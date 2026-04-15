import { promisify } from 'node:util'
import { execFile as execFileCb } from 'node:child_process'

type Json = Record<string, unknown>

const DEFAULT_RPC_PATHS = ['/rpc', '/api/rpc']
const execFile = promisify(execFileCb)

export class OpenClawGatewayError extends Error {
  status: number
  detail?: unknown

  constructor(message: string, status = 500, detail?: unknown) {
    super(message)
    this.name = 'OpenClawGatewayError'
    this.status = status
    this.detail = detail
  }
}

function getBaseUrl(): string | null {
  const base = process.env.OPENCLAW_GATEWAY_URL?.trim()
  return base ? base.replace(/\/+$/, '') : null
}

function getRpcPaths(): string[] {
  const raw = process.env.OPENCLAW_GATEWAY_RPC_PATHS?.trim()
  if (!raw) return DEFAULT_RPC_PATHS
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => (v.startsWith('/') ? v : `/${v}`))
}

function headers(): HeadersInit {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function sanitizeGatewayError(err: unknown): string {
  if (!err) return 'Unknown gateway error'
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Gateway request failed'
}

async function postRpc(url: string, method: string, params: Json, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ jsonrpc: '2.0', id: `zc-${Date.now()}`, method, params }),
      signal: controller.signal,
      cache: 'no-store',
    })

    const text = await res.text()
    const parsed = text ? safeJson(text) : null

    if (!res.ok) {
      throw new OpenClawGatewayError(
        `Gateway returned ${res.status}${parsed ? `: ${extractErrorMessage(parsed)}` : ''}`,
        502,
        parsed ?? text,
      )
    }

    if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
      throw new OpenClawGatewayError(`Gateway RPC error: ${extractErrorMessage(parsed.error)}`, 502, parsed)
    }

    if (parsed && typeof parsed === 'object' && 'result' in parsed) {
      return (parsed as { result: unknown }).result
    }

    return parsed
  } catch (err: unknown) {
    if (err instanceof OpenClawGatewayError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new OpenClawGatewayError('Gateway timeout', 504)
    }
    throw new OpenClawGatewayError(sanitizeGatewayError(err), 502)
  } finally {
    clearTimeout(timer)
  }
}

async function callViaCli(method: string, params: Json, timeoutMs: number): Promise<unknown> {
  const args = ['gateway', 'call', method, '--params', JSON.stringify(params), '--json', '--timeout', String(timeoutMs)]
  // Strip gateway URL/token env vars so CLI uses local loopback config (not the HTTP env target).
  // The gateway token in .env may not match the running gateway's auth token.
  // Inject required OPENCLAW shell marker vars so the CLI can authenticate via loopback.
  const cliEnv = { ...process.env }
  delete cliEnv.OPENCLAW_GATEWAY_URL
  delete cliEnv.OPENCLAW_GATEWAY_TOKEN
  // Ensure CLI bootstrap vars are present (they may be missing if Next.js was started outside of openclaw shell)
  cliEnv.OPENCLAW_CLI = cliEnv.OPENCLAW_CLI ?? '1'
  cliEnv.OPENCLAW_SHELL = cliEnv.OPENCLAW_SHELL ?? 'exec'
  cliEnv.OPENCLAW_PATH_BOOTSTRAPPED = cliEnv.OPENCLAW_PATH_BOOTSTRAPPED ?? '1'
  try {
    const { stdout } = await execFile('openclaw', args, {
      timeout: timeoutMs + 1000,
      maxBuffer: 5 * 1024 * 1024,
      env: cliEnv,
      // Run from HOME to prevent the CLI from auto-loading the project's .env file
      // (which contains OPENCLAW_GATEWAY_URL/TOKEN that conflict with loopback auth)
      cwd: cliEnv.HOME ?? process.env.HOME ?? '/',
    })
    const parsed = safeJson(stdout.trim())
    return parsed
  } catch (err: unknown) {
    const msg = sanitizeGatewayError(err)
    throw new OpenClawGatewayError(`CLI gateway call failed: ${msg}`, 502)
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function extractErrorMessage(payload: unknown): string {
  if (!payload) return 'Unknown error'
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
  }
  return 'Unknown error'
}

export async function callGatewayMethod(method: string, params: Json, timeoutMs = 15000): Promise<unknown> {
  const base = getBaseUrl()
  const errors: string[] = []

  if (base) {
    const paths = getRpcPaths()
    for (const path of paths) {
      const url = `${base}${path}`
      try {
        return await postRpc(url, method, params, timeoutMs)
      } catch (err) {
        errors.push(`${path}: ${sanitizeGatewayError(err)}`)
      }
    }
  } else {
    errors.push('OPENCLAW_GATEWAY_URL missing')
  }

  // Fallback: use local openclaw CLI gateway call, which uses configured gateway auth/session
  try {
    return await callViaCli(method, params, timeoutMs)
  } catch (err) {
    errors.push(sanitizeGatewayError(err))
  }

  throw new OpenClawGatewayError(`RPC call failed (${errors.join(' | ')})`, 502)
}

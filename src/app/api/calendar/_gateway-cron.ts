import { OpenClawGatewayError, callGatewayMethod } from '@/lib/openclaw-gateway'

type JsonRecord = Record<string, unknown>

export type CandidateCall = {
  method: string
  params: JsonRecord
}

export type CandidateCallResult = {
  ok: boolean
  method?: string
  result?: unknown
  warnings: string[]
  error?: string
}

function errorMessage(err: unknown): string {
  if (err instanceof OpenClawGatewayError) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Unknown gateway error'
}

export async function callMethodCandidates(candidates: CandidateCall[], timeoutMs = 15_000): Promise<CandidateCallResult> {
  const warnings: string[] = []

  for (const candidate of candidates) {
    try {
      const result = await callGatewayMethod(candidate.method, candidate.params, timeoutMs)
      return {
        ok: true,
        method: candidate.method,
        result,
        warnings,
      }
    } catch (err: unknown) {
      warnings.push(`${candidate.method}: ${errorMessage(err)}`)
    }
  }

  return {
    ok: false,
    warnings,
    error: 'No compatible gateway method succeeded for this action.',
  }
}

export function sanitizeText(input: unknown, maxLen: number): string {
  const value = String(input ?? '').replace(/\s+/g, ' ').trim()
  return value.slice(0, maxLen)
}

export function parseFutureDate(input: unknown): Date | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  if (date.getTime() < Date.now() - 30_000) return null
  return date
}

export function isLikelyCronExpression(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const parts = trimmed.split(/\s+/)
  return parts.length >= 5 && parts.length <= 6
}

import { callGatewayMethod } from '@/lib/openclaw-gateway'

type UnknownRecord = Record<string, unknown>

export type OfficeMember = {
  id: string
  name: string
  role: string
  workstation: string
  avatar: string
  source: 'live' | 'mock' | 'static'
  status: string
  statusDetail?: string
  currentTask?: string
  currentCommand?: string   // last tool call (exec command, file path, etc.)
  runningFrom?: string
  progressPercent?: number
  progressLabel?: string
  tokenStats?: {
    input: number
    output: number
    total: number
    remaining: number
    percentUsed: number
    model: string
  }
  details: string
  configuredModel?: string
  live?: {
    sessionId: string
    runtime?: string
    model?: string
    parentSessionId?: string
    isMain: boolean
    sourceMethod?: string
    updatedAt?: string
    startedAt?: string
    uptimeMs?: number
    uptimeHuman?: string
    rawKey?: string
    agentId?: string
  }
  ops: {
    canRefresh: boolean
    canStop: boolean
    stopGuard: string | null
  }
}

export type DigitalOfficeSnapshot = {
  members: OfficeMember[]
  degraded: boolean
  reason?: string
  meta: {
    sessionMethodsTried: string[]
    subagentMethodsTried: string[]
    methodErrors: string[]
    fetchedAt: string
  }
}

type SessionLike = {
  id: string
  label?: string
  state?: string
  stateDetail?: string
  model?: string
  updatedAt?: string
  startedAt?: string
  runtime?: string
  parentSessionId?: string
  isMain?: boolean
  sourceMethod?: string
  raw?: UnknownRecord
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  remainingTokens?: number
  percentUsed?: number
  abortedLastRun?: boolean
}


const avatars = ['🐶', '🧠', '💻', '📝', '🎨', '🛠️', '🔎']
const SESSION_LIST_METHODS = ['sessions.list', 'status']

function asArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter((v): v is UnknownRecord => !!v && typeof v === 'object')
  return []
}

function pickList(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return asArray(payload)
  if (!payload || typeof payload !== 'object') return []

  const obj = payload as UnknownRecord

  // Handle `status` response shape: { sessions: { recent: [...], byAgent: [...] } }
  if (obj.sessions && typeof obj.sessions === 'object' && !Array.isArray(obj.sessions)) {
    const sessionsObj = obj.sessions as UnknownRecord
    const recent = asArray(sessionsObj.recent)
    if (recent.length > 0) return recent
  }

  const candidates = [obj.sessions, obj.items, obj.results, obj.data]
  for (const candidate of candidates) {
    const list = asArray(candidate)
    if (list.length > 0) return list
  }
  return []
}

function pickString(item: UnknownRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function parseDateString(value?: string): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${sec}s`
  return `${sec}s`
}

function parseSessionItem(item: UnknownRecord, idx: number, sourceMethod: string): SessionLike {
  const runtime =
    typeof item.runtime === 'string' ? item.runtime : typeof item.type === 'string' ? item.type : undefined

  // Handle `status` response shape: key is like "agent:main:telegram:direct:..."
  // flags may include 'system' for main sessions
  const key = typeof item.key === 'string' ? item.key : ''
  const flags = Array.isArray(item.flags) ? (item.flags as string[]) : []
  // A session is "main" only if it's the top-level agent session (not subagent, cron run, etc.)
  // Key format: agent:<agentId>:<channel>:<type>:<id>
  // Subagent keys contain ':subagent:', cron keys contain ':cron:'
  const isSubagent = key.includes(':subagent:')
  const isCron = key.includes(':cron:')
  const isMain =
    item.isMain === true ||
    item.is_main === true ||
    flags.includes('system') ||
    (!isSubagent && !isCron && key === 'agent:main:main') ||
    (typeof item.role === 'string' && item.role.toLowerCase() === 'main')

  // updatedAt/startedAt can be string OR number (epoch ms)
  const rawUpdatedAt = item.updatedAt ?? item.updated_at ?? item.lastUpdateAt ?? item.last_update_at
  const updatedAt = typeof rawUpdatedAt === 'number'
    ? new Date(rawUpdatedAt).toISOString()
    : pickString(item, 'updatedAt', 'updated_at', 'lastUpdateAt', 'last_update_at')
  const rawStartedAt = item.startedAt ?? item.started_at ?? item.createdAt ?? item.created_at
  const startedAt = typeof rawStartedAt === 'number'
    ? new Date(rawStartedAt).toISOString()
    : pickString(item, 'startedAt', 'started_at', 'createdAt', 'created_at')
  const state = pickString(item, 'state', 'status')
  const stateDetail = pickString(item, 'statusDetail', 'status_detail', 'detail')

  // Derive a human-readable label from the session key when no explicit label is set.
  // Strategy: take the last 2 meaningful segments (skip UUIDs) from the key.
  // Example: "agent:main:cron:xyz:run:abc" → "run-abc"
  // Example: "agent:main:subagent:4fc70ca6-8a4e" → "subagent-4fc70ca6"
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const keyParts = key.split(':')
  let derivedLabel: string | undefined
  if (key) {
    // Filter out pure UUIDs, keep the rest
    const meaningful = keyParts.filter(p => p.length > 0 && !UUID_RE.test(p))
    if (meaningful.length >= 2) {
      // Use last 2 meaningful parts, but truncate any UUID-prefix (first 8 chars) if present
      const last2 = meaningful.slice(-2).map(p => (p.length > 12 ? p.slice(0, 8) : p))
      derivedLabel = last2.join('-')
    } else if (meaningful.length === 1) {
      derivedLabel = meaningful[0]
    } else {
      // Fall back to last 2 raw parts if all were UUIDs
      derivedLabel = keyParts.slice(-2).map(p => p.slice(0, 8)).join('-')
    }
  }

  return {
    id: String(item.sessionId ?? item.session_id ?? item.id ?? `session-${idx}`),
    label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : derivedLabel,
    state,
    stateDetail,
    model: typeof item.model === 'string' ? item.model : undefined,
    updatedAt,
    startedAt,
    runtime,
    // Token stats from gateway
    inputTokens: typeof item.inputTokens === 'number' ? item.inputTokens : undefined,
    outputTokens: typeof item.outputTokens === 'number' ? item.outputTokens : undefined,
    totalTokens: typeof item.totalTokens === 'number' ? item.totalTokens : undefined,
    remainingTokens: typeof item.remainingTokens === 'number' ? item.remainingTokens : undefined,
    percentUsed: typeof item.percentUsed === 'number' ? item.percentUsed : undefined,
    abortedLastRun: item.abortedLastRun === true,
    parentSessionId:
      typeof item.parentSessionId === 'string'
        ? item.parentSessionId
        : typeof item.parent_session_id === 'string'
          ? item.parent_session_id
          : undefined,
    isMain,
    sourceMethod,
    raw: item,
  }
}


async function callCandidates(methods: string[], params: UnknownRecord, timeoutMs: number): Promise<{ method?: string; payload?: unknown; errors: string[] }> {
  const errors: string[] = []

  for (const method of methods) {
    try {
      const payload = await callGatewayMethod(method, params, timeoutMs)
      return { method, payload, errors }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      errors.push(`${method}: ${message}`)
    }
  }

  return { errors }
}


export function inferWorkerGuard(session: Pick<SessionLike, 'label' | 'runtime' | 'parentSessionId' | 'id' | 'isMain'>): { canStop: boolean; reason: string | null } {
  const label = (session.label || '').toLowerCase()
  const runtime = (session.runtime || '').toLowerCase()

  if (session.isMain) return { canStop: false, reason: 'main session is protected' }
  if (!session.id) return { canStop: false, reason: 'missing session id' }

  const looksWorker =
    Boolean(session.parentSessionId) ||
    runtime === 'subagent' ||
    runtime.includes('worker') ||
    label.startsWith('panel-') ||
    label.includes('worker')

  if (!looksWorker) {
    return { canStop: false, reason: 'only worker/subagent sessions are stoppable' }
  }

  return { canStop: true, reason: null }
}

// ── Agent name derivation ────────────────────────────────────────────────────

// Map topic IDs to readable names (from MEMORY.md)
const TOPIC_NAMES: Record<string, string> = {
  '1': 'General',
  '16': 'Research',
  '17': 'Content',
  '18': 'Dev/Coding',
  '19': 'Ops',
  '20': 'Marketing',
  '553': 'Briefing',
}

// Content agent group topic → specialist role mapping
const CONTENT_TOPIC_ROLES: Record<string, { emoji: string; label: string }> = {
  '1':  { emoji: '🎬', label: 'Content Manager' },
  '24': { emoji: '🔍', label: 'Researcher' },
  '25': { emoji: '🎬', label: 'Video Editor' },
  '26': { emoji: '📝', label: 'Script Writer' },
  '27': { emoji: '📊', label: 'Analytics' },
  '28': { emoji: '🎨', label: 'Image Generator' },
}

function deriveAgentName(session: SessionLike): string {
  const rawKey = typeof session.raw?.key === 'string' ? session.raw.key : ''

  // SUBAGENTS — use label, capitalize and format nicely
  if (rawKey.includes(':subagent:')) {
    if (session.label) {
      const cleanLabel = session.label
        .replace(/-\d+$/, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      return cleanLabel
    }
    return 'Subagent'
  }

  // COMMUNITY AGENT
  if (rawKey.includes('agent:community:')) {
    if (rawKey.includes('telegram:direct')) return 'Community Bot DM'
    if (rawKey.includes('telegram:group')) return 'Community Bot Group'
    return 'Community Bot'
  }

  // CUSTOM AGENTS (auto-detected from session key)
  if (rawKey.includes('agent:')) {
    const agentMatch = rawKey.match(/^agent:([^:]+):/)
    const agentId = agentMatch ? agentMatch[1] : 'agent'
    if (rawKey.includes('telegram:direct')) return `${agentId} DM`
    if (rawKey.includes('telegram:group')) return `${agentId} — Group`
    if (rawKey.includes('discord:')) return `${agentId} — Discord`
    return agentId
  }

  // ACP CODING AGENTS
  if (rawKey.includes('agent:claude:')) return 'Claude Code'
  if (rawKey.includes('agent:codex:')) return 'Codex'
  if (rawKey.includes('agent:gemini:')) return 'Gemini'

  // MAIN AGENT — Telegram DM
  if (rawKey.includes('telegram:direct')) {
    return 'Main TG DM'
  }
  // MAIN AGENT — Telegram Group Topic
  if (rawKey.includes('telegram:group')) {
    const keyParts = rawKey.split(':')
    const topicIdx = keyParts.indexOf('topic')
    if (topicIdx !== -1 && keyParts[topicIdx + 1]) {
      const topicId = keyParts[topicIdx + 1]
      const topicName = TOPIC_NAMES[topicId] || `Topic ${topicId}`
      return `Main TG ${topicName}`
    }
    return 'Main TG Group'
  }
  // MAIN AGENT — Discord
  if (rawKey.includes('discord:direct')) return 'Main Discord DM'
  if (rawKey.includes('discord:guild') || rawKey.includes('discord:channel')) {
    const keyParts = rawKey.split(':')
    const channelIdx = keyParts.indexOf('channel')
    if (channelIdx !== -1 && keyParts[channelIdx + 1]) {
      return `Main Discord #${keyParts[channelIdx + 1].slice(0, 6)}`
    }
    return 'Main Discord'
  }
  if (rawKey.includes('discord:')) return 'Main Discord'
  // MAIN AGENT — other channels
  if (rawKey.includes('whatsapp:')) return 'BOB WhatsApp'
  if (rawKey.includes('signal:')) return 'BOB Signal'
  if (rawKey.includes('slack:')) return 'BOB Slack'
  // SUBAGENT — check before isMain fallback (gateway may incorrectly flag done subagents as isMain)
  if (rawKey.includes(':subagent:')) {
    const label = session.label || ''
    if (label) {
      // Clean trailing numbers: "dev-example-scroll-13" → "dev-example-scroll"
      const cleanLabel = label.replace(/-\d+$/, '')
      // Convert kebab-case to Title Case
      // Common abbreviations stay uppercase
      const UPPER_WORDS = ['ui', 'api', 'db', 'ts', 'ux', 'css', 'pos', 'opus', 'tg', 'dm']
      return cleanLabel
        .split('-')
        .map((word: string) => {
          if (UPPER_WORDS.includes(word.toLowerCase())) return word.toUpperCase()
          return word.charAt(0).toUpperCase() + word.slice(1)
        })
        .join(' ')
    }
    return 'Subagent'
  }

  // Fallback main (after subagent check)
  if (session.isMain) {
    return 'BOB Main'
  }

  return 'Unknown Agent'
}

function deriveRunningFromKey(session: SessionLike): string {
  const rawKey = typeof session.raw?.key === 'string' ? session.raw.key : ''
  const agentMatch = rawKey.match(/^agent:([^:]+):/)
  const agentId = agentMatch ? agentMatch[1] : 'main'
  const AGENT_LABELS: Record<string, string> = { main: 'MAIN', community: 'COMMUNITY' }
  const agentLabel = AGENT_LABELS[agentId] ?? agentId.toUpperCase()

  if (rawKey.includes('telegram:direct')) return `${agentLabel} TG DM`
  if (rawKey.includes('telegram:group')) {
    const parts = rawKey.split(':')
    const topicIdx = parts.indexOf('topic')
    if (topicIdx !== -1 && parts[topicIdx + 1]) {
      return `${agentLabel} TG GROUP ${parts[topicIdx + 1].toUpperCase()}`
    }
    return `${agentLabel} TG GROUP`
  }
  if (rawKey.includes('discord:direct')) return `${agentLabel} DISCORD DM`
  if (rawKey.includes('discord:')) return `${agentLabel} DISCORD`
  if (rawKey.includes('whatsapp:')) return `${agentLabel} WHATSAPP`
  if (rawKey.includes('signal:')) return `${agentLabel} SIGNAL`
  if (rawKey.includes('slack:')) return `${agentLabel} SLACK`
  if (rawKey.includes(':subagent:')) {
    // For subagents, try to show the parent topic/session they were spawned from
    if (session.parentSessionId) {
      const parentMatch = session.parentSessionId.match(/:topic:(\d+)/)
      if (parentMatch) {
        return `${agentLabel} TOPIC ${parentMatch[1]}`
      }
      return `${agentLabel} SUBAGENT`
    }
    return `${agentLabel} SUBAGENT`
  }
  if (session.isMain) return `${agentLabel} SESSION`
  return `${agentLabel} SESSION`
}

function toMembersFromSessions(sessions: SessionLike[]): OfficeMember[] {
  const now = Date.now()

  // Sort: main sessions first (by key stability), then subagents immediately after their parent
  const sorted = (() => {
    const mains = sessions.filter(s => s.isMain)
    const subs = sessions.filter(s => !s.isMain)

    const result: typeof sessions = []
    for (const main of mains) {
      result.push(main)
      // Insert any subagents whose parentSessionId matches this main session's id OR raw key
      const mainRawKey = typeof main.raw?.key === 'string' ? main.raw.key : ''
      const children = subs.filter(s =>
        s.parentSessionId === main.id ||
        s.parentSessionId === mainRawKey
      )
      result.push(...children)
    }
    // Any remaining subs without a matched parent go at the end
    const placed = new Set(result.map(s => s.id))
    for (const sub of subs) {
      if (!placed.has(sub.id)) result.push(sub)
    }
    return result
  })()

  return sorted.slice(0, 12).map((session, i) => {
    const worker = inferWorkerGuard(session)
    const isWorker = worker.canStop
    // Determine role from session key if available (status API response shape)
    const rawKey = typeof session.raw?.key === 'string' ? session.raw.key : ''
    const roleFromKey = rawKey.includes(':subagent:')
      ? 'Subagent Session'
      : rawKey.includes(':cron:')
        ? 'Cron Session'
        : null
    const role = session.isMain ? 'Main Session' : roleFromKey ?? (isWorker ? 'Worker Session' : 'Agent Session')
    const startedMs = parseDateString(session.startedAt)
    const uptimeMs = startedMs ? Math.max(0, now - startedMs) : undefined
    const uptimeHuman = typeof uptimeMs === 'number' ? formatDuration(uptimeMs) : undefined

    const detailBits = [`sessionId=${session.id}`]
    if (session.updatedAt) detailBits.push(`last update ${session.updatedAt}`)
    if (session.startedAt) detailBits.push(`started ${session.startedAt}`)
    if (session.parentSessionId) detailBits.push(`parent ${session.parentSessionId}`)

    // Determine actual status from state + recent activity
    // If updatedAt is within last 60 seconds, session is actively working
    const updatedMs = parseDateString(session.updatedAt)
    const recentlyActive = updatedMs ? (now - updatedMs) < 60_000 : false
    // If state is explicitly set, use it; otherwise infer from activity
    let status: string
    if (session.state && session.state !== 'running') {
      status = session.state
    } else if (session.isMain) {
      // Main session: 'working' if updated in last 60s, else 'idle'
      status = recentlyActive ? 'working' : 'idle'
    } else {
      // Subagent: 'working' if running and recently active, else 'running'
      status = recentlyActive ? 'working' : (session.state || 'running')
    }

    // Use the new deriveAgentName function for proper naming
    const name = deriveAgentName(session)

    const progressInfo = deriveProgressInfo(session, uptimeMs)
    const tokenStats = session.totalTokens ? {
      input: session.inputTokens || 0,
      output: session.outputTokens || 0,
      total: session.totalTokens,
      remaining: session.remainingTokens || 0,
      percentUsed: session.percentUsed || 0,
      model: session.model || 'unknown',
    } : undefined

    return {
      id: session.id,
      name,
      role,
      workstation: `Runtime • ${session.model || session.runtime || 'default-model'}`,
      avatar: session.isMain ? '🐶' : rawKey.includes('agent:community:') ? '🤖' : avatars[i % avatars.length],
      source: 'live',
      status,
      statusDetail: session.stateDetail,
      currentTask: session.stateDetail || undefined,
      runningFrom: deriveRunningFromKey(session),
      progressPercent: progressInfo.percent,
      progressLabel: progressInfo.label,
      tokenStats,
      details: detailBits.join(' • '),
      live: {
        sessionId: session.id,
        runtime: session.runtime,
        model: session.model,
        parentSessionId: session.parentSessionId,
        isMain: Boolean(session.isMain),
        sourceMethod: session.sourceMethod,
        updatedAt: session.updatedAt,
        startedAt: session.startedAt,
        uptimeMs,
        uptimeHuman,
        rawKey: typeof session.raw?.key === 'string' ? session.raw.key : undefined,
        agentId: (() => {
          const rk = typeof session.raw?.key === 'string' ? session.raw.key : ''
          const m = rk.match(/^agent:([^:]+):/)
          return m ? m[1] : 'main'
        })(),
      },
      ops: {
        canRefresh: true,
        canStop: worker.canStop,
        stopGuard: worker.reason,
      },
    }
  })
}

// ── Agent Registry (auto-discovered) ─────────────────────────────────────────
// Every subdirectory of ~/.openclaw/agents/ becomes a registered agent so it
// always shows in the office grid even when offline. The author's personal
// agents are no longer hardcoded here — that was a pre-publish bug where
// "Community Bot" and "Claude Code" appeared on every student's dashboard.

import { discoverInstalledAgents, type AgentInfo } from './agent-discovery'

function buildStaticMember(agent: AgentInfo): OfficeMember {
  return {
    id: `static:${agent.id}`,
    name: agent.label,
    role: agent.id === 'main' ? 'Orchestrator' : 'Agent',
    workstation: agent.id === 'main' ? 'Main HQ' : `${agent.label} Desk`,
    avatar: agent.emoji,
    source: 'static',
    status: 'offline',
    details: 'static registry',
    live: {
      sessionId: '',
      agentId: agent.id,
      rawKey: `agent:${agent.id}:main`,
      isMain: true,
    },
    ops: { canRefresh: true, canStop: false, stopGuard: 'static profile' },
  }
}

// Derive activity text from session data (tokens, state, label)
function deriveActivityText(session: SessionLike, isActive: boolean): string | undefined {
  if (session.stateDetail) return session.stateDetail
  const state = (session.state || '').toLowerCase()
  if (state === 'thinking') return 'Thinking...'
  if (state === 'generating') return 'Generating...'
  if (state === 'tool_use' || state === 'tool-use') return 'Using tools...'
  if (state === 'streaming') return 'Responding...'

  // Show real token activity
  if (isActive && session.outputTokens && session.outputTokens > 0) {
    const outK = (session.outputTokens / 1000).toFixed(1)
    const inK = (session.inputTokens ? session.inputTokens / 1000 : 0).toFixed(1)
    return `↑${outK}k ↓${inK}k tokens`
  }

  if (isActive) {
    if (session.label) {
      const cleanLabel = (session.label || '').replace(/-\d+$/, '').split('-').join(' ')
      return cleanLabel
    }
    return 'Active'
  }
  return undefined
}

// Calculate progress from real gateway data
function deriveProgressInfo(session: SessionLike, _uptimeMs?: number): { percent: number; label: string } {
  const state = (session.state || '').toLowerCase()
  if (state === 'complete' || state === 'done') return { percent: 100, label: 'Complete ✓' }
  if (state === 'error' || state === 'aborted') return { percent: 0, label: 'Error ✗' }

  // Use real percentUsed from gateway (context window usage)
  if (typeof session.percentUsed === 'number') {
    const pct = session.percentUsed
    if (session.isMain) {
      return { percent: pct, label: `${pct}% context used` }
    }
    // Subagents: percentUsed = how much of context window is used
    return { percent: Math.min(95, pct), label: `${pct}% context` }
  }

  // Fallback: use output tokens as rough progress
  if (session.outputTokens && session.outputTokens > 0) {
    // Rough: assume ~10k output tokens = complete task
    const pct = Math.min(95, Math.round((session.outputTokens / 10000) * 100))
    const outK = (session.outputTokens / 1000).toFixed(1)
    return { percent: pct, label: `${outK}k tokens out` }
  }

  if (session.isMain) return { percent: 0, label: 'Ready' }
  // Subagent with no token data yet — it's running, not queued
  const subState = (session.state || '').toLowerCase()
  if (subState === 'running' || subState === '') return { percent: 0, label: 'Running...' }
  return { percent: 0, label: 'Queued' }
}

interface SubagentRunInfo {
  controllerKey: string
  label?: string
}

// Load subagent runs.json to enrich parentSessionId + label
function loadSubagentRuns(): Map<string, SubagentRunInfo> {
  // Returns map: childSessionKey → { controllerKey, label }
  // OpenClaw stores labels in agent's sessions.json files
  const map = new Map<string, SubagentRunInfo>()
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    
    const agentDirs = ['main', 'community']
    for (const agentId of agentDirs) {
      const sessionsPath = path.join(process.env.HOME ?? '', '.openclaw', 'agents', agentId, 'sessions', 'sessions.json')
      try {
        const raw = fs.readFileSync(sessionsPath, 'utf8')
        const sessions = JSON.parse(raw)
        for (const [sessionKey, sessionData] of Object.entries(sessions) as [string, Record<string, unknown>][]) {
          if (sessionKey.includes(':subagent:')) {
            const label = sessionData.label as string | undefined
            // Use spawnedBy as the controllerKey (OpenClaw stores parent as spawnedBy)
            const controllerKey = (sessionData.spawnedBy as string | undefined) || ''
            map.set(sessionKey, { controllerKey, label })
          }
        }
      } catch {
        // Agent dir or sessions.json doesn't exist yet, skip
      }
    }
    return map
  } catch {
    return new Map()
  }
}

// Read last tool call from a session transcript
function getLastToolCall(sessionId: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path')
    // Determine which agent's sessions dir to look in based on sessionId prefix
    const agentId = sessionId.startsWith('agent:community:') ? 'community' : 'main'
    const sessionsDir = path.join(process.env.HOME ?? '', '.openclaw', 'agents', agentId, 'sessions')

    // Try exact sessionId first, then glob for topic variants
    const candidates = [
      path.join(sessionsDir, `${sessionId}.jsonl`),
    ]
    // Also check for topic files like sessionId-topic-NNN.jsonl
    try {
      const files = fs.readdirSync(sessionsDir) as string[]
      files.forEach((f: string) => {
        if (f.startsWith(sessionId) && f.endsWith('.jsonl')) {
          candidates.push(path.join(sessionsDir, f))
        }
      })
    } catch { /* ignore */ }

    let latestToolCall: string | undefined
    let latestTs = 0

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue
      const raw: string = fs.readFileSync(filePath, 'utf8')
      const lines = raw.trim().split('\n').filter(Boolean)

      // Read last 80 lines only (performance)
      const tail = lines.slice(-80)
      for (const line of tail) {
        try {
          const entry = JSON.parse(line)
          const msg = entry?.message
          if (!msg) continue
          const ts = new Date(entry.timestamp ?? 0).getTime()
          if (ts < latestTs) continue

          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'toolCall') {
                const toolName: string = block.name ?? ''
                const args = block.arguments ?? {}
                let label = ''

                if (toolName === 'exec') {
                  const cmd: string = args.command ?? ''
                  // Trim to first line, max 48 chars
                  label = cmd.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 48)
                } else if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
                  const p: string = args.file_path ?? args.path ?? ''
                  label = `${toolName} ${p.split('/').slice(-2).join('/')}`
                } else if (toolName === 'web_search') {
                  label = `search: ${(args.query ?? '').toString().slice(0, 40)}`
                } else if (toolName === 'browser') {
                  label = `browser: ${args.action ?? ''} ${args.url ?? args.element ?? ''}`.trim().slice(0, 48)
                } else if (toolName === 'sessions_spawn') {
                  label = `spawn: ${args.label ?? 'subagent'}`
                } else {
                  label = toolName.slice(0, 48)
                }

                if (label) {
                  latestToolCall = label
                  latestTs = ts
                }
              }
            }
          }
        } catch { /* skip malformed line */ }
      }
    }

    // Only return if recent (within last 90 seconds)
    if (latestToolCall && latestTs > Date.now() - 90_000) {
      return latestToolCall
    }
    return undefined
  } catch {
    return undefined
  }
}

export async function getDigitalOfficeSnapshot(): Promise<DigitalOfficeSnapshot> {
  const sessionCall = await callCandidates(SESSION_LIST_METHODS, { limit: 30 }, 10_000)

  const allSessions = sessionCall.method ? pickList(sessionCall.payload).map((item, idx) => parseSessionItem(item, idx, sessionCall.method as string)) : []
  
  // Enrich subagents with parentSessionId + label from runs.json
  const subagentRuns = loadSubagentRuns()
  if (subagentRuns.size > 0) {
    allSessions.forEach(session => {
      const rawKey = typeof session.raw?.key === 'string' ? session.raw.key : ''
      if (rawKey.includes(':subagent:')) {
        const runInfo = subagentRuns.get(rawKey)
        if (runInfo) {
          // Inject label if missing
          if (runInfo.label) {
            session.label = runInfo.label  // Always override — gateway never provides it
          }
          // Inject parentSessionId if missing
          if (!session.parentSessionId) {
            const parentSession = allSessions.find(s => {
              const sk = typeof s.raw?.key === 'string' ? s.raw.key : ''
              return sk === runInfo.controllerKey
            })
            session.parentSessionId = parentSession ? parentSession.id : runInfo.controllerKey
          }
        }
      }
    })
  }

  // Filter: Show all named agents (main, community, custom, etc.) + subagents (exclude cron jobs, slash sessions, and completed subagents)
  const sessions = allSessions.filter(session => {
    const rawKey = typeof session.raw?.key === 'string' ? session.raw.key : ''
    const isCron = rawKey.includes(':cron:')
    const isSlash = rawKey.includes(':slash:')
    const isMainAgent = rawKey === 'agent:main:main' ||
                        rawKey.startsWith('agent:main:telegram:') ||
                        rawKey.startsWith('agent:main:discord:') ||
                        rawKey.startsWith('agent:main:whatsapp:') ||
                        rawKey.startsWith('agent:main:signal:') ||
                        rawKey.startsWith('agent:main:slack:') ||
                        rawKey.startsWith('agent:main:irc:')
    const isCommunityAgent = rawKey.includes('agent:community:')
    const isClaudeAgent = rawKey.includes('agent:claude:')
    const isCodexAgent = rawKey.includes('agent:codex:')
    const isGeminiAgent = rawKey.includes('agent:gemini:')
    const isSubagent = rawKey.includes(':subagent:')
    const isCustomAgent = rawKey.includes('agent:') && !isMainAgent && !isCommunityAgent && !isClaudeAgent && !isCodexAgent && !isGeminiAgent

    // Filter out completed subagents
    if (isSubagent) {
      const state = (session.state || '').toLowerCase()
      const isDead = ['complete', 'done', 'stopped', 'killed', 'error', 'aborted'].includes(state)
      if (isDead) return false
    }

    // Filter out dead/stale Claude ACP sessions
    if (isClaudeAgent && !isSubagent) {
      const state = (session.state || '').toLowerCase()
      if (['done', 'completed', 'stopped'].includes(state)) return false
    }

    return (isMainAgent || isCommunityAgent || isCustomAgent || isClaudeAgent || isCodexAgent || isGeminiAgent || isSubagent) && !isCron && !isSlash
  })

  // Limit Claude Code sessions to max 2 most recent
  const claudeSessions = sessions.filter(s => {
    const rk = typeof s.raw?.key === 'string' ? s.raw.key : ''
    return rk.includes('agent:claude:') && !rk.includes(':subagent:')
  })
  if (claudeSessions.length > 2) {
    // Sort by updatedAt desc, keep top 2
    claudeSessions.sort((a, b) => {
      const ta = parseDateString(a.updatedAt) ?? 0
      const tb = parseDateString(b.updatedAt) ?? 0
      return tb - ta
    })
    const dropIds = new Set(claudeSessions.slice(2).map(s => s.id))
    const filteredIdx: number[] = []
    sessions.forEach((s, i) => { if (dropIds.has(s.id)) filteredIdx.push(i) })
    for (let i = filteredIdx.length - 1; i >= 0; i--) sessions.splice(filteredIdx[i], 1)
  }

  const methodErrors = [...sessionCall.errors]

  // Build members from live sessions
  const liveMembers = sessions.length > 0 ? toMembersFromSessions(sessions) : []

  // Derive activity text + last tool call for live members
  const now = Date.now()
  sessions.forEach((session, idx) => {
    if (!liveMembers[idx]) return
    const updatedMs = parseDateString(session.updatedAt)
    const isActive = updatedMs ? (now - updatedMs) < 60_000 : false
    const activity = deriveActivityText(session, isActive)
    if (activity) {
      liveMembers[idx].currentTask = activity
    }
    if (isActive && liveMembers[idx].status === 'working') {
      const sessionId = session.id
      if (sessionId) {
        const lastCmd = getLastToolCall(sessionId)
        if (lastCmd) {
          liveMembers[idx].currentCommand = lastCmd
        }
      }
    }
  })

  // Merge live members with static registry:
  // For each static agent, use live data if available, otherwise use static default
  const liveByAgentId = new Map<string, OfficeMember[]>()
  for (const m of liveMembers) {
    const aid = m.live?.agentId ?? 'main'
    if (!liveByAgentId.has(aid)) liveByAgentId.set(aid, [])
    liveByAgentId.get(aid)!.push(m)
  }

  const members: OfficeMember[] = []
  const installedAgents = await discoverInstalledAgents()
  for (const agent of installedAgents) {
    const liveSessions = liveByAgentId.get(agent.id)
    if (liveSessions && liveSessions.length > 0) {
      for (const lm of liveSessions) {
        if (lm.live?.isMain && (!lm.workstation || lm.workstation.startsWith('Runtime'))) {
          lm.workstation = agent.id === 'main' ? 'Main HQ' : `${agent.label} Desk`
        }
        members.push(lm)
      }
      liveByAgentId.delete(agent.id)
    } else {
      // No live session — show the agent as offline placeholder so the desk
      // is visible (matches "always appears" UX while no longer hardcoding identities).
      members.push(buildStaticMember(agent))
    }
  }

  // Append any remaining live sessions not in the discovered agent registry
  // (e.g. ephemeral cli sessions, codex/gemini one-shots).
  for (const [, liveSessions] of liveByAgentId) {
    members.push(...liveSessions)
  }

  // Degraded only when gateway RPC failed, not when agents are simply offline
  const degraded = methodErrors.length > 0

  return {
    members,
    degraded,
    reason: degraded ? `Live metadata unavailable (${methodErrors[0]})` : undefined,
    meta: {
      sessionMethodsTried: SESSION_LIST_METHODS,
      subagentMethodsTried: [],
      methodErrors,
      fetchedAt: new Date().toISOString(),
    },
  }
}

export async function stopWorkerSession(sessionId: string): Promise<{ ok: boolean; usedMethod?: string; errors: string[] }> {
  const methods = ['sessions_stop', 'sessions_kill', 'session_stop', 'session_kill']
  const errors: string[] = []

  for (const method of methods) {
    try {
      await callGatewayMethod(method, { sessionId }, 10_000)
      return { ok: true, usedMethod: method, errors }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      errors.push(`${method}: ${message}`)
    }
  }

  return { ok: false, errors }
}

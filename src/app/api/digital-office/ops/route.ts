import { NextRequest, NextResponse } from 'next/server'
import { getDigitalOfficeSnapshot, stopWorkerSession } from '@/lib/digital-office-live'

export const runtime = 'nodejs'

type Body = {
  action?: 'refresh' | 'stop' | 'stop-bulk' | 'cleanup-idle'
  memberId?: string
  memberIds?: string[]
  dryRun?: boolean
}

type BulkItemResult = {
  memberId: string
  sessionId?: string
  allowed: boolean
  reason?: string
  stopped?: boolean
  usedMethod?: string
  errors?: string[]
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body
  const action = body.action

  if (action === 'refresh') {
    const snapshot = await getDigitalOfficeSnapshot()
    return NextResponse.json({ ok: true, action, snapshot })
  }

  if (action === 'stop') {
    const memberId = String(body.memberId || '').trim()
    if (!memberId) {
      return NextResponse.json({ ok: false, error: 'memberId is required for stop action' }, { status: 400 })
    }

    const snapshot = await getDigitalOfficeSnapshot()
    const member = snapshot.members.find((m) => m.id === memberId)

    if (!member || member.source !== 'live' || !member.live) {
      return NextResponse.json({ ok: false, error: 'member not found in live roster' }, { status: 404 })
    }

    if (member.live.isMain) {
      return NextResponse.json({ ok: false, error: 'main session is protected and cannot be stopped' }, { status: 403 })
    }

    if (member.role !== 'Worker Session' || !member.ops.canStop) {
      return NextResponse.json(
        {
          ok: false,
          error: member.ops.stopGuard || 'only worker/subagent sessions can be stopped',
        },
        { status: 403 },
      )
    }

    const result = await stopWorkerSession(member.live.sessionId)
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'no stop/kill RPC method succeeded',
          detail: result.errors,
        },
        { status: 502 },
      )
    }

    const refreshed = await getDigitalOfficeSnapshot()
    return NextResponse.json({
      ok: true,
      action,
      memberId,
      usedMethod: result.usedMethod,
      snapshot: refreshed,
    })
  }

  if (action === 'stop-bulk') {
    const ids = Array.isArray(body.memberIds)
      ? body.memberIds.map((v) => String(v || '').trim()).filter(Boolean)
      : []

    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'memberIds[] is required for stop-bulk action' }, { status: 400 })
    }

    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length > 30) {
      return NextResponse.json({ ok: false, error: 'too many memberIds (max 30)' }, { status: 400 })
    }

    const dryRun = body.dryRun !== false
    const snapshot = await getDigitalOfficeSnapshot()
    const byId = new Map(snapshot.members.map((m) => [m.id, m]))

    const results: BulkItemResult[] = uniqueIds.map((memberId) => {
      const member = byId.get(memberId)
      if (!member || member.source !== 'live' || !member.live) {
        return { memberId, allowed: false, reason: 'member not found in live roster' }
      }
      if (member.live.isMain) {
        return { memberId, sessionId: member.live.sessionId, allowed: false, reason: 'main session is protected' }
      }
      if (member.role !== 'Worker Session' || !member.ops.canStop) {
        return {
          memberId,
          sessionId: member.live.sessionId,
          allowed: false,
          reason: member.ops.stopGuard || 'only worker/subagent sessions are stoppable',
        }
      }
      return { memberId, sessionId: member.live.sessionId, allowed: true }
    })

    const allowed = results.filter((r) => r.allowed)

    if (!dryRun) {
      for (const item of allowed) {
        if (!item.sessionId) {
          item.allowed = false
          item.reason = 'missing session id'
          continue
        }
        const stopped = await stopWorkerSession(item.sessionId)
        if (!stopped.ok) {
          item.stopped = false
          item.errors = stopped.errors
        } else {
          item.stopped = true
          item.usedMethod = stopped.usedMethod
        }
      }
    }

    const summary = {
      requested: uniqueIds.length,
      allowed: allowed.length,
      blocked: results.filter((r) => !r.allowed).length,
      dryRun,
      stopped: dryRun ? 0 : results.filter((r) => r.stopped).length,
      failed: dryRun ? 0 : results.filter((r) => r.allowed && r.stopped !== true).length,
    }

    const refreshed = dryRun ? snapshot : await getDigitalOfficeSnapshot()

    return NextResponse.json({
      ok: true,
      action,
      dryRun,
      summary,
      results,
      snapshot: refreshed,
    })
  }

  if (action === 'cleanup-idle') {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Discover all installed agent dirs (was hardcoded to the author's
    // personal install: main / community / claude / codex / gemini).
    const { discoverInstalledAgents } = await import('@/lib/agent-discovery')
    const installedAgents = await discoverInstalledAgents()
    const agentDirs = installedAgents.map(a => a.dir)
    const targetId = body.memberId ? String(body.memberId).trim() : ''

    try {
      // Get currently active subagent keys from gateway
      const snapshot = await getDigitalOfficeSnapshot()
      const activeKeys = new Set(
        snapshot.members
          .filter(m => !m.live?.isMain && m.status === 'working')
          .map(m => m.live?.rawKey)
          .filter(Boolean)
      )

      let totalRemoved = 0
      const allRemovedKeys: string[] = []

      for (const agentId of agentDirs) {
        const sessionsPath = path.join(process.env.HOME || '', `.openclaw/agents/${agentId}/sessions/sessions.json`)
        try {
          const raw = await fs.readFile(sessionsPath, 'utf8')
          const sessions = JSON.parse(raw) as Record<string, unknown>

          const toRemove: string[] = []
          for (const key of Object.keys(sessions)) {
            if (!key.includes('subagent')) continue
            if (targetId) {
              if (key.includes(targetId) || key === targetId) toRemove.push(key)
            } else {
              if (!activeKeys.has(key)) toRemove.push(key)
            }
          }

          if (toRemove.length > 0) {
            if (body.dryRun !== true) {
              for (const key of toRemove) delete sessions[key]
              await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2))
            }
            totalRemoved += toRemove.length
            allRemovedKeys.push(...toRemove.map(k => k.substring(0, 60)))
          }
        } catch {
          // Agent dir doesn't exist or no sessions file — skip
        }
      }

      if (body.dryRun === true) {
        return NextResponse.json({
          ok: true, action: 'cleanup-idle', dryRun: true,
          toRemove: totalRemoved, keys: allRemovedKeys,
        })
      }

      const refreshed = await getDigitalOfficeSnapshot()
      return NextResponse.json({
        ok: true, action: 'cleanup-idle', removed: totalRemoved,
        keys: allRemovedKeys, snapshot: refreshed,
      })
    } catch (err) {
      return NextResponse.json({
        ok: false, error: `Failed: ${err instanceof Error ? err.message : 'unknown'}`,
      }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: false, error: 'Unknown action. Use refresh, stop, stop-bulk, or cleanup-idle.' }, { status: 400 })
}

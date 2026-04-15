import { NextResponse } from 'next/server'
import { getDigitalOfficeSnapshot } from '@/lib/digital-office-live'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'

// In-memory cache: avoid hammering gateway on rapid polls
let cache: { data: string; ts: number } | null = null
const CACHE_TTL = 5000 // 5 seconds

export async function GET() {
  const now = Date.now()
  if (cache && (now - cache.ts) < CACHE_TTL) {
    return new Response(cache.data, { headers: { 'Content-Type': 'application/json' } })
  }

  const snapshot = await getDigitalOfficeSnapshot()
  
  // Enrich members with parentSessionId from sessions.json
  const sessionsPath = path.join(process.env.HOME || '', '.openclaw/agents/main/sessions/sessions.json')
  let parentMap: Record<string, string> = {}
  try {
    if (fs.existsSync(sessionsPath)) {
      const content = fs.readFileSync(sessionsPath, 'utf-8')
      const sessions = JSON.parse(content)
      Object.values(sessions).forEach((s: any) => {
        if (s.sessionId && s.parentSessionId) {
          parentMap[s.sessionId] = s.parentSessionId
        }
      })
    }
  } catch (e) {
    // ignore
  }

  // Read configured models from openclaw.json
  const openclawPath = path.join(process.env.HOME || '', '.openclaw/openclaw.json')
  let agentModelMap: Record<string, string> = {}
  let defaultModel = ''
  try {
    if (fs.existsSync(openclawPath)) {
      const ocContent = fs.readFileSync(openclawPath, 'utf-8')
      const ocConfig = JSON.parse(ocContent)
      defaultModel = ocConfig?.agents?.defaults?.model?.primary || ''
      const agentList = ocConfig?.agents?.list
      if (Array.isArray(agentList)) {
        for (const agent of agentList) {
          if (agent.id) {
            agentModelMap[agent.id] = agent.model || defaultModel
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Apply parentSessionId and configuredModel to members
  const enrichedMembers = snapshot.members?.map((m: any) => {
    const agentId = m.live?.agentId || 'main'
    return {
      ...m,
      configuredModel: agentModelMap[agentId] || defaultModel || undefined,
      live: {
        ...m.live,
        parentSessionId: parentMap[m.live?.sessionId] || m.live?.parentSessionId
      }
    }
  })
  
  const body = JSON.stringify({ ok: true, ...snapshot, members: enrichedMembers })
  cache = { data: body, ts: Date.now() }
  return new Response(body, { headers: { 'Content-Type': 'application/json' } })
}

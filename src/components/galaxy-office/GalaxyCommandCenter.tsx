'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { OfficeMember } from '@/lib/digital-office-live'
import { inferDeskStatus } from '@/components/digital-office/DeskGrid'
import { useToast } from '@/components/ui/toast'
import { GalaxyBackground } from './GalaxyBackground'
import { GalaxyHUD } from './GalaxyHUD'
import AgentOrb from './AgentOrb'
import OrchestratorSunOrb from './OrchestratorSunOrb'
import { ConstellationMap } from './ConstellationMap'
import { GalaxyDetailPanel } from './GalaxyDetailPanel'
import { GalaxyServerStation } from './GalaxyServerStation'

// ── Types ────────────────────────────────────────────────────────────

type AnimState = 'arriving' | 'working' | 'idle' | 'leaving' | 'error' | 'complete' | 'empty'
type RoomMemberState = { member: OfficeMember; animation: AnimState; isNew: boolean }

const POLL_MS = 10000
const LEAVING_MS = 600
const NEW_MS = 2000

// ── Color Map ────────────────────────────────────────────────────────

type AgentColor = { accent: string; glow: string; ring: string }
const AGENT_COLORS: Record<string, AgentColor> = {
  orchestrator: { accent: '#00e5ff', glow: 'rgba(0,229,255,0.4)', ring: 'rgba(0,229,255,0.25)' },
  main:      { accent: '#00e5ff', glow: 'rgba(0,229,255,0.4)', ring: 'rgba(0,229,255,0.25)' },
  content:   { accent: '#a855f7', glow: 'rgba(168,85,247,0.4)', ring: 'rgba(168,85,247,0.25)' },
  clipper:   { accent: '#2dd4bf', glow: 'rgba(45,212,191,0.4)', ring: 'rgba(45,212,191,0.25)' },
  trader:    { accent: '#f59e0b', glow: 'rgba(245,158,11,0.4)', ring: 'rgba(245,158,11,0.25)' },
  community: { accent: '#22c55e', glow: 'rgba(34,197,94,0.4)', ring: 'rgba(34,197,94,0.25)' },
  claude:    { accent: '#3b82f6', glow: 'rgba(59,130,246,0.4)', ring: 'rgba(59,130,246,0.25)' },
  codex:     { accent: '#60a5fa', glow: 'rgba(96,165,250,0.4)', ring: 'rgba(96,165,250,0.25)' },
  gemini:    { accent: '#f472b6', glow: 'rgba(244,114,182,0.4)', ring: 'rgba(244,114,182,0.25)' },
}
const DEFAULT_COLOR: AgentColor = { accent: '#94a3b8', glow: 'rgba(148,163,184,0.3)', ring: 'rgba(148,163,184,0.2)' }

function getAgentColor(name: string): AgentColor {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(AGENT_COLORS)) { if (key.includes(k)) return v }
  return DEFAULT_COLOR
}

function getAgentInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

// ── Session helpers ──────────────────────────────────────────────────

function extractAgentId(s: RoomMemberState): string {
  // From rawKey like "agent:main:subagent:xyz" or "agent:community:telegram:direct"
  const m = s.member.live?.rawKey?.match(/^agent:([^:]+):/)
  if (m) return m[1]
  // Fallback: check live.agentId
  if (s.member.live?.agentId) return s.member.live.agentId
  // Fallback: guess from name
  return s.member.live?.agentId || 'unknown'
}

function isSubagent(s: RoomMemberState): boolean {
  return (s.member.live?.rawKey ?? '').includes(':subagent:')
}

function isOrchestratorMainSession(s: RoomMemberState): boolean {
  const rawKey = s.member.live?.rawKey || ''
  return rawKey === 'agent:main:main'
}

function deriveAnim(m: OfficeMember): AnimState {
  const s = inferDeskStatus(m)
  return s === 'working' || s === 'thinking' ? 'working' : 'idle'
}

// ── Orbital Position Calculator ──────────────────────────────────────

type OrbitalAgent = {
  id: string
  agentId: string
  state: RoomMemberState
  colors: AgentColor
  initial: string
  ring: 'inner' | 'outer'
  count?: number
}

const INNER_R = 18
const OUTER_R = 30
const INNER_ORBIT_PERIOD = 60
const OUTER_ORBIT_PERIOD = 100
const ELLIPSE_RATIO = 0.7

function calcOrbitalPositions(
  agents: OrbitalAgent[],
  bobPos: { x: number; y: number },
  time: number,
  dragOffsets: Record<string, { dx: number; dy: number }>,
) {
  const inner = agents.filter(a => a.ring === 'inner')
  const outer = agents.filter(a => a.ring === 'outer')
  const positions: Record<string, { x: number; y: number }> = {}

  inner.forEach((a, i) => {
    const baseAngle = (i / Math.max(inner.length, 1)) * Math.PI * 2
    const angle = baseAngle + (time / INNER_ORBIT_PERIOD) * Math.PI * 2
    const off = dragOffsets[a.id] ?? { dx: 0, dy: 0 }
    positions[a.id] = {
      x: bobPos.x + Math.cos(angle) * INNER_R + off.dx,
      y: bobPos.y + Math.sin(angle) * INNER_R * ELLIPSE_RATIO + off.dy,
    }
  })

  outer.forEach((a, i) => {
    const baseAngle = (i / Math.max(outer.length, 1)) * Math.PI * 2 + Math.PI / outer.length
    const angle = baseAngle + (time / OUTER_ORBIT_PERIOD) * Math.PI * 2
    const off = dragOffsets[a.id] ?? { dx: 0, dy: 0 }
    positions[a.id] = {
      x: bobPos.x + Math.cos(angle) * OUTER_R + off.dx,
      y: bobPos.y + Math.sin(angle) * OUTER_R * ELLIPSE_RATIO + off.dy,
    }
  })

  return positions
}

// ── Main Component ───────────────────────────────────────────────────

export function GalaxyCommandCenter() {
  const { toast, confirm } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 })
  const [roomStates, setRoomStates] = useState<Map<string, RoomMemberState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [degraded, setDegraded] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  // Drag state
  const [dragOffsets, setDragOffsets] = useState<Record<string, { dx: number; dy: number }>>({})
  const [orchDragOffset, setOrchDragOffset] = useState({ dx: 0, dy: 0 })
  const dragRef = useRef<{ id: string; startX: number; startY: number; origDx: number; origDy: number } | null>(null)

  const prevIds = useRef<Set<string>>(new Set())
  const leaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const newTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Container size observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setContainerSize({ width: e.contentRect.width, height: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Fetch office data — this is the ONLY data source, no team-structure needed
  const fetchData = useCallback(async () => {
    setSyncing(true)
    try {
      const r = await fetch('/api/digital-office', { cache: 'no-store' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json() as { members?: OfficeMember[]; degraded?: boolean }
      const members: OfficeMember[] = Array.isArray(j.members) ? j.members : []
      setDegraded(Boolean(j.degraded))
      setError(null)

      const curIds = new Set(members.map(m => m.id))
      const newIds = new Set<string>()
      for (const id of curIds) { if (!prevIds.current.has(id)) newIds.add(id) }

      // Departures
      for (const pid of prevIds.current) {
        if (!curIds.has(pid)) {
          setRoomStates(prev => { const n = new Map(prev); const e = n.get(pid); if (e) n.set(pid, { ...e, animation: 'leaving' }); return n })
          const t = setTimeout(() => { setRoomStates(prev => { const n = new Map(prev); n.delete(pid); return n }); leaveTimers.current.delete(pid) }, LEAVING_MS)
          leaveTimers.current.set(pid, t)
        }
      }
      prevIds.current = curIds

      setRoomStates(prev => {
        const n = new Map(prev)
        for (const m of members) {
          if (n.get(m.id)?.animation === 'leaving') continue
          n.set(m.id, { member: m, animation: newIds.has(m.id) ? 'arriving' : deriveAnim(m), isNew: newIds.has(m.id) })
        }
        return n
      })

      for (const id of newIds) {
        if (newTimers.current.has(id)) clearTimeout(newTimers.current.get(id)!)
        const t = setTimeout(() => {
          setRoomStates(prev => {
            const n = new Map(prev); const s = n.get(id)
            if (s && s.animation === 'arriving') n.set(id, { ...s, animation: deriveAnim(s.member), isNew: false })
            return n
          })
          newTimers.current.delete(id)
        }, NEW_MS)
        newTimers.current.set(id, t)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false); setSyncing(false)
    }
  }, [])

  // Polling — only digital-office API, no team-structure
  useEffect(() => {
    void fetchData()
    const d = setInterval(() => void fetchData(), POLL_MS)
    const lt = leaveTimers.current, nt = newTimers.current
    return () => { clearInterval(d); for (const t of lt.values()) clearTimeout(t); for (const t of nt.values()) clearTimeout(t) }
  }, [fetchData])

  // ── Build orbital agents from REAL session data ────────────────────
  // "done" for subagent/ACP runs means finished — hide those.
  // "done" for persistent agent sessions (main, Agent, etc.) means idle — keep visible.
  const PERSISTENT_AGENTS = new Set(['main', 'content', 'clipper', 'trader', 'community'])
  const displayStates = useMemo(() => Array.from(roomStates.values()).filter(s => {
    const status = s.member.status
    const aid = extractAgentId(s)
    // Persistent agents: always show, treat done=idle
    if (PERSISTENT_AGENTS.has(aid)) return true
    // Subagent/ACP: filter out finished states
    return !['done', 'completed', 'finished'].includes(status)
  }), [roomStates])

  const { orchState, orbitalAgents } = useMemo(() => {
    let orch: RoomMemberState | null = null
    const agentGroups = new Map<string, RoomMemberState[]>()

    for (const s of displayStates) {
      // Orchestrator main session → sun
      if (isOrchestratorMainSession(s)) {
        orch = s
        continue
      }

      // Group by agentId
      const aid = extractAgentId(s)
      if (!agentGroups.has(aid)) agentGroups.set(aid, [])
      agentGroups.get(aid)!.push(s)
    }

    // Build orbital agents — group certain agent types into single orbitals
    const agents: OrbitalAgent[] = []
    let ringIdx = 0
    const GROUPABLE = new Set(['claude', 'community', 'main'])

    for (const [aid, sessions] of agentGroups.entries()) {
      if (GROUPABLE.has(aid) && sessions.length >= 1) {
        // Pick most active session for display
        const active = sessions.find(s => s.animation === 'working')
          || sessions.find(s => s.animation === 'arriving')
          || sessions[0]
        if (!active) continue
        const count = sessions.length
        const ring: 'inner' | 'outer' = ringIdx % 2 === 0 ? 'inner' : 'outer'
        agents.push({
          id: aid === 'claude' ? 'claude-group' : aid === 'community' ? 'community-group' : 'main-sessions',
          agentId: aid,
          state: active,
          colors: getAgentColor(active.member.name || aid),
          initial: getAgentInitial(active.member.name || aid),
          ring,
          count: count > 1 ? count : undefined,
        })
        ringIdx++
      } else {
        // Individual agents (content, Agent, Agent, etc.)
        for (const sess of sessions) {
          const ring: 'inner' | 'outer' = ringIdx % 2 === 0 ? 'inner' : 'outer'
          agents.push({
            id: sess.member.id,
            agentId: aid,
            state: sess,
            colors: getAgentColor(sess.member.name || aid),
            initial: getAgentInitial(sess.member.name || aid),
            ring,
          })
          ringIdx++
        }
      }
    }

    return { orchState: orch, orbitalAgents: agents }
  }, [displayStates])

  // Counts
  const totalAgents = displayStates.length
  const activeAgents = displayStates.filter(s => s.animation === 'working' || s.animation === 'arriving').length

  // Animated orbital positions
  const baseOrchPos = { x: 50, y: 42 }
  const orchPos = { x: baseOrchPos.x + orchDragOffset.dx, y: baseOrchPos.y + orchDragOffset.dy }
  const [orbitPositions, setOrbitPositions] = useState<Record<string, { x: number; y: number }>>({})
  const orbitAgentsRef = useRef(orbitalAgents)
  orbitAgentsRef.current = orbitalAgents
  const dragOffsetsRef = useRef(dragOffsets)
  dragOffsetsRef.current = dragOffsets
  const orchPosRef = useRef(orchPos)
  orchPosRef.current = orchPos

  useEffect(() => {
    let animId: number
    const startTime = Date.now()
    let lastUpdate = 0
    function tick() {
      const now = Date.now()
      if (now - lastUpdate > 66) {
        lastUpdate = now
        const t = (now - startTime) / 1000
        setOrbitPositions(calcOrbitalPositions(orbitAgentsRef.current, orchPosRef.current, t, dragOffsetsRef.current))
      }
      animId = requestAnimationFrame(tick)
    }
    setOrbitPositions(calcOrbitalPositions(orbitAgentsRef.current, orchPosRef.current, 0, dragOffsetsRef.current))
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [])

  const positions = orbitPositions

  // ── Drag handlers ──────────────────────────────────────────────────

  const handleDragStart = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const isOrch = id === '__orch__'
    const orig = isOrch ? orchDragOffset : (dragOffsets[id] ?? { dx: 0, dy: 0 })
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origDx: orig.dx, origDy: orig.dy }
  }, [dragOffsets, orchDragOffset])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return
    const { id, startX, startY, origDx, origDy } = dragRef.current
    const rect = containerRef.current.getBoundingClientRect()
    // Convert pixel delta to percentage
    const dx = origDx + ((e.clientX - startX) / rect.width) * 100
    const dy = origDy + ((e.clientY - startY) / rect.height) * 100

    if (id === '__orch__') {
      setOrchDragOffset({ dx, dy })
    } else {
      setDragOffsets(prev => ({ ...prev, [id]: { dx, dy } }))
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    dragRef.current = null
  }, [])

  // Selected member
  const selectedMember = selectedAgentId
    ? displayStates.find(s => s.member.id === selectedAgentId)?.member
      ?? orbitalAgents.find(a => a.id === selectedAgentId)?.state.member
      ?? null
    : null

  // Cleanup handler
  const handleCleanup = async () => {
    const ok = await confirm({ title: 'Cleanup Idle Agents', message: 'Remove all idle/completed subagents?', confirmLabel: '🧹 CLEANUP', cancelLabel: 'CANCEL', danger: true })
    if (!ok) return
    try {
      const r = await fetch('/api/digital-office/ops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cleanup-idle', dryRun: false }) })
      const d = await r.json() as { ok?: boolean; removed?: number; error?: string }
      if (d.ok) toast(`Removed ${d.removed} idle subagent(s)`, d.removed ? 'success' : 'info')
      else toast(d.error || 'Cleanup failed', 'error')
    } catch (e) { toast(`Failed: ${e instanceof Error ? e.message : 'unknown'}`, 'error') }
  }

  // Model name for orchestrator
  const orchModel = (() => {
    const m = orchState?.member
    const raw = m?.configuredModel || m?.live?.model || m?.tokenStats?.model || ''
    return raw ? raw.replace('anthropic/', '').replace('z-ai/', '').toUpperCase() : 'DETECTING...'
  })()

  const orchSubCount = displayStates.filter(s => isSubagent(s)).length

  return (
    <div
      ref={containerRef}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerLeave={handleDragEnd}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 20% 50%, #0d0030 0%, #050510 60%), #050510',
        borderRadius: 16,
        touchAction: 'none',
      }}
    >
      <GalaxyBackground />

      <ConstellationMap
        orchestratorPosition={orchPos}
        agentPositions={orbitalAgents.map(a => ({
          id: a.id,
          x: positions[a.id]?.x ?? 50,
          y: positions[a.id]?.y ?? 50,
          accent: a.colors.accent,
          isActive: a.state.animation === 'working' || a.state.animation === 'arriving',
        }))}
        innerRingRadius={INNER_R}
        outerRingRadius={OUTER_R}
        selectedAgentId={selectedAgentId}
        containerSize={containerSize}
      />

      <div style={{ position: 'relative', zIndex: 5, minHeight: 'inherit' }}>
        <GalaxyHUD
          totalAgents={totalAgents}
          activeAgents={activeAgents}
          degraded={degraded}
          syncing={syncing}
          error={error}
          onCleanup={handleCleanup}
        />

        {loading && displayStates.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#00e5ff', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: '0.15em',
          }}>
            <span style={{ animation: 'galaxy-twinkle 1s step-end infinite' }}>INITIALIZING FLEET...</span>
          </div>
        )}

        {/* Orchestrator Sun Orb — draggable */}
        {!loading && (
          <div
            onPointerDown={(e) => handleDragStart('__orch__', e)}
            style={{
              position: 'absolute',
              left: `${orchPos.x}%`, top: `${orchPos.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              cursor: dragRef.current?.id === '__orch__' ? 'grabbing' : 'grab',
            }}
          >
            <OrchestratorSunOrb
              member={orchState?.member ?? null}
              activeSubAgentCount={orchSubCount}
              isSelected={selectedAgentId === orchState?.member?.id}
              onClick={() => orchState && setSelectedAgentId(orchState.member.id === selectedAgentId ? null : orchState.member.id)}
              modelName={orchModel}
            />
          </div>
        )}

        {/* Agent Orbs — draggable */}
        {!loading && orbitalAgents.map((agent, i) => {
          const pos = positions[agent.id]
          if (!pos) return null
          return (
            <React.Fragment key={agent.id}>
              <AgentOrb
                member={agent.state.member}
                animation={agent.state.animation}
                colors={agent.colors}
                position={pos}
                index={i}
                initial={agent.initial}
                isSelected={selectedAgentId === agent.id}
                onClick={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
                onHover={() => {}}
                onDragStart={(e) => handleDragStart(agent.id, e)}
              />
              {agent.count && agent.count > 1 && (
                <div style={{
                  position: 'absolute',
                  left: `${pos.x}%`, top: `${pos.y}%`,
                  transform: 'translate(16px, -46px)',
                  background: '#0f0', color: '#000', fontSize: 9, fontWeight: 700,
                  borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(0,229,255,0.5)',
                  pointerEvents: 'none',
                  zIndex: 12,
                }}>
                  {agent.count}
                </div>
              )}
            </React.Fragment>
          )
        })}

        {/* Server Station */}
        {!loading && (
          <div style={{ position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 480, zIndex: 5 }}>
            <GalaxyServerStation />
          </div>
        )}

        {/* Empty state — no agents running */}
        {!loading && displayStates.length === 0 && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', color: '#5e6e85', fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌌</div>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>No agents online</div>
            <div style={{ fontSize: 9, marginTop: 4, color: '#3d4a5e' }}>Agents will appear as planets when sessions start</div>
          </div>
        )}
      </div>

      {selectedMember && (
        <GalaxyDetailPanel
          member={selectedMember}
          colors={getAgentColor(selectedMember.name)}
          onClose={() => setSelectedAgentId(null)}
          onRemove={async () => {
            try {
              await fetch('/api/digital-office/ops', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cleanup-idle', dryRun: false }),
              })
              toast('Agent removed', 'success')
              setSelectedAgentId(null)
            } catch { toast('Failed to remove', 'error') }
          }}
        />
      )}
    </div>
  )
}

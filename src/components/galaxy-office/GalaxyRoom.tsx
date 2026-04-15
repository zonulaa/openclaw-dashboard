'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import gsap from 'gsap'
import type { OfficeMember } from '@/lib/digital-office-live'
import { inferDeskStatus } from '@/components/digital-office/DeskGrid'
import '@/styles/galaxy-office.css'

// ── Types ─────────────────────────────────────────────────────────────

type Props = {
  members?: OfficeMember[]
  degraded?: boolean
  meta?: { fetchedAt?: string; [key: string]: unknown }
  onListViewToggle?: () => void
  pollIntervalMs?: number
}

type AgentColor = {
  accent: string
  glow: string
  ring: string
}

// ── Color map ─────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, AgentColor> = {
  orchestrator: { accent: '#00e5ff', glow: 'rgba(0,229,255,0.4)', ring: 'rgba(0,229,255,0.25)' },
  content: { accent: '#a855f7', glow: 'rgba(168,85,247,0.4)', ring: 'rgba(168,85,247,0.25)' },
  clipper: { accent: '#2dd4bf', glow: 'rgba(45,212,191,0.4)', ring: 'rgba(45,212,191,0.25)' },
  trader: { accent: '#f59e0b', glow: 'rgba(245,158,11,0.4)', ring: 'rgba(245,158,11,0.25)' },
  community: { accent: '#22c55e', glow: 'rgba(34,197,94,0.4)', ring: 'rgba(34,197,94,0.25)' },
  claude: { accent: '#3b82f6', glow: 'rgba(59,130,246,0.4)', ring: 'rgba(59,130,246,0.25)' },
}
const DEFAULT_COLOR: AgentColor = { accent: '#94a3b8', glow: 'rgba(148,163,184,0.3)', ring: 'rgba(148,163,184,0.2)' }

function getAgentColor(name: string): AgentColor {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(AGENT_COLORS)) {
    if (key.includes(k)) return v
  }
  return DEFAULT_COLOR
}

function getAgentInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

function getStatusClass(status: string): 'active' | 'idle' | 'error' {
  const s = status.toLowerCase()
  if (s.includes('error') || s.includes('fail')) return 'error'
  if (s.includes('active') || s.includes('working') || s.includes('running') || s.includes('thinking')) return 'active'
  return 'idle'
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// ── Agent Orb ─────────────────────────────────────────────────────────

function AgentOrb({
  member,
  index,
  onClick,
}: {
  member: OfficeMember
  index: number
  onClick: (m: OfficeMember) => void
}) {
  const orbRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const colors = getAgentColor(member.name)
  const status = getStatusClass(member.status)
  const initial = getAgentInitial(member.name)
  const ctxPercent = member.tokenStats?.percentUsed ?? 0

  useEffect(() => {
    if (!orbRef.current) return
    const ctx = gsap.context(() => {
      // Entrance animation
      gsap.fromTo(orbRef.current,
        { opacity: 0, scale: 0.3, y: 40 },
        { opacity: 1, scale: 1, y: 0, duration: 0.8, delay: index * 0.15, ease: 'back.out(1.7)', clearProps: 'transform' }
      )
    }, orbRef)
    return () => ctx.revert()
  }, [index])

  // Status pulse
  useEffect(() => {
    if (!ringRef.current) return
    const speed = status === 'active' ? 2 : status === 'error' ? 0.8 : 6
    const ctx = gsap.context(() => {
      gsap.to(ringRef.current, {
        rotation: 360,
        duration: speed,
        repeat: -1,
        ease: 'none',
      })
    }, ringRef)
    return () => ctx.revert()
  }, [status])

  const handleMouseEnter = () => {
    if (!orbRef.current) return
    gsap.to(orbRef.current, { scale: 1.12, duration: 0.3, ease: 'power2.out' })
  }
  const handleMouseLeave = () => {
    if (!orbRef.current) return
    gsap.to(orbRef.current, { scale: 1, duration: 0.3, ease: 'power2.out' })
  }

  const statusLabel = status === 'active' ? 'ACTIVE' : status === 'error' ? 'ERROR' : 'IDLE'

  return (
    <div
      ref={orbRef}
      className={`galaxy-agent-orb galaxy-agent-orb--${status}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onClick(member)}
      style={{
        '--agent-accent': colors.accent,
        '--agent-glow': colors.glow,
        '--agent-ring': colors.ring,
      } as React.CSSProperties}
    >
      {/* Orbit ring */}
      <div ref={ringRef} className="galaxy-orb-ring" />

      {/* Context arc */}
      <svg className="galaxy-orb-ctx" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
        <circle
          cx="50" cy="50" r="46" fill="none"
          stroke={colors.accent}
          strokeWidth="2"
          strokeDasharray={`${ctxPercent * 2.89} 289`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 4px ${colors.accent})` }}
        />
      </svg>

      {/* Inner orb */}
      <div className="galaxy-orb-inner">
        <span className="galaxy-orb-initial">{initial}</span>
      </div>

      {/* Working particles */}
      {status === 'active' && (
        <>
          <div className="galaxy-orb-particle galaxy-orb-particle--1" />
          <div className="galaxy-orb-particle galaxy-orb-particle--2" />
          <div className="galaxy-orb-particle galaxy-orb-particle--3" />
        </>
      )}

      {/* Labels */}
      <div className="galaxy-orb-label">
        <span className="galaxy-orb-name">{member.name.split('—')[0].trim()}</span>
        <span className="galaxy-orb-role">{statusLabel}</span>
      </div>
    </div>
  )
}

// ── Constellation Lines (SVG) ─────────────────────────────────────────

function ConstellationLines({ members }: { members: OfficeMember[] }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const lines = svgRef.current.querySelectorAll('.galaxy-constellation-line')
    const ctx = gsap.context(() => {
      lines.forEach((line, i) => {
        const length = (line as SVGLineElement).getTotalLength?.() ?? 200
        gsap.set(line, { strokeDasharray: length, strokeDashoffset: length })
        gsap.to(line, {
          strokeDashoffset: 0,
          duration: 1.2,
          delay: 0.3 + i * 0.1,
          ease: 'power2.out',
        })
      })
    }, svgRef)
    return () => ctx.revert()
  }, [members])

  // Position orbs in a tree: Bob center-top, children spread below
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    const centerX = 50
    const topY = 15
    const rowGap = 22
    let idx = 0

    // Find the main/orchestrator session
    members.forEach((m) => {
      if (m.live?.isMain && !(m.live?.rawKey ?? '').includes(':subagent:')) {
        pos[m.id] = { x: centerX, y: topY }
      }
    })

    const children = members.filter(m => !pos[m.id])

    const count = children.length
    const spread = 70
    children.forEach((m, i) => {
      const x = count === 1 ? centerX : centerX - spread / 2 + (spread / (count - 1)) * i
      const row = Math.floor(i / 5)
      pos[m.id] = { x, y: topY + rowGap * (1 + row) }
      idx++
    })

    return pos
  }, [members])

  // Connect orchestrator to all children
  const orchMember = members.find(m => m.live?.isMain && !m.live?.rawKey?.includes(':subagent:'))
  const orchPos = orchMember ? positions[orchMember.id] : null

  return (
    <svg ref={svgRef} className="galaxy-constellation" viewBox="0 0 100 100" preserveAspectRatio="none">
      {orchPos && members.filter(m => m.id !== orchMember?.id).map((m) => {
        const p = positions[m.id]
        if (!p) return null
        return (
          <line
            key={m.id}
            className="galaxy-constellation-line"
            x1={orchPos.x} y1={orchPos.y}
            x2={p.x} y2={p.y}
            stroke="rgba(0,229,255,0.15)"
            strokeWidth="0.3"
          />
        )
      })}
    </svg>
  )
}

// ── HUD Stats Bar ─────────────────────────────────────────────────────

function GalaxyHUD({ members, fetchedAt }: { members: OfficeMember[]; fetchedAt?: string }) {
  const [clock, setClock] = useState('')
  const activeCount = members.filter(m => getStatusClass(m.status) === 'active').length
  const totalCount = members.length

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="galaxy-hud">
      <div className="galaxy-hud__left">
        <div className="galaxy-hud__live-badge">
          <span className="galaxy-hud__live-dot" />
          LIVE
        </div>
        <span className="galaxy-hud__fleet">
          AGENT FLEET: <strong>{activeCount}</strong>/{totalCount} ACTIVE
        </span>
      </div>
      <div className="galaxy-hud__center">
        <span className="galaxy-hud__clock">{clock}</span>
      </div>
      <div className="galaxy-hud__right">
        <span className="galaxy-hud__updated">Updated {timeAgo(fetchedAt)}</span>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────

function AgentDetailPanel({ member, onClose }: { member: OfficeMember; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const colors = getAgentColor(member.name)

  useEffect(() => {
    if (!panelRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(panelRef.current,
        { opacity: 0, x: 60, scale: 0.95 },
        { opacity: 1, x: 0, scale: 1, duration: 0.4, ease: 'power3.out' }
      )
    }, panelRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={panelRef} className="galaxy-detail-panel" style={{ '--agent-accent': colors.accent } as React.CSSProperties}>
      <button className="galaxy-detail-panel__close" onClick={onClose}>✕</button>
      <div className="galaxy-detail-panel__header">
        <div className="galaxy-detail-panel__orb-mini" style={{ background: colors.accent, boxShadow: `0 0 20px ${colors.glow}` }}>
          {getAgentInitial(member.name)}
        </div>
        <div>
          <h3 className="galaxy-detail-panel__name">{member.name}</h3>
          <p className="galaxy-detail-panel__role">{member.role}</p>
        </div>
      </div>
      <div className="galaxy-detail-panel__grid">
        <div className="galaxy-detail-panel__stat">
          <span className="galaxy-detail-panel__stat-label">STATUS</span>
          <span className="galaxy-detail-panel__stat-value" style={{ color: getStatusClass(member.status) === 'active' ? '#22c55e' : getStatusClass(member.status) === 'error' ? '#ef4444' : '#f59e0b' }}>
            {member.status.toUpperCase()}
          </span>
        </div>
        <div className="galaxy-detail-panel__stat">
          <span className="galaxy-detail-panel__stat-label">MODEL</span>
          <span className="galaxy-detail-panel__stat-value">{member.tokenStats?.model || member.configuredModel || '—'}</span>
        </div>
        <div className="galaxy-detail-panel__stat">
          <span className="galaxy-detail-panel__stat-label">CONTEXT</span>
          <span className="galaxy-detail-panel__stat-value">{member.tokenStats ? `${Math.round(member.tokenStats.percentUsed)}%` : '—'}</span>
        </div>
        <div className="galaxy-detail-panel__stat">
          <span className="galaxy-detail-panel__stat-label">UPTIME</span>
          <span className="galaxy-detail-panel__stat-value">{member.live?.uptimeHuman || '—'}</span>
        </div>
        {member.currentTask && (
          <div className="galaxy-detail-panel__stat galaxy-detail-panel__stat--full">
            <span className="galaxy-detail-panel__stat-label">CURRENT TASK</span>
            <span className="galaxy-detail-panel__stat-value">{member.currentTask}</span>
          </div>
        )}
        {member.statusDetail && (
          <div className="galaxy-detail-panel__stat galaxy-detail-panel__stat--full">
            <span className="galaxy-detail-panel__stat-label">DETAIL</span>
            <span className="galaxy-detail-panel__stat-value">{member.statusDetail}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shooting Star ─────────────────────────────────────────────────────

function ShootingStar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const shoot = () => {
      setVisible(true)
      setTimeout(() => setVisible(false), 1000)
    }
    const interval = setInterval(shoot, 8000 + Math.random() * 12000)
    return () => clearInterval(interval)
  }, [])

  if (!visible) return null
  return <div className="galaxy-shooting-star" />
}

// ── Main Galaxy Room ──────────────────────────────────────────────────

export function GalaxyRoom({
  members: propMembers,
  degraded: propDegraded,
  meta: propMeta,
  onListViewToggle,
  pollIntervalMs = 3000,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedAgent, setSelectedAgent] = useState<OfficeMember | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Parallax on mouse move
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePos({ x, y })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  // Animate star parallax
  useEffect(() => {
    if (!containerRef.current) return
    const stars = containerRef.current.querySelector('.galaxy-stars')
    if (stars) {
      gsap.to(stars, {
        x: mousePos.x * 8,
        y: mousePos.y * 8,
        duration: 0.6,
        ease: 'power2.out',
      })
    }
  }, [mousePos])

  const members = propMembers ?? []

  return (
    <div ref={containerRef} className="galaxy-office">
      {/* Starfield layers */}
      <div className="galaxy-stars">
        <div className="galaxy-stars__layer galaxy-stars__layer--small" />
        <div className="galaxy-stars__layer galaxy-stars__layer--medium" />
        <div className="galaxy-stars__layer galaxy-stars__layer--large" />
      </div>

      {/* Nebula clouds */}
      <div className="galaxy-nebula galaxy-nebula--1" />
      <div className="galaxy-nebula galaxy-nebula--2" />
      <div className="galaxy-nebula galaxy-nebula--3" />

      {/* Shooting star */}
      <ShootingStar />

      {/* Constellation lines */}
      <ConstellationLines members={members} />

      {/* HUD top bar */}
      <GalaxyHUD members={members} fetchedAt={propMeta?.fetchedAt as string | undefined} />

      {/* Agent orbs */}
      <div className="galaxy-agent-grid">
        {members.map((m, i) => (
          <AgentOrb key={m.id} member={m} index={i} onClick={setSelectedAgent} />
        ))}
      </div>

      {/* Degraded notice */}
      {propDegraded && (
        <div className="galaxy-degraded">
          ⚠ DEGRADED MODE — Live data unavailable
        </div>
      )}

      {/* Detail panel */}
      {selectedAgent && (
        <AgentDetailPanel member={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}

      {/* List view toggle */}
      {onListViewToggle && (
        <button className="galaxy-list-toggle" onClick={onListViewToggle}>
          ☰ List View
        </button>
      )}
    </div>
  )
}

export default GalaxyRoom

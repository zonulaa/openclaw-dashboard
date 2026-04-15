'use client'

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { OfficeMember } from '@/lib/digital-office-live'

// ── Types ────────────────────────────────────────────────────────────

type Props = {
  member: OfficeMember | null
  colors: { accent: string; glow: string }
  onClose: () => void
  onRemove?: (id: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────────

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

function formatModel(m: OfficeMember): string {
  const raw = m.configuredModel || m.live?.model || m.tokenStats?.model || ''
  return raw ? raw.replace('anthropic/', '').replace('z-ai/', '').toUpperCase() : '—'
}

function deriveAgentType(m: OfficeMember): string {
  const rawKey = m.live?.rawKey ?? ''
  // Use live.agentId, then fall back to member.id (which matches openclaw agent id)
  const agentId = m.live?.agentId ?? m.id ?? 'unknown'
  if (rawKey.includes(':subagent:')) return 'SUBAGENT'
  if ((m.role || '').toLowerCase().includes('subagent')) return 'SUBAGENT'
  if ((m.role || '').toLowerCase().includes('worker')) return 'WORKER'
  if (agentId === 'main') return 'BOB'
  return agentId.toUpperCase()
}

function deriveRunningFrom(m: OfficeMember): string {
  if (m.runningFrom) return m.runningFrom
  const agentId = m.live?.agentId ?? m.id ?? 'unknown'
  const label = agentId === 'main' ? 'BOB' : agentId.toUpperCase()
  if (m.live?.isMain) return `${label} SESSION`
  if (m.live?.parentSessionId) return `${label} SPAWNED`
  return `${label} SESSION`
}

function resolveUptime(m: OfficeMember): string {
  const val = m.live?.uptimeHuman
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'human' in (val as Record<string, unknown>)) return (val as { human: string }).human
  return '—'
}

// ── Detail Panel ─────────────────────────────────────────────────────

export function GalaxyDetailPanel({ member, colors, onClose, onRemove }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!member) return
    const ctx = gsap.context(() => {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25 })
      gsap.fromTo(panelRef.current,
        { x: 360, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', delay: 0.05 }
      )
    })
    return () => ctx.revert()
  }, [member])

  // Animate token bar
  useEffect(() => {
    if (!member || !barRef.current) return
    const pct = member.tokenStats?.percentUsed ?? 0
    gsap.fromTo(barRef.current,
      { width: '0%' },
      { width: `${pct}%`, duration: 1.2, ease: 'power2.out', delay: 0.3 }
    )
  }, [member])

  if (!member) return null

  const status = member.status?.toLowerCase() || 'idle'
  const isActive = status.includes('working') || status.includes('running') || status.includes('thinking') || status.includes('active')
  const isError = status.includes('error') || status.includes('fail')
  const statusColor = isError ? '#ef4444' : isActive ? '#22c55e' : '#f59e0b'
  const statusLabel = isError ? 'ERROR' : isActive ? 'ACTIVE' : 'IDLE'
  const tokens = member.tokenStats
  const isSubagent = member.live?.rawKey?.includes(':subagent:')
  const canRemove = isSubagent && onRemove

  const handleClose = () => {
    gsap.to(panelRef.current, { x: 360, opacity: 0, duration: 0.3, ease: 'power2.in' })
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.2, delay: 0.1, onComplete: onClose })
  }

  const S: Record<string, React.CSSProperties> = {
    backdrop: {
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.4)',
    },
    panel: {
      position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 51,
      width: 340,
      background: 'rgba(5,5,20,0.95)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderLeft: `1px solid ${colors.accent}25`,
      display: 'flex', flexDirection: 'column' as const,
      fontFamily: "'JetBrains Mono', monospace",
      overflowY: 'auto' as const,
    },
    header: {
      padding: '20px 16px 16px',
      borderBottom: `1px solid ${colors.accent}20`,
      display: 'flex', alignItems: 'center', gap: 12,
    },
    orb: {
      width: 48, height: 48, borderRadius: '50%',
      background: `radial-gradient(circle, ${colors.accent}30, transparent 70%)`,
      border: `2px solid ${colors.accent}60`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 'bold', color: colors.accent,
      boxShadow: `0 0 20px ${colors.glow}`,
      flexShrink: 0,
    },
    section: { padding: '12px 16px' },
    label: { fontSize: 8, color: '#5e6e85', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 },
    value: { fontSize: 11, color: '#c8d6e5', lineHeight: 1.5 },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
    divider: { height: 1, background: `rgba(0,229,255,0.08)`, margin: '0 16px' },
    pill: {
      display: 'inline-flex', padding: '2px 8px', borderRadius: 4,
      fontSize: 8, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    },
    barTrack: {
      height: 6, borderRadius: 3,
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden', marginTop: 6,
    },
    barFill: {
      height: '100%', borderRadius: 3,
      background: `linear-gradient(90deg, ${colors.accent}, ${colors.accent}88)`,
      boxShadow: `0 0 8px ${colors.glow}`,
    },
    closeBtn: {
      position: 'absolute' as const, top: 12, right: 12,
      background: 'none', border: 'none',
      color: '#5e6e85', fontSize: 18, cursor: 'pointer',
      padding: 4,
    },
    removeBtn: {
      margin: '12px 16px 20px',
      padding: '8px 16px', borderRadius: 6,
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      color: '#ef4444', cursor: 'pointer',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10, fontWeight: 'bold',
      letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    },
  }

  return (
    <>
      <div ref={backdropRef} style={S.backdrop} onClick={handleClose} />
      <div ref={panelRef} style={S.panel}>
        <button style={S.closeBtn} onClick={handleClose} aria-label="Close">✕</button>

        {/* Header */}
        <div style={S.header}>
          <div style={S.orb}>{member.name.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#e2e8f0', marginBottom: 2 }}>
              {member.name.split('—')[0].trim()}
            </div>
            <div style={{ fontSize: 9, color: '#5e6e85' }}>
              {member.role || member.details}
              {member.live?.agentId && <span style={{ color: '#475569', marginLeft: 4 }}>({member.live.agentId})</span>}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ ...S.pill, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40` }}>
                ● {statusLabel}
              </span>
              <span style={{ ...S.pill, background: 'rgba(94,234,212,0.1)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.25)' }}>
                {deriveAgentType(member)}
              </span>
              <span style={{ ...S.pill, background: 'rgba(0,229,255,0.1)', color: '#00e5ff', border: '1px solid rgba(0,229,255,0.25)' }}>
                {formatModel(member)}
              </span>
            </div>
          </div>
        </div>

        {/* Token Stats */}
        {tokens && (
          <div style={S.section}>
            <div style={S.label}>Context Usage</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: colors.accent }}>{tokens.percentUsed?.toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: '#5e6e85', alignSelf: 'flex-end' }}>
                {tokens.total?.toLocaleString()} tokens
              </span>
            </div>
            <div style={S.barTrack}>
              <div ref={barRef} style={{ ...S.barFill, width: '0%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#5e6e85' }}>
              <span>Output: {tokens.output?.toLocaleString()}</span>
              <span>Remaining: {tokens.remaining?.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div style={S.divider} />

        {/* Session Info */}
        <div style={S.section}>
          <div style={S.label}>Session</div>
          {member.live?.sessionId && (
            <div style={S.row}>
              <span style={{ fontSize: 9, color: '#5e6e85' }}>ID</span>
              <span style={{ fontSize: 9, color: '#c8d6e5', fontFamily: 'monospace' }}>{member.live.sessionId.slice(0, 12)}…</span>
            </div>
          )}
          <div style={S.row}>
            <span style={{ fontSize: 9, color: '#5e6e85' }}>Origin</span>
            <span style={{ fontSize: 9, color: '#c8d6e5' }}>{deriveRunningFrom(member)}</span>
          </div>
          <div style={S.row}>
            <span style={{ fontSize: 9, color: '#5e6e85' }}>Uptime</span>
            <span style={{ fontSize: 9, color: '#c8d6e5' }}>{resolveUptime(member)}</span>
          </div>
          <div style={S.row}>
            <span style={{ fontSize: 9, color: '#5e6e85' }}>Started</span>
            <span style={{ fontSize: 9, color: '#c8d6e5' }}>{timeAgo(member.live?.startedAt)}</span>
          </div>
          <div style={S.row}>
            <span style={{ fontSize: 9, color: '#5e6e85' }}>Last Updated</span>
            <span style={{ fontSize: 9, color: member.live?.updatedAt && (Date.now() - Date.parse(member.live.updatedAt)) < 60000 ? '#22c55e' : '#c8d6e5' }}>
              {timeAgo(member.live?.updatedAt)}
            </span>
          </div>
          {member.progressPercent != null && member.progressPercent > 0 && (
            <>
              <div style={S.row}>
                <span style={{ fontSize: 9, color: '#5e6e85' }}>Progress</span>
                <span style={{ fontSize: 9, color: colors.accent }}>{member.progressPercent}%{member.progressLabel ? ` (${member.progressLabel})` : ''}</span>
              </div>
              <div style={S.barTrack}>
                <div style={{ ...S.barFill, width: `${member.progressPercent}%` }} />
              </div>
            </>
          )}
        </div>

        <div style={S.divider} />

        {/* Current Task */}
        {member.currentTask && (
          <div style={S.section}>
            <div style={S.label}>Current Task</div>
            <div style={{
              fontSize: 10, color: '#c8d6e5', lineHeight: 1.6,
              padding: '8px 10px', borderRadius: 6,
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid rgba(0,229,255,0.08)',
              maxHeight: 120, overflowY: 'auto' as const,
              wordBreak: 'break-word' as const,
            }}>
              {member.currentTask}
            </div>
          </div>
        )}

        {/* Last Tool Call */}
        {member.currentCommand && (
          <div style={S.section}>
            <div style={S.label}>Last Tool Call</div>
            <div style={{
              fontSize: 9, color: '#a78bfa', lineHeight: 1.5,
              padding: '6px 10px', borderRadius: 6,
              background: 'rgba(168,85,247,0.04)',
              border: '1px solid rgba(168,85,247,0.08)',
              maxHeight: 80, overflowY: 'auto' as const,
              wordBreak: 'break-word' as const,
              fontFamily: 'monospace',
            }}>
              {member.currentCommand}
            </div>
          </div>
        )}

        {/* Status Detail */}
        {member.statusDetail && (
          <div style={S.section}>
            <div style={S.label}>Status Detail</div>
            <div style={{ fontSize: 10, color: '#c8d6e5' }}>{member.statusDetail}</div>
          </div>
        )}

        {/* Remove button */}
        {canRemove && (
          <button
            style={S.removeBtn}
            onClick={() => onRemove!(member.id)}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
          >
            ✕ Remove Agent
          </button>
        )}
      </div>
    </>
  )
}

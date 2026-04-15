'use client'

import React, { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'

// ── Types ────────────────────────────────────────────────────────────

type VPSStats = {
  ok: boolean
  uptime?: string | { human?: string; seconds?: number }
  cpu?: number | { pct?: number }
  ram?: { pct?: number }
  disk?: { pct?: number }
  memory?: { usedPercent: number; totalMB: number }
  pm2?: { name: string; status: string; cpu: number; memory: number }[]
}

// ── SVG Space Station Visual ─────────────────────────────────────────

function SpaceStationSVG({ cpu, ram, disk }: { cpu: number; ram: number; disk: number }) {
  const panelRef = useRef<SVGGElement>(null)

  useEffect(() => {
    if (!panelRef.current) return
    const tween = gsap.to(panelRef.current, {
      rotation: 360, duration: 60, ease: 'none', repeat: -1,
      transformOrigin: '200px 80px',
    })
    return () => { tween.kill() }
  }, [])

  // Color based on health
  const health = Math.max(0, 100 - Math.max(cpu, ram, disk))
  const healthColor = health > 60 ? '#00e5ff' : health > 30 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 400 160" width="100%" style={{ maxWidth: 400, display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="station-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <filter id="station-glow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Slowly rotating solar panel ring */}
      <g ref={panelRef}>
        {/* Orbit ring */}
        <ellipse cx="200" cy="80" rx="180" ry="30" fill="none" stroke="rgba(0,229,255,0.06)" strokeWidth="0.5" strokeDasharray="4 6" />
      </g>

      {/* Left solar panel arm */}
      <rect x="40" y="76" width="100" height="2" fill="#334155" rx="1" />
      {/* Left solar panel */}
      <g>
        <rect x="20" y="60" width="50" height="34" rx="2" fill="url(#station-hull)" stroke="#475569" strokeWidth="0.8" />
        <line x1="32" y1="60" x2="32" y2="94" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="45" y1="60" x2="45" y2="94" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="58" y1="60" x2="58" y2="94" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="20" y1="72" x2="70" y2="72" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="20" y1="84" x2="70" y2="84" stroke="#1e3a5f" strokeWidth="0.5" />
        {/* Solar panel glow */}
        <rect x="22" y="62" width="46" height="30" rx="1" fill="rgba(0,229,255,0.04)" />
      </g>

      {/* Right solar panel arm */}
      <rect x="260" y="76" width="100" height="2" fill="#334155" rx="1" />
      {/* Right solar panel */}
      <g>
        <rect x="330" y="60" width="50" height="34" rx="2" fill="url(#station-hull)" stroke="#475569" strokeWidth="0.8" />
        <line x1="342" y1="60" x2="342" y2="94" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="355" y1="60" x2="355" y2="94" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="368" y1="60" x2="368" y2="94" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="330" y1="72" x2="380" y2="72" stroke="#1e3a5f" strokeWidth="0.5" />
        <line x1="330" y1="84" x2="380" y2="84" stroke="#1e3a5f" strokeWidth="0.5" />
        <rect x="332" y="62" width="46" height="30" rx="1" fill="rgba(0,229,255,0.04)" />
      </g>

      {/* Central hub */}
      <rect x="140" y="56" width="120" height="42" rx="8" fill="url(#station-hull)" stroke="#475569" strokeWidth="1" />
      {/* Hub inner detail */}
      <rect x="148" y="62" width="104" height="30" rx="4" fill="rgba(0,229,255,0.03)" stroke="rgba(0,229,255,0.08)" strokeWidth="0.5" />

      {/* Status lights on hull */}
      <circle cx="158" cy="70" r="2.5" fill={healthColor} filter="url(#station-glow)" />
      <circle cx="170" cy="70" r="2" fill="rgba(0,229,255,0.4)" />
      <circle cx="180" cy="70" r="2" fill="rgba(0,229,255,0.4)" />

      {/* Docking port top */}
      <rect x="190" y="48" width="20" height="8" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.5" />
      <circle cx="200" cy="52" r="1.5" fill={healthColor} opacity="0.6" />

      {/* Docking port bottom */}
      <rect x="190" y="98" width="20" height="8" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.5" />

      {/* Antenna */}
      <line x1="200" y1="42" x2="200" y2="28" stroke="#475569" strokeWidth="0.8" />
      <circle cx="200" cy="26" r="2" fill="none" stroke={healthColor} strokeWidth="0.8" />
      <circle cx="200" cy="26" r="1" fill={healthColor} opacity="0.6" />

      {/* Mini gauge displays inside hub */}
      {/* CPU */}
      <text x="160" y="86" fill="#5e6e85" fontSize="5" fontFamily="'JetBrains Mono', monospace">CPU</text>
      <rect x="160" y="88" width="24" height="3" rx="1" fill="rgba(255,255,255,0.05)" />
      <rect x="160" y="88" width={24 * cpu / 100} height="3" rx="1" fill={cpu > 80 ? '#ef4444' : '#00e5ff'} opacity="0.7" />

      {/* RAM */}
      <text x="192" y="86" fill="#5e6e85" fontSize="5" fontFamily="'JetBrains Mono', monospace">RAM</text>
      <rect x="192" y="88" width="24" height="3" rx="1" fill="rgba(255,255,255,0.05)" />
      <rect x="192" y="88" width={24 * ram / 100} height="3" rx="1" fill={ram > 80 ? '#ef4444' : '#a855f7'} opacity="0.7" />

      {/* DSK */}
      <text x="224" y="86" fill="#5e6e85" fontSize="5" fontFamily="'JetBrains Mono', monospace">DSK</text>
      <rect x="224" y="88" width="24" height="3" rx="1" fill="rgba(255,255,255,0.05)" />
      <rect x="224" y="88" width={24 * disk / 100} height="3" rx="1" fill={disk > 80 ? '#ef4444' : '#2dd4bf'} opacity="0.7" />

      {/* Station name */}
      <text x="200" y="120" textAnchor="middle" fill="#5e6e85" fontSize="6" fontFamily="'JetBrains Mono', monospace" letterSpacing="2">
        INFRASTRUCTURE NODE
      </text>
      <text x="200" y="130" textAnchor="middle" fill="rgba(0,229,255,0.4)" fontSize="5" fontFamily="'JetBrains Mono', monospace" letterSpacing="1.5">
        VPS · ORBITAL STATION
      </text>
    </svg>
  )
}

// ── GaugeArc ─────────────────────────────────────────────────────────

function GaugeArc({ percent, color, label, size = 50 }: { percent: number; color: string; label: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  const ref = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(ref.current,
      { strokeDashoffset: circ },
      { strokeDashoffset: offset, duration: 1.5, ease: 'power2.out', delay: 0.5 }
    )
  }, [offset, circ])

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <circle ref={ref} cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
        <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={11} fontWeight="bold" fontFamily="'JetBrains Mono', monospace"
        >{Math.round(percent)}%</text>
      </svg>
      <div style={{ fontSize: 7, color: '#5e6e85', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1 }}>
        {label}
      </div>
    </div>
  )
}

// ── Server Station Component ─────────────────────────────────────────

export function GalaxyServerStation() {
  const [stats, setStats] = useState<VPSStats | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('/api/vps-stats', { cache: 'no-store' })
        if (res.ok) setStats(await res.json() as VPSStats)
      } catch { /* */ }
    }
    void fetch_()
    const interval = setInterval(fetch_, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Entrance
  useEffect(() => {
    if (!cardRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(cardRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', delay: 2.8 }
      )
    }, cardRef)
    return () => ctx.revert()
  }, [])

  const cpu = typeof stats?.cpu === 'object' ? (stats.cpu?.pct ?? 0) : (stats?.cpu ?? 0)
  const mem = stats?.ram?.pct ?? stats?.memory?.usedPercent ?? 0
  const disk = stats?.disk?.pct ?? 0
  const pm2 = stats?.pm2 ?? []
  const uptimeStr = typeof stats?.uptime === 'object' ? (stats.uptime?.human ?? '') : (stats?.uptime ?? '')

  return (
    <div ref={cardRef} style={{
      width: '100%', maxWidth: 480, margin: '0 auto',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Space station SVG visual */}
      <SpaceStationSVG cpu={cpu} ram={mem} disk={disk} />

      {/* Stats row below */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12,
        padding: '12px 16px',
        background: 'rgba(5,5,20,0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: 10,
        border: '1px solid rgba(0,229,255,0.08)',
      }}>
        <GaugeArc percent={cpu} color="#00e5ff" label="CPU" />
        <GaugeArc percent={mem} color="#a855f7" label="RAM" />
        <GaugeArc percent={disk} color="#2dd4bf" label="Disk" />

        {/* PM2 + uptime */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, minWidth: 80 }}>
          {uptimeStr && (
            <div style={{ fontSize: 7, color: '#5e6e85', letterSpacing: '0.1em' }}>
              UP {uptimeStr}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {pm2.slice(0, 6).map((p, i) => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: p.status === 'online' ? '#22c55e' : '#ef4444',
                boxShadow: p.status === 'online' ? '0 0 4px rgba(34,197,94,0.5)' : '0 0 4px rgba(239,68,68,0.5)',
              }} title={p.name} />
            ))}
          </div>
          {pm2.length > 0 && (
            <div style={{ fontSize: 6, color: '#5e6e85' }}>
              {pm2.filter(p => p.status === 'online').length}/{pm2.length} online
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import React, { useEffect, useRef, useMemo } from 'react'
import gsap from 'gsap'

// ── Types ──────────────────────────────────────────────────────────────

type AgentPosition = {
  id: string
  x: number
  y: number
  accent: string
  isActive: boolean
}

type ConstellationMapProps = {
  orchestratorPosition: { x: number; y: number }
  agentPositions: Array<AgentPosition>
  innerRingRadius: number
  outerRingRadius: number
  selectedAgentId: string | null
  containerSize: { width: number; height: number }
}

// ── Helpers ────────────────────────────────────────────────────────────

function pct(v: number, dim: number) {
  return (v / 100) * dim
}

// ── Component ──────────────────────────────────────────────────────────

export function ConstellationMap({
  orchestratorPosition,
  agentPositions,
  innerRingRadius,
  outerRingRadius,
  selectedAgentId,
  containerSize,
}: ConstellationMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const ctxRef = useRef<gsap.Context | null>(null)

  const { width: w, height: h } = containerSize
  const bx = pct(orchestratorPosition.x, w)
  const by = pct(orchestratorPosition.y, h)

  // Memoize pixel positions for agents
  const agents = useMemo(
    () =>
      agentPositions.map((a) => ({
        ...a,
        px: pct(a.x, w),
        py: pct(a.y, h),
      })),
    [agentPositions, w, h],
  )

  // ── GSAP animations ───────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || w === 0) return

    ctxRef.current = gsap.context(() => {
      // Orbit ring rotation
      gsap.to('[data-ring="inner"]', {
        rotation: 360,
        duration: 90,
        repeat: -1,
        ease: 'none',
        transformOrigin: `${bx}px ${by}px`,
      })
      gsap.to('[data-ring="outer"]', {
        rotation: -360,
        duration: 120,
        repeat: -1,
        ease: 'none',
        transformOrigin: `${bx}px ${by}px`,
      })

      // Connection line draw-in
      svg.querySelectorAll<SVGLineElement>('[data-line]').forEach((line, i) => {
        const len = Math.hypot(
          Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
          Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
        )
        gsap.set(line, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(line, {
          strokeDashoffset: 0,
          duration: 1,
          delay: i * 0.1,
          ease: 'power2.out',
        })
      })

      // Data-flow particles
      svg.querySelectorAll<SVGCircleElement>('[data-particle]').forEach((p) => {
        const ax = Number(p.dataset.ax)
        const ay = Number(p.dataset.ay)
        const speed = Number(p.dataset.speed)
        const offset = Number(p.dataset.offset)

        gsap.fromTo(
          p,
          { attr: { cx: bx, cy: by } },
          {
            attr: { cx: ax, cy: ay },
            duration: speed,
            repeat: -1,
            ease: 'none',
            delay: offset,
          },
        )
      })
    }, svg)

    return () => {
      ctxRef.current?.revert()
    }
  }, [agents, bx, by, w, h])

  // ── Selection highlighting ────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    agents.forEach((a) => {
      const line = svg.querySelector(`[data-line="${a.id}"]`)
      if (!line) return
      const target = selectedAgentId
        ? a.id === selectedAgentId
          ? 0.5
          : 0.04
        : 0.12
      gsap.to(line, { opacity: target, duration: 0.3, overwrite: true })
    })
  }, [selectedAgentId, agents])

  // ── Build particle data ───────────────────────────────────────────
  const particles = useMemo(() => {
    const list: Array<{
      key: string
      ax: number
      ay: number
      accent: string
      speed: number
      offset: number
      opacity: number
    }> = []

    agents.forEach((a) => {
      const count = a.isActive ? 2 : 1
      const baseSpeed = a.isActive ? 2 + Math.random() : 5
      for (let i = 0; i < count; i++) {
        list.push({
          key: `${a.id}-p${i}`,
          ax: a.px,
          ay: a.py,
          accent: a.accent,
          speed: baseSpeed + i * 0.5,
          offset: i * (baseSpeed / count),
          opacity: a.isActive ? 0.7 : 0.3,
        })
      }
    })
    return list
  }, [agents])

  if (w === 0 || h === 0) return null

  const irPx = pct(innerRingRadius, Math.min(w, h))
  const orPx = pct(outerRingRadius, Math.min(w, h))

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <defs>
        {agents.map((a) => (
          <linearGradient
            key={`grad-${a.id}`}
            id={`grad-${a.id}`}
            x1={bx}
            y1={by}
            x2={a.px}
            y2={a.py}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="rgba(0,229,255,0.8)" />
            <stop offset="100%" stopColor={a.accent} />
          </linearGradient>
        ))}
      </defs>

      {/* Orbit rings */}
      <g data-ring="inner">
        <circle
          cx={bx}
          cy={by}
          r={irPx}
          fill="none"
          stroke="rgba(0,229,255,0.06)"
          strokeDasharray="4 8"
          strokeWidth={0.5}
        />
      </g>
      <g data-ring="outer">
        <circle
          cx={bx}
          cy={by}
          r={orPx}
          fill="none"
          stroke="rgba(0,229,255,0.04)"
          strokeDasharray="4 8"
          strokeWidth={0.5}
        />
      </g>

      {/* Connection lines */}
      {agents.map((a) => (
        <line
          key={`line-${a.id}`}
          data-line={a.id}
          x1={bx}
          y1={by}
          x2={a.px}
          y2={a.py}
          stroke={`url(#grad-${a.id})`}
          strokeWidth={1}
          opacity={0.12}
        />
      ))}

      {/* Data-flow particles */}
      {particles.map((p) => (
        <circle
          key={p.key}
          data-particle
          data-ax={p.ax}
          data-ay={p.ay}
          data-speed={p.speed}
          data-offset={p.offset}
          r={2}
          fill={p.accent}
          opacity={p.opacity}
          cx={bx}
          cy={by}
        />
      ))}
    </svg>
  )
}

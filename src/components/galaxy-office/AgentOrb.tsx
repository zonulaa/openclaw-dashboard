'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import type { OfficeMember } from '@/lib/digital-office-live'
import { PlanetCanvas, type PlanetType } from './PlanetCanvas'

// ── Types ────────────────────────────────────────────────────────────

type AgentOrbProps = {
  member: OfficeMember
  animation: 'arriving' | 'working' | 'idle' | 'leaving' | 'error' | 'complete' | 'empty'
  colors: { accent: string; glow: string; ring: string }
  position: { x: number; y: number }
  index: number
  isSelected: boolean
  onClick: () => void
  onHover: (hovered: boolean) => void
  onDragStart?: (e: React.PointerEvent) => void
  initial: string
}

const STATUS_LABELS: Record<AgentOrbProps['animation'], string> = {
  arriving: 'ARRIVING', working: 'ACTIVE', idle: 'IDLE',
  leaving: 'LEAVING', error: 'ERROR', complete: 'COMPLETE', empty: '',
}

// ── Map agent initial → planet type ──────────────────────────────────

function getPlanetType(initial: string): PlanetType {
  switch (initial) {
    case '⚡': case 'D': return 'earth'    // Dev — Earth
    case 'O': return 'mars'                 // Ops — Mars
    case '✦': return 'venus'                // Content — Venus
    case 'K': return 'saturn'               // Content — Saturn
    case 'C': return 'jupiter'              // Community — Jupiter
    case 'J': return 'neptune'              // Agent — Neptune
    default: return 'generic'
  }
}

function getRotationSpeed(initial: string): number {
  switch (initial) {
    case '⚡': case 'D': return 25
    case 'O': return 30
    case '✦': return 35
    case 'K': return 18
    case 'C': return 15
    case 'J': return 22
    default: return 24
  }
}

// ── CSS Keyframes ────────────────────────────────────────────────────

const STYLES = `
@keyframes planet-orbit-particle {
  0%   { transform: translate(-50%,-50%) rotate(0deg)   translateX(48px) scale(1);   opacity:1; }
  50%  { transform: translate(-50%,-50%) rotate(180deg) translateX(48px) scale(0.5); opacity:0.4; }
  100% { transform: translate(-50%,-50%) rotate(360deg) translateX(48px) scale(1);   opacity:1; }
}
@keyframes planet-error-pulse {
  0%, 100% { box-shadow: 0 0 15px rgba(255,60,60,0.3); }
  50%      { box-shadow: 0 0 30px rgba(255,60,60,0.6); }
}
@keyframes planet-working-glow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.12); }
}
@keyframes planet-energy-ring {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes planet-fire-particle {
  0%   { transform: translate(-50%,-50%) rotate(var(--fire-angle)) translateY(0px) scale(1); opacity: 0.9; }
  40%  { opacity: 1; }
  100% { transform: translate(-50%,-50%) rotate(var(--fire-angle)) translateY(-40px) scale(0); opacity: 0; }
}
@keyframes planet-fire-ring {
  0%   { box-shadow: 0 0 15px var(--fire-color1), 0 0 30px var(--fire-color2), inset 0 0 10px var(--fire-color1); }
  33%  { box-shadow: 0 0 25px var(--fire-color2), 0 0 50px var(--fire-color1), inset 0 0 15px var(--fire-color2); }
  66%  { box-shadow: 0 0 20px var(--fire-color1), 0 0 40px var(--fire-color2), inset 0 0 12px var(--fire-color1); }
  100% { box-shadow: 0 0 15px var(--fire-color1), 0 0 30px var(--fire-color2), inset 0 0 10px var(--fire-color1); }
}
@keyframes planet-ember-orbit {
  0%   { transform: translate(-50%,-50%) rotate(0deg)   translateX(42px) scale(1);   opacity: 0.8; filter: blur(0px); }
  25%  { transform: translate(-50%,-50%) rotate(90deg)  translateX(44px) scale(1.3); opacity: 1;   filter: blur(0px); }
  50%  { transform: translate(-50%,-50%) rotate(180deg) translateX(42px) scale(0.8); opacity: 0.6; filter: blur(1px); }
  75%  { transform: translate(-50%,-50%) rotate(270deg) translateX(44px) scale(1.1); opacity: 0.9; filter: blur(0px); }
  100% { transform: translate(-50%,-50%) rotate(360deg) translateX(42px) scale(1);   opacity: 0.8; filter: blur(0px); }
}
`

const SZ = 80  // total container size
const PLANET_SZ = 64  // planet canvas size

// ── Component ────────────────────────────────────────────────────────

export default function AgentOrb({
  member, animation, colors, position, index,
  isSelected, onClick, onHover, onDragStart, initial,
}: AgentOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const hasEnteredRef = useRef(false)

  const planetType = getPlanetType(initial)
  const rotSpeed = getRotationSpeed(initial)
  const isWorking = animation === 'working'
  const isError = animation === 'error'
  const isMock = member.source === 'mock'  // idle placeholder
  const isIdle = !isWorking && !isError

  // Entrance
  useEffect(() => {
    if (!containerRef.current || hasEnteredRef.current) return
    hasEnteredRef.current = true
    gsap.fromTo(containerRef.current,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, delay: 0.8 + index * 0.15, ease: 'back.out(1.7)', clearProps: 'scale,opacity' }
    )
  }, [index])

  // Selection
  useEffect(() => {
    if (!containerRef.current) return
    gsap.to(containerRef.current, { scale: isSelected ? 1.18 : 1, duration: 0.35, ease: 'power2.out' })
  }, [isSelected])

  // Hover
  const handleMouseEnter = useCallback(() => {
    onHover(true)
    if (orbRef.current) gsap.to(orbRef.current, { scale: 1.15, y: -8, duration: 0.3, ease: 'power2.out' })
  }, [onHover])

  const handleMouseLeave = useCallback(() => {
    onHover(false)
    if (orbRef.current) gsap.to(orbRef.current, { scale: 1, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
  }, [onHover])

  const agentName = (member.name?.split('—')[0] ?? initial).trim()
  const statusLabel = STATUS_LABELS[animation]
  const percentUsed = member.tokenStats?.percentUsed ?? 0
  const circumference = 2 * Math.PI * (SZ / 2 - 2)
  const arcLength = (percentUsed / 100) * circumference

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={onDragStart}
      style={{
        position: 'absolute', left: `${position.x}%`, top: `${position.y}%`,
        transform: 'translate(-50%, -50%)', cursor: isMock ? 'default' : 'grab',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        zIndex: isSelected ? 10 : isWorking ? 5 : 1,
        opacity: isMock ? 0.4 : isIdle ? 0.7 : 1,
        filter: isMock ? 'brightness(0.5) saturate(0.5)' : isIdle ? 'brightness(0.8)' : 'none',
        transition: 'opacity 0.5s ease, filter 0.5s ease',
      }}
    >
      <style>{STYLES}</style>

      <div ref={orbRef} style={{ position: 'relative', width: SZ, height: SZ }}>

        {/* Atmosphere glow — FIERY when working, subtle when idle */}
        <div style={{
          position: 'absolute',
          inset: isWorking ? -22 : -6,
          borderRadius: '50%',
          background: isWorking
            ? `radial-gradient(circle, ${colors.accent}44 15%, ${colors.glow} 35%, rgba(255,100,0,0.15) 55%, transparent 70%)`
            : `radial-gradient(circle, ${colors.glow} 40%, transparent 70%)`,
          opacity: isWorking ? 1 : isMock ? 0.15 : 0.3,
          animation: isWorking ? 'planet-working-glow 1.5s ease-in-out infinite' : 'none',
          transition: 'inset 0.5s ease, opacity 0.5s ease',
          pointerEvents: 'none',
        }} />

        {/* Secondary fire glow (warm outer ring) — only when working */}
        {isWorking && (
          <div style={{
            position: 'absolute', inset: -30, borderRadius: '50%',
            background: `radial-gradient(circle, transparent 40%, rgba(255,150,50,0.08) 55%, rgba(255,80,0,0.04) 70%, transparent 80%)`,
            animation: 'planet-working-glow 2.5s ease-in-out 0.5s infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Fire ring — pulsing glow border when working */}
        {isWorking && (
          <div style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: `2px solid ${colors.accent}66`,
            animation: 'planet-fire-ring 2s ease-in-out infinite, planet-energy-ring 4s linear infinite',
            pointerEvents: 'none', zIndex: 3,
            '--fire-color1': colors.glow,
            '--fire-color2': 'rgba(255,120,0,0.3)',
          } as React.CSSProperties} />
        )}

        {/* Inner energy ring — counter-rotating */}
        {isWorking && (
          <div style={{
            position: 'absolute', inset: 2, borderRadius: '50%',
            border: `1px dashed ${colors.accent}44`,
            animation: 'planet-energy-ring 2.5s linear infinite reverse',
            pointerEvents: 'none', zIndex: 3,
          }} />
        )}

        {/* Context arc SVG */}
        <svg width={SZ} height={SZ} style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
          <circle cx={SZ/2} cy={SZ/2} r={SZ/2 - 2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1.5}
            transform={`rotate(-90 ${SZ/2} ${SZ/2})`} />
          {percentUsed > 0 && (
            <circle cx={SZ/2} cy={SZ/2} r={SZ/2 - 2} fill="none"
              stroke={colors.accent} strokeWidth={2}
              strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${SZ/2} ${SZ/2})`}
              style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}
            />
          )}
        </svg>

        {/* 3D Planet */}
        <div style={{
          position: 'absolute',
          top: (SZ - PLANET_SZ) / 2, left: (SZ - PLANET_SZ) / 2,
          width: PLANET_SZ, height: PLANET_SZ,
          zIndex: 2,
        }}>
          <PlanetCanvas
            type={planetType}
            size={PLANET_SZ}
            rotationSpeed={isWorking ? rotSpeed * 0.3 : isMock ? rotSpeed * 2 : rotSpeed}
          />

          {/* Initial letter overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
          }}>
            <span style={{
              fontSize: 20, fontWeight: 900, color: '#fff',
              textShadow: '0 0 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)',
              userSelect: 'none', lineHeight: 1,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {initial}
            </span>
          </div>
        </div>

        {/* Orbiting ember particles (working) */}
        {isWorking && [0, 1, 2, 3, 4].map(i => (
          <div key={`ember-${i}`} style={{
            position: 'absolute', width: 5, height: 5, borderRadius: '50%',
            background: i % 2 === 0 ? colors.accent : '#ff9040',
            boxShadow: `0 0 10px ${i % 2 === 0 ? colors.glow : 'rgba(255,140,40,0.6)'}, 0 0 20px ${i % 2 === 0 ? colors.glow : 'rgba(255,80,0,0.3)'}`,
            top: '50%', left: '50%',
            animation: `planet-ember-orbit ${2 + i * 0.4}s linear infinite`,
            animationDelay: `${i * 0.5}s`,
            zIndex: 4,
          }} />
        ))}

        {/* Rising fire particles (working) */}
        {isWorking && [0, 1, 2, 3, 4, 5].map(i => (
          <div key={`fire-${i}`} style={{
            position: 'absolute',
            width: 3 + (i % 3), height: 3 + (i % 3),
            borderRadius: '50%',
            background: i % 3 === 0 ? '#ffcc00' : i % 3 === 1 ? '#ff8800' : colors.accent,
            boxShadow: `0 0 6px ${i % 3 === 0 ? 'rgba(255,200,0,0.8)' : i % 3 === 1 ? 'rgba(255,136,0,0.6)' : colors.glow}`,
            top: '50%', left: '50%',
            '--fire-angle': `${i * 60}deg`,
            animation: `planet-fire-particle ${1.2 + i * 0.3}s ease-out infinite`,
            animationDelay: `${i * 0.25}s`,
            zIndex: 4,
            pointerEvents: 'none',
          } as React.CSSProperties} />
        ))}

        {/* Error pulse */}
        {isError && (
          <div style={{
            position: 'absolute', inset: 4, borderRadius: '50%', zIndex: 4,
            border: '2px solid rgba(255,60,60,0.5)',
            animation: 'planet-error-pulse 1s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Name */}
      <span style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: colors.accent, textShadow: `0 0 8px ${colors.glow}88`,
        whiteSpace: 'nowrap', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {agentName}
      </span>

      {/* Status badge */}
      {statusLabel && (
        <span style={{
          fontSize: 7, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '1px 6px', borderRadius: 3,
          background: isError ? 'rgba(255,60,60,0.2)' : isWorking ? `${colors.accent}22` : 'rgba(255,255,255,0.06)',
          color: isError ? '#ff5555' : colors.accent,
          border: `1px solid ${isError ? 'rgba(255,60,60,0.3)' : colors.accent + '33'}`,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {statusLabel}
        </span>
      )}
    </div>
  )
}

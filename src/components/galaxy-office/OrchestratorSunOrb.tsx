'use client'

import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import type { OfficeMember } from '@/lib/digital-office-live'
import { PlanetCanvas } from './PlanetCanvas'

type OrchestratorSunOrbProps = {
  member: OfficeMember | null
  activeSubAgentCount: number
  isSelected: boolean
  onClick: () => void
  modelName: string
  initial?: string
}

const STYLES = `
@keyframes sun-corona-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 0.9; transform: scale(1.06); }
}
@keyframes sun-flare {
  0%   { opacity: 0.6; transform: scale(0.8); }
  50%  { opacity: 0.2; transform: scale(1.3); }
  100% { opacity: 0.6; transform: scale(0.8); }
}
`

const SZ = 140  // total container
const STAR_SZ = 100  // star canvas

export default function OrchestratorSunOrb({
  member, activeSubAgentCount, isSelected, onClick, modelName, initial,
}: OrchestratorSunOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Entrance
  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(containerRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.2, ease: 'elastic.out(1, 0.5)', delay: 0.3 }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [])

  // Selection
  useEffect(() => {
    if (!containerRef.current) return
    gsap.to(containerRef.current, { scale: isSelected ? 1.1 : 1, duration: 0.35, ease: 'power2.out' })
  }, [isSelected])

  const displayModel = modelName?.toUpperCase().replace(/\s+/g, '-') || 'UNKNOWN'
  const displayInitial = initial || (member?.name?.charAt(0).toUpperCase() ?? 'O')

  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', position: 'relative' }}
    >
      <style>{STYLES}</style>

      {/* Crown */}
      <span style={{ fontSize: 18, textShadow: '0 0 16px rgba(255,215,0,0.7)', lineHeight: 1, marginBottom: -4 }}>
        👑
      </span>

      {/* Star container */}
      <div ref={containerRef} style={{ position: 'relative', width: SZ, height: SZ }}>

        {/* Outer corona (large soft glow) */}
        <div style={{
          position: 'absolute', inset: -30, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,180,50,0.12) 30%, rgba(255,100,0,0.04) 55%, transparent 70%)',
          animation: 'sun-corona-pulse 3s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Inner corona */}
        <div style={{
          position: 'absolute', inset: -12, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,80,0.2) 40%, rgba(255,150,30,0.08) 65%, transparent 80%)',
          animation: 'sun-corona-pulse 2s ease-in-out 0.5s infinite',
          pointerEvents: 'none',
        }} />

        {/* Solar flares */}
        <div style={{
          position: 'absolute', top: -10, left: '45%',
          width: 24, height: 24, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,220,80,0.5), transparent 70%)',
          animation: 'sun-flare 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 5, right: -5,
          width: 18, height: 18, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,160,40,0.4), transparent 70%)',
          animation: 'sun-flare 5.5s ease-in-out 1.5s infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '40%', left: -8,
          width: 16, height: 16, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,200,60,0.35), transparent 70%)',
          animation: 'sun-flare 3.5s ease-in-out 2.5s infinite',
          pointerEvents: 'none',
        }} />

        {/* 3D Star sphere */}
        <div style={{
          position: 'absolute',
          top: (SZ - STAR_SZ) / 2, left: (SZ - STAR_SZ) / 2,
          width: STAR_SZ, height: STAR_SZ,
          boxShadow: isSelected
            ? '0 0 60px rgba(255,180,50,0.6), 0 0 30px rgba(255,120,0,0.4)'
            : '0 0 40px rgba(255,180,50,0.35), 0 0 20px rgba(255,100,0,0.2)',
          borderRadius: '50%',
          transition: 'box-shadow 0.3s ease',
        }}>
          <PlanetCanvas type="star" size={STAR_SZ} rotationSpeed={30} />

          {/* Initial */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%',
          }}>
            <span style={{
              fontSize: 34, fontWeight: 900, color: '#fff',
              textShadow: '0 0 24px rgba(255,200,60,0.9), 0 2px 6px rgba(0,0,0,0.3)',
              userSelect: 'none', lineHeight: 1,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{displayInitial}</span>
          </div>
        </div>
      </div>

      {/* Labels */}
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#ffb74d', textShadow: '0 0 10px rgba(255,180,50,0.6)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        ORCHESTRATOR
      </span>

      <span style={{
        fontSize: 7, fontWeight: 600, letterSpacing: '0.06em',
        padding: '2px 8px', borderRadius: 8,
        background: 'rgba(0,200,83,0.15)', color: '#69f0ae',
        border: '1px solid rgba(0,200,83,0.25)', whiteSpace: 'nowrap',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {displayModel}
      </span>

      {activeSubAgentCount > 0 && (
        <span style={{
          fontSize: 7, fontWeight: 600, letterSpacing: '0.05em',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {activeSubAgentCount} sub-agent{activeSubAgentCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

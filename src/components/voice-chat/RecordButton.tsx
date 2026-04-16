'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'

// Push-to-talk button with Space bar binding.
// Hold Space → recording. Release → stop.
// Disables Space when user is typing in an input/textarea.

type RecordButtonProps = {
  isRecording: boolean
  disabled?: boolean
  onStart: () => void
  onStop: () => void
}

export function RecordButton({ isRecording, disabled, onStart, onStop }: RecordButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const waveRef = useRef<HTMLDivElement>(null)
  const spaceHeldRef = useRef(false)

  // Waveform animation when recording
  useEffect(() => {
    if (!waveRef.current) return
    const bars = waveRef.current.children
    if (isRecording) {
      const ctx = gsap.context(() => {
        for (let i = 0; i < bars.length; i++) {
          gsap.to(bars[i], {
            scaleY: 0.3 + Math.random() * 1.7,
            duration: 0.15 + Math.random() * 0.15,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
            delay: i * 0.05,
          })
        }
      }, waveRef)
      return () => ctx.revert()
    } else {
      for (let i = 0; i < bars.length; i++) {
        gsap.to(bars[i], { scaleY: 0.3, duration: 0.3, ease: 'power2.out', overwrite: true })
      }
    }
  }, [isRecording])

  // Button press animation
  useEffect(() => {
    if (!btnRef.current) return
    gsap.to(btnRef.current, {
      scale: isRecording ? 0.92 : 1,
      duration: 0.2,
      ease: 'power2.out',
    })
  }, [isRecording])

  // Space bar key binding
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code !== 'Space' || e.repeat || disabled) return
    // Don't capture Space in input elements
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

    e.preventDefault()
    if (!spaceHeldRef.current) {
      spaceHeldRef.current = true
      onStart()
    }
  }, [disabled, onStart])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code !== 'Space') return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

    e.preventDefault()
    if (spaceHeldRef.current) {
      spaceHeldRef.current = false
      onStop()
    }
  }, [onStop])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  // Waveform bars
  const BARS = 16

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Waveform visualization */}
      <div
        ref={waveRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          height: 40,
          opacity: isRecording ? 1 : 0.3,
          transition: 'opacity 0.3s',
        }}
      >
        {Array.from({ length: BARS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 24,
              borderRadius: 2,
              background: isRecording
                ? `linear-gradient(180deg, #ff3366, #ff6b8a)`
                : 'var(--text-muted, #475569)',
              transformOrigin: 'center',
              transform: 'scaleY(0.3)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {/* Push-to-talk button */}
      <button
        ref={btnRef}
        onPointerDown={(e) => {
          e.preventDefault()
          if (!disabled) onStart()
        }}
        onPointerUp={(e) => {
          e.preventDefault()
          if (isRecording) onStop()
        }}
        onPointerLeave={() => {
          if (isRecording) onStop()
        }}
        disabled={disabled}
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: isRecording ? '3px solid #ff3366' : '3px solid var(--line-strong, rgba(0,212,255,0.25))',
          background: isRecording
            ? 'radial-gradient(circle, rgba(255,51,102,0.3), rgba(255,51,102,0.1))'
            : 'radial-gradient(circle, rgba(0,212,255,0.1), rgba(0,212,255,0.03))',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.3s, background 0.3s',
          boxShadow: isRecording
            ? '0 0 30px rgba(255,51,102,0.3), 0 0 60px rgba(255,51,102,0.1)'
            : '0 0 20px rgba(0,212,255,0.1)',
          outline: 'none',
          opacity: disabled ? 0.4 : 1,
          position: 'relative',
        }}
        aria-label={isRecording ? 'Lepas untuk berhenti merekam' : 'Tahan untuk berbicara'}
        title="Tahan Space atau klik untuk berbicara"
      >
        {/* Mic icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={isRecording ? '#ff3366' : 'var(--text, #e2e8f0)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="8" y1="21" x2="16" y2="21" />
        </svg>

        {/* Pulsing ring when recording */}
        {isRecording && (
          <span style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            border: '2px solid rgba(255,51,102,0.4)',
            animation: 'voice-record-pulse 1.5s ease-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </button>

      {/* Hint */}
      <span style={{
        fontSize: 10,
        color: 'var(--text-muted, #475569)',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.05em',
        textAlign: 'center',
      }}>
        {isRecording ? 'Lepas untuk kirim' : 'Tahan Space / klik untuk bicara'}
      </span>

      <style>{`
        @keyframes voice-record-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

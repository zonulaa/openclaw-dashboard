'use client'

import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import type { VoiceChatState } from './useVoiceChat'

// Animated sloth avatar — SVG-based with idle breathing,
// lip-sync mouth animation, and listening indicator.

type VoiceAvatarProps = {
  state: VoiceChatState
  className?: string
}

export function VoiceAvatar({ state, className }: VoiceAvatarProps) {
  const bodyRef = useRef<SVGGElement>(null)
  const mouthRef = useRef<SVGEllipseElement>(null)
  const leftEyeRef = useRef<SVGEllipseElement>(null)
  const rightEyeRef = useRef<SVGEllipseElement>(null)
  const coffeeSteamRef = useRef<SVGGElement>(null)
  const listeningRingRef = useRef<SVGCircleElement>(null)

  // Idle breathing animation
  useEffect(() => {
    if (!bodyRef.current) return
    const ctx = gsap.context(() => {
      gsap.to(bodyRef.current, {
        scaleY: 1.02,
        scaleX: 0.99,
        transformOrigin: 'center bottom',
        duration: 2.5,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })
    }, bodyRef)
    return () => ctx.revert()
  }, [])

  // Sleepy blink animation
  useEffect(() => {
    if (!leftEyeRef.current || !rightEyeRef.current) return
    const ctx = gsap.context(() => {
      const blink = () => {
        const tl = gsap.timeline()
        tl.to([leftEyeRef.current, rightEyeRef.current], {
          scaleY: 0.1,
          transformOrigin: 'center',
          duration: 0.15,
          ease: 'power2.in',
        })
        tl.to([leftEyeRef.current, rightEyeRef.current], {
          scaleY: 1,
          duration: 0.2,
          ease: 'power2.out',
        })
        // Random interval for next blink (slow, sleepy)
        gsap.delayedCall(3 + Math.random() * 4, blink)
      }
      gsap.delayedCall(2, blink)
    })
    return () => ctx.revert()
  }, [])

  // Lip-sync mouth animation when speaking
  useEffect(() => {
    if (!mouthRef.current) return
    if (state === 'speaking') {
      const ctx = gsap.context(() => {
        gsap.to(mouthRef.current, {
          ry: 8,
          rx: 6,
          duration: 0.15,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          overwrite: true,
        })
      })
      return () => ctx.revert()
    } else {
      gsap.to(mouthRef.current, {
        ry: 3,
        rx: 5,
        duration: 0.3,
        ease: 'power2.out',
        overwrite: true,
      })
    }
  }, [state])

  // Coffee steam animation
  useEffect(() => {
    if (!coffeeSteamRef.current) return
    const ctx = gsap.context(() => {
      const paths = coffeeSteamRef.current?.children
      if (!paths) return
      for (let i = 0; i < paths.length; i++) {
        gsap.to(paths[i], {
          y: -8,
          opacity: 0,
          duration: 1.5 + i * 0.3,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          delay: i * 0.4,
        })
      }
    }, coffeeSteamRef)
    return () => ctx.revert()
  }, [])

  // Listening ring pulse
  useEffect(() => {
    if (!listeningRingRef.current) return
    if (state === 'recording') {
      const ctx = gsap.context(() => {
        gsap.to(listeningRingRef.current, {
          scale: 1.15,
          opacity: 0.8,
          transformOrigin: 'center',
          duration: 0.8,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        })
      })
      return () => ctx.revert()
    } else {
      gsap.set(listeningRingRef.current, { scale: 1, opacity: 0 })
    }
  }, [state])

  const isListening = state === 'recording'
  const isThinking = state === 'thinking' || state === 'transcribing'

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 200 220" width="200" height="220" style={{ overflow: 'visible' }}>
        {/* Listening ring */}
        <circle
          ref={listeningRingRef}
          cx="100" cy="100" r="90"
          fill="none"
          stroke={isListening ? '#ff3366' : 'transparent'}
          strokeWidth="3"
          opacity="0"
          style={{ filter: 'drop-shadow(0 0 8px rgba(255,51,102,0.5))' }}
        />

        <g ref={bodyRef}>
          {/* Body — round brown blob */}
          <ellipse cx="100" cy="120" rx="55" ry="60" fill="#8B6914" />
          <ellipse cx="100" cy="120" rx="48" ry="52" fill="#A0792C" />
          {/* Belly patch */}
          <ellipse cx="100" cy="130" rx="30" ry="32" fill="#C4A35A" opacity="0.6" />

          {/* Face */}
          <g>
            {/* Eye patches (dark circles — sloth signature) */}
            <ellipse cx="82" cy="95" rx="16" ry="14" fill="#5C4A1E" />
            <ellipse cx="118" cy="95" rx="16" ry="14" fill="#5C4A1E" />

            {/* Eyes */}
            <ellipse ref={leftEyeRef} cx="82" cy="94" rx="6" ry="7" fill="#1a1a2e" />
            <ellipse ref={rightEyeRef} cx="118" cy="94" rx="6" ry="7" fill="#1a1a2e" />
            {/* Eye highlights */}
            <circle cx="84" cy="92" r="2.5" fill="#fff" opacity="0.9" />
            <circle cx="120" cy="92" r="2.5" fill="#fff" opacity="0.9" />

            {/* Nose */}
            <ellipse cx="100" cy="105" rx="5" ry="3.5" fill="#3D2B0A" />

            {/* Mouth */}
            <ellipse ref={mouthRef} cx="100" cy="113" rx="5" ry="3" fill="#3D2B0A" />

            {/* Smile lines */}
            <path d="M 92 112 Q 96 117 100 113" fill="none" stroke="#5C4A1E" strokeWidth="1" opacity="0.5" />
            <path d="M 108 112 Q 104 117 100 113" fill="none" stroke="#5C4A1E" strokeWidth="1" opacity="0.5" />
          </g>

          {/* Ears */}
          <circle cx="60" cy="80" r="10" fill="#8B6914" />
          <circle cx="60" cy="80" r="6" fill="#C4A35A" opacity="0.5" />
          <circle cx="140" cy="80" r="10" fill="#8B6914" />
          <circle cx="140" cy="80" r="6" fill="#C4A35A" opacity="0.5" />

          {/* Arms — left holds coffee mug */}
          <path d="M 52 130 Q 30 140 35 160 Q 38 170 50 168" fill="#8B6914" stroke="none" />
          {/* Right arm — waving slightly */}
          <path d="M 148 130 Q 170 140 165 158" fill="#8B6914" stroke="none" />

          {/* Coffee mug */}
          <g transform="translate(28, 155)">
            <rect x="0" y="0" width="22" height="18" rx="3" fill="#e0e0e0" />
            <rect x="2" y="2" width="18" height="6" rx="2" fill="#6F4E37" />
            {/* Handle */}
            <path d="M 22 4 Q 30 4 30 10 Q 30 16 22 16" fill="none" stroke="#e0e0e0" strokeWidth="3" />
            {/* Steam */}
            <g ref={coffeeSteamRef}>
              <path d="M 6 0 Q 4 -6 8 -10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 11 0 Q 13 -8 9 -12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M 16 0 Q 14 -5 18 -9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </g>

          {/* Claws (toes) */}
          <g opacity="0.6">
            <line x1="75" y1="175" x2="70" y2="183" stroke="#5C4A1E" strokeWidth="2" strokeLinecap="round" />
            <line x1="80" y1="177" x2="78" y2="185" stroke="#5C4A1E" strokeWidth="2" strokeLinecap="round" />
            <line x1="85" y1="178" x2="85" y2="186" stroke="#5C4A1E" strokeWidth="2" strokeLinecap="round" />
            <line x1="115" y1="178" x2="115" y2="186" stroke="#5C4A1E" strokeWidth="2" strokeLinecap="round" />
            <line x1="120" y1="177" x2="122" y2="185" stroke="#5C4A1E" strokeWidth="2" strokeLinecap="round" />
            <line x1="125" y1="175" x2="130" y2="183" stroke="#5C4A1E" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* Thinking dots */}
        {isThinking && (
          <g>
            <circle cx="88" cy="200" r="3" fill="var(--accent, #00d4ff)" opacity="0.6">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="200" r="3" fill="var(--accent, #00d4ff)" opacity="0.6">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="112" cy="200" r="3" fill="var(--accent, #00d4ff)" opacity="0.6">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
            </circle>
          </g>
        )}

        {/* Recording indicator dot */}
        {isListening && (
          <circle cx="100" cy="45" r="5" fill="#ff3366">
            <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      {/* State label */}
      <span style={{
        marginTop: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: isListening ? '#ff3366'
          : isThinking ? 'var(--accent, #00d4ff)'
          : state === 'speaking' ? '#00ff88'
          : 'var(--text-muted, #475569)',
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: 'uppercase',
        transition: 'color 0.3s',
      }}>
        {state === 'recording' ? 'Mendengarkan...'
          : state === 'transcribing' ? 'Memproses...'
          : state === 'thinking' ? 'Berpikir...'
          : state === 'speaking' ? 'Berbicara...'
          : 'Siap'}
      </span>
    </div>
  )
}

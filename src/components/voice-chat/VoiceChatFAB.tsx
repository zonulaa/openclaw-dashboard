'use client'

import React, { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { usePathname } from 'next/navigation'
import { VoiceChatWidget } from './VoiceChatWidget'

// Floating action button that toggles the voice chat widget.
// Positioned bottom-right. Hidden on the /voice-chat page (where
// the full-page version is already shown).

export function VoiceChatFAB() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Don't show FAB on the voice-chat page itself
  if (pathname === '/voice-chat') return null

  // Animate panel open/close
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!panelRef.current) return
    if (open) {
      gsap.fromTo(panelRef.current,
        { opacity: 0, y: 20, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' },
      )
    }
  }, [open])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!btnRef.current) return
    gsap.fromTo(btnRef.current,
      { scale: 0 },
      { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.6)', delay: 1 },
    )
  }, [])

  return (
    <>
      {/* Widget panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
              background: 'rgba(0,0,0,0.3)',
            }}
          />
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              bottom: 88,
              right: 20,
              zIndex: 999,
            }}
          >
            <VoiceChatWidget mode="widget" />
          </div>
        </>
      )}

      {/* FAB button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: open ? '2px solid var(--accent, #00d4ff)' : '2px solid var(--line-strong, rgba(0,212,255,0.25))',
          background: open
            ? 'radial-gradient(circle, rgba(0,212,255,0.2), rgba(0,212,255,0.05))'
            : 'var(--panel-strong, rgba(10,14,32,0.85))',
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(0,212,255,0.1)',
          transition: 'border-color 0.3s, background 0.3s',
          outline: 'none',
        }}
        aria-label={open ? 'Tutup obrolan suara' : 'Buka obrolan suara'}
        title="Voice Chat"
      >
        {open ? (
          // X icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #00d4ff)" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // Mic icon
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text, #e2e8f0)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <line x1="8" y1="21" x2="16" y2="21" />
          </svg>
        )}
      </button>
    </>
  )
}

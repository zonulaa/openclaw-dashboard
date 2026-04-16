'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { VoiceAvatar } from './VoiceAvatar'
import { RecordButton } from './RecordButton'
import { useVoiceChat } from './useVoiceChat'

// Main voice chat component — supports both floating widget and full-page mode.
// Bahasa Indonesia UI labels, English code comments.

type VoiceChatWidgetProps = {
  mode?: 'widget' | 'page'
}

export function VoiceChatWidget({ mode = 'widget' }: VoiceChatWidgetProps) {
  const {
    state,
    messages,
    error,
    currentTranscript,
    startRecording,
    stopRecording,
    sendMessage,
    stop,
    clearMessages,
  } = useVoiceChat()

  const [textInput, setTextInput] = useState('')
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Entrance animation
  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.fromTo(containerRef.current,
        { opacity: 0, y: mode === 'widget' ? 20 : 0, scale: mode === 'widget' ? 0.95 : 1 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out' },
      )
    }, containerRef)
    return () => ctx.revert()
  }, [mode])

  // Handle text input submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = textInput.trim()
    if (!text) return
    setTextInput('')
    sendMessage(text)
  }, [textInput, sendMessage])

  const isIdle = state === 'idle'
  const isRecording = state === 'recording'
  const isBusy = state === 'thinking' || state === 'transcribing' || state === 'speaking'

  const isPage = mode === 'page'

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        maxWidth: isPage ? 600 : 360,
        height: isPage ? '100%' : 520,
        background: isPage ? 'transparent' : 'var(--panel, rgba(8,12,30,0.65))',
        borderRadius: isPage ? 0 : 'var(--radius-card, 20px)',
        border: isPage ? 'none' : '1px solid var(--line, rgba(0,212,255,0.12))',
        padding: isPage ? '24px 16px' : '20px 16px 16px',
        backdropFilter: isPage ? 'none' : 'blur(20px)',
        boxShadow: isPage ? 'none' : '0 8px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingBottom: 8,
        borderBottom: '1px solid var(--line, rgba(0,212,255,0.12))',
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--text, #e2e8f0)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Obrolan Suara
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              style={{
                fontSize: 10,
                color: 'var(--text-muted, #475569)',
                background: 'none',
                border: '1px solid var(--line, rgba(0,212,255,0.12))',
                borderRadius: 6,
                padding: '3px 8px',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              aria-label="Hapus percakapan"
            >
              Hapus
            </button>
          )}
          {isBusy && (
            <button
              onClick={stop}
              style={{
                fontSize: 10,
                color: 'var(--danger, #ff3366)',
                background: 'none',
                border: '1px solid rgba(255,51,102,0.3)',
                borderRadius: 6,
                padding: '3px 8px',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              aria-label="Hentikan"
            >
              Berhenti
            </button>
          )}
        </div>
      </div>

      {/* Avatar */}
      <VoiceAvatar state={state} />

      {/* Current transcript (interim results while recording) */}
      {isRecording && currentTranscript && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-soft, #94a3b8)',
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '4px 12px',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          &ldquo;{currentTranscript}&rdquo;
        </div>
      )}

      {/* Record button */}
      <RecordButton
        isRecording={isRecording}
        disabled={isBusy}
        onStart={startRecording}
        onStop={stopRecording}
      />

      {/* Chat transcript */}
      <div style={{
        flex: 1,
        width: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 0,
        paddingTop: 8,
        borderTop: '1px solid var(--line, rgba(0,212,255,0.12))',
      }}>
        {messages.length === 0 && !error && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted, #475569)',
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            padding: '12px 0',
          }}>
            Tahan Space atau tekan tombol mikrofon untuk mulai berbicara
          </span>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: msg.role === 'user' ? 'var(--accent, #00d4ff)' : 'var(--accent-green, #00ff88)',
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 2,
            }}>
              {msg.role === 'user' ? 'Anda' : 'AI'}
            </span>
            <div style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: 'var(--text, #e2e8f0)',
              background: msg.role === 'user'
                ? 'rgba(0,212,255,0.08)'
                : 'rgba(0,255,136,0.06)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(0,212,255,0.15)' : 'rgba(0,255,136,0.12)'}`,
              borderRadius: 12,
              padding: '8px 12px',
              maxWidth: '85%',
              wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading dots when thinking */}
        {state === 'thinking' && (
          <div style={{
            display: 'flex',
            gap: 4,
            padding: '8px 12px',
            alignSelf: 'flex-start',
          }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent, #00d4ff)',
                  display: 'inline-block',
                  animation: `voice-thinking-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          fontSize: 11,
          color: 'var(--danger, #ff3366)',
          background: 'rgba(255,51,102,0.08)',
          border: '1px solid rgba(255,51,102,0.2)',
          borderRadius: 8,
          padding: '6px 12px',
          width: '100%',
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Text input (alternative to voice) */}
      <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Ketik pesan..."
          disabled={isBusy}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--line, rgba(0,212,255,0.12))',
            background: 'rgba(0,0,0,0.2)',
            color: 'var(--text, #e2e8f0)',
            padding: '0 12px',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent, #00d4ff)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--line, rgba(0,212,255,0.12))'
          }}
        />
        <button
          type="submit"
          disabled={isBusy || !textInput.trim()}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 10,
            border: '1px solid var(--line-strong, rgba(0,212,255,0.25))',
            background: 'rgba(0,212,255,0.1)',
            color: 'var(--accent, #00d4ff)',
            fontSize: 12,
            fontWeight: 600,
            cursor: isBusy || !textInput.trim() ? 'not-allowed' : 'pointer',
            opacity: isBusy || !textInput.trim() ? 0.4 : 1,
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'opacity 0.2s',
          }}
          aria-label="Kirim pesan"
        >
          Kirim
        </button>
      </form>

      <style>{`
        @keyframes voice-thinking-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}

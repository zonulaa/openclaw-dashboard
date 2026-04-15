'use client'

import { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react'
import { gsap } from '@/lib/gsap-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: number
  message: string
  type: ToastType
}

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmState = ConfirmOptions & {
  resolve: (ok: boolean) => void
}

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  confirm: async () => false,
})

export function useToast() {
  return useContext(ToastContext)
}

let toastId = 0

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: 'rgba(0,184,148,0.12)', border: 'rgba(0,184,148,0.3)', text: '#00FF9F', icon: '✅' },
  error:   { bg: 'rgba(255,107,107,0.12)', border: 'rgba(255,107,107,0.3)', text: '#FF6B6B', icon: '❌' },
  info:    { bg: 'rgba(119,173,255,0.12)', border: 'rgba(119,173,255,0.3)', text: '#77adff', icon: 'ℹ️' },
  warning: { bg: 'rgba(255,230,109,0.12)', border: 'rgba(255,230,109,0.3)', text: '#FFE66D', icon: '⚠️' },
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const confirmBoxRef = useRef<HTMLDivElement>(null)

  // ── Toast ──────────────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Confirm ────────────────────────────────────────────────────────────────

  // GSAP: confirm modal entrance
  useEffect(() => {
    if (!confirmState) return
    const tl = gsap.timeline()
    if (backdropRef.current) tl.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.15 })
    if (confirmBoxRef.current) tl.fromTo(confirmBoxRef.current, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.18, ease: 'back.out(1.4)' }, '<0.05')
    return () => { tl.kill() }
  }, [confirmState])

  const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setConfirmState({ ...opts, resolve })
    })
  }, [])

  const handleConfirmClose = useCallback((ok: boolean) => {
    // GSAP: confirm exit
    const tl = gsap.timeline({
      onComplete: () => {
        resolveRef.current?.(ok)
        resolveRef.current = null
        setConfirmState(null)
      }
    })
    if (confirmBoxRef.current) tl.to(confirmBoxRef.current, { scale: 0.9, opacity: 0, duration: 0.12, ease: 'power2.in' })
    if (backdropRef.current) tl.to(backdropRef.current, { opacity: 0, duration: 0.1 }, '<0.05')
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast, confirm: showConfirm }}>
      {children}

      {/* ── Custom Confirm Modal ──────────────────────────────────────────── */}
      {confirmState && (
        <div
          ref={backdropRef}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleConfirmClose(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            ref={confirmBoxRef}
            style={{
              background: 'linear-gradient(160deg, rgba(26,26,46,0.98), rgba(5,5,16,0.99))',
              border: `1px solid ${confirmState.danger ? 'rgba(255,107,107,0.4)' : 'rgba(37,37,64,0.9)'}`,
              borderRadius: '14px',
              padding: '24px',
              width: '320px',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.7)',
              fontFamily: 'Courier New, monospace',
            }}
          >
            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>{confirmState.danger ? '⚠️' : 'ℹ️'}</span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: confirmState.danger ? '#FF6B6B' : '#c8deff',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {confirmState.title ?? (confirmState.danger ? 'Confirm Delete' : 'Confirm Action')}
              </span>
            </div>

            {/* Divider */}
            <div style={{
              height: '1px',
              background: confirmState.danger ? 'rgba(255,107,107,0.2)' : 'rgba(0,212,255,0.12)',
              marginBottom: '14px',
            }} />

            {/* Message */}
            <p style={{
              fontSize: '11px',
              color: '#475569',
              lineHeight: '1.6',
              marginBottom: '20px',
            }}>
              {confirmState.message}
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleConfirmClose(false)}
                style={{
                  padding: '7px 16px',
                  background: 'rgba(0,212,255,0.09)',
                  border: '1px solid rgba(37,37,64,0.9)',
                  borderRadius: '7px',
                  color: '#5e7299',
                  fontSize: '10px',
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {confirmState.cancelLabel ?? 'CANCEL'}
              </button>
              <button
                onClick={() => handleConfirmClose(true)}
                style={{
                  padding: '7px 16px',
                  background: confirmState.danger ? 'rgba(255,107,107,0.15)' : 'rgba(0,212,255,0.1)',
                  border: `1px solid ${confirmState.danger ? 'rgba(255,107,107,0.4)' : 'rgba(0,212,255,0.3)'}`,
                  borderRadius: '7px',
                  color: confirmState.danger ? '#FF6B6B' : '#77adff',
                  fontSize: '10px',
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {confirmState.confirmLabel ?? (confirmState.danger ? '🗑️ DELETE' : 'CONFIRM')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Stack ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const colors = TOAST_COLORS[t.type]
          return (
            <ToastItem key={t.id} t={t} colors={colors} onRemove={() => removeToast(t.id)} />
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// ── Toast Item with GSAP enter/exit ──────────────────────────────────────────
function ToastItem({ t, colors, onRemove }: { t: Toast; colors: typeof TOAST_COLORS.success; onRemove: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    gsap.fromTo(ref.current, { x: 100, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: 'power2.out' })
  }, [])

  const handleClick = useCallback(() => {
    if (!ref.current) { onRemove(); return }
    gsap.to(ref.current, {
      x: 100,
      opacity: 0,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: onRemove,
    })
  }, [onRemove])

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: colors.text,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        maxWidth: '320px',
      }}
    >
      <span>{colors.icon}</span>
      <span>{t.message}</span>
    </div>
  )
}

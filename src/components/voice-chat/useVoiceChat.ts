'use client'

import { useState, useRef, useCallback } from 'react'

// Voice chat hook — manages STT, LLM chat, and TTS pipeline.
// Uses Web Speech API for STT (SpeechRecognition).
// TODO: Swap in Faster Whisper for better accuracy when self-hosted STT is available.

// Web Speech API type declarations (not in default TS lib)
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type VoiceChatState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'

type SpeechRecognitionEvent = {
  results: { length: number; [index: number]: { [index: number]: { transcript: string } } }
  resultIndex: number
}

type SpeechRecognitionErrorEvent = {
  error: string
  message: string
}

export function useVoiceChat() {
  const [state, setState] = useState<VoiceChatState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentTranscript, setCurrentTranscript] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Generate unique ID
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // ── Speech-to-Text (Web Speech API) ──────────────────────────────
  const startRecording = useCallback(() => {
    setError(null)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('Browser tidak mendukung Speech Recognition')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'id-ID' // Bahasa Indonesia

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setCurrentTranscript(transcript)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') {
        setError('Izin mikrofon ditolak. Aktifkan di pengaturan browser.')
      } else if (e.error !== 'aborted') {
        setError(`Kesalahan STT: ${e.error}`)
      }
      setState('idle')
    }

    recognition.onend = () => {
      // Recognition ended — handled by stopRecording
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('recording')
    setCurrentTranscript('')
  }, [])

  const stopRecording = useCallback(async () => {
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.stop()
      recognitionRef.current = null
    }

    // Use the accumulated transcript
    const transcript = currentTranscript.trim()
    if (!transcript) {
      setState('idle')
      return
    }

    setCurrentTranscript('')
    await sendMessage(transcript)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTranscript])

  // ── Send message to LLM ──────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    setError(null)
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, timestamp: Date.now() }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setState('thinking')

    try {
      abortRef.current = new AbortController()

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      })

      const data = await res.json()

      if (!data.ok) {
        throw new Error(data.error || 'Gagal mendapat respons AI')
      }

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Speak the response
      await speakText(data.reply)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
      setState('idle')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // ── Text-to-Speech ───────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    setState('speaking')

    try {
      // Try server-side edge-tts first
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (res.ok && res.headers.get('Content-Type')?.includes('audio')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        return new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url)
            audioRef.current = null
            setState('idle')
            resolve()
          }
          audio.onerror = () => {
            URL.revokeObjectURL(url)
            // Fallback to browser TTS
            browserTTS(text).then(resolve)
          }
          audio.play().catch(() => {
            URL.revokeObjectURL(url)
            browserTTS(text).then(resolve)
          })
        })
      }

      // Fallback: browser SpeechSynthesis
      await browserTTS(text)
    } catch {
      await browserTTS(text)
    }
  }, [])

  const browserTTS = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        setState('idle')
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'id-ID'
      utterance.rate = 1.0
      utterance.pitch = 1.0

      utterance.onend = () => {
        setState('idle')
        resolve()
      }
      utterance.onerror = () => {
        setState('idle')
        resolve()
      }

      window.speechSynthesis.speak(utterance)
    })
  }, [])

  // ── Stop everything ──────────────────────────────────────────────
  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setState('idle')
    setCurrentTranscript('')
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Whether audio is currently playing (for lip-sync)
  const isSpeaking = state === 'speaking'

  return {
    state,
    messages,
    error,
    currentTranscript,
    isSpeaking,
    startRecording,
    stopRecording,
    sendMessage,
    stop,
    clearMessages,
  }
}

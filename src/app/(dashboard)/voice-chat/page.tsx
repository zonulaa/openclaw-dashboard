'use client'

import React from 'react'
import { VoiceChatWidget } from '@/components/voice-chat/VoiceChatWidget'

// Voice chat page at /voice-chat — within the dashboard layout.
// Full-page mode with centered layout.

export default function VoiceChatPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 56px)',
      padding: '24px 16px',
    }}>
      <VoiceChatWidget mode="page" />
    </div>
  )
}

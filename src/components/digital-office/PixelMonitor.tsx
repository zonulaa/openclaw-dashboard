'use client'

import { cn } from '@/lib/utils'

type PixelMonitorProps = {
  isOn: boolean
  className?: string
}

export function PixelMonitor({ isOn, className }: PixelMonitorProps) {
  return (
    <div className={cn('pixel-monitor', isOn ? 'pixel-monitor--on' : 'pixel-monitor--off', className)}>
      {/* Screen */}
      <div className="pixel-monitor__screen">
        {isOn && (
          <div className="pixel-monitor__code">
            {/* Fake code lines */}
            <div className="pixel-monitor__code-line" style={{ width: '60%' }} />
            <div className="pixel-monitor__code-line" style={{ width: '80%' }} />
            <div className="pixel-monitor__code-line" style={{ width: '45%' }} />
            <div className="pixel-monitor__code-line" style={{ width: '70%' }} />
          </div>
        )}
        {!isOn && (
          <div className="pixel-monitor__power-led" />
        )}
      </div>
      {/* Stand */}
      <div className="pixel-monitor__stand" />
      {/* Base */}
      <div className="pixel-monitor__base" />
    </div>
  )
}

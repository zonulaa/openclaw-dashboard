'use client'

import { cn } from '@/lib/utils'

type PixelCharacterProps = {
  shirtColor: 'yellow' | 'blue' | 'purple'
  state: 'working' | 'idle' | 'arriving' | 'leaving'
  size?: number
  className?: string
}

// 8x10 pixel grid character (sitting pose)
// Colors: T=transparent, S=skin, H=hair, C=shirt, P=pants, K=shoe
const SITTING_PIXELS = [
  // Row 0: Hair
  ['T','T','H','H','H','H','T','T'],
  // Row 1: Head
  ['T','T','S','S','S','S','T','T'],
  // Row 2: Head + eyes
  ['T','T','S','E','S','E','T','T'],
  // Row 3: Head bottom
  ['T','T','S','S','S','S','T','T'],
  // Row 4: Shoulders + shirt
  ['T','C','C','C','C','C','C','T'],
  // Row 5: Arms + shirt
  ['S','C','C','C','C','C','C','S'],
  // Row 6: Shirt bottom / lap
  ['T','C','C','C','C','C','C','T'],
  // Row 7: Pants (sitting)
  ['T','P','P','P','P','P','P','T'],
  // Row 8: Legs bent
  ['T','T','P','P','P','P','T','T'],
  // Row 9: Shoes
  ['T','K','K','T','T','K','K','T'],
]

const COLOR_MAP: Record<string, Record<string, string>> = {
  yellow: {
    T: 'transparent',
    S: '#ffd5a0',
    H: '#4a3728',
    E: '#2d2d2d',
    C: '#f0c040',
    P: '#3a3a5c',
    K: '#2d2d3a',
  },
  blue: {
    T: 'transparent',
    S: '#ffd5a0',
    H: '#3a2820',
    E: '#2d2d2d',
    C: '#4a8fd4',
    P: '#3a3a5c',
    K: '#2d2d3a',
  },
  purple: {
    T: 'transparent',
    S: '#ffd5a0',
    H: '#3a2820',
    E: '#2d2d2d',
    C: '#A78BFA',
    P: '#3a3a5c',
    K: '#2d2d3a',
  },
}

export function PixelCharacter({ shirtColor, state, size = 3, className }: PixelCharacterProps) {
  const colors = COLOR_MAP[shirtColor]
  const px = size

  return (
    <div
      className={cn(
        'pixel-character',
        state === 'working' && 'pixel-character--working',
        state === 'arriving' && 'pixel-character--arriving',
        state === 'leaving' && 'pixel-character--leaving',
        className,
      )}
      aria-label={`Pixel character with ${shirtColor} shirt, ${state}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(8, ${px}px)`,
        gridTemplateRows: `repeat(10, ${px}px)`,
        gap: 0,
        width: 8 * px,
        height: 10 * px,
        imageRendering: 'pixelated',
      }}
    >
      {SITTING_PIXELS.flat().map((code, i) => (
        <div
          key={i}
          style={{
            width: px,
            height: px,
            backgroundColor: colors[code] || 'transparent',
          }}
        />
      ))}
    </div>
  )
}

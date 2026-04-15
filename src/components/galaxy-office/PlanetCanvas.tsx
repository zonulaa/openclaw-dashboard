'use client'

import React, { useRef, useEffect } from 'react'

// ── Planet surface presets ────────────────────────────────────────────

export type PlanetType = 'star' | 'earth' | 'mars' | 'venus' | 'saturn' | 'jupiter' | 'neptune' | 'generic'

type PlanetConfig = {
  baseColors: [number, number, number][]  // RGB array for surface bands
  cloudOpacity: number                     // 0-1, cloud layer intensity
  cloudSpeed: number                       // cloud rotation offset multiplier
  specularIntensity: number                // 0-1
  atmosphereColor: [number, number, number]
  hasRings: boolean
  ringColor: [number, number, number, number]  // RGBA
  banding: number                          // horizontal band count (for gas giants)
  roughness: number                        // 0-1 terrain noise
}

const PLANET_CONFIGS: Record<PlanetType, PlanetConfig> = {
  star: {
    baseColors: [[255,248,220], [255,183,77], [255,143,0], [230,81,0], [191,54,12]],
    cloudOpacity: 0.3, cloudSpeed: 1.5, specularIntensity: 0,
    atmosphereColor: [255,180,50], hasRings: false, ringColor: [0,0,0,0],
    banding: 12, roughness: 0.4,
  },
  earth: {
    baseColors: [[30,58,138], [30,64,175], [21,128,61], [34,197,94], [22,101,52]],
    cloudOpacity: 0.25, cloudSpeed: 0.7, specularIntensity: 0.6,
    atmosphereColor: [96,165,250], hasRings: false, ringColor: [0,0,0,0],
    banding: 0, roughness: 0.6,
  },
  mars: {
    baseColors: [[127,29,29], [153,27,27], [180,83,9], [220,38,38], [120,53,15]],
    cloudOpacity: 0.05, cloudSpeed: 0.3, specularIntensity: 0.15,
    atmosphereColor: [239,68,68], hasRings: false, ringColor: [0,0,0,0],
    banding: 0, roughness: 0.7,
  },
  venus: {
    baseColors: [[131,24,67], [190,24,93], [219,39,119], [244,114,182], [157,23,77]],
    cloudOpacity: 0.5, cloudSpeed: 0.4, specularIntensity: 0.3,
    atmosphereColor: [236,72,153], hasRings: false, ringColor: [0,0,0,0],
    banding: 6, roughness: 0.2,
  },
  saturn: {
    baseColors: [[88,28,135], [126,34,206], [168,85,247], [192,132,252], [107,33,168]],
    cloudOpacity: 0.15, cloudSpeed: 0.6, specularIntensity: 0.25,
    atmosphereColor: [168,85,247], hasRings: true, ringColor: [168,85,247,80],
    banding: 10, roughness: 0.15,
  },
  jupiter: {
    baseColors: [[5,46,22], [21,128,61], [34,197,94], [74,222,128], [22,163,74]],
    cloudOpacity: 0.2, cloudSpeed: 0.8, specularIntensity: 0.2,
    atmosphereColor: [34,197,94], hasRings: false, ringColor: [0,0,0,0],
    banding: 14, roughness: 0.1,
  },
  neptune: {
    baseColors: [[4,47,46], [13,148,136], [45,212,191], [153,246,228], [17,94,89]],
    cloudOpacity: 0.2, cloudSpeed: 0.5, specularIntensity: 0.35,
    atmosphereColor: [45,212,191], hasRings: false, ringColor: [0,0,0,0],
    banding: 8, roughness: 0.2,
  },
  generic: {
    baseColors: [[51,65,85], [100,116,139], [148,163,184], [71,85,105], [30,41,59]],
    cloudOpacity: 0.1, cloudSpeed: 0.5, specularIntensity: 0.3,
    atmosphereColor: [148,163,184], hasRings: false, ringColor: [0,0,0,0],
    banding: 0, roughness: 0.4,
  },
}

// ── Noise function (simple hash-based) ───────────────────────────────

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const n00 = hash(ix, iy), n10 = hash(ix + 1, iy)
  const n01 = hash(ix, iy + 1), n11 = hash(ix + 1, iy + 1)
  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) + n01 * (1 - sx) * sy + n11 * sx * sy
}

function fbm(x: number, y: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq)
    amp *= 0.5; freq *= 2
  }
  return val
}

// ── Render planet to canvas ──────────────────────────────────────────

function renderPlanet(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  config: PlanetConfig,
  rotation: number,
  isStar: boolean,
) {
  const cx = w / 2, cy = h / 2
  const r = Math.min(cx, cy) * 0.82  // sphere radius (leave room for atmosphere)
  const atmoR = r * 1.12

  ctx.clearRect(0, 0, w, h)

  // ── Atmosphere glow ──
  const atmoGrad = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, atmoR)
  const [ar, ag, ab] = config.atmosphereColor
  atmoGrad.addColorStop(0, `rgba(${ar},${ag},${ab},0)`)
  atmoGrad.addColorStop(0.5, `rgba(${ar},${ag},${ab},${isStar ? 0.3 : 0.12})`)
  atmoGrad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
  ctx.fillStyle = atmoGrad
  ctx.fillRect(0, 0, w, h)

  // ── Rings (drawn behind half, then in front half) ──
  if (config.hasRings) {
    drawRing(ctx, cx, cy, r, config.ringColor, false)
  }

  // ── Planet sphere (pixel by pixel for true 3D) ──
  const imgData = ctx.createImageData(w, h)
  const data = imgData.data
  const lightDir = { x: -0.6, y: -0.5, z: 0.6 }  // top-left light
  const lightLen = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2)
  lightDir.x /= lightLen; lightDir.y /= lightLen; lightDir.z /= lightLen

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const dx = (px - cx) / r, dy = (py - cy) / r
      const dist2 = dx * dx + dy * dy
      if (dist2 > 1) continue

      // Sphere normal
      const dz = Math.sqrt(1 - dist2)
      const nx = dx, ny = dy, nz = dz

      // Spherical UV mapping
      const theta = Math.atan2(nx, nz)  // longitude
      const phi = Math.asin(ny)          // latitude
      let u = (theta / Math.PI + 1) / 2 + rotation  // wrap + rotation
      const v = phi / Math.PI + 0.5

      // ── Surface color ──
      const colors = config.baseColors
      let colorIdx: number

      if (config.banding > 0) {
        // Gas giant: horizontal bands
        const band = (Math.sin(v * Math.PI * config.banding + fbm(u * 8, v * 8, 3) * 2) + 1) / 2
        colorIdx = band * (colors.length - 1)
      } else {
        // Rocky: noise-based terrain
        const noise = fbm(u * 6 + rotation * 0.5, v * 6, 4)
        colorIdx = noise * (colors.length - 1)
      }

      const ci = Math.floor(colorIdx)
      const cf = colorIdx - ci
      const c0 = colors[Math.min(ci, colors.length - 1)]
      const c1 = colors[Math.min(ci + 1, colors.length - 1)]
      let cr = c0[0] + (c1[0] - c0[0]) * cf
      let cg = c0[1] + (c1[1] - c0[1]) * cf
      let cb = c0[2] + (c1[2] - c0[2]) * cf

      // ── Roughness detail ──
      if (config.roughness > 0) {
        const detail = fbm(u * 20 + rotation, v * 20, 3) * config.roughness * 40 - 20
        cr = Math.max(0, Math.min(255, cr + detail))
        cg = Math.max(0, Math.min(255, cg + detail))
        cb = Math.max(0, Math.min(255, cb + detail))
      }

      // ── Clouds ──
      if (config.cloudOpacity > 0) {
        const cloud = fbm(u * 5 + rotation * config.cloudSpeed, v * 4, 3)
        if (cloud > 0.45) {
          const cAmount = Math.min(1, (cloud - 0.45) * 4) * config.cloudOpacity
          cr = cr * (1 - cAmount) + 240 * cAmount
          cg = cg * (1 - cAmount) + 245 * cAmount
          cb = cb * (1 - cAmount) + 250 * cAmount
        }
      }

      // ── Lighting ──
      const diffuse = Math.max(0, nx * lightDir.x + ny * lightDir.y + nz * lightDir.z)

      // Specular (Blinn-Phong)
      const viewDir = { x: 0, y: 0, z: 1 }
      const halfX = lightDir.x + viewDir.x, halfY = lightDir.y + viewDir.y, halfZ = lightDir.z + viewDir.z
      const halfLen = Math.sqrt(halfX ** 2 + halfY ** 2 + halfZ ** 2)
      const specDot = Math.max(0, (nx * halfX + ny * halfY + nz * halfZ) / halfLen)
      const specular = Math.pow(specDot, isStar ? 4 : 32) * config.specularIntensity

      // Ambient
      const ambient = isStar ? 0.5 : 0.08

      // Rim lighting (Fresnel)
      const rim = Math.pow(1 - nz, 3) * 0.4

      const light = Math.min(1, ambient + diffuse * (isStar ? 0.5 : 0.85) + rim)

      let fr = cr * light + specular * 255
      let fg = cg * light + specular * 255
      let fb = cb * light + specular * 255

      // Rim glow (atmosphere color on edges)
      if (!isStar) {
        const rimGlow = Math.pow(1 - nz, 4) * 0.6
        fr += ar * rimGlow
        fg += ag * rimGlow
        fb += ab * rimGlow
      }

      const idx = (py * w + px) * 4
      data[idx] = Math.min(255, fr)
      data[idx + 1] = Math.min(255, fg)
      data[idx + 2] = Math.min(255, fb)
      data[idx + 3] = 255

      // Anti-alias edge
      if (dist2 > 0.92) {
        const edge = (1 - dist2) / 0.08
        data[idx + 3] = Math.round(255 * Math.min(1, edge * 2))
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)

  // ── Rings in front ──
  if (config.hasRings) {
    drawRing(ctx, cx, cy, r, config.ringColor, true)
  }
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: [number, number, number, number],
  front: boolean,
) {
  const [rr, rg, rb, ra] = color
  const innerR = r * 1.2, outerR = r * 1.7
  const tilt = 0.3  // ring tilt factor

  ctx.save()
  ctx.beginPath()
  // Only draw front or back half
  if (front) {
    ctx.rect(0, cy, cx * 2, cy)
  } else {
    ctx.rect(0, 0, cx * 2, cy)
  }
  ctx.clip()

  // Draw ring as series of ellipses
  for (let i = 0; i < 8; i++) {
    const t = i / 8
    const ringR = innerR + t * (outerR - innerR)
    const alpha = (ra / 255) * (1 - t * 0.5) * (0.3 + Math.sin(t * Math.PI * 4) * 0.2)
    ctx.beginPath()
    ctx.ellipse(cx, cy, ringR, ringR * tilt, 0, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(${rr},${rg},${rb},${alpha})`
    ctx.lineWidth = (outerR - innerR) / 10
    ctx.stroke()
  }
  ctx.restore()
}

// ── React Component ──────────────────────────────────────────────────

type Props = {
  type: PlanetType
  size: number
  rotationSpeed?: number  // seconds per full rotation
  className?: string
}

export function PlanetCanvas({ type, size, rotationSpeed = 20, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = 2  // retina
    const w = size * scale, h = size * scale
    canvas.width = w
    canvas.height = h

    const config = PLANET_CONFIGS[type]
    let animId: number
    const startTime = Date.now()

    function draw() {
      if (!ctx) return
      const elapsed = (Date.now() - startTime) / 1000
      const rotation = (elapsed / rotationSpeed) % 1
      renderPlanet(ctx, w, h, config, rotation, type === 'star')
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => cancelAnimationFrame(animId)
  }, [type, size, rotationSpeed])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
      }}
    />
  )
}

'use client'

import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'

// ── Canvas Starfield with parallax ───────────────────────────────────

function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = 0, h = 0

    function resize() {
      if (!canvas) return
      w = canvas.width = canvas.offsetWidth * 2
      h = canvas.height = canvas.offsetHeight * 2
      ctx!.scale(1, 1)
    }
    resize()
    window.addEventListener('resize', resize)

    // Generate stars in 3 layers
    type Star = { x: number; y: number; r: number; a: number; speed: number; phase: number }
    const stars: Star[] = []
    for (let i = 0; i < 250; i++) {
      const layer = i < 160 ? 0 : i < 220 ? 1 : 2
      stars.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        r: layer === 0 ? 0.5 + Math.random() * 0.5 : layer === 1 ? 1 + Math.random() * 0.8 : 1.5 + Math.random() * 1.5,
        a: 0.3 + Math.random() * 0.7,
        speed: layer === 0 ? 0.002 : layer === 1 ? 0.005 : 0.01,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const move = (e: MouseEvent) => {
      mouseRef.current = { x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 }
    }
    window.addEventListener('mousemove', move)

    function draw(t: number) {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.001 + s.phase)
        const px = ((s.x / 2000) * w + mx * s.speed * w * 8) % w
        const py = ((s.y / 2000) * h + my * s.speed * h * 8) % h

        ctx.beginPath()
        ctx.arc(px, py, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 220, 255, ${s.a * twinkle})`
        ctx.fill()

        // Bright stars get a glow
        if (s.r > 1.5) {
          ctx.beginPath()
          ctx.arc(px, py, s.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(200, 220, 255, ${s.a * twinkle * 0.12})`
          ctx.fill()
        }
      }
      animId = requestAnimationFrame(draw)
    }
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', move)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

// ── Nebula Clouds ────────────────────────────────────────────────────

function NebulaClouds() {
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const ref3 = useRef<HTMLDivElement>(null)
  const ref4 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const els = [ref1.current, ref2.current, ref3.current, ref4.current]
    const tweens = els.map((el, i) => {
      if (!el) return null
      return gsap.to(el, {
        x: `+=${30 + i * 12}`,
        y: `+=${15 + i * 8}`,
        duration: 20 + i * 5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    })
    return () => tweens.forEach(t => t?.kill())
  }, [])

  const base: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    pointerEvents: 'none',
    zIndex: 0,
  }

  return (
    <>
      <div ref={ref1} style={{ ...base, width: 500, height: 500, left: '5%', top: '10%', background: 'radial-gradient(circle, rgba(0,229,255,0.12) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div ref={ref2} style={{ ...base, width: 600, height: 600, right: '0%', top: '20%', background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <div ref={ref3} style={{ ...base, width: 400, height: 400, left: '40%', bottom: '5%', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      {/* Aurora band */}
      <div ref={ref4} style={{ ...base, width: '120%', height: 120, left: '-10%', top: '45%', borderRadius: 0, background: 'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.04) 20%, rgba(168,85,247,0.05) 50%, rgba(45,212,191,0.04) 80%, transparent 100%)', filter: 'blur(40px)' }} />
    </>
  )
}

// ── Shooting Stars ───────────────────────────────────────────────────

function ShootingStars() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let active = true

    function spawnStar() {
      if (!active || !container) return
      const star = document.createElement('div')
      const startX = Math.random() * 100
      const startY = Math.random() * 40
      const angle = 20 + Math.random() * 25
      const len = 80 + Math.random() * 60

      star.style.cssText = `
        position: absolute;
        left: ${startX}%;
        top: ${startY}%;
        width: ${len}px;
        height: 1.5px;
        background: linear-gradient(90deg, transparent, rgba(200,220,255,0.8), rgba(0,229,255,0.6), transparent);
        transform: rotate(${angle}deg);
        pointer-events: none;
        opacity: 0;
        border-radius: 1px;
      `
      container.appendChild(star)

      gsap.to(star, {
        x: 300,
        y: 200,
        opacity: 1,
        duration: 0.3,
        ease: 'power1.in',
        onComplete: () => {
          gsap.to(star, {
            x: 600,
            y: 400,
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: () => star.remove(),
          })
        },
      })

      // Schedule next
      const delay = 4000 + Math.random() * 10000
      setTimeout(spawnStar, delay)
    }

    const initDelay = setTimeout(spawnStar, 2000 + Math.random() * 3000)
    // Second stream
    const initDelay2 = setTimeout(spawnStar, 5000 + Math.random() * 5000)

    return () => {
      active = false
      clearTimeout(initDelay)
      clearTimeout(initDelay2)
    }
  }, [])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />
}

// ── Perspective Grid Floor ───────────────────────────────────────────

function PerspectiveGrid() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '-20%',
        right: '-20%',
        height: '40%',
        transform: 'perspective(800px) rotateX(60deg)',
        transformOrigin: 'center bottom',
        backgroundImage: `
          linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.5,
        maskImage: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 80%)',
        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 80%)',
      }}
    />
  )
}

// ── Combined Background ──────────────────────────────────────────────

export function GalaxyBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      <StarfieldCanvas />
      <NebulaClouds />
      <ShootingStars />
      <PerspectiveGrid />
    </div>
  )
}

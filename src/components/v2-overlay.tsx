"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";

// ── Aurora gradient mesh background ──────────────────────────────────

export function V2Aurora() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;

    const colors = ["#00d4ff", "#a855f7", "#2dd4bf", "#f472b6", "#00d4ff"];

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const blobs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * (canvas?.width ?? 1200),
      y: Math.random() * (canvas?.height ?? 800),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.25,
      radius: 280 + Math.random() * 220,
      color: colors[i],
    }));

    function draw() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      blobs.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -b.radius || b.x > canvas.width + b.radius) b.vx *= -1;
        if (b.y < -b.radius || b.y > canvas.height + b.radius) b.vy *= -1;

        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
        grad.addColorStop(0, b.color + "18");
        grad.addColorStop(0.5, b.color + "08");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

// ── Cursor glow that follows the mouse ───────────────────────────────

export function V2CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const glow = glowRef.current;
    if (!glow) return;

    const move = (e: MouseEvent) => {
      gsap.to(glow, {
        left: e.clientX - 120,
        top: e.clientY - 120,
        duration: 0.35,
        ease: "power2.out",
      });
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <div
      ref={glowRef}
      style={{
        position: "fixed",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 1,
        mixBlendMode: "screen",
      }}
    />
  );
}

// ── Matrix-style falling data stream ─────────────────────────────────

export function V2DataStream() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chars = "01001110101100ABCDEF";
    const elements: HTMLDivElement[] = [];

    for (let i = 0; i < 25; i++) {
      const col = document.createElement("div");
      const size = 9 + Math.random() * 4;
      const opacity = 0.02 + Math.random() * 0.04;
      col.style.cssText = `
        position: absolute;
        top: ${-10 + Math.random() * 20}%;
        left: ${Math.random() * 100}%;
        font-family: 'JetBrains Mono', monospace;
        font-size: ${size}px;
        color: #00d4ff;
        opacity: ${opacity};
        pointer-events: none;
        writing-mode: vertical-lr;
        letter-spacing: 0.3em;
      `;
      col.textContent = Array.from(
        { length: 20 + Math.floor(Math.random() * 15) },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");
      container.appendChild(col);
      elements.push(col);

      gsap.to(col, {
        y: "120vh",
        duration: 18 + Math.random() * 22,
        repeat: -1,
        ease: "none",
        delay: Math.random() * 12,
      });
    }

    return () => {
      elements.forEach((el) => {
        gsap.killTweensOf(el);
        el.remove();
      });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
}

// ── Global ripple on click ───────────────────────────────────────────

function useGlobalRipple() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const ripple = document.createElement("div");
      ripple.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        width: 0;
        height: 0;
        border-radius: 50%;
        border: 1px solid #00d4ff;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
      `;
      document.body.appendChild(ripple);
      gsap.to(ripple, {
        width: 200,
        height: 200,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        onComplete: () => ripple.remove(),
      });
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
}

// ── Global magnetic hover on .v2-magnet elements ─────────────────────

function useGlobalMagnetic() {
  useEffect(() => {
    // Skip on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    function attachMagnetic(el: Element) {
      if ((el as HTMLElement).dataset.v2MagnetBound) return;
      (el as HTMLElement).dataset.v2MagnetBound = "1";

      const onMove = (e: Event) => {
        const me = e as MouseEvent;
        const rect = (el as HTMLElement).getBoundingClientRect();
        const x = me.clientX - rect.left - rect.width / 2;
        const y = me.clientY - rect.top - rect.height / 2;
        gsap.to(el, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: "power2.out" });
      };
      const onLeave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
    }

    // Attach to existing elements
    document.querySelectorAll(".v2-magnet").forEach(attachMagnetic);

    // Watch for new .v2-magnet elements added to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.classList.contains("v2-magnet")) attachMagnetic(node);
            node.querySelectorAll(".v2-magnet").forEach(attachMagnetic);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
}

// ── Global card clip-path reveal + 3D tilt + border animation ────────

function useGlobalCardEffects() {
  useEffect(() => {
    // Skip tilt on touch devices
    const isTouch = window.matchMedia("(pointer: coarse)").matches;

    function attachCardEffects(card: Element) {
      const el = card as HTMLElement;
      if (el.dataset.v2CardBound) return;
      el.dataset.v2CardBound = "1";

      // Clip-path reveal animation
      gsap.fromTo(
        el,
        { clipPath: "circle(0% at 50% 50%)", opacity: 0 },
        {
          clipPath: "circle(120% at 50% 50%)",
          opacity: 1,
          stagger: 0.12,
          duration: 1,
          ease: "power3.out",
          delay: 0.3,
        }
      );

      if (isTouch) return;

      // 3D tilt on hover
      const onMove = (e: Event) => {
        const me = e as MouseEvent;
        const rect = el.getBoundingClientRect();
        const x = (me.clientX - rect.left) / rect.width;
        const y = (me.clientY - rect.top) / rect.height;
        const rotateX = (y - 0.5) * -8;
        const rotateY = (x - 0.5) * 8;
        gsap.to(el, {
          rotateX,
          rotateY,
          duration: 0.2,
          ease: "power1.out",
          transformPerspective: 1000,
        });
      };
      const onLeave = () => {
        gsap.to(el, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.6,
          ease: "elastic.out(1, 0.5)",
        });
      };

      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
    }

    function attachBorderAnim(el: Element) {
      if ((el as HTMLElement).dataset.v2BorderBound) return;
      (el as HTMLElement).dataset.v2BorderBound = "1";
      gsap.to(el, {
        backgroundPosition: "200% center",
        duration: 3,
        repeat: -1,
        ease: "none",
      });
    }

    // Attach to existing elements
    document.querySelectorAll(".v2-card").forEach(attachCardEffects);
    document.querySelectorAll(".v2-card-border-anim").forEach(attachBorderAnim);

    // Watch for new elements
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.classList.contains("v2-card")) attachCardEffects(node);
            if (node.classList.contains("v2-card-border-anim")) attachBorderAnim(node);
            node.querySelectorAll(".v2-card").forEach(attachCardEffects);
            node.querySelectorAll(".v2-card-border-anim").forEach(attachBorderAnim);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
}

// ── V2GlobalEffects — Single component for ALL global V2 effects ─────

export function V2GlobalEffects() {
  useGlobalRipple();
  useGlobalMagnetic();
  useGlobalCardEffects();

  return (
    <>
      <V2Aurora />
      <V2DataStream />
      <V2CursorGlow />
    </>
  );
}

// ── Legacy exports (backwards compat for dashboard-v2 page) ──────────

export function V2Ripple({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function V2Overlay({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

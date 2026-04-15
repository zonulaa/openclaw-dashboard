/**
 * GSAP utility presets + V2 reusable components for User Control dashboard.
 *
 * Usage:  import { V2Card, V2Greeting, V2Ticker, ... } from "@/lib/gsap-utils";
 */
"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// ---------------------------------------------------------------------------
// Plugin registration (run once)
// ---------------------------------------------------------------------------
let _registered = false;
export function registerGSAPPlugins(): void {
  if (_registered) return;
  gsap.registerPlugin(ScrollTrigger);
  _registered = true;
}
if (typeof window !== "undefined") registerGSAPPlugins();

// ---------------------------------------------------------------------------
// V2 Color Palette
// ---------------------------------------------------------------------------
export const C = {
  cyan: "#00d4ff",
  purple: "#a855f7",
  teal: "#2dd4bf",
  pink: "#f472b6",
  green: "#00ff88",
  amber: "#fbbf24",
  red: "#ff3366",
  bg: "#050510",
  glass: "rgba(8, 12, 30, 0.65)",
  border: "rgba(0, 212, 255, 0.12)",
  text: "#e2e8f0",
  muted: "#475569",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type El = string | Element | Element[];
type Vars = gsap.TweenVars;

export function formatIDR(n: number) {
  if (n == null || isNaN(n)) return "Rp 0";
  if (n >= 1_000_000) return "Rp " + n.toLocaleString("id-ID");
  if (n >= 1_000) return "Rp " + n.toLocaleString("id-ID");
  return "Rp " + n.toLocaleString("id-ID");
}

export function timeAgo(v: string | number | undefined) {
  if (!v || v === "recent" || v === "unknown") return "—";
  const ms = typeof v === "number" ? v : new Date(v).getTime();
  if (isNaN(ms)) return "—";
  const d = Date.now() - ms;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

export function todayWIB() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// ---------------------------------------------------------------------------
// Preset animations
// ---------------------------------------------------------------------------

export function fadeInUp(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.fromTo(target, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", ...overrides });
}

export function fadeIn(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", ...overrides });
}

export function slideUp(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.fromTo(target, { y: 30 }, { y: 0, duration: 0.5, ease: "power2.out", ...overrides });
}

export function staggerFadeIn(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.fromTo(target, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: "power2.out", ...overrides });
}

export function scaleIn(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.fromTo(target, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.2)", ...overrides });
}

export function pulse(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.fromTo(target, { scale: 1 }, { scale: 1.02, duration: 0.3, yoyo: true, repeat: 1, ease: "power2.inOut", ...overrides });
}

export function shake(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.to(target, {
    keyframes: [
      { x: -5, duration: 0.08 }, { x: 5, duration: 0.08 },
      { x: -5, duration: 0.08 }, { x: 5, duration: 0.08 }, { x: 0, duration: 0.08 },
    ],
    ease: "power2.inOut",
    ...overrides,
  });
}

export function slideUpOut(target: El, overrides: Vars = {}): gsap.core.Tween {
  return gsap.to(target, { y: -20, opacity: 0, duration: 0.3, ease: "power2.in", ...overrides });
}

export function countUp(target: El, endValue: number, overrides: Vars = {}): gsap.core.Tween {
  const obj = { val: 0 };
  return gsap.to(obj, {
    val: endValue, duration: 1, ease: "power2.out",
    onUpdate() { if (target instanceof Element) target.textContent = Math.round(obj.val).toString(); },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// V2Card — Reusable glass card with optional glow border + 3D tilt
// ---------------------------------------------------------------------------

export function V2Card({
  icon, label, children, glow = false, className = "",
}: {
  icon: string; label: string; children: ReactNode; glow?: boolean; className?: string;
}) {
  return (
    <div className={`v2-card ${glow ? "v2-card-border-anim" : ""} ${className}`}>
      <div className="v2-card-header">
        <span className="v2-card-icon">{icon}</span>
        <span className="v2-card-label">{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2Greeting — Terminal-style greeting with ScrambleText + live clock
// ---------------------------------------------------------------------------

export function V2Greeting() {
  const [time, setTime] = useState("");
  const [greeting, setGreeting] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const hour = parseInt(now.toLocaleString("en-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", hour12: false }));
      setGreeting(hour < 12 ? "MORNING" : hour < 18 ? "AFTERNOON" : "EVENING");
      setTime(now.toLocaleTimeString("en-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString("en-ID", { timeZone: "Asia/Jakarta", weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase());
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="v2-greeting">
      <div className="v2-terminal">
        <span>{">"} GOOD {greeting}, COMMANDER</span>
        <span className="v2-cursor-blink" />
      </div>
      <div className="v2-date">{dateStr} · {time} WIB</div>
      <div className="v2-status-row">
        <span className="v2-status-pill"><span className="v2-dot-live" /> SYSTEM OPERATIONAL</span>
        <span className="v2-status-pill" style={{ background: `${C.purple}11`, borderColor: `${C.purple}33`, color: C.purple }}>
          ◈ MISSION CONTROL v2
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2Ticker — Horizontal scrolling marquee for market/price data
// ---------------------------------------------------------------------------

export function V2Ticker({ items }: { items: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;
    const w = track.scrollWidth / 2;
    gsap.to(track, { x: -w, duration: 35, ease: "none", repeat: -1, delay: 1.5 });
    return () => { gsap.killTweensOf(track); };
  }, [items.length]);

  return (
    <div className="v2-ticker-wrap">
      <div className="v2-ticker-track" ref={trackRef}>{items}{items}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2Badge — Status badge pills
// ---------------------------------------------------------------------------

export function V2Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className="v2-badge-ok" style={{ marginBottom: "0.4rem", alignSelf: "flex-start" }}>
      <span className="v2-dot-live" style={{ width: 5, height: 5 }} />
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// V2Stat — Single stat block
// ---------------------------------------------------------------------------

export function V2Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="v2-stat">
      <div className="v2-stat-val">{value}</div>
      <div className="v2-stat-lbl">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2Empty — Empty state placeholder
// ---------------------------------------------------------------------------

export function V2Empty({ text = "No data" }: { text?: string }) {
  return <div className="v2-empty">{text}</div>;
}

// ---------------------------------------------------------------------------
// Re-exports — gsap + plugins + ScrambleText
// ---------------------------------------------------------------------------

export { gsap, ScrollTrigger };
export { ScrambleText } from "@/components/scramble-text";

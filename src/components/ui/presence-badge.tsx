import * as React from "react";
import { cn } from "@/lib/utils";

export type PresenceTone = "working" | "focus" | "idle" | "queued" | "online" | "busy" | "offline";

export interface PresenceBadgeProps {
  tone: PresenceTone;
  label: string;
  className?: string;
}

// ── Dot pulse animation keyframes (injected once via <style>) ────────
const PULSE_CSS = `
@keyframes presence-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(1.35); }
}
`;

// ── Tone config ─────────────────────────────────────────────────────
const toneConfig: Record<
  PresenceTone,
  {
    pill: React.CSSProperties;
    pillClass: string;
    dot: React.CSSProperties;
    label: React.CSSProperties;
    animate: boolean;
  }
> = {
  // working / online → muted blue at 40%
  working: {
    pillClass: "",
    pill: {
      background: "rgba(0,212,255,0.08)",
      border: "1px solid rgba(0,212,255,0.3)",
      boxShadow: "0 0 10px rgba(0,212,255,0.15)",
    },
    dot: {
      background: "rgba(0,212,255,0.9)",
      boxShadow: "0 0 6px rgba(9,132,227,0.6)",
    },
    label: { color: "#77adff" },
    animate: true,
  },
  // online → green
  online: {
    pillClass: "",
    pill: {
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.4)",
      boxShadow: "0 0 10px rgba(34,197,94,0.2)",
    },
    dot: {
      background: "rgba(34,197,94,0.9)",
      boxShadow: "0 0 6px rgba(34,197,94,0.6)",
    },
    label: { color: "#4ade80" },
    animate: true,
  },
  // busy → red
  busy: {
    pillClass: "",
    pill: {
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.4)",
      boxShadow: "0 0 10px rgba(239,68,68,0.2)",
    },
    dot: {
      background: "rgba(239,68,68,0.9)",
      boxShadow: "0 0 6px rgba(239,68,68,0.6)",
    },
    label: { color: "#f87171" },
    animate: true,
  },
  // focus → amber/yellow
  focus: {
    pillClass: "",
    pill: {
      background: "rgba(251,191,36,0.1)",
      border: "1px solid rgba(251,191,36,0.4)",
      boxShadow: "0 0 10px rgba(251,191,36,0.22)",
    },
    dot: {
      background: "#fbbf24",
      boxShadow: "0 0 6px rgba(251,191,36,0.7)",
    },
    label: { color: "#fde68a" },
    animate: true,
  },
  // idle → teal
  idle: {
    pillClass: "",
    pill: {
      background: "rgba(20,184,166,0.1)",
      border: "1px solid rgba(20,184,166,0.35)",
    },
    dot: {
      background: "rgba(20,184,166,0.85)",
      boxShadow: "0 0 5px rgba(20,184,166,0.5)",
    },
    label: { color: "#2dd4bf" },
    animate: false,
  },
  // offline → muted
  offline: {
    pillClass: "",
    pill: {
      background: "rgba(130,149,188,0.08)",
      border: "1px solid rgba(130,149,188,0.25)",
    },
    dot: {
      background: "#475569",
    },
    label: { color: "#475569" },
    animate: false,
  },
  // queued → purple
  queued: {
    pillClass: "",
    pill: {
      background: "rgba(167,139,250,0.1)",
      border: "1px solid rgba(167,139,250,0.38)",
      boxShadow: "0 0 8px rgba(167,139,250,0.18)",
    },
    dot: {
      background: "#a78bfa",
      boxShadow: "0 0 6px rgba(167,139,250,0.65)",
    },
    label: { color: "#c4b5fd" },
    animate: true,
  },
};

// ── Component ───────────────────────────────────────────────────────
export function PresenceBadge({ tone, label, className }: PresenceBadgeProps) {
  const cfg = toneConfig[tone] ?? toneConfig.offline;

  return (
    <>
      <style>{PULSE_CSS}</style>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
          "text-[0.7rem] font-semibold uppercase tracking-wide select-none",
          className
        )}
        style={cfg.pill}
        aria-label={`Presence: ${label}`}
      >
        {/* Animated presence dot */}
        <span
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{
            ...cfg.dot,
            animation: cfg.animate
              ? "presence-dot-pulse 2s ease-in-out infinite"
              : undefined,
          }}
          aria-hidden="true"
        />
        <span style={cfg.label}>{label}</span>
      </span>
    </>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/themes";

// ── Props ───────────────────────────────────────────────────────────
export interface AgentAvatarProps {
  /** Display name — used for initials and color derivation */
  name: string;
  /** Override the auto-derived color index */
  colorSeed?: string;
  /** Avatar size */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Whether to show a status indicator dot */
  status?: "working" | "focus" | "idle" | "queued" | "offline";
  /** Additional class names on the wrapper */
  className?: string;
  /** Use strong ring style (for prominent displays) */
  strong?: boolean;
}

// ── Size map ────────────────────────────────────────────────────────
const sizeMap = {
  xs: { container: "h-6 w-6", text: "text-[10px]", dot: "h-1.5 w-1.5" },
  sm: { container: "h-8 w-8", text: "text-xs", dot: "h-2 w-2" },
  md: { container: "h-9 w-9", text: "text-sm", dot: "h-2.5 w-2.5" },
  lg: { container: "h-11 w-11", text: "text-base", dot: "h-3 w-3" },
  xl: { container: "h-14 w-14", text: "text-lg", dot: "h-3.5 w-3.5" },
} as const;

// ── Status dot colors ────────────────────────────────────────────────
const statusDotColor = {
  working: "bg-cyan-DEFAULT",
  focus: "bg-amber-DEFAULT",
  idle: "bg-void-text-muted",
  queued: "bg-[#a78bfa]",
  offline: "bg-[rgba(130,149,188,0.4)]",
} as const;

// ── Status ring glow (for "working" — pulsing cyan border) ───────────
const workingRingStyle: React.CSSProperties = {
  boxShadow: "0 0 0 2px #77adff, 0 0 12px 2px rgba(119,173,255,0.55)",
  animation: "agent-avatar-pulse 2s ease-in-out infinite",
};

const focusRingStyle: React.CSSProperties = {
  boxShadow: "0 0 0 2px #fbbf24, 0 0 10px 1px rgba(251,191,36,0.45)",
};

// ── Initials helper ──────────────────────────────────────────────────
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Component ───────────────────────────────────────────────────────
export function AgentAvatar({
  name,
  colorSeed,
  size = "md",
  status,
  className,
  strong = false,
}: AgentAvatarProps) {
  const colors = getAvatarColor(colorSeed ?? name);
  const { container, text, dot } = sizeMap[size];
  const initials = getInitials(name);

  // Determine ring style based on status
  const ringStyle: React.CSSProperties =
    status === "working"
      ? workingRingStyle
      : status === "focus"
        ? focusRingStyle
        : {};

  return (
    <>
      {/* Keyframe injection — lightweight, idempotent */}
      <style>{`
        @keyframes agent-avatar-pulse {
          0%, 100% { box-shadow: 0 0 0 2px #77adff, 0 0 12px 2px rgba(119,173,255,0.55); }
          50%       { box-shadow: 0 0 0 2px #77adff, 0 0 20px 5px rgba(119,173,255,0.85); }
        }
      `}</style>
      <span className={cn("relative inline-flex shrink-0", className)}>
        {/* Avatar circle */}
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            "font-semibold leading-none select-none transition-shadow duration-300",
            container,
            text,
            strong && "shadow-[0_6px_14px_rgba(0,0,0,0.34)]"
          )}
          style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            ...ringStyle,
          }}
          title={name}
          aria-label={name}
        >
          {initials}
        </span>

        {/* Status indicator dot */}
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 rounded-full",
              "ring-2 ring-[var(--bg-1)]",
              dot,
              statusDotColor[status]
            )}
            aria-hidden="true"
          />
        )}
      </span>
    </>
  );
}

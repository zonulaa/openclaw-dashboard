"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "@/lib/gsap-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatusCardStatus = "working" | "idle" | "complete" | "error";

export interface AgentStatusCardProps {
  /** Agent role type: 'subagent', 'main', 'worker' */
  agentType: string;
  /** Where the agent originates from: 'main tg dm', 'telegram:group:topic:18' */
  runningFrom: string;
  /** Current task description */
  job: string;
  /** Phase label: 'Phase 2/4' or 'Step 1/3' */
  phaseLabel: string;
  /** Progress value 0–100 */
  progress: number;
  /** Current status */
  status: AgentStatusCardStatus;
  /** Optional time estimate: '5 mins remaining' */
  estimatedTime?: string;
  /** Optional CSS class override */
  className?: string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AgentStatusCardStatus,
  {
    label: string;
    dotColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    aura: string;
    pulse: boolean;
  }
> = {
  working: {
    label: "Working",
    dotColor: "#7fe1b8",
    badgeBg: "rgba(0, 184, 148, 0.12)",
    badgeBorder: "rgba(127, 225, 184, 0.4)",
    badgeText: "#7fe1b8",
    aura: "radial-gradient(ellipse 140px 60px at 50% 0%, rgba(127,225,184,0.12), transparent 75%)",
    pulse: true,
  },
  idle: {
    label: "Idle",
    dotColor: "#475569",
    badgeBg: "rgba(37, 37, 64, 0.5)",
    badgeBorder: "rgba(130, 149, 188, 0.3)",
    badgeText: "#475569",
    aura: "radial-gradient(ellipse 140px 60px at 50% 0%, rgba(0,212,255,0.05), transparent 75%)",
    pulse: false,
  },
  complete: {
    label: "Complete",
    dotColor: "#77adff",
    badgeBg: "rgba(9, 132, 227, 0.12)",
    badgeBorder: "rgba(119, 173, 255, 0.4)",
    badgeText: "#77adff",
    aura: "radial-gradient(ellipse 140px 60px at 50% 0%, rgba(119,173,255,0.12), transparent 75%)",
    pulse: false,
  },
  error: {
    label: "Error",
    dotColor: "#ffb0ae",
    badgeBg: "rgba(214, 48, 49, 0.12)",
    badgeBorder: "rgba(255, 176, 174, 0.4)",
    badgeText: "#ffb0ae",
    aura: "radial-gradient(ellipse 140px 60px at 50% 0%, rgba(255,176,174,0.14), transparent 75%)",
    pulse: false,
  },
};

// ── Agent type badge style ────────────────────────────────────────────────────

function getAgentTypeBadgeStyle(type: string): React.CSSProperties {
  const t = type.toLowerCase();
  if (t === "main") {
    return {
      background: "rgba(9,132,227,0.18)",
      border: "1px solid rgba(119,173,255,0.45)",
      color: "#77adff",
    };
  }
  if (t === "worker") {
    return {
      background: "rgba(108,92,231,0.16)",
      border: "1px solid rgba(167,139,250,0.4)",
      color: "#c4b5fd",
    };
  }
  // subagent (default)
  return {
    background: "rgba(0,184,169,0.14)",
    border: "1px solid rgba(45,212,191,0.4)",
    color: "#5eead4",
  };
}

// ── CSS injected once for pulse animation ────────────────────────────────────

// GSAP handles glow, pulse, and bar-fill animations — no CSS @keyframes needed
const CARD_STYLES = ``;

// ── Helper: format source label ───────────────────────────────────────────────

function formatRunningFrom(raw: string): string {
  // Already short form like "main tg dm" → leave as-is
  // Transform long form "telegram:group:topic:18" → "tg:group:18"
  if (!raw.includes(":")) return raw;
  return raw
    .replace("telegram:", "tg:")
    .replace("discord:", "dc:")
    .replace(":topic:", ":")
    .replace(":group:", ":g:");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span
        className="shrink-0 text-[0.62rem] uppercase tracking-widest font-semibold"
        style={{ color: "var(--text-muted, #475569)", minWidth: "5.5rem" }}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-[0.76rem] leading-snug truncate font-medium",
          mono && "font-mono"
        )}
        style={{ color: "var(--text, #e2e8f0)" }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function ProgressBar({
  progress,
  status,
}: {
  progress: number;
  status: AgentStatusCardStatus;
}) {
  const [displayed, setDisplayed] = useState(progress);
  const prevRef = useRef(progress);

  // Animate to new value
  useEffect(() => {
    const from = prevRef.current;
    const to = progress;
    if (from === to) return;

    const duration = 600;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else {
        setDisplayed(to);
        prevRef.current = to;
      }
    };

    requestAnimationFrame(tick);
  }, [progress]);

  const clampedPct = Math.max(0, Math.min(100, displayed));

  // Build gradient based on status
  const gradient: Record<AgentStatusCardStatus, string> = {
    working:
      "linear-gradient(90deg, var(--accent-2, #4e89e8) 0%, var(--accent, #77adff) 60%, #a8c8ff 100%)",
    idle: "linear-gradient(90deg, #4a5578 0%, #6272a4 100%)",
    complete:
      "linear-gradient(90deg, #2d9e6b 0%, #7fe1b8 100%)",
    error: "linear-gradient(90deg, #c0392b 0%, #ffb0ae 100%)",
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Track */}
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{
          height: "6px",
          background: "rgba(37,37,64,0.9)",
          border: "1px solid rgba(0,212,255,0.12)",
        }}
        role="progressbar"
        aria-valuenow={Math.round(clampedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${Math.round(clampedPct)}%`}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${clampedPct}%`,
            background: gradient[status],
            transition: "none", // JS handles animation
            boxShadow:
              status === "working"
                ? "0 0 6px rgba(119,173,255,0.4)"
                : "none",
          }}
        />
        {/* Shimmer on working */}
        {status === "working" && clampedPct < 100 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0"
            style={{
              left: `calc(${clampedPct}% - 6px)`,
              width: "12px",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
            }}
          />
        )}
      </div>

      {/* Percentage label */}
      <div className="flex items-center justify-between">
        <span
          className="text-[0.65rem] font-mono tabular-nums"
          style={{ color: "var(--text-muted, #475569)" }}
        >
          {Math.round(clampedPct)}%
        </span>
        {clampedPct === 100 && status !== "error" && (
          <span className="text-[0.65rem]" style={{ color: "#7fe1b8" }}>
            ✓ done
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AgentStatusCard({
  agentType,
  runningFrom,
  job,
  phaseLabel,
  progress,
  status,
  estimatedTime,
  className,
}: AgentStatusCardProps) {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS_CONFIG[status];
  const typeBadgeStyle = getAgentTypeBadgeStyle(agentType);
  const isActive = status === "working";
  const cardRef = useRef<HTMLElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  // GSAP: working glow pulse on card
  useEffect(() => {
    if (!isActive || !cardRef.current) return;
    const anim = gsap.to(cardRef.current, {
      boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 28px rgba(0,0,0,0.36), 0 0 0 1px rgba(127,225,184,0.32)",
      duration: 1.4,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    return () => { anim.kill(); };
  }, [isActive]);

  // GSAP: dot pulse
  useEffect(() => {
    if (!cfg.pulse || !dotRef.current) return;
    const anim = gsap.to(dotRef.current, {
      opacity: 0.55,
      scale: 0.85,
      duration: 0.9,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    return () => { anim.kill(); };
  }, [cfg.pulse]);

  return (
    <>
      <style>{CARD_STYLES}</style>

      <article
        ref={cardRef}
        className={cn(
          "relative flex flex-col gap-3 rounded-xl overflow-hidden select-none",
          "transition-colors duration-150",
          className
        )}
        style={{
          background: hovered
            ? "linear-gradient(180deg, rgba(37,37,64,0.96), rgba(26,26,46,0.98))"
            : "linear-gradient(180deg, var(--bg-1, #0a0e1f) 0%, rgba(26,26,46,0.97) 100%)",
          border: `1px solid ${
            hovered ? "rgba(255,255,255,0.09)" : "rgba(0,212,255,0.12)"
          }`,
          boxShadow: hovered
            ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.4)"
            : "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
          padding: "1rem",
          minWidth: 0,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        role="listitem"
        aria-label={`${agentType} agent — ${job}`}
      >
        {/* ── Top aura gradient ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-20"
          style={{ background: cfg.aura }}
        />

        {/* ── Header row: type badge + status badge ── */}
        <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap">
          {/* Agent type */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest"
            style={typeBadgeStyle}
          >
            <span aria-hidden="true">◆</span>
            {agentType.toUpperCase()}
          </span>

          {/* Status badge */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.65rem] font-semibold"
            style={{
              background: cfg.badgeBg,
              border: `1px solid ${cfg.badgeBorder}`,
              color: cfg.badgeText,
            }}
          >
            <span
              className={cn("inline-block rounded-full")}
              ref={dotRef}
              style={{
                width: "6px",
                height: "6px",
                background: cfg.dotColor,
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            {cfg.label}
          </span>
        </div>

        {/* ── Info rows ── */}
        <div className="relative z-10 flex flex-col gap-2">
          <InfoRow
            label="Running from"
            value={formatRunningFrom(runningFrom)}
            mono
          />
          <InfoRow label="Job" value={job} />
          <InfoRow label="Progress" value={phaseLabel} />
          {estimatedTime && (
            <InfoRow label="ETA" value={estimatedTime} />
          )}
        </div>

        {/* ── Progress bar ── */}
        <div className="relative z-10">
          <ProgressBar progress={progress} status={status} />
        </div>

        {/* ── Divider line ── */}
        <div
          aria-hidden="true"
          className="relative z-10"
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(0,212,255,0.12) 20%, rgba(0,212,255,0.12) 80%, transparent)",
          }}
        />

        {/* ── Bottom: phase + detail ── */}
        <div className="relative z-10 flex items-center justify-between gap-2 flex-wrap">
          <span
            className="text-[0.68rem] font-mono font-semibold tracking-wide"
            style={{ color: "var(--text-muted, #475569)" }}
          >
            {phaseLabel}
          </span>
          {progress > 0 && progress < 100 && isActive && (
            <span
              className="text-[0.65rem]"
              style={{ color: "rgba(119,173,255,0.6)" }}
            >
              ↻ live
            </span>
          )}
        </div>
      </article>
    </>
  );
}

// ── Re-export types ───────────────────────────────────────────────────────────

export type { AgentStatusCardProps as default };

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end?: string;  // ISO string
  calendar?: string;
  color?: string; // override
  linkedTaskId?: string;
  linkedTaskTitle?: string;
}

export interface EventBlockProps {
  event: CalendarEvent;
  /** top offset in percent within the day column (0–100) */
  topPct: number;
  /** height in percent within the day column */
  heightPct: number;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
}

// ── Color map by calendar source ─────────────────────────────────────
const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  work:     { bg: "rgba(119,173,255,0.18)", border: "rgba(119,173,255,0.6)", text: "#77adff" },
  personal: { bg: "rgba(167,139,250,0.18)", border: "rgba(167,139,250,0.6)", text: "#a78bfa" },
  cron:     { bg: "rgba(127,225,184,0.15)", border: "rgba(0,255,136,0.5)", text: "#7fe1b8" },
  apple:    { bg: "rgba(251,191,36,0.14)",  border: "rgba(251,191,36,0.5)",  text: "#fbbf24" },
  default:  { bg: "rgba(119,173,255,0.14)", border: "rgba(119,173,255,0.45)", text: "#77adff" },
};

function getSourceColor(calendar?: string) {
  if (!calendar) return SOURCE_COLORS.default;
  const key = calendar.toLowerCase();
  if (key.includes("work")) return SOURCE_COLORS.work;
  if (key.includes("personal")) return SOURCE_COLORS.personal;
  if (key.includes("cron")) return SOURCE_COLORS.cron;
  if (key.includes("apple") || key.includes("home") || key.includes("calendar")) return SOURCE_COLORS.apple;
  return SOURCE_COLORS.default;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── EventBlock ────────────────────────────────────────────────────────
export function EventBlock({ event, topPct, heightPct, onClick, className }: EventBlockProps) {
  const [hovered, setHovered] = React.useState(false);
  const [showTooltip, setShowTooltip] = React.useState(false);

  const colors = getSourceColor(event.calendar);

  const minHeight = 28; // px — never collapse smaller than this visually

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Event: ${event.title}`}
      className={cn("absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer group", className)}
      style={{
        top: `${topPct}%`,
        minHeight: minHeight,
        height: `max(${heightPct}%, ${minHeight}px)`,
        background: colors.bg,
        border: `1px solid ${hovered ? colors.border : colors.border + "aa"}`,
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: hovered ? `0 0 0 1px ${colors.border}55, 0 2px 10px ${colors.border}22` : "none",
        zIndex: hovered ? 20 : 10,
      }}
      onClick={() => onClick?.(event)}
      onKeyDown={(e) => e.key === "Enter" && onClick?.(event)}
      onMouseEnter={() => { setHovered(true); setShowTooltip(true); }}
      onMouseLeave={() => { setHovered(false); setShowTooltip(false); }}
    >
      {/* Main label */}
      <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
        <span
          className="text-[0.65rem] font-semibold leading-tight line-clamp-2"
          style={{ color: colors.text }}
        >
          {event.title}
        </span>
        <span className="text-[0.58rem] leading-tight mt-px" style={{ color: colors.text + "cc" }}>
          {formatTime(event.start)}
          {event.end ? ` – ${formatTime(event.end)}` : ""}
        </span>
        {event.linkedTaskId && (
          <span className="text-[0.55rem] mt-px" style={{ color: "#7fe1b8bb" }}>🔗</span>
        )}
      </div>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: 180,
            maxWidth: 240,
          }}
        >
          <div
            className="rounded-lg px-3 py-2 text-[0.72rem] leading-snug shadow-xl"
            style={{
              background: "rgba(26,26,46,0.97)",
              border: `1px solid ${colors.border}`,
              color: "#e2e8f0",
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            <p className="font-semibold mb-1" style={{ color: colors.text, margin: 0 }}>
              {event.title}
            </p>
            <p className="text-[0.68rem]" style={{ color: "#475569", margin: 0 }}>
              {formatTime(event.start)}
              {event.end ? ` – ${formatTime(event.end)}` : ""}
            </p>
            {event.calendar && (
              <p className="text-[0.65rem] mt-1" style={{ color: "#6880a8", margin: "4px 0 0" }}>
                📅 {event.calendar}
              </p>
            )}
            {event.linkedTaskTitle && (
              <p className="text-[0.65rem]" style={{ color: "#7fe1b8", margin: "2px 0 0" }}>
                🔗 {event.linkedTaskTitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

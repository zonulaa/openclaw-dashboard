"use client";

import * as React from "react";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { MatchableMember } from "@/lib/team-session-matcher";

// ── Props ─────────────────────────────────────────────────────────
export interface SessionRowProps {
  member: MatchableMember;
  /** Compact layout for inside role cards */
  compact?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────

function truncateId(id: string, maxLen = 14): string {
  if (id.length <= maxLen) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function modelShortName(model?: string): string {
  if (!model) return "—";
  // Strip provider prefix (e.g. "anthropic/claude-sonnet-4" → "claude-sonnet-4")
  const withoutProvider = model.includes("/") ? model.split("/").pop()! : model;
  // Truncate if still long
  return withoutProvider.length > 18 ? `${withoutProvider.slice(0, 16)}…` : withoutProvider;
}

// ── CSS injected once ──────────────────────────────────────────────
const SESSION_ROW_CSS = `
@keyframes session-row-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
.session-row-live-dot {
  animation: session-row-pulse 2s ease-in-out infinite;
}
`;

// ── Component ─────────────────────────────────────────────────────
export function SessionRow({ member, compact = true }: SessionRowProps) {
  const live = member.live;
  const sessionId = live?.sessionId ?? member.id;
  const runtime = live?.runtime ?? "—";
  const model = modelShortName(live?.model);
  const uptime = live?.uptimeHuman ?? "—";
  const isMain = Boolean(live?.isMain);
  const isLive = member.source === "live";

  return (
    <>
      <style>{SESSION_ROW_CSS}</style>
      <div
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
        style={{
          background: "rgba(8,12,30,0.45)",
          border: "1px solid rgba(0,212,255,0.12)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
          transition: "background 150ms ease, border-color 150ms ease",
        }}
        role="listitem"
        aria-label={`Session ${sessionId}`}
      >
        {/* Avatar */}
        <AgentAvatar
          name={member.name}
          size="xs"
          status={isMain ? "focus" : isLive ? "working" : "idle"}
        />

        {/* Name/label (primary) + truncated session ID (secondary) */}
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="text-[0.68rem] font-semibold leading-tight truncate"
            style={{ color: "#c8deff" }}
            title={member.name}
          >
            {member.name}
          </span>
          {!compact && (
            <span
              className="text-[0.62rem] truncate"
              style={{ color: "#4e6080", fontFamily: "monospace" }}
              title={sessionId}
            >
              {truncateId(sessionId)}
            </span>
          )}
        </div>

        {/* Live dot */}
        {isLive && (
          <span
            className="session-row-live-dot shrink-0 h-1.5 w-1.5 rounded-full"
            style={{ background: isMain ? "#fbbf24" : "rgba(0,212,255,0.9)", boxShadow: "0 0 4px rgba(9,132,227,0.6)" }}
            aria-hidden="true"
          />
        )}

        {/* Runtime chip */}
        <span
          className="shrink-0 text-[0.62rem] uppercase font-semibold rounded-full px-1.5 py-0.5"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.25)",
            color: "#77adff",
          }}
        >
          {runtime}
        </span>

        {/* Model */}
        <span
          className="shrink-0 text-[0.62rem] truncate max-w-[80px]"
          style={{ color: "#7a95be" }}
          title={live?.model}
        >
          {model}
        </span>

        {/* Uptime */}
        {!compact && (
          <span
            className="shrink-0 text-[0.62rem]"
            style={{ color: "#5e7299" }}
          >
            {uptime}
          </span>
        )}
      </div>
    </>
  );
}

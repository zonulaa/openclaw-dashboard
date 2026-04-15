"use client";

import * as React from "react";
import { SessionRow } from "@/components/team/session-row";
import type { MatchableMember } from "@/lib/team-session-matcher";

// ── Props ─────────────────────────────────────────────────────────
export interface UnassignedSessionsProps {
  sessions: MatchableMember[];
}

// ── Component ─────────────────────────────────────────────────────
export function UnassignedSessions({ sessions }: UnassignedSessionsProps) {
  if (sessions.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{
        background: "linear-gradient(180deg, rgba(30,30,52,0.95), rgba(26,26,46,0.98))",
        border: "1px solid rgba(0,212,255,0.12)",
        borderStyle: "dashed",
      }}
      aria-label="Unassigned sessions"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {/* Icon */}
        <span
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-sm shrink-0"
          style={{
            background: "rgba(130,149,188,0.12)",
            border: "1px solid rgba(130,149,188,0.28)",
          }}
          aria-hidden="true"
        >
          🔍
        </span>

        <div className="flex flex-col min-w-0">
          <span
            className="text-[0.78rem] font-bold leading-tight"
            style={{ color: "#94a3b8" }}
          >
            Unassigned Sessions
          </span>
          <span
            className="text-[0.66rem]"
            style={{ color: "#5e7299" }}
          >
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} not matched to any role
          </span>
        </div>

        {/* Count badge */}
        <span
          className="ml-auto shrink-0 text-[0.66rem] font-semibold rounded-full px-2 py-0.5"
          style={{
            background: "rgba(130,149,188,0.12)",
            border: "1px solid rgba(130,149,188,0.3)",
            color: "#475569",
          }}
        >
          {sessions.length}
        </span>
      </div>

      {/* Divider */}
      <div
        className="h-px w-full"
        style={{ background: "rgba(0,212,255,0.09)" }}
        aria-hidden="true"
      />

      {/* Session list */}
      <div
        className="flex flex-col gap-1.5"
        role="list"
        aria-label="Unassigned session list"
      >
        {sessions.map((member) => (
          <SessionRow key={member.id} member={member} compact={false} />
        ))}
      </div>

      {/* Help text */}
      <p
        className="text-[0.66rem] leading-snug"
        style={{ color: "#4b6289" }}
      >
        These sessions are running but don&apos;t match any role in the team structure. You can
        assign them by editing role titles or focus areas to better match the session labels.
      </p>
    </section>
  );
}

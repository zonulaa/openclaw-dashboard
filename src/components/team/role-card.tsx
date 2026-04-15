"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PresenceBadge } from "@/components/ui/presence-badge";
import { SessionRow } from "@/components/team/session-row";
import type { MatchableMember } from "@/lib/team-session-matcher";

// ── Types ─────────────────────────────────────────────────────────

export type RoleSpawnPreset = {
  runtime?: string;
  model?: string;
  timeoutSeconds?: number;
  profile?: string;
  defaultTaskTemplate?: string;
};

export type TeamRoleProps = {
  id: string;
  title: string;
  ownerType: "me" | "worker";
  focus: string;
  responsibilities: string[];
  spawnPreset?: RoleSpawnPreset;
};

export type SpawnState = {
  loading: boolean;
  mode?: "dryRun" | "spawn";
  sessionId?: string | null;
  runId?: string | null;
  payload?: unknown;
  error?: string;
  at?: string;
};

export interface RoleCardProps {
  role: TeamRoleProps;
  liveSessions: MatchableMember[];
  spawnState?: SpawnState;
  taskOverride?: string;
  dryRunDefault?: boolean;
  onTaskOverrideChange?: (roleId: string, value: string) => void;
  onDryRunDefaultToggle?: (roleId: string, value: boolean) => void;
  onSpawn?: (roleId: string, dryRun: boolean) => void;
}

// ── Role icon map ─────────────────────────────────────────────────

const ROLE_ICONS: Record<string, string> = {
  "lead-orchestrator": "🐶",
  "developer-worker": "💻",
  "writer-worker": "📝",
  "designer-worker": "🎨",
  "ops-worker": "🛠️",
  "research-worker": "🔎",
};

function getRoleIcon(roleId: string, title: string): string {
  if (ROLE_ICONS[roleId]) return ROLE_ICONS[roleId];
  const norm = title.toLowerCase();
  if (norm.includes("dev") || norm.includes("code") || norm.includes("engineer")) return "💻";
  if (norm.includes("write") || norm.includes("doc") || norm.includes("edit")) return "📝";
  if (norm.includes("design") || norm.includes("ui") || norm.includes("ux")) return "🎨";
  if (norm.includes("ops") || norm.includes("infra") || norm.includes("deploy")) return "🛠️";
  if (norm.includes("research") || norm.includes("analys")) return "🔎";
  if (norm.includes("lead") || norm.includes("orchestrat") || norm.includes("manager")) return "🐶";
  return "🤖";
}

// ── CSS injected once ──────────────────────────────────────────────

const ROLE_CARD_CSS = `
@keyframes role-card-glow-pulse {
  0%, 100% { box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(9,132,227,0.28); }
  50%       { box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(9,132,227,0.48); }
}
.role-card-live-glow {
  animation: role-card-glow-pulse 2.8s ease-in-out infinite;
}
`;

// ── Component ─────────────────────────────────────────────────────

export function RoleCard({
  role,
  liveSessions,
  spawnState,
  taskOverride = "",
  dryRunDefault = false,
  onTaskOverrideChange,
  onDryRunDefaultToggle,
  onSpawn,
}: RoleCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const [showSpawnPanel, setShowSpawnPanel] = React.useState(false);

  const icon = getRoleIcon(role.id, role.title);
  const isLead = role.ownerType === "me";
  const hasLiveSessions = liveSessions.length > 0;

  // Card dynamic border/glow
  const cardStyle: React.CSSProperties = {
    background: hovered
      ? (isLead
          ? "linear-gradient(180deg, rgba(37,37,64,0.95), rgba(26,26,46,0.98))"
          : "linear-gradient(180deg, rgba(37,37,64,0.93), rgba(26,26,46,0.96))")
      : (isLead
          ? "linear-gradient(180deg, rgba(30,30,52,0.95), rgba(26,26,46,0.98))"
          : "linear-gradient(180deg, rgba(26,26,46,0.93), rgba(22,22,40,0.96))"),
    border: `1px solid ${
      hovered
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,212,255,0.12)"
    }`,
    borderRadius: 14,
    padding: "1rem",
    position: "relative",
    overflow: "hidden",
    transition: "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
    boxShadow: hovered
      ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.4)"
      : "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
  };

  // Aura at top of card
  const auraStyle: React.CSSProperties = {
    background: isLead
      ? "radial-gradient(ellipse 160px 80px at 50% -10%, rgba(9,132,227,0.18), transparent 80%)"
      : "radial-gradient(ellipse 140px 70px at 50% -10%, rgba(0,212,255,0.08), transparent 80%)",
  };

  return (
    <>
      <style>{ROLE_CARD_CSS}</style>
      <article
        className={cn("flex flex-col gap-3", hasLiveSessions && !hovered && "role-card-live-glow")}
        style={cardStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`${role.title} role card`}
      >
        {/* ── Top aura ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-20"
          style={auraStyle}
        />

        {/* ── Header: icon + title + badge ── */}
        <div className="relative z-10 flex items-start gap-3">
          {/* Role icon avatar */}
          <span
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl text-lg shrink-0"
            style={{
              background: isLead
                ? "rgba(0,212,255,0.15)"
                : "rgba(0,212,255,0.08)",
              border: isLead
                ? "1px solid rgba(0,212,255,0.3)"
                : "1px solid rgba(0,212,255,0.12)",
            }}
            aria-hidden="true"
          >
            {icon}
          </span>

          {/* Title + focus */}
          <div className="flex flex-col min-w-0 flex-1 gap-0.5">
            <span
              className="text-sm font-bold leading-tight"
              style={{ color: "#e2e8f0" }}
            >
              {role.title}
            </span>
            <span
              className="text-[0.7rem] leading-snug line-clamp-2"
              style={{ color: "#475569" }}
            >
              {role.focus}
            </span>
          </div>

          {/* Lead/Worker badge */}
          <span
            className="shrink-0 self-start text-[0.6rem] uppercase tracking-wide font-bold rounded-full px-2 py-0.5"
            style={{
              background: isLead
                ? "rgba(0,212,255,0.1)"
                : "rgba(0,212,255,0.08)",
              border: isLead
                ? "1px solid rgba(0,212,255,0.3)"
                : "1px solid rgba(0,212,255,0.12)",
              color: isLead ? "#77adff" : "#475569",
            }}
          >
            {isLead ? "Lead" : "Worker"}
          </span>
        </div>

        {/* ── Lane divider ── */}
        <div className="relative z-10 flex items-center gap-2" aria-hidden="true">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              background: isLead ? "rgba(0,212,255,0.9)" : "rgba(0,212,255,0.12)",
              boxShadow: isLead ? "0 0 6px rgba(0,212,255,0.7)" : undefined,
            }}
          />
          <span
            className="flex-1 h-px"
            style={{
              background: isLead
                ? "linear-gradient(90deg, rgba(119,173,255,0.55), transparent)"
                : "linear-gradient(90deg, rgba(0,212,255,0.09), transparent)",
            }}
          />
        </div>

        {/* ── Responsibilities ── */}
        <div className="relative z-10 flex flex-col gap-1">
          <span
            className="text-[0.62rem] uppercase tracking-widest font-semibold"
            style={{ color: "#6880a8" }}
          >
            Responsibilities
          </span>
          <ul className="flex flex-col gap-0.5 list-none m-0 p-0">
            {role.responsibilities.map((item, idx) => (
              <li
                key={`${role.id}-resp-${idx}`}
                className="flex items-start gap-1.5 text-[0.73rem] leading-snug"
                style={{ color: "#94a3b8" }}
              >
                <span
                  className="mt-1 h-1 w-1 rounded-full shrink-0"
                  style={{ background: "rgba(0,212,255,0.35)" }}
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Live sessions section ── */}
        {hasLiveSessions ? (
          <div className="relative z-10 flex flex-col gap-1.5">
            {/* Section header */}
            <div className="flex items-center gap-2">
              <span
                className="text-[0.62rem] uppercase tracking-widest font-semibold"
                style={{ color: "#6880a8" }}
              >
                Live Sessions
              </span>
              <PresenceBadge
                tone="working"
                label={`${liveSessions.length} active`}
                className="text-[0.55rem]"
              />
            </div>
            {/* Session rows */}
            <div className="flex flex-col gap-1" role="list" aria-label={`Live sessions for ${role.title}`}>
              {liveSessions.slice(0, 4).map((member) => (
                <SessionRow key={member.id} member={member} compact />
              ))}
              {liveSessions.length > 4 && (
                <span className="text-[0.65rem] pl-1" style={{ color: "#5e7299" }}>
                  +{liveSessions.length - 4} more session{liveSessions.length - 4 !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            className="relative z-10 flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: "rgba(26,26,46,0.6)",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
          >
            <span className="text-[0.68rem]" style={{ color: "#4b6289" }}>
              No active sessions for this role
            </span>
            <PresenceBadge tone="idle" label="idle" className="ml-auto text-[0.55rem]" />
          </div>
        )}

        {/* ── Spawn preset summary (collapsed by default) ── */}
        {role.spawnPreset && (
          <div className="relative z-10">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[0.66rem] w-full text-left"
              style={{ color: "#6880a8", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              onClick={() => setShowSpawnPanel((v) => !v)}
              aria-expanded={showSpawnPanel}
              aria-controls={`spawn-panel-${role.id}`}
            >
              <span
                className="inline-block transition-transform duration-150"
                style={{ transform: showSpawnPanel ? "rotate(90deg)" : "rotate(0deg)" }}
                aria-hidden="true"
              >
                ▶
              </span>
              Spawn controls
              {role.spawnPreset.runtime && (
                <span
                  className="ml-1 rounded-full px-1.5 py-0.5 text-[0.58rem] uppercase font-semibold"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.12)",
                    color: "#475569",
                  }}
                >
                  {role.spawnPreset.runtime}
                </span>
              )}
              {role.spawnPreset.model && (
                <span
                  className="ml-auto rounded-full px-1.5 py-0.5 text-[0.58rem]"
                  style={{ color: "#5e7299" }}
                >
                  {role.spawnPreset.model.split("/").pop()}
                </span>
              )}
            </button>

            {showSpawnPanel && (
              <div
                id={`spawn-panel-${role.id}`}
                className="mt-2 flex flex-col gap-2.5 rounded-xl p-3"
                style={{
                  background: "rgba(26,26,46,0.9)",
                  border: "1px solid rgba(0,212,255,0.12)",
                }}
              >
                {/* Preset info */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {role.spawnPreset.runtime && (
                    <>
                      <span className="text-[0.62rem] uppercase tracking-wider" style={{ color: "#5e7299" }}>Runtime</span>
                      <span className="text-[0.68rem] font-medium" style={{ color: "#a8c8ff" }}>{role.spawnPreset.runtime}</span>
                    </>
                  )}
                  {role.spawnPreset.model && (
                    <>
                      <span className="text-[0.62rem] uppercase tracking-wider" style={{ color: "#5e7299" }}>Model</span>
                      <span className="text-[0.68rem] font-medium truncate" style={{ color: "#a8c8ff" }} title={role.spawnPreset.model}>{role.spawnPreset.model.split("/").pop()}</span>
                    </>
                  )}
                  {role.spawnPreset.profile && (
                    <>
                      <span className="text-[0.62rem] uppercase tracking-wider" style={{ color: "#5e7299" }}>Profile</span>
                      <span className="text-[0.68rem] font-medium" style={{ color: "#a8c8ff" }}>{role.spawnPreset.profile}</span>
                    </>
                  )}
                  {role.spawnPreset.timeoutSeconds && (
                    <>
                      <span className="text-[0.62rem] uppercase tracking-wider" style={{ color: "#5e7299" }}>Timeout</span>
                      <span className="text-[0.68rem] font-medium" style={{ color: "#a8c8ff" }}>{role.spawnPreset.timeoutSeconds}s</span>
                    </>
                  )}
                </div>

                {/* Task override */}
                <label className="flex flex-col gap-1">
                  <span className="text-[0.62rem] uppercase tracking-wider" style={{ color: "#5e7299" }}>
                    Task override (optional)
                  </span>
                  <textarea
                    className="w-full text-[0.71rem] rounded-lg px-2.5 py-1.5 resize-none"
                    rows={2}
                    value={taskOverride}
                    placeholder={role.spawnPreset.defaultTaskTemplate || "Leave empty to use default task template"}
                    style={{
                      background: "rgba(5,5,16,0.9)",
                      border: "1px solid rgba(0,212,255,0.12)",
                      color: "#e2e8f0",
                      fontFamily: "inherit",
                    }}
                    onChange={(e) => onTaskOverrideChange?.(role.id, e.target.value)}
                  />
                </label>

                {/* Dry run toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dryRunDefault}
                    onChange={(e) => onDryRunDefaultToggle?.(role.id, e.target.checked)}
                    className="accent-cyan-500 h-3.5 w-3.5"
                  />
                  <span className="text-[0.68rem]" style={{ color: "#475569" }}>
                    Dry-run mode (preview payload)
                  </span>
                </label>

                {/* Spawn buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(spawnState?.loading)}
                    onClick={() => onSpawn?.(role.id, true)}
                    className="flex-1 text-[0.72rem] font-semibold rounded-lg py-1.5 transition-colors duration-150"
                    style={{
                      background: "rgba(15,20,33,0.8)",
                      border: "1px solid rgba(125,153,202,0.4)",
                      color: spawnState?.loading ? "#5e7299" : "#94a3b8",
                      cursor: spawnState?.loading ? "not-allowed" : "pointer",
                      opacity: spawnState?.loading ? 0.6 : 1,
                    }}
                  >
                    {spawnState?.loading && spawnState.mode === "dryRun" ? "Previewing…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(spawnState?.loading)}
                    onClick={() => onSpawn?.(role.id, dryRunDefault)}
                    className="flex-1 text-[0.72rem] font-semibold rounded-lg py-1.5 transition-colors duration-150"
                    style={{
                      background: spawnState?.loading
                        ? "rgba(50,80,130,0.5)"
                        : "linear-gradient(180deg, #77adff, #4e89e8)",
                      color: spawnState?.loading ? "#7a95be" : "#050510",
                      cursor: spawnState?.loading ? "not-allowed" : "pointer",
                      opacity: spawnState?.loading ? 0.6 : 1,
                    }}
                  >
                    {spawnState?.loading && spawnState.mode === "spawn"
                      ? "Spawning…"
                      : dryRunDefault
                        ? "Dry Run"
                        : "Spawn"}
                  </button>
                </div>

                {/* Spawn result */}
                {spawnState && !spawnState.loading && Boolean(spawnState.error || spawnState.sessionId || spawnState.payload) && (
                  <div
                    className="rounded-lg px-2.5 py-2"
                    style={{
                      background: "rgba(26,26,46,0.9)",
                      border: "1px solid rgba(0,212,255,0.12)",
                    }}
                    aria-live="polite"
                  >
                    {spawnState.error ? (
                      <p className="text-[0.71rem]" style={{ color: "#ffb0ae" }}>
                        Error: {spawnState.error}
                      </p>
                    ) : spawnState.mode === "spawn" && spawnState.sessionId ? (
                      <p className="text-[0.71rem]" style={{ color: "#7fe1b8" }}>
                        ✓ Spawned · session: {spawnState.sessionId}
                        {spawnState.runId ? ` · run: ${spawnState.runId}` : ""}
                      </p>
                    ) : spawnState.mode === "dryRun" && spawnState.payload ? (
                      <>
                        <p className="text-[0.68rem] mb-1" style={{ color: "#475569" }}>
                          Dry run preview:
                        </p>
                        <pre
                          className="text-[0.65rem] leading-relaxed overflow-auto max-h-36"
                          style={{ color: "#b6c9ea", margin: 0 }}
                        >
                          {JSON.stringify(spawnState.payload as Record<string, unknown>, null, 2)}
                        </pre>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    </>
  );
}

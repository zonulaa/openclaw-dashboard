"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { PresenceBadge, type PresenceTone } from "@/components/ui/presence-badge";

// ── Types ────────────────────────────────────────────────────────────
export interface AgentLiveData {
  sessionId: string;
  runtime?: string;
  model?: string;
  parentSessionId?: string;
  isMain: boolean;
  sourceMethod?: string;
  updatedAt?: string;
  startedAt?: string;
  uptimeMs?: number;
  uptimeHuman?: string;
  rawKey?: string;
  agentId?: string;
}

export interface AgentOps {
  canRefresh: boolean;
  canStop: boolean;
  stopGuard: string | null;
}

export interface AgentDeskCardProps {
  id: string;
  name: string;
  role: string;
  workstation: string;
  source: "live" | "mock";
  status: string;
  statusDetail?: string;
  details: string;
  live?: AgentLiveData;
  ops: AgentOps;

  // Computed view fields
  presenceTone: PresenceTone;
  presenceLabel: string;
  deskLabel: string;
  teamRoleTitle: string | null;

  runningFrom?: string;

  // Interaction handlers
  isSelected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  onRefresh?: (id: string) => void;
  onStop?: (id: string) => void;
  isBusy?: string; // "refresh" | "stop" | undefined
  bulkBusy?: boolean;
}

// ── Detail row helper ─────────────────────────────────────────────────
function Row({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex gap-2 items-start">
      <span style={{ color: "#5e7299", minWidth: 72, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#475569", fontFamily: mono ? "monospace" : undefined, fontSize: small ? "0.63rem" : undefined, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

// ── Aura glow style per tone ─────────────────────────────────────────
const auraStyle: Record<PresenceTone, React.CSSProperties> = {
  working: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(9,132,227,0.18), transparent 80%)",
  },
  online: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(34,197,94,0.16), transparent 80%)",
  },
  busy: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(239,68,68,0.16), transparent 80%)",
  },
  focus: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(251,191,36,0.16), transparent 80%)",
  },
  queued: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(167,139,250,0.16), transparent 80%)",
  },
  idle: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(20,184,166,0.12), transparent 80%)",
  },
  offline: {
    background: "radial-gradient(ellipse 120px 120px at 50% -10%, rgba(0,212,255,0.05), transparent 80%)",
  },
};

// ── Card hover glow animation (CSS injected once) ────────────────────
const CARD_CSS = `
@keyframes desk-card-glow-pulse {
  0%, 100% { box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,212,255,0.18); }
  50%       { box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(9,132,227,0.45); }
}
.desk-card-working-glow {
  animation: desk-card-glow-pulse 2.5s ease-in-out infinite;
}
`;

// ── Stat item ────────────────────────────────────────────────────────
function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className="text-[0.62rem] uppercase tracking-wider font-semibold"
        style={{ color: "#6880a8" }}
      >
        {label}
      </span>
      <span
        className="text-[0.74rem] font-medium truncate"
        style={{ color: "#b6c9ea" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────
export function AgentDeskCard({
  id,
  name,
  role,
  source,
  statusDetail,
  status,
  details,
  live,
  ops,
  presenceTone,
  presenceLabel,
  deskLabel,
  teamRoleTitle,
  runningFrom,
  isSelected,
  onToggleSelect,
  onRefresh,
  onStop,
  isBusy,
  bulkBusy,
}: AgentDeskCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const isWorker = source === "live" && role === "Worker Session";
  const isActiveState = presenceTone === "working" || presenceTone === "focus";
  const isSubagent = Boolean(live?.parentSessionId);

  // Card border / glow style
  const cardStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      background: hovered
        ? "linear-gradient(180deg, rgba(37,37,64,0.96), rgba(26,26,46,0.98))"
        : "linear-gradient(180deg, rgba(30,30,52,0.96), rgba(26,26,46,0.98))",
      border: `1px solid ${hovered ? "rgba(255,255,255,0.1)" : "rgba(0,212,255,0.12)"}`,
      borderRadius: 12,
      padding: "1rem",
      position: "relative",
      overflow: "hidden",
      transition: "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
      boxShadow: hovered
        ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.4)"
        : "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
      // Subagent: accent left border to show it's linked to parent
      ...(isSubagent && {
        borderLeft: "3px solid rgba(9,132,227,0.6)",
        marginLeft: "0.75rem",
      }),
    };
    return base;
  })();

  return (
    <>
      <style>{CARD_CSS}</style>
      <article
        className={cn(
          "flex flex-col gap-3",
          isActiveState && !hovered && "desk-card-working-glow"
        )}
        style={{ ...cardStyle, cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setExpanded(prev => !prev)}
        role="listitem"
        aria-label={`${name} workstation card`}
      >
        {/* ── Top Aura gradient ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={auraStyle[presenceTone]}
        />

        {/* ── Subagent parent link indicator ── */}
        {isSubagent && (
          <div className="relative z-10 flex items-center gap-1.5 mb-1 -mt-1">
            <span style={{ color: "rgba(0,212,255,0.7)", fontSize: "0.65rem" }}>↳</span>
            <span
              className="text-[0.62rem] font-medium truncate"
              style={{ color: "rgba(0,212,255,0.7)" }}
            >
              spawned by {runningFrom}
            </span>
          </div>
        )}

        {/* ── Header: Avatar + Name + Role ── */}
        <div className="relative flex items-center gap-3 z-10">
          <AgentAvatar
            name={name}
            size="lg"
            status={presenceTone === "idle" ? "idle" : presenceTone === "working" ? "working" : presenceTone === "focus" ? "focus" : "queued"}
            strong
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className="text-sm font-semibold leading-tight truncate"
              style={{ color: "#e2e8f0" }}
            >
              {name}
            </span>
            <span
              className="text-[0.71rem] leading-snug truncate mt-0.5"
              style={{ color: "#475569" }}
            >
              {teamRoleTitle || role}
            </span>
            <span
              className="text-[0.66rem] leading-snug truncate"
              style={{ color: "#6880a8" }}
            >
              {deskLabel}
            </span>
          </div>

          {/* Source chip */}
          <span
            className="shrink-0 self-start text-[0.6rem] uppercase tracking-wide font-semibold rounded-full px-2 py-0.5"
            style={{
              background: source === "live" ? "rgba(0,212,255,0.08)" : "rgba(0,212,255,0.08)",
              border: source === "live" ? "1px solid rgba(0,212,255,0.25)" : "1px solid rgba(0,212,255,0.12)",
              color: source === "live" ? "#77adff" : "#475569",
            }}
          >
            {source}
          </span>
        </div>

        {/* ── Presence badge ── */}
        <div className="relative z-10">
          <PresenceBadge tone={presenceTone} label={presenceLabel} />
          {(statusDetail || status) && (
            <p
              className="mt-1.5 text-[0.71rem] leading-snug line-clamp-2"
              style={{ color: "#7a95be" }}
            >
              {statusDetail || status}
            </p>
          )}
        </div>

        {/* ── Stats row ── */}
        <div
          className="relative z-10 grid grid-cols-3 gap-2 rounded-lg px-3 py-2.5"
          style={{
            background: "rgba(5,5,16,0.8)",
            border: "1px solid rgba(0,212,255,0.12)",
          }}
        >
          <StatItem label="Uptime" value={live?.uptimeHuman || "—"} />
          <StatItem label="Runtime" value={live?.runtime || "—"} />
          <StatItem label="Model" value={live?.model ? live.model.split("/").pop() ?? live.model : "—"} />
        </div>

        {/* ── Last updated ── */}
        {live?.updatedAt && (
          <p
            className="relative z-10 text-[0.65rem]"
            style={{ color: "#5e7299" }}
          >
            Updated {live.updatedAt}
          </p>
        )}

        {/* ── Ops section (worker sessions only) ── */}
        {isWorker ? (
          <div className="relative z-10 flex flex-col gap-2 pt-1 border-t" style={{ borderColor: "rgba(0,212,255,0.12)" }}>
            {/* Bulk stop checkbox */}
            <label
              className="flex items-center gap-2 text-[0.71rem] cursor-pointer select-none"
              style={{ color: "#475569" }}
            >
              <input
                type="checkbox"
                checked={Boolean(isSelected)}
                disabled={!ops.canStop || bulkBusy}
                onChange={(e) => onToggleSelect?.(id, e.target.checked)}
                className="accent-cyan-500 h-3.5 w-3.5 rounded"
              />
              Include in bulk stop
            </label>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRefresh?.(id); }}
                disabled={Boolean(isBusy)}
                className="flex-1 text-[0.72rem] font-semibold rounded-lg py-1.5 transition-colors duration-150"
                style={{
                  background: "rgba(15,20,33,0.8)",
                  border: "1px solid rgba(125,153,202,0.4)",
                  color: "#94a3b8",
                  cursor: isBusy ? "not-allowed" : "pointer",
                  opacity: isBusy ? 0.6 : 1,
                }}
              >
                {isBusy === "refresh" ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStop?.(id); }}
                disabled={Boolean(isBusy) || !ops.canStop}
                title={ops.stopGuard || "Stop this worker session"}
                className="flex-1 text-[0.72rem] font-semibold rounded-lg py-1.5 transition-colors duration-150"
                style={{
                  background: "linear-gradient(180deg, #77adff, #4e89e8)",
                  color: "#050510",
                  cursor: isBusy || !ops.canStop ? "not-allowed" : "pointer",
                  opacity: isBusy || !ops.canStop ? 0.5 : 1,
                }}
              >
                {isBusy === "stop" ? "Stopping…" : "Stop"}
              </button>
            </div>
          </div>
        ) : source === "live" ? (
          <p className="relative z-10 text-[0.66rem]" style={{ color: "#5e7299" }}>
            {ops.stopGuard || "Only worker sessions are controllable"}
          </p>
        ) : null}

        {/* Details line */}
        {details && !expanded && (
          <p
            className="relative z-10 text-[0.66rem] leading-snug line-clamp-2"
            style={{ color: "#5e7299" }}
          >
            {details}
          </p>
        )}

      </article>

      {/* ── Expanded detail modal (portal, renders above everything) ── */}
      {expanded && typeof document !== "undefined" && ReactDOM.createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setExpanded(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(2px)",
            }}
          />
          {/* Modal */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10000,
              background: "linear-gradient(180deg, rgba(30,30,52,0.99), rgba(20,20,40,0.99))",
              border: "1px solid rgba(125,153,202,0.25)",
              borderRadius: 14,
              padding: "20px 24px",
              minWidth: 300, maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
              color: "#475569",
              fontSize: "0.75rem",
              lineHeight: 1.6,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.9rem" }}>{name}</p>
                <p style={{ color: "#5e7299", fontSize: "0.68rem" }}>{role}</p>
              </div>
              <button
                onClick={() => setExpanded(false)}
                style={{ background: "none", border: "none", color: "#5e7299", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
              >✕</button>
            </div>

            {/* Details */}
            <div className="flex flex-col gap-2">
              <Row label="Status" value={presenceLabel} />
              <Row label="Model" value={live?.model ?? "—"} />
              <Row label="Runtime" value={live?.runtime ?? "—"} />
              <Row label="Agent" value={live?.agentId ?? "—"} />
              {live?.uptimeHuman && <Row label="Uptime" value={live.uptimeHuman} />}
              {live?.startedAt && <Row label="Started" value={new Date(live.startedAt).toLocaleTimeString()} />}
              {live?.updatedAt && <Row label="Updated" value={new Date(live.updatedAt).toLocaleTimeString()} />}
              {live?.sessionId && <Row label="Session ID" value={live.sessionId.slice(0, 20) + "…"} mono />}
              {live?.parentSessionId && <Row label="Parent ID" value={live.parentSessionId.slice(0, 20) + "…"} mono />}
              {live?.rawKey && <Row label="Key" value={live.rawKey} mono small />}
            </div>

            <p className="mt-4 text-center" style={{ color: "#3a4e70", fontSize: "0.63rem" }}>
              Click outside to close
            </p>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

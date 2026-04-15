"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast } from '@/components/ui/toast'
import { PixelCharacter } from "./PixelCharacter";
import { PixelMonitor } from "./PixelMonitor";
import { getSpriteForKey } from "@/lib/office-sprites";
import type { OfficeMember } from "@/lib/digital-office-live";
// AgentStatusCard types removed
import "@/styles/office-animations.css";
import "@/styles/pixel-art.css";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PixelDeskAnimation =
  | "arriving"
  | "working"
  | "complete"
  | "leaving"
  | "idle"
  | "error"
  | "empty";

export type PixelDeskProps = {
  /** Internal desk id (1-based index) */
  deskId: number;
  /** The live office member data (null = empty desk) */
  member: OfficeMember | null;
  /** Animation state to display */
  animation: PixelDeskAnimation;
  /** Show the AgentStatusCard overlay */
  showStatusCard?: boolean;
  /** Whether this agent just appeared (triggers new-agent highlight) */
  isNew?: boolean;
  /** Optional CSS class */
  className?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// toCardStatus removed — no longer needed

function toAgentKey(member: OfficeMember): string {
  if (member.live?.isMain) return "agent:main:main";
  if (member.id === "you-main") return "agent:main:main"; // mock degraded fallback
  const role = (member.role || "").toLowerCase();
  if (role.includes("subagent") || role.includes("worker")) return "subagent";
  return "subagent";
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatModelShort(raw: string): string {
  return raw
    .replace("anthropic/", "")
    .replace("z-ai/", "")
    .replace("claude-", "cl-")
    .replace("-4-6", "-4.6")
    .replace("-4-5", "-4.5")
    .replace("sonnet-4.6", "s4.6")
    .replace("sonnet-4.5", "s4.5")
    .replace("haiku-4.5", "h4.5")
    .replace("opus-4.6", "o4.6")
    .replace("opus-4", "o4")
    .slice(0, 16);
}

function getModelShort(member: OfficeMember): string {
  // 1. Prefer configuredModel from openclaw.json (authoritative)
  if (member.configuredModel) {
    return formatModelShort(member.configuredModel);
  }

  // 2. Fall back to live session model
  const liveModel = member.live?.model ?? member.tokenStats?.model ?? "";
  if (liveModel && liveModel !== "default-model" && liveModel !== "unknown") {
    return formatModelShort(liveModel);
  }

  return "";
}

// derivePhaseLabel removed — using progressLabel from member data

function deriveProgress(member: OfficeMember): number {
  const uptimeMs = member.live?.uptimeMs;
  if (!uptimeMs) return 0;
  // Estimate progress as % of 10 minutes (600s) uptime — a rough heuristic
  return Math.min(95, Math.round((uptimeMs / 600_000) * 100));
}

// deriveJob removed — using currentTask from member data

function deriveStatusEmoji(animation: PixelDeskAnimation): string {
  switch (animation) {
    case "working":
    case "arriving":
      return "✨";
    case "complete":
      return "✓";
    case "error":
      return "✗";
    case "idle":
    default:
      return "—";
  }
}

function deriveStatusLabel(animation: PixelDeskAnimation): string {
  switch (animation) {
    case "working":
    case "arriving":
      return "Working";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    case "idle":
    default:
      return "Idle";
  }
}

function deriveAgentType(member: OfficeMember): string {
  const rawKey = member.live?.rawKey ?? '';
  const agentId = member.live?.agentId ?? 'main';
  if (rawKey.includes(':subagent:')) return "SUBAGENT";
  const role = (member.role || "").toLowerCase();
  if (role.includes("subagent")) return "SUBAGENT";
  if (role.includes("worker")) return "WORKER";
  // Show agent identity for main sessions
  return agentId.toUpperCase();
}

function deriveRunningFrom(member: OfficeMember): string {
  if (member.runningFrom) return member.runningFrom;
  const agentId = member.live?.agentId ?? 'main';
  const agentLabel = agentId.toUpperCase();
  if (member.live?.isMain) return `${agentLabel} SESSION`;
  if (member.live?.parentSessionId) return `${agentLabel} DM`;
  return `${agentLabel} SESSION`;
}

function formatStartedAt(startedAt?: string): string {
  if (!startedAt) return "—";
  try {
    const d = new Date(startedAt);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  } catch {
    return startedAt;
  }
}

// ── Animation class map ───────────────────────────────────────────────────────

function getAnimationClass(
  anim: PixelDeskAnimation,
  isNew: boolean
): string {
  if (isNew) return "pixel-desk--new";
  switch (anim) {
    case "arriving":   return "pixel-desk--arriving";
    case "working":    return "pixel-desk--working-anim";
    case "complete":   return "pixel-desk--complete-anim";
    case "leaving":    return "pixel-desk--leaving";
    case "idle":       return "pixel-desk--idle-anim";
    case "error":      return "pixel-desk--error-anim";
    default:           return "";
  }
}

// ── Border color per animation ────────────────────────────────────────────────

function getBorderColor(anim: PixelDeskAnimation): string {
  switch (anim) {
    case "working":
    case "arriving":  return "#4ECDC4";
    case "complete":  return "#77adff";
    case "leaving":   return "#475569";
    case "idle":      return "#FFE66D";
    case "error":     return "#FF6B6B";
    default:          return "#2a2a4a";
  }
}

// ── Sub: empty desk ───────────────────────────────────────────────────────────

function EmptyDesk({ deskId }: { deskId: number }) {
  return (
    <div className="pixel-desk pixel-desk--empty" role="article" aria-label={`Desk ${deskId}: Available`} data-status="empty">
      <span className="pixel-desk__number">#{deskId}</span>
      <div className="pixel-desk__empty-label" aria-label="Available desk">
        <span aria-hidden="true">🪑</span>
        <br />
        available
      </div>
      {/* Desk surface */}
      <div
        className="pixel-desk__surface"
        style={{ background: "#4a4040" }}
        aria-hidden="true"
      />
      <div className="pixel-desk__chair" aria-hidden="true" />
    </div>
  );
}

// ── HoverCard component ───────────────────────────────────────────────────────

type HoverCardProps = {
  member: OfficeMember;
  animation: PixelDeskAnimation;
  borderColor: string;
  onClose: () => void;
  onRemoveAgent?: () => Promise<void>;
};

function HoverCard({ member, animation, borderColor, onClose, onRemoveAgent }: HoverCardProps) {
  const agentName = member.name || "Unknown Agent";
  const agentType = deriveAgentType(member);
  const agentId = member.live?.agentId ?? 'main';
  const runningFrom = deriveRunningFrom(member);
  const progress = member.progressPercent ?? deriveProgress(member);
  const progressLabel = member.progressLabel || '';

  const statusEmoji = animation === "working" || animation === "arriving" ? "✨"
    : animation === "complete" ? "✅" : animation === "error" ? "⚠️" : "💤";
  const statusLabel = animation === "working" || animation === "arriving" ? "Working"
    : animation === "complete" ? "Complete" : animation === "error" ? "Error" : "Idle";

  const filledBlocks = Math.round((progress / 100) * 16);
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(16 - filledBlocks);

  // Token stats
  const tokens = member.tokenStats;
  const outK = tokens ? (tokens.output / 1000).toFixed(1) : '—';
  const totalK = tokens ? (tokens.total / 1000).toFixed(0) : '—';

  const s = (label: string, value: string | number | undefined, color?: string) => (
    <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
      <span style={{ color: "#5e7299", minWidth: "72px", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ color: color || "#c8d6f0", fontSize: "9px", fontWeight: label === "Status" ? "bold" : "normal" }}>{value ?? "—"}</span>
    </div>
  );

  return (
    <div role="dialog" aria-label={`Details: ${agentName}`} style={{
      width: "270px", background: "linear-gradient(180deg, #0a0e1f 0%, #16213e 100%)",
      border: `1px solid ${borderColor}66`, borderRadius: "8px",
      boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
      fontFamily: "Courier New, monospace", fontSize: "10px", color: "#c8d6f0",
      maxHeight: "70vh", overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px 6px",
        borderBottom: `1px solid ${borderColor}33`, background: `linear-gradient(90deg, ${borderColor}11, transparent)` }}>
        <span style={{ color: borderColor, fontWeight: "bold", fontSize: "10px" }} title={agentName}>
          {truncate(agentName, 28)}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "14px", padding: "0 2px" }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {s("Type", `${agentType} (${agentId})`, agentType === "SUBAGENT" ? "#5eead4" : "#77adff")}
        {s("Status", `${statusLabel} ${statusEmoji}`, borderColor)}
        {s("Origin", runningFrom)}
        {s("Model", member.live?.model)}
        {s("Uptime", member.live?.uptimeHuman)}

        {/* Divider */}
        <div style={{ height: "1px", background: `${borderColor}22`, margin: "4px 0" }} />

        {/* Progress */}
        {s("Progress", progressLabel)}
        <div style={{ marginTop: "2px" }}>
          <span style={{ color: borderColor, fontSize: "9px", letterSpacing: "-1px" }}>{progressBar}</span>
          <span style={{ color: "#475569", fontSize: "9px", marginLeft: "6px" }}>{progress}%</span>
        </div>

        {/* Token Stats */}
        {tokens && (
          <>
            <div style={{ height: "1px", background: `${borderColor}22`, margin: "4px 0" }} />
            {s("Tokens Out", `${outK}k`)}
            {s("Context", `${totalK}k / ${tokens.percentUsed}% used`)}
            {s("Remaining", `${(tokens.remaining / 1000).toFixed(0)}k tokens`)}
          </>
        )}

        {/* Session Info */}
        <div style={{ height: "1px", background: `${borderColor}22`, margin: "4px 0" }} />
        {s("Session", truncate(member.live?.sessionId ?? "—", 20))}
        {s("Started", formatStartedAt(member.live?.startedAt))}
        {member.currentTask && s("Task", member.currentTask)}

        {/* Remove button for subagents */}
        {!member.live?.isMain && onRemoveAgent && (
          <>
            <div style={{ height: "1px", background: `${borderColor}22`, margin: "6px 0" }} />
            <button
              onClick={(e) => {
                e.stopPropagation()
                void onRemoveAgent()
              }}
              style={{
                width: '100%',
                padding: '6px 0',
                background: 'rgba(255,107,107,0.1)',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: '6px',
                color: '#FF6B6B',
                fontSize: '9px',
                fontFamily: 'Courier New, monospace',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              🗑️ Remove Agent
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PixelDesk({
  deskId,
  member,
  animation,
  showStatusCard: _showStatusCard = true,
  isNew = false,
  className,
}: PixelDeskProps) {
  const [cardOpen, setCardOpen] = useState(false);
  const { toast, confirm } = useToast();

  // Close card when clicking outside
  useEffect(() => {
    if (!cardOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      // Don't close if clicking inside the card itself
      if (el.closest('.pixel-desk__detail-card')) return;
      setCardOpen(false);
    };
    // Delay listener so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [cardOpen]);

  if (!member) {
    return <EmptyDesk deskId={deskId} />;
  }

  const agentKey = toAgentKey(member);
  const sprite = getSpriteForKey(agentKey);
  const borderColor = getBorderColor(animation);
  const animClass = getAnimationClass(animation, isNew);
  const modelShort = getModelShort(member);
  const agentName = member.name || sprite.name;
  const progress = member.progressPercent ?? deriveProgress(member);
  const progressLabel = member.progressLabel || '';

  // Map animation → DeskStatus for AgentSprite
  const deskStatusMap: Record<PixelDeskAnimation, "working" | "idle" | "thinking" | "empty"> = {
    arriving: "working",
    working: "working",
    complete: "idle",
    leaving: "idle",
    idle: "idle",
    error: "idle",
    empty: "empty",
  };
  const _deskStatus = deskStatusMap[animation];

  return (
    <div
      className={cn("pixel-desk", animClass, className)}
      role="article"
      aria-label={`Desk ${deskId}: ${agentName} — ${animation}`}
      data-status={animation}
      onClick={(e) => { e.stopPropagation(); setCardOpen(prev => !prev); }}
      style={{ cursor: 'pointer', zIndex: cardOpen ? 100 : undefined }}
    >
      {/* Desk number */}
      <span className="pixel-desk__number">#{deskId}</span>

      {/* ── Detail Card (modal centered, click backdrop to close) ── */}
      {cardOpen && (
        <>
          <div className="pixel-desk__detail-backdrop" onClick={(e) => { e.stopPropagation(); setCardOpen(false); }} />
          <div className="pixel-desk__detail-card" onClick={(e) => e.stopPropagation()}>
            <HoverCard
              member={member}
              animation={animation}
              borderColor={borderColor}
              onClose={() => setCardOpen(false)}
              onRemoveAgent={member.live?.isMain ? undefined : async () => {
                const agentLabel = member.name || member.live?.rawKey || 'this agent'
                const ok = await confirm({
                  title: 'Remove Agent',
                  message: `Remove "${agentLabel}" from the office?\n\nThis will delete the session entry from sessions.json.`,
                  confirmLabel: '🗑️ REMOVE',
                  cancelLabel: 'CANCEL',
                  danger: true,
                })
                if (!ok) return
                try {
                  const parts = (member.live?.rawKey || '').split(':')
                  const uuid = parts[parts.length - 1]
                  const res = await fetch('/api/digital-office/ops', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'cleanup-idle', dryRun: false, memberId: uuid }),
                  })
                  const data = await res.json() as { ok?: boolean; removed?: number; error?: string }
                  if (data.ok) {
                    toast(`Agent removed from sessions`, 'success')
                    setCardOpen(false)
                  } else {
                    toast(data.error || 'Remove failed', 'error')
                  }
                } catch (e) {
                  toast(`Failed: ${e instanceof Error ? e.message : 'unknown'}`, 'error')
                }
              }}
            />
          </div>
        </>
      )}

      {/* ── Speech Bubble (last tool call) ── */}
      {member.currentCommand && (animation === 'working' || animation === 'arriving') && (
        <div className="pixel-desk__speech-bubble" title={member.currentCommand}>
          <span className="pixel-desk__speech-text">
            {member.currentCommand.length > 36
              ? member.currentCommand.slice(0, 36) + '…'
              : member.currentCommand}
          </span>
          <div className="pixel-desk__speech-tail" />
        </div>
      )}

      {/* ── Pixel Art Workstation (Monitor + Desk + Character) ── */}
      <div className="pixel-desk__workstation">
        <PixelMonitor isOn={animation === 'working' || animation === 'arriving'} />
        <div className="pixel-desk__desk-surface">
          {/* Coffee cup on desk when working */}
          {(animation === 'working' || animation === 'arriving') && (
            <span className="pixel-desk__coffee-cup">☕</span>
          )}
        </div>
        <div className="pixel-desk__keyboard" />
        <PixelCharacter
          shirtColor={(() => {
            const aid = member.live?.agentId ?? 'main';
            const rawKey = member.live?.rawKey ?? '';
            if (rawKey.includes(':subagent:')) return 'blue';
            return aid === 'main' ? 'yellow' : 'purple';
          })()}
          state={animation === 'working' || animation === 'arriving' ? 'working' : animation === 'leaving' ? 'leaving' : 'idle'}
          size={4}
        />
      </div>

      {/* ── 1. Agent Name + Model Badge ── */}
      <div className="pixel-desk__agent-name" style={{ color: sprite.color }}>
        {agentName}
      </div>
      {modelShort && (
        <div className="pixel-desk__model-pill">
          🧠 {modelShort}
        </div>
      )}

      {/* ── 2. Type Badge ── */}
      {(() => {
        const agentType = deriveAgentType(member);
        const isSub = agentType === 'SUBAGENT' || agentType === 'WORKER';
        return (
          <div className={cn(
            "pixel-desk__badge",
            isSub ? "pixel-desk__badge--sub" : "pixel-desk__badge--main"
          )}>
            {agentType}
          </div>
        );
      })()}

      {/* ── 3-6. Progress Section (task + bar + status) ── */}
      <div className="pixel-desk__progress-section">
        {/* Current Task / Progress Label */}
        <div className="pixel-desk__current-task">
          {member.currentTask
            ? truncate(member.currentTask, 28)
            : progressLabel
            ? progressLabel
            : animation === "complete"
            ? "Done ✓"
            : "—"}
        </div>

        {/* Progress Bar + Percentage */}
        <div className="pixel-desk__progress-bar-row">
          <div className="pixel-desk__progress-bar">
            <div
              className="pixel-desk__progress-fill"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-label="Agent progress"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span className="pixel-desk__progress-pct">{progress}%</span>
        </div>

        {/* Status Line with Emoji */}
        <div className={cn(
          "pixel-desk__status-line",
          animation === "working" || animation === "arriving"
            ? "pixel-desk__status-line--working"
            : animation === "complete"
            ? "pixel-desk__status-line--complete"
            : animation === "error"
            ? "pixel-desk__status-line--error"
            : "pixel-desk__status-line--idle"
        )}>
          {deriveStatusLabel(animation)} {deriveStatusEmoji(animation)}
        </div>
      </div>

      {/* Model badge removed from bottom — now shown in name row below */}

      {/* (click desk to open details) */}

      {/* (desk surface and character are in the workstation section above) */}
    </div>
  );
}

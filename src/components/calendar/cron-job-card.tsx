"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { describeCron } from "@/lib/cron-describe";
import { safeGetNextRun } from "@/lib/cron-next-run";

// ── Types ────────────────────────────────────────────────────────────
export interface CronJobCardJob {
  id: string;
  name?: string;
  kind: "cron" | "reminder";
  schedule: string;
  command: string;
  runAt?: string;
  source: "gateway" | "local";
  editable?: boolean;
  deletable?: boolean;
}

export interface CronJobCardProps {
  job: CronJobCardJob;
  isBusy?: boolean;
  isEditing?: boolean;
  editSchedule?: string;
  editCommand?: string;
  editRunAt?: string;
  onBeginEdit?: (job: CronJobCardJob) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (job: CronJobCardJob) => void;
  onDelete?: (job: CronJobCardJob) => void;
  onRunNow?: (job: CronJobCardJob) => void;
  onEditScheduleChange?: (v: string) => void;
  onEditCommandChange?: (v: string) => void;
  onEditRunAtChange?: (v: string) => void;
}

// ── Color helpers ────────────────────────────────────────────────────

/** Derive a schedule "type" from a cron expression for colour-coding */
function scheduleType(expression: string): "minutely" | "hourly" | "daily" | "weekly" | "monthly" | "other" {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return "other";
  const [minuteF, hourF, domF, , dowF] = parts;

  if (/^\*\/\d+$/.test(minuteF) && hourF === "*") return "minutely";
  if (minuteF === "0" && /^\*\/\d+$/.test(hourF)) return "hourly";
  if (domF === "*" && dowF === "*") return "daily";
  if (dowF !== "*") return "weekly";
  if (domF !== "*") return "monthly";
  return "other";
}

const TYPE_COLORS: Record<string, { accent: string; bg: string; border: string; label: string }> = {
  minutely: { accent: "#7fe1b8", bg: "rgba(127,225,184,0.08)", border: "rgba(127,225,184,0.3)", label: "Minutely" },
  hourly:   { accent: "#77adff", bg: "rgba(119,173,255,0.08)", border: "rgba(119,173,255,0.3)", label: "Hourly" },
  daily:    { accent: "#22d3ee", bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.3)", label: "Daily" },
  weekly:   { accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)", label: "Weekly" },
  monthly:  { accent: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.3)", label: "Monthly" },
  other:    { accent: "#475569", bg: "rgba(141,163,203,0.06)", border: "rgba(141,163,203,0.25)", label: "Custom" },
};

const SOURCE_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  gateway: { accent: "#77adff", bg: "rgba(119,173,255,0.1)", border: "rgba(0,212,255,0.35)" },
  local:   { accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)" },
};

// ── Sub-components ────────────────────────────────────────────────────

function Badge({
  label,
  accent,
  bg,
  border,
}: {
  label: string;
  accent: string;
  bg: string;
  border: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-px text-[0.62rem] font-semibold uppercase tracking-wide"
      style={{ background: bg, border: `1px solid ${border}`, color: accent }}
    >
      {label}
    </span>
  );
}

// ── Main card component ────────────────────────────────────────────────

export function CronJobCard({
  job,
  isBusy = false,
  isEditing = false,
  editSchedule = "",
  editCommand = "",
  editRunAt = "",
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRunNow,
  onEditScheduleChange,
  onEditCommandChange,
  onEditRunAtChange,
}: CronJobCardProps) {
  const [hovered, setHovered] = React.useState(false);

  const isReminder = job.kind === "reminder";
  const sType = isReminder ? "other" : scheduleType(job.schedule);
  const typeColor = TYPE_COLORS[sType] ?? TYPE_COLORS.other;
  const srcColor = SOURCE_COLORS[job.source] ?? SOURCE_COLORS.local;

  // Next run (only for cron, not reminders)
  const { nextRun, countdown } = React.useMemo(() => {
    if (isReminder && job.runAt) {
      const d = new Date(job.runAt);
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const mins = Math.floor(diffMs / 60000);
      let cd = "";
      if (diffMs < 0) cd = "in the past";
      else if (mins < 60) cd = `in ${mins} min`;
      else cd = `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
      return { nextRun: d, countdown: cd };
    }
    return safeGetNextRun(job.schedule);
  }, [isReminder, job.runAt, job.schedule]);

  const cardStyle: React.CSSProperties = {
    background: hovered
      ? "linear-gradient(180deg, rgba(37,37,64,0.97), rgba(26,26,46,0.98))"
      : "linear-gradient(180deg, rgba(30,30,52,0.97), rgba(26,26,46,0.98))",
    border: `1px solid ${hovered ? "rgba(255,255,255,0.08)" : "rgba(0,212,255,0.12)"}`,
    borderRadius: 12,
    padding: "0.9rem",
    position: "relative",
    overflow: "hidden",
    transition: "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
    boxShadow: hovered
      ? `0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px rgba(0,0,0,0.4)`
      : "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
    marginBottom: "0.6rem",
  };

  const canEdit = job.editable && job.source === "gateway";
  const canDelete = job.deletable && job.source === "gateway";

  return (
    <article
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Top glow strip ────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${typeColor.accent}88, transparent)`,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s",
          pointerEvents: "none",
        }}
      />

      {/* ── Header row: Title + badges ───────────────────────────── */}
      <div className="flex items-start gap-2 flex-wrap mb-2">
        <div className="flex-1 min-w-0">
          <h4
            className="text-[0.86rem] font-semibold leading-snug truncate"
            style={{ color: "#e2e8f0", margin: 0 }}
            title={isReminder ? job.command : job.schedule}
          >
            {isReminder ? "⏰ Reminder" : job.command.slice(0, 48)}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge label={isReminder ? "reminder" : typeColor.label} accent={typeColor.accent} bg={typeColor.bg} border={typeColor.border} />
          <Badge label={job.source} accent={srcColor.accent} bg={srcColor.bg} border={srcColor.border} />
        </div>
      </div>

      {/* ── Middle: Expression + description ─────────────────────── */}
      <div
        className="rounded-lg px-3 py-2 mb-2"
        style={{
          background: "rgba(5,5,16,0.8)",
          border: "1px solid rgba(0,212,255,0.12)",
        }}
      >
        {isReminder ? (
          <>
            <p
              className="font-mono text-[0.75rem] mb-0.5"
              style={{ color: typeColor.accent, margin: 0 }}
            >
              {job.runAt ? new Date(job.runAt).toLocaleString() : "—"}
            </p>
            <p className="text-[0.72rem]" style={{ color: "#475569", margin: 0 }}>
              {job.command}
            </p>
          </>
        ) : (
          <>
            <p
              className="font-mono text-[0.75rem] mb-0.5"
              style={{ color: typeColor.accent, margin: 0 }}
            >
              {job.schedule}
            </p>
            <p className="text-[0.72rem]" style={{ color: "#475569", margin: 0 }}>
              {describeCron(job.schedule)}
            </p>
          </>
        )}
      </div>

      {/* ── Bottom: Countdown + last run ────────────────────────── */}
      {!isEditing && (
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ background: typeColor.accent, opacity: 0.9 }}
            />
            <span className="text-[0.72rem] font-medium" style={{ color: typeColor.accent }}>
              {countdown}
            </span>
          </div>
          {nextRun && (
            <span className="text-[0.68rem]" style={{ color: "#5e7299" }}>
              {nextRun.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {nextRun.toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      )}

      {/* ── Edit form ────────────────────────────────────────────── */}
      {isEditing && (
        <div className="flex flex-col gap-2 mb-2">
          {job.kind === "cron" ? (
            <input
              type="text"
              value={editSchedule}
              onChange={(e) => onEditScheduleChange?.(e.target.value)}
              placeholder="Cron expression"
              className="font-mono"
              style={inputStyle}
              maxLength={120}
            />
          ) : (
            <input
              type="datetime-local"
              value={editRunAt}
              onChange={(e) => onEditRunAtChange?.(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="text"
            value={editCommand}
            onChange={(e) => onEditCommandChange?.(e.target.value)}
            placeholder={job.kind === "reminder" ? "Reminder message" : "Command / task"}
            style={inputStyle}
            maxLength={400}
          />
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 flex-wrap pt-2 border-t"
        style={{ borderColor: "rgba(0,212,255,0.12)" }}
      >
        {isEditing ? (
          <>
            <ActionBtn
              onClick={() => onSaveEdit?.(job)}
              disabled={isBusy}
              accent="#77adff"
            >
              {isBusy ? "Saving…" : "Save"}
            </ActionBtn>
            <ActionBtn onClick={() => onCancelEdit?.()} disabled={isBusy}>
              Cancel
            </ActionBtn>
          </>
        ) : (
          <>
            <ActionBtn
              onClick={() => onBeginEdit?.(job)}
              disabled={!canEdit || isBusy}
              title={!canEdit ? "Read-only (local crontab)" : undefined}
            >
              Edit
            </ActionBtn>
            <ActionBtn
              onClick={() => onDelete?.(job)}
              disabled={!canDelete || isBusy}
              danger
              title={!canDelete ? "Read-only (local crontab)" : undefined}
            >
              {isBusy ? "Deleting…" : "Delete"}
            </ActionBtn>
            {!isReminder && (
              <ActionBtn
                onClick={() => onRunNow?.(job)}
                disabled={isBusy}
                accent="#7fe1b8"
                className="ml-auto"
              >
                ▶ Run now
              </ActionBtn>
            )}
          </>
        )}

        {job.source !== "gateway" && (
          <span className="text-[0.65rem] ml-auto" style={{ color: "#5e7299" }}>
            Local crontab · read-only
          </span>
        )}
      </div>
    </article>
  );
}

// ── Shared input style ────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid rgba(0,212,255,0.12)",
  background: "rgba(5,5,16,0.9)",
  color: "#e2e8f0",
  borderRadius: 9,
  padding: "0.52rem 0.68rem",
  font: "inherit",
  fontSize: "0.8rem",
};

// ── Small action button ───────────────────────────────────────────────
function ActionBtn({
  children,
  onClick,
  disabled,
  danger,
  accent,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: string;
  title?: string;
  className?: string;
}) {
  const baseColor = danger ? "#ffb0ae" : accent ?? "#94a3b8";
  const baseBorder = danger ? "rgba(255,100,100,0.35)" : "rgba(125,153,202,0.38)";
  const baseBg = danger ? "rgba(239,68,68,0.1)" : "rgba(8,12,30,0.55)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn("text-[0.71rem] font-semibold rounded-lg px-3 py-1.5 transition-colors duration-150", className)}
      style={{
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        color: baseColor,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

import { ScreenWrapper } from "@/components/layout/screen-wrapper";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";
import { useToast } from "@/components/ui/toast";
import dynamic from "next/dynamic";
import { CronJobCard } from "@/components/calendar/cron-job-card";
import { CalendarEventSkeleton, CronJobSkeleton, Skeleton } from "@/components/skeleton-loader";

// Lazy-load WeekView (388 lines, complex grid) — only rendered in week mode
const WeekView = dynamic(
  () => import("@/components/calendar/week-view").then((m) => m.WeekView),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden" style={{ minHeight: 480 }}>
        <Skeleton className="w-full h-full" style={{ minHeight: 480 }} aria-label="Loading week view…" />
      </div>
    ),
  },
);
import type { CalendarEvent } from "@/components/calendar/event-block";

// ── Types ────────────────────────────────────────────────────────────
type EventItem = {
  title: string;
  start: string;
  end?: string;
  calendar?: string;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
};

type CronJob = {
  id: string;
  name?: string;
  kind: "cron" | "reminder";
  schedule: string;
  command: string;
  runAt?: string;
  source: "gateway" | "local";
  editable?: boolean;
  deletable?: boolean;
};

type ActionState = {
  type: "success" | "error";
  message: string;
  warnings?: string[];
};

type ViewMode = "list" | "week";

// ── V2 Palette ──────────────────────────────────────────────────────
const C = {
  cyan: "#00d4ff",
  purple: "#a855f7",
  teal: "#2dd4bf",
  pink: "#f472b6",
  green: "#00ff88",
  amber: "#fbbf24",
  red: "#ff3366",
  bg: "#050510",
  glass: "rgba(8, 12, 30, 0.65)",
  border: "rgba(0, 212, 255, 0.12)",
  text: "#e2e8f0",
  muted: "#475569",
};

// ── Shared style constants ───────────────────────────────────────────
const CARD_STYLE = {
  background: C.glass,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`,
  boxShadow: `0 0 40px ${C.cyan}08, 0 16px 48px rgba(0,0,0,0.3)`,
} as const;

const CARD_BORDER = `1px solid ${C.border}`;
const COLOR_LABEL = C.muted;
const COLOR_VALUE = C.text;
const COLOR_MUTED = C.muted;
const COLOR_TITLE = C.text;

// ── Stats bar component ──────────────────────────────────────────────
function StatsBar({
  eventsCount,
  cronCount,
  upcomingCount,
  view,
  onViewChange,
}: {
  eventsCount: number;
  cronCount: number;
  upcomingCount: number;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl"
      style={{
        background: C.glass,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: CARD_BORDER,
        boxShadow: `0 0 40px ${C.cyan}08, 0 16px 48px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Stats */}
      <StatChip label="Events" value={eventsCount} color="rgba(0,212,255,0.9)" />
      <StatChip label="Cron jobs" value={cronCount} color="#7fe1b8" />
      <StatChip label="Next 7 days" value={upcomingCount} color="#fbbf24" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggle */}
      <div
        className="flex items-center gap-1 rounded-lg p-0.5"
        style={{ background: "rgba(5,5,16,0.8)", border: CARD_BORDER }}
      >
        {(["list", "week"] as ViewMode[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className="text-[0.72rem] font-semibold rounded-md px-3 py-1.5 capitalize transition-all duration-150"
            style={{
              background: view === v ? "rgba(0,212,255,0.1)" : "transparent",
              color: view === v ? "#77adff" : COLOR_LABEL,
              border: view === v ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
              cursor: "pointer",
            }}
          >
            {v === "list" ? "☰ List" : "📅 Week"}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="text-[0.72rem] font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[0.68rem]" style={{ color: COLOR_LABEL }}>
        {label}
      </span>
    </div>
  );
}

// ── Upcoming events card (list view) ────────────────────────────────
function EventCard({ event }: { event: EventItem }) {
  return (
    <article
      className="flex flex-col gap-2 rounded-xl p-4"
      style={CARD_STYLE}
    >
      <h4 className="text-[0.86rem] font-semibold" style={{ margin: 0, color: COLOR_TITLE }}>
        {event.title}
        {event.linkedTaskId && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ml-2"
            style={{
              background: "rgba(127,225,184,0.1)",
              border: "1px solid rgba(127,225,184,0.3)",
              color: "#7fe1b8",
            }}
            title={`Linked to task: ${event.linkedTaskTitle ?? event.linkedTaskId}`}
          >
            🔗 task
          </span>
        )}
      </h4>
      <p className="text-[0.75rem]" style={{ color: COLOR_MUTED, margin: 0 }}>
        {new Date(event.start).toLocaleString()}
      </p>
      {event.end && (
        <p className="text-[0.72rem]" style={{ color: COLOR_LABEL, margin: 0 }}>
          Ends: {new Date(event.end).toLocaleString()}
        </p>
      )}
      <p className="text-[0.8rem]" style={{ margin: 0, color: COLOR_MUTED }}>
        {event.calendar ?? "Apple Calendar"}
      </p>
      {event.linkedTaskTitle && (
        <p className="text-[0.72rem]" style={{ color: "#7fe1b8", margin: 0 }}>
          📋 Task: <em>{event.linkedTaskTitle}</em>
        </p>
      )}
    </article>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { toast, confirm } = useToast();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sources, setSources] = useState<{ events: string; cron: string }>({
    events: "none",
    cron: "none",
  });

  // Form state
  const [reminderAt, setReminderAt] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [cronExpression, setCronExpression] = useState("*/15 * * * *");
  const [cronCommand, setCronCommand] = useState('echo "heartbeat"');

  // Edit state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editSchedule, setEditSchedule] = useState("");
  const [editCommand, setEditCommand] = useState("");
  const [editRunAt, setEditRunAt] = useState("");

  const [busyJobIds, setBusyJobIds] = useState<Record<string, true>>({});
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);
  const [isSubmittingCron, setIsSubmittingCron] = useState(false);
  const [actionState, setActionState] = useState<ActionState | null>(null);

  // View toggle
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Selected event for week view
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // ── Status badge helper (Team Structure pattern) ──────────────────
  const statusBadge = (label: string, value: string | number) => (
    <span
      key={label}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-medium"
      style={{
        background: C.glass,
        border: CARD_BORDER,
        color: COLOR_MUTED,
      }}
    >
      <span style={{ color: COLOR_LABEL }}>{label}</span>
      <span style={{ color: COLOR_VALUE, fontWeight: 600 }}>{value}</span>
    </span>
  );

  // ── Data fetching (preserved exactly) ────────────────────────────
  const loadOverview = useCallback(async () => {
    try {
      const [overviewRes, tasksRes] = await Promise.all([
        fetch("/api/calendar/overview", { cache: "no-store" }),
        fetch("/api/task-board", { cache: "no-store" }),
      ]);

      const data = (await overviewRes.json()) as {
        events?: EventItem[];
        cronJobs?: CronJob[];
        warnings?: string[];
        sources?: { events?: string; cron?: string };
      };

      const eventToTaskMap: Map<string, { id: string; title: string }> = new Map();
      try {
        const taskData = (await tasksRes.json()) as {
          tasks?: Array<{ id: string; title: string; calendarEventId?: string }>;
        };
        for (const task of taskData.tasks ?? []) {
          if (task.calendarEventId) {
            eventToTaskMap.set(task.calendarEventId, { id: task.id, title: task.title });
          }
        }
      } catch {
        // non-critical
      }

      const rawEvents = Array.isArray(data.events) ? data.events : [];
      const enrichedEvents: EventItem[] = rawEvents.map((ev) => {
        let linkedTaskId: string | undefined;
        let linkedTaskTitle: string | undefined;
        for (const [, task] of eventToTaskMap) {
          if (task.title === ev.title) {
            linkedTaskId = task.id;
            linkedTaskTitle = task.title;
            break;
          }
        }
        return { ...ev, linkedTaskId, linkedTaskTitle };
      });

      setEvents(enrichedEvents);
      setCronJobs(Array.isArray(data.cronJobs) ? data.cronJobs : []);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      if (data.sources && typeof data.sources === "object") {
        setSources({
          events: String(data.sources.events ?? "none"),
          cron: String(data.sources.cron ?? "none"),
        });
      }
    } catch {
      setWarnings(["Unable to load calendar panel data."]);
    }
  }, []);

  // ── Reminder submit (preserved) ───────────────────────────────────
  const submitReminder = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setActionState(null);
      const message = reminderMessage.trim();
      if (!reminderAt || !message) {
        setActionState({ type: "error", message: "Reminder time and message are required." });
        return;
      }
      setIsSubmittingReminder(true);
      try {
        const res = await fetch("/api/calendar/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ at: new Date(reminderAt).toISOString(), message }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; warnings?: string[] };
        if (!res.ok || !data.ok) {
          setActionState({
            type: "error",
            message: data.error || "Failed to create one-shot reminder.",
            warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
          });
          return;
        }
        setReminderMessage("");
        setActionState({
          type: "success",
          message: "One-shot reminder created.",
          warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
        });
        await loadOverview();
      } catch {
        setActionState({ type: "error", message: "Unable to create reminder right now." });
      } finally {
        setIsSubmittingReminder(false);
      }
    },
    [loadOverview, reminderAt, reminderMessage],
  );

  // ── Cron submit (preserved) ───────────────────────────────────────
  const submitCron = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setActionState(null);
      const schedule = cronExpression.trim();
      const command = cronCommand.trim();
      if (!schedule || !command) {
        setActionState({ type: "error", message: "Cron expression and command/message are required." });
        return;
      }
      setIsSubmittingCron(true);
      try {
        const res = await fetch("/api/calendar/cron", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule, command }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; warnings?: string[] };
        if (!res.ok || !data.ok) {
          setActionState({
            type: "error",
            message: data.error || "Failed to create recurring cron job.",
            warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
          });
          return;
        }
        setActionState({
          type: "success",
          message: "Recurring cron job created.",
          warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
        });
        await loadOverview();
      } catch {
        setActionState({ type: "error", message: "Unable to create recurring cron job right now." });
      } finally {
        setIsSubmittingCron(false);
      }
    },
    [cronCommand, cronExpression, loadOverview],
  );

  // ── Edit / delete (preserved + wired to new card) ─────────────────
  const beginEdit = useCallback((job: CronJob) => {
    setEditingJobId(job.id);
    setEditSchedule(job.schedule);
    setEditCommand(job.command);
    setEditRunAt(job.runAt ? new Date(job.runAt).toISOString().slice(0, 16) : "");
    setActionState(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingJobId(null);
    setEditSchedule("");
    setEditCommand("");
    setEditRunAt("");
  }, []);

  const markJobBusy = useCallback((id: string, busy: boolean) => {
    setBusyJobIds((prev) => {
      if (busy) return { ...prev, [id]: true };
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const submitUpdate = useCallback(
    async (job: CronJob) => {
      if (!job.editable || job.source !== "gateway") {
        setActionState({ type: "error", message: "Only gateway jobs can be updated." });
        return;
      }
      const nextCommand = editCommand.trim();
      const nextSchedule = editSchedule.trim();
      if (!nextCommand) {
        setActionState({ type: "error", message: "Command/message is required." });
        return;
      }
      if (job.kind === "cron" && !nextSchedule) {
        setActionState({ type: "error", message: "Cron expression is required." });
        return;
      }
      if (job.kind === "reminder" && !editRunAt) {
        setActionState({ type: "error", message: "Reminder date/time is required." });
        return;
      }
      setActionState(null);
      markJobBusy(job.id, true);
      const optimistic = cronJobs.map((item) =>
        item.id === job.id
          ? {
              ...item,
              schedule: job.kind === "cron" ? nextSchedule : item.schedule,
              command: nextCommand,
              runAt: job.kind === "reminder" ? new Date(editRunAt).toISOString() : item.runAt,
            }
          : item,
      );
      setCronJobs(optimistic);
      try {
        const res = await fetch("/api/calendar/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: job.id,
            source: job.source,
            kind: job.kind,
            previousSchedule: job.schedule,
            previousCommand: job.command,
            schedule: job.kind === "cron" ? nextSchedule : undefined,
            command: nextCommand,
            runAt: job.kind === "reminder" ? new Date(editRunAt).toISOString() : undefined,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; warnings?: string[] };
        if (!res.ok || !data.ok) {
          setCronJobs(cronJobs);
          setActionState({
            type: "error",
            message: data.error || "Failed to update job.",
            warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
          });
          return;
        }
        setActionState({
          type: "success",
          message: `${job.kind === "reminder" ? "Reminder" : "Cron job"} updated.`,
          warnings: Array.isArray(data.warnings) ? data.warnings : undefined,
        });
        cancelEdit();
        await loadOverview();
      } catch {
        setCronJobs(cronJobs);
        setActionState({ type: "error", message: "Unable to update job right now." });
      } finally {
        markJobBusy(job.id, false);
      }
    },
    [cancelEdit, cronJobs, editCommand, editRunAt, editSchedule, loadOverview, markJobBusy],
  );

  const deleteJob = useCallback(
    async (job: CronJob) => {
      if (!job.deletable || job.source !== "gateway") {
        toast("Only gateway jobs can be deleted.", "error");
        return;
      }

      const label = job.name || job.command?.slice(0, 40) || job.id || "this job";
      const confirmed = await confirm({
        title: "Delete Cron Job",
        message: `Are you sure you want to delete "${label}"? This cannot be undone.`,
        confirmLabel: "🗑️ DELETE",
        cancelLabel: "CANCEL",
        danger: true,
      });
      if (!confirmed) return;

      markJobBusy(job.id, true);
      const previous = cronJobs;
      setCronJobs((items) => items.filter((item) => item.id !== job.id));
      try {
        const res = await fetch("/api/calendar/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: job.id,
            source: job.source,
            kind: job.kind,
            schedule: job.schedule,
            command: job.command,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; warnings?: string[] };
        if (!res.ok || !data.ok) {
          setCronJobs(previous);
          toast(data.error || "Failed to delete job.", "error");
          return;
        }
        toast(`${job.kind === "reminder" ? "Reminder" : "Cron job"} deleted.`, "success");
        if (editingJobId === job.id) cancelEdit();
        await loadOverview();
      } catch {
        setCronJobs(previous);
        toast("Unable to delete job right now.", "error");
      } finally {
        markJobBusy(job.id, false);
      }
    },
    [cancelEdit, confirm, cronJobs, editingJobId, loadOverview, markJobBusy, toast],
  );

  // ── Polling (preserved) ───────────────────────────────────────────
  const { isLoading, isRefreshing, lastUpdated, isVisible } = useVisibilityPolling(loadOverview, {
    intervalMs: 15000,
  });

  // ── Derived state ─────────────────────────────────────────────────
  const cronOnlyJobs = useMemo(() => cronJobs.filter((job) => job.kind === "cron"), [cronJobs]);
  const reminderJobs = useMemo(() => cronJobs.filter((job) => job.kind === "reminder"), [cronJobs]);
  const allJobs = useMemo(() => [...reminderJobs, ...cronOnlyJobs], [reminderJobs, cronOnlyJobs]);

  // Events for the week view (adapt EventItem → CalendarEvent with an id)
  const calendarEvents = useMemo<CalendarEvent[]>(() =>
    events.map((ev, i) => ({
      id: `ev-${i}-${ev.title}`,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      calendar: ev.calendar,
      linkedTaskId: ev.linkedTaskId,
      linkedTaskTitle: ev.linkedTaskTitle,
    })),
    [events],
  );

  // Upcoming in next 7 days
  const upcomingCount = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return events.filter((ev) => {
      const d = new Date(ev.start);
      return d >= now && d <= weekAhead;
    }).length;
  }, [events]);

  // ── Input styling ─────────────────────────────────────────────────
  const inputStyle = {
    background: "rgba(5,5,16,0.8)",
    border: CARD_BORDER,
    color: COLOR_VALUE,
    borderRadius: "0.5rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.8rem",
    outline: "none",
    width: "100%",
  } as const;

  const buttonStyle = {
    background: "rgba(0,212,255,0.1)",
    border: "1px solid rgba(0,212,255,0.3)",
    color: "#77adff",
    borderRadius: "0.5rem",
    padding: "0.5rem 1rem",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <ScreenWrapper
      eyebrow="Schedule · Events"
      title="Calendar"
      description="Upcoming events, cron jobs, and reminders."
      maxWidth="max-w-6xl"
    >
      {/* ── Status bar (Team Structure pattern) ── */}
      <div className="flex flex-wrap items-center gap-2" role="status" aria-label="Calendar status">
        {statusBadge(
          "Status",
          isLoading ? "Loading…" : isRefreshing ? "Refreshing…" : "Live",
        )}
        {statusBadge("Events", events.length)}
        {statusBadge("Cron jobs", allJobs.length)}
        {statusBadge("Sources", `${sources.events} / ${sources.cron}`)}
        {lastUpdated && statusBadge("Updated", new Date(lastUpdated).toLocaleTimeString())}
        {!isVisible && (
          <span
            className="text-[0.66rem] rounded-full px-2.5 py-1"
            style={{
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.3)",
              color: "#fbbf24",
            }}
          >
            Paused (tab hidden)
          </span>
        )}
      </div>

      {/* ── Stats bar + view toggle ─────────────────────────── */}
      <StatsBar
        eventsCount={events.length}
        cronCount={allJobs.length}
        upcomingCount={upcomingCount}
        view={viewMode}
        onViewChange={setViewMode}
      />

      {/* ── Action feedback ────────────────────────────────── */}
      {actionState && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: actionState.type === "success"
              ? "rgba(127,225,184,0.06)"
              : "rgba(255,176,174,0.06)",
            border: actionState.type === "success"
              ? "1px solid rgba(127,225,184,0.3)"
              : "1px solid rgba(255,176,174,0.3)",
          }}
        >
          <p
            className="text-[0.78rem] font-medium"
            style={{
              color: actionState.type === "success" ? "#7fe1b8" : "#ffb0ae",
              margin: 0,
            }}
          >
            {actionState.type === "success" ? "✅" : "⚠"} {actionState.message}
          </p>
          {actionState.warnings?.map((w) => (
            <p key={w} className="text-[0.72rem] mt-1" style={{ color: "#fbbf24", margin: "4px 0 0" }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: "rgba(251,191,36,0.06)",
            border: "1px solid rgba(251,191,36,0.3)",
          }}
        >
          {warnings.map((w) => (
            <p key={w} className="text-[0.72rem]" style={{ color: "#fbbf24", margin: "2px 0" }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <CalendarEventSkeleton count={4} />
          <CronJobSkeleton count={3} />
        </div>
      ) : (
        <>
          {/* ────────────────────────────────────────────────────
              LIST VIEW
          ──────────────────────────────────────────────────── */}
          {viewMode === "list" && (
            <div className="flex flex-col gap-5">
              {/* Create forms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reminder form */}
                <div
                  className="flex flex-col gap-3 rounded-xl p-4"
                  style={CARD_STYLE}
                >
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: COLOR_VALUE, margin: 0 }}
                  >
                    Create one-shot reminder
                  </h3>
                  <form onSubmit={submitReminder} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.68rem] font-medium" style={{ color: COLOR_LABEL }} htmlFor="reminder-at">
                        Date/time
                      </label>
                      <input
                        id="reminder-at"
                        type="datetime-local"
                        value={reminderAt}
                        onChange={(e) => setReminderAt(e.target.value)}
                        required
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.68rem] font-medium" style={{ color: COLOR_LABEL }} htmlFor="reminder-message">
                        Message
                      </label>
                      <input
                        id="reminder-message"
                        type="text"
                        value={reminderMessage}
                        onChange={(e) => setReminderMessage(e.target.value)}
                        maxLength={280}
                        placeholder="What should happen?"
                        required
                        style={inputStyle}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingReminder || isSubmittingCron}
                      style={{
                        ...buttonStyle,
                        opacity: isSubmittingReminder || isSubmittingCron ? 0.5 : 1,
                      }}
                    >
                      {isSubmittingReminder ? "Creating…" : "Create reminder"}
                    </button>
                  </form>
                </div>

                {/* Cron form */}
                <div
                  className="flex flex-col gap-3 rounded-xl p-4"
                  style={CARD_STYLE}
                >
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: COLOR_VALUE, margin: 0 }}
                  >
                    Create recurring cron job
                  </h3>
                  <form onSubmit={submitCron} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.68rem] font-medium" style={{ color: COLOR_LABEL }} htmlFor="cron-expression">
                        Cron expression
                      </label>
                      <input
                        id="cron-expression"
                        type="text"
                        value={cronExpression}
                        onChange={(e) => setCronExpression(e.target.value)}
                        placeholder="*/15 * * * *"
                        required
                        style={inputStyle}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[0.68rem] font-medium" style={{ color: COLOR_LABEL }} htmlFor="cron-command">
                        Command / message
                      </label>
                      <input
                        id="cron-command"
                        type="text"
                        value={cronCommand}
                        onChange={(e) => setCronCommand(e.target.value)}
                        maxLength={400}
                        placeholder='echo "heartbeat"'
                        required
                        style={inputStyle}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingReminder || isSubmittingCron}
                      style={{
                        ...buttonStyle,
                        opacity: isSubmittingReminder || isSubmittingCron ? 0.5 : 1,
                      }}
                    >
                      {isSubmittingCron ? "Creating…" : "Create cron job"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Events + Cron list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upcoming events */}
                <div className="flex flex-col gap-3">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: COLOR_VALUE, margin: 0 }}
                  >
                    Upcoming events ({events.length})
                  </h3>
                  {events.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {events.map((ev, i) => (
                        <EventCard key={`${ev.title}-${ev.start}-${i}`} event={ev} />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-xl py-16 gap-3"
                      style={{
                        background: "rgba(8,12,30,0.45)",
                        border: CARD_BORDER,
                      }}
                    >
                      <span className="text-3xl">📅</span>
                      <p className="text-sm font-medium" style={{ color: COLOR_MUTED }}>
                        No events found
                      </p>
                      <p className="text-xs" style={{ color: COLOR_LABEL }}>
                        Events will appear here when scheduled.
                      </p>
                    </div>
                  )}
                </div>

                {/* Cron jobs */}
                <div className="flex flex-col gap-3">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: COLOR_VALUE, margin: 0 }}
                  >
                    Cron jobs & reminders ({allJobs.length})
                  </h3>
                  {allJobs.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {allJobs.map((job) => (
                        <CronJobCard
                          key={job.id}
                          job={job}
                          isBusy={Boolean(busyJobIds[job.id])}
                          isEditing={editingJobId === job.id}
                          editSchedule={editSchedule}
                          editCommand={editCommand}
                          editRunAt={editRunAt}
                          onBeginEdit={beginEdit}
                          onCancelEdit={cancelEdit}
                          onSaveEdit={submitUpdate}
                          onDelete={deleteJob}
                          onRunNow={(j) => {
                            setActionState({ type: "success", message: `Run now queued for: ${j.command}` });
                          }}
                          onEditScheduleChange={setEditSchedule}
                          onEditCommandChange={setEditCommand}
                          onEditRunAtChange={setEditRunAt}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-xl py-16 gap-3"
                      style={{
                        background: "rgba(8,12,30,0.45)",
                        border: CARD_BORDER,
                      }}
                    >
                      <span className="text-3xl">🕐</span>
                      <p className="text-sm font-medium" style={{ color: COLOR_MUTED }}>
                        No cron jobs found
                      </p>
                      <p className="text-xs" style={{ color: COLOR_LABEL }}>
                        Cron jobs will appear here when created.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────
              WEEK VIEW
          ──────────────────────────────────────────────────── */}
          {viewMode === "week" && (
            <div className="flex flex-col gap-4">
              {calendarEvents.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center rounded-xl py-16 gap-3"
                  style={{
                    background: "rgba(8,12,30,0.45)",
                    border: CARD_BORDER,
                  }}
                >
                  <span className="text-3xl">📅</span>
                  <p className="text-sm font-medium" style={{ color: COLOR_MUTED }}>
                    No events to display this week
                  </p>
                  <p className="text-xs" style={{ color: COLOR_LABEL }}>
                    Switch to List view to create reminders and cron jobs.
                  </p>
                </div>
              )}

              <WeekView
                events={calendarEvents}
                onEventClick={(ev) => {
                  const match = events.find((e) => e.title === ev.title && e.start === ev.start);
                  setSelectedEvent(match ?? null);
                }}
              />

              {/* Selected event detail */}
              {selectedEvent && (
                <div
                  className="flex flex-col gap-2 rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(26,26,46,0.92)",
                    border: "1px solid rgba(0,212,255,0.25)",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h4
                        className="text-[0.9rem] font-semibold"
                        style={{ color: COLOR_TITLE, margin: 0 }}
                      >
                        {selectedEvent.title}
                      </h4>
                      <p className="text-[0.75rem]" style={{ color: COLOR_MUTED, margin: 0 }}>
                        {new Date(selectedEvent.start).toLocaleString()}
                        {selectedEvent.end
                          ? ` → ${new Date(selectedEvent.end).toLocaleString()}`
                          : ""}
                      </p>
                      {selectedEvent.calendar && (
                        <p className="text-[0.72rem]" style={{ color: COLOR_LABEL, margin: 0 }}>
                          📅 {selectedEvent.calendar}
                        </p>
                      )}
                      {selectedEvent.linkedTaskTitle && (
                        <p className="text-[0.72rem]" style={{ color: "#7fe1b8", margin: 0 }}>
                          🔗 {selectedEvent.linkedTaskTitle}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(null)}
                      className="text-[0.7rem] rounded-lg px-3 py-1.5 shrink-0"
                      style={{
                        background: "rgba(15,20,33,0.8)",
                        border: "1px solid rgba(125,153,202,0.35)",
                        color: COLOR_MUTED,
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </ScreenWrapper>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, CheckSquare, CalendarDays, Timer, Bell, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useCreateEventStore, type CreateEventTab } from "@/store";

// ── Toast ──────────────────────────────────────────────────────────
type ToastState = { kind: "success" | "error"; message: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className={[
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[110]",
        "flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl",
        "text-sm font-medium animate-fade-in",
        toast.kind === "success"
          ? "bg-[rgba(127,225,184,0.15)] border border-[rgba(127,225,184,0.35)] text-[#7fe1b8]"
          : "bg-[rgba(255,176,174,0.12)] border border-[rgba(255,176,174,0.3)] text-[#ffb0ae]",
      ].join(" ")}
    >
      {toast.kind === "success" ? (
        <CheckCircle2 size={15} aria-hidden="true" />
      ) : (
        <AlertCircle size={15} aria-hidden="true" />
      )}
      {toast.message}
    </div>
  );
}

// ── Input helpers ─────────────────────────────────────────────────
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-void-text-soft tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-[0.68rem] text-void-text-muted">{hint}</p>}
    </div>
  );
}

const inputClass = [
  "w-full bg-[rgba(8,12,30,0.45)] border border-[rgba(0,212,255,0.12)] rounded-lg",
  "px-3 py-2 text-sm text-void-text placeholder:text-void-text-muted",
  "focus:outline-none focus:border-[rgba(119,173,255,0.5)] focus:ring-1 focus:ring-[rgba(119,173,255,0.2)]",
  "transition-colors duration-150",
].join(" ");

const selectClass = inputClass + " cursor-pointer";

// ── Tab: Task ─────────────────────────────────────────────────────
function TaskTab({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<"me" | "you">("me");
  const [status, setStatus] = useState("todo");
  const [dueAt, setDueAt] = useState("");
  const [createReminder, setCreateReminder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/task-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          assignee,
          status,
          dueAt: dueAt || undefined,
          createCalendarReminder: createReminder,
          source: "manual",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to create task.");
      setToast({ kind: "success", message: `Task "${title.trim()}" created!` });
      setTimeout(() => { setToast(null); onClose(); }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setToast({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Title *">
          <input
            className={inputClass}
            placeholder="Task title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            className={inputClass + " resize-none min-h-[72px]"}
            placeholder="Optional details…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            <select className={selectClass} value={assignee} onChange={(e) => setAssignee(e.target.value as "me" | "you")}>
              <option value="me">Me</option>
              <option value="you">You (AI)</option>
            </select>
          </Field>

          <Field label="Status">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </Field>
        </div>

        <Field label="Due Date" hint="Optional — creates a calendar reminder if set">
          <input
            type="datetime-local"
            className={inputClass}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>

        {dueAt && (
          <label className="flex items-center gap-2 text-xs text-void-text-soft cursor-pointer">
            <input
              type="checkbox"
              className="accent-cyan w-3.5 h-3.5"
              checked={createReminder}
              onChange={(e) => setCreateReminder(e.target.checked)}
            />
            Create calendar reminder at due date
          </label>
        )}

        {error && (
          <p className="text-[0.75rem] text-[#ffb0ae] flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2 h-9 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
            {loading ? "Creating…" : "Create Task"}
          </button>
          <button type="button" onClick={onClose} className="px-4 h-9 text-sm void-btn rounded-lg">
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}

// ── Tab: Calendar Event ───────────────────────────────────────────
function CalendarTab({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!datetime) { setError("Date & time is required."); return; }
    setError("");
    setLoading(true);
    try {
      // POST to /api/calendar/reminders — closest available endpoint
      const res = await fetch("/api/calendar/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: title.trim() + (notes.trim() ? ` — ${notes.trim()}` : ""),
          at: datetime,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to create calendar reminder.");
      setToast({ kind: "success", message: `"${title.trim()}" scheduled!` });
      setTimeout(() => { setToast(null); onClose(); }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setToast({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Event Title *">
          <input className={inputClass} placeholder="e.g. Team standup…" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>

        <Field label="Date & Time *">
          <input type="datetime-local" className={inputClass} value={datetime} onChange={(e) => setDatetime(e.target.value)} />
        </Field>

        <Field label="Notes">
          <textarea className={inputClass + " resize-none min-h-[60px]"} placeholder="Optional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <p className="text-[0.68rem] text-void-text-muted -mt-2">
          Event is scheduled via the Calendar Reminders API (OPENCLAW calendar).
        </p>

        {error && (
          <p className="text-[0.75rem] text-[#ffb0ae] flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2 h-9 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
            {loading ? "Scheduling…" : "Schedule Event"}
          </button>
          <button type="button" onClick={onClose} className="px-4 h-9 text-sm void-btn rounded-lg">Cancel</button>
        </div>
      </form>
    </>
  );
}

// ── Cron preview ──────────────────────────────────────────────────
function describeCron(expr: string): string {
  if (!expr.trim()) return "";
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return "Incomplete expression";
  const [min, hour, dom, month, dow] = parts;
  // Very simple human-readable summaries for common patterns
  if (min === "*" && hour === "*") return "Every minute";
  if (min !== "*" && hour === "*") return `Every hour at :${min.padStart(2, "0")}`;
  if (dom === "*" && month === "*" && dow === "*") {
    return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dow !== "*" && dom === "*") {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const dayStr = dow.split(",").map((d) => days[Number(d)] ?? d).join(", ");
    return `Every ${dayStr} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom !== "*" && month !== "*") {
    return `On day ${dom} of month ${month} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  return `${hour}:${min} on ${dom}/${month} (dow:${dow})`;
}

// ── Tab: Cron Job ─────────────────────────────────────────────────
function CronTab({ onClose }: { onClose: () => void }) {
  const [schedule, setSchedule] = useState("0 9 * * 1-5");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const preview = describeCron(schedule);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schedule.trim()) { setError("Cron expression is required."); return; }
    if (!command.trim()) { setError("Command / description is required."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: schedule.trim(), command: command.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to create cron job.");
      setToast({ kind: "success", message: "Cron job created!" });
      setTimeout(() => { setToast(null); onClose(); }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setToast({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  const PRESETS = [
    { label: "Weekdays 9am", value: "0 9 * * 1-5" },
    { label: "Daily midnight", value: "0 0 * * *" },
    { label: "Hourly", value: "0 * * * *" },
    { label: "Every 30 min", value: "*/30 * * * *" },
    { label: "Every Sunday", value: "0 8 * * 0" },
  ];

  return (
    <>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Cron Expression *" hint={preview ? `→ ${preview}` : undefined}>
          <div className="flex gap-2">
            <input
              className={inputClass + " font-mono"}
              placeholder="0 9 * * 1-5"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              autoFocus
            />
          </div>
        </Field>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setSchedule(p.value)}
              className={[
                "px-2.5 py-1 rounded-md text-[0.7rem] font-mono border transition-colors duration-100",
                schedule === p.value
                  ? "border-[rgba(119,173,255,0.5)] bg-[rgba(119,173,255,0.12)] text-[#77adff]"
                  : "border-void-line text-void-text-muted hover:text-void-text hover:border-[rgba(119,173,255,0.3)]",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Field label="Command / Description *">
          <input
            className={inputClass}
            placeholder="e.g. Send daily report…"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
        </Field>

        {error && (
          <p className="text-[0.75rem] text-[#ffb0ae] flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2 h-9 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />}
            {loading ? "Creating…" : "Create Cron Job"}
          </button>
          <button type="button" onClick={onClose} className="px-4 h-9 text-sm void-btn rounded-lg">Cancel</button>
        </div>
      </form>
    </>
  );
}

// ── Tab: Reminder ─────────────────────────────────────────────────
function ReminderTab({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [at, setAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) { setError("Message is required."); return; }
    if (!at) { setError("Date & time is required."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/calendar/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), at }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to create reminder.");
      setToast({ kind: "success", message: "Reminder set!" });
      setTimeout(() => { setToast(null); onClose(); }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setToast({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Reminder Message *">
          <input className={inputClass} placeholder="What to remind you about…" value={message} onChange={(e) => setMessage(e.target.value)} autoFocus />
        </Field>

        <Field label="Date & Time *">
          <input type="datetime-local" className={inputClass} value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>

        {error && (
          <p className="text-[0.75rem] text-[#ffb0ae] flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2 h-9 text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            {loading ? "Setting…" : "Set Reminder"}
          </button>
          <button type="button" onClick={onClose} className="px-4 h-9 text-sm void-btn rounded-lg">Cancel</button>
        </div>
      </form>
    </>
  );
}

// ── Tab config ────────────────────────────────────────────────────
const TABS: { id: CreateEventTab; label: string; Icon: React.ElementType }[] = [
  { id: "task",     label: "Task",           Icon: CheckSquare },
  { id: "calendar", label: "Calendar Event", Icon: CalendarDays },
  { id: "cron",     label: "Cron Job",       Icon: Timer },
  { id: "reminder", label: "Reminder",       Icon: Bell },
];

// ── Create Event Modal ────────────────────────────────────────────
export function CreateEventModal() {
  const { createEventModalOpen, defaultTab, setCreateEventModalOpen } = useCreateEventStore();
  const [activeTab, setActiveTab] = useState<CreateEventTab>(defaultTab);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync active tab when defaultTab changes (e.g. opened with specific tab)
  useEffect(() => {
    if (createEventModalOpen) setActiveTab(defaultTab);
  }, [createEventModalOpen, defaultTab]);

  const close = useCallback(() => setCreateEventModalOpen(false), [setCreateEventModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!createEventModalOpen) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [createEventModalOpen, close]);

  if (!createEventModalOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[95] bg-[rgba(4,7,14,0.72)] backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create event"
        className={[
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[96]",
          "w-full max-w-lg mx-4",
          "void-panel overflow-hidden",
          "animate-fade-in",
          "flex flex-col",
          "max-h-[90vh]",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-void-line shrink-0">
          <h2 className="text-base font-semibold text-void-text">Create</h2>
          <button
            onClick={close}
            aria-label="Close modal"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-void-text-muted hover:text-void-text hover:bg-[rgba(32,45,70,0.4)] transition-colors duration-150"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-void-line shrink-0 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap",
                "border-b-2 transition-all duration-150",
                activeTab === id
                  ? "border-cyan text-cyan"
                  : "border-transparent text-void-text-muted hover:text-void-text hover:border-[rgba(119,173,255,0.3)]",
              ].join(" ")}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {activeTab === "task"     && <TaskTab     onClose={close} />}
          {activeTab === "calendar" && <CalendarTab onClose={close} />}
          {activeTab === "cron"     && <CronTab     onClose={close} />}
          {activeTab === "reminder" && <ReminderTab onClose={close} />}
        </div>
      </div>
    </>
  );
}

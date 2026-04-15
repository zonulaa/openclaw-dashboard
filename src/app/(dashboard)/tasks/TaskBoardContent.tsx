"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { gsap } from "@/lib/gsap-utils";

import { ScreenWrapper } from "@/components/layout/screen-wrapper";
import { TaskCalendarSyncPanel } from "@/components/TaskCalendarSyncPanel";
import { useVisibilityPolling } from "@/lib/use-visibility-polling";
import { SubtaskList, SubtaskItem } from "./SubtaskList";

// Types
type TaskAssignee = "me" | "you";
type TaskStatus = "todo" | "in-progress" | "review" | "done";
type TaskSource = "manual" | "auto";
type TaskReminderState = "none" | "linked" | "failed";
type TaskActivityType = "created" | "updated" | "status-transition" | "run-result";
type TaskActivitySource = "task-board-ui" | "panel-run";
type TaskPriority = "high" | "medium" | "low";

const PRIORITY_CYCLE: TaskPriority[] = ["high", "medium", "low"];
void PRIORITY_CYCLE;

type TaskItem = {
  id: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  status: TaskStatus;
  priority?: TaskPriority;
  source?: TaskSource;
  lastActivityAt?: string;
  dueAt?: string;
  reminderState?: TaskReminderState;
  linkedJobId?: string;
  linkedEventTitle?: string;
  linkedReminderAt?: string;
  linkedReminderMethod?: string;
  reminderError?: string;
  calendarEventId?: string;
  calendarSyncMode?: string;
  calendarSyncedAt?: string;
  calendarSyncError?: string;
  goalId?: string;
  subtasks?: SubtaskItem[];
};

type TaskActivity = {
  id: string;
  taskId: string;
  type: TaskActivityType;
  source: TaskActivitySource;
  timestamp: string;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  taskTitle: string | null;
  taskStatus: TaskStatus | null;
  meta?: Record<string, string | number | boolean | null>;
};

type ActivityPage = {
  offset: number;
  limit: number;
  nextOffset: number;
  total: number;
  hasMore: boolean;
};

type TimelineFilters = {
  eventType: "all" | TaskActivityType;
  source: "all" | TaskActivitySource;
  taskStatus: "all" | TaskStatus;
};

// Constants
const taskStatuses: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in-progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const activityTypeOptions: { value: TimelineFilters["eventType"]; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "status-transition", label: "Status transition" },
  { value: "run-result", label: "Run result" },
];

const activitySourceOptions: { value: TimelineFilters["source"]; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "task-board-ui", label: "Task board UI" },
  { value: "panel-run", label: "Panel run" },
];

const timelinePageSize = 20;

const GOAL_LABELS: Record<string, { emoji: string; short: string; color: string }> = {
  "cover-costs":        { emoji: "💰", short: "Cover Costs",   color: "#4ade80" },
  "cover-living":       { emoji: "🏠", short: "Cover Living",  color: "#34d399" },
  "show-work-monetize": { emoji: "🎬", short: "Show Work",     color: "#60a5fa" },
  "ops-goals":          { emoji: "⚙️",    short: "Operations",    color: "#f97316" },
};

const GOAL_FILTERS = [
  { id: "all",                emoji: "🗂",  label: "All",          color: "#94a3b8" },
  { id: "show-work-monetize", emoji: "🎬", label: "Show Work",    color: "#60a5fa" },
  { id: "ops-goals",          emoji: "⚙️",    label: "Operations",   color: "#f97316" },
  { id: "cover-costs",        emoji: "💰", label: "Cover Costs",  color: "#4ade80" },
  { id: "cover-living",       emoji: "🏠", label: "Cover Living", color: "#34d399" },
];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

// Styles
const inputStyle: React.CSSProperties = { background: "rgba(5,5,16,0.8)", border: "1px solid rgba(0,212,255,0.12)", color: "#c8deff", borderRadius: "8px" };
const primaryButtonStyle: React.CSSProperties = { background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", color: "#77adff", borderRadius: "8px" };
const secondaryButtonStyle: React.CSSProperties = { background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "#FF6B6B", borderRadius: "8px" };
const cardStyle: React.CSSProperties = { background: "linear-gradient(180deg, rgba(30,30,52,0.95), rgba(26,26,46,0.98))", border: "1px solid rgba(0,212,255,0.12)", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 4px 12px rgba(0,0,0,0.3)" };
const chipStyle: React.CSSProperties = { background: "rgba(8,12,30,0.6)", border: "1px solid rgba(0,212,255,0.12)", color: "#475569" };

function formatDueShort(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
}

function toDateTimeLocalInput(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatActivityLabel(activity: TaskActivity): string {
  if (activity.type === "status-transition") return `Status: ${activity.fromStatus ?? "?"} → ${activity.toStatus ?? "?"}`;
  if (activity.type === "run-result") { const ok = activity.meta?.ok; return `Run result: ${ok === true ? "success" : ok === false ? "failed" : "recorded"}`; }
  if (activity.type === "created") return "Task created";
  return "Task updated";
}

function stringifyMeta(meta?: Record<string, string | number | boolean | null>): string {
  if (!meta) return "";
  return Object.entries(meta).map(([key, value]) => `${key}: ${String(value)}`).join(" • ");
}

function buildTaskBoardUrl(filters: TimelineFilters, offset: number): string {
  const params = new URLSearchParams({ includeActivity: "1", activityLimit: String(timelinePageSize), activityOffset: String(offset) });
  if (filters.eventType !== "all") params.set("eventType", filters.eventType);
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.taskStatus !== "all") params.set("taskStatus", filters.taskStatus);
  return `/api/task-board?${params.toString()}`;
}

function sinkDoneSubtasks(subtasks: SubtaskItem[]): SubtaskItem[] {
  const undone = subtasks.filter((s) => !s.done);
  const done   = subtasks.filter((s) => s.done);
  return [...undone, ...done];
}

function statusBadge(label: string, value: string | number) {
  return (
    <span key={label} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.68rem] font-medium" style={{ background: "rgba(8,12,30,0.6)", border: "1px solid rgba(0,212,255,0.12)", color: "#475569" }}>
      <span style={{ color: "#5e7299" }}>{label}</span>
      <span style={{ color: "#c8deff", fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function GoalBadge({ goalId }: { goalId?: string }) {
  if (!goalId) return null;
  const g = GOAL_LABELS[goalId];
  if (!g) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "0.58rem", fontWeight: 600, lineHeight: 1, color: g.color, background: g.color + "18", border: `1px solid ${g.color}33`, borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap" }}>
      {g.emoji} {g.short}
    </span>
  );
}

function PriorityDot({ priority }: { priority?: TaskPriority }) {
  const colors: Record<string, string> = { high: "#f97316", medium: "#eab308", low: "#64748b" };
  const color = colors[priority ?? "low"] ?? "#64748b";
  return <span title={priority ?? "low"} style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: color, flexShrink: 0, marginTop: "3px" }} />;
}

function DueBadge({ dueAt }: { dueAt?: string }) {
  if (!dueAt) return null;
  const short = formatDueShort(dueAt);
  if (!short) return null;
  const isPast = new Date(dueAt) < new Date();
  return (
    <span style={{ fontSize: "0.6rem", fontWeight: 600, color: isPast ? "#f87171" : "#94a3b8", background: isPast ? "rgba(248,113,113,0.1)" : "rgba(148,163,184,0.1)", border: `1px solid ${isPast ? "rgba(248,113,113,0.25)" : "rgba(148,163,184,0.2)"}`, borderRadius: "4px", padding: "1px 5px", whiteSpace: "nowrap", flexShrink: 0 }}>
      {isPast ? "⚠ " : ""}{short}
    </span>
  );
}

function SubtaskProgress({ subtasks }: { subtasks?: SubtaskItem[] }) {
  if (!subtasks || subtasks.length === 0) return null;
  const done  = subtasks.filter((s) => s.done).length;
  const total = subtasks.length;
  const pct   = Math.round((done / total) * 100);
  const allDone = done === total;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "rgba(141,163,203,0.15)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: "99px", background: allDone ? "#4ade80" : "#60a5fa", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "0.6rem", color: "#5e7299", whiteSpace: "nowrap" }}>{done}/{total}</span>
    </div>
  );
}

// MobileTaskCard
function MobileTaskCard({ task, accent, titleColor, bgColor, borderColor, onSubtaskToggle, onSubtaskReorder, onSubtaskDelete, onSubtaskEdit, onOpenUI, onCloseUI }: {
  task: TaskItem; accent: string; titleColor: string; bgColor: string; borderColor: string;
  onSubtaskToggle: (task: TaskItem, subtaskId: string) => Promise<void>;
  onSubtaskReorder: (taskId: string, subtasks: SubtaskItem[]) => Promise<void>;
  onSubtaskDelete: (taskId: string, ids: Set<string>) => Promise<void>;
  onSubtaskEdit: (taskId: string, subtaskId: string, newText: string) => Promise<void>;
  onOpenUI: () => void; onCloseUI: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const subtasks = task.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;
  const handleExpand = () => {
    if (!hasSubtasks) return;
    const next = !expanded;
    setExpanded(next);
    if (next) onOpenUI(); else onCloseUI();
  };
  return (
    <div className="flex flex-col rounded-lg overflow-hidden" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      <button type="button" onClick={handleExpand} className="flex items-start justify-between gap-2 px-3 py-2 w-full text-left" style={{ background: "none", border: "none", cursor: hasSubtasks ? "pointer" : "default" }}>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span style={{ fontSize: "0.78rem", color: titleColor, lineHeight: 1.4 }}>{task.title}</span>
          {hasSubtasks && <SubtaskProgress subtasks={subtasks} />}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
          <DueBadge dueAt={task.dueAt} />
          {hasSubtasks && <span style={{ color: accent, fontSize: "0.65rem", transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>}
        </div>
      </button>
      {expanded && hasSubtasks && (
        <div className="flex flex-col gap-1 px-3 pb-3">
          <SubtaskList subtasks={subtasks} accentColor={accent} isMobile={true}
            onReorder={(reordered) => void onSubtaskReorder(task.id, reordered)}
            onToggle={(subtaskId) => void onSubtaskToggle(task, subtaskId)}
            onDelete={(ids) => void onSubtaskDelete(task.id, ids)}
            onEdit={(subtaskId, newText) => void onSubtaskEdit(task.id, subtaskId, newText)}
            onOpenUI={onOpenUI} onCloseUI={onCloseUI}
          />
        </div>
      )}
    </div>
  );
}

// MobileCommandCenter
function MobileCommandCenter({ tasks, onStatusChange, onSubtaskToggle, onSubtaskReorder, onSubtaskDelete, onSubtaskEdit, onOpenUI, onCloseUI }: {
  tasks: TaskItem[];
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onSubtaskToggle: (task: TaskItem, subtaskId: string) => Promise<void>;
  onSubtaskReorder: (taskId: string, subtasks: SubtaskItem[]) => Promise<void>;
  onSubtaskDelete: (taskId: string, ids: Set<string>) => Promise<void>;
  onSubtaskEdit: (taskId: string, subtaskId: string, newText: string) => Promise<void>;
  onOpenUI: () => void; onCloseUI: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  void onStatusChange;
  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const UserSubs: Array<{ subtaskText: string; parentTitle: string; parentId: string; subId: string }> = [];
  for (const task of tasks) {
    for (const sub of task.subtasks ?? []) {
      if (sub.text.includes("[User]") && !sub.done) {
        UserSubs.push({ subtaskText: sub.text.replace(/\[User\]\s*/g, "").trim(), parentTitle: task.title, parentId: task.id, subId: sub.id });
      }
    }
  }

  const reviewTasks = tasks.filter((t) => t.status === "review");
  const workingTasks = tasks
    .filter((t) => t.status === "in-progress" || (t.status === "todo" && t.assignee === "me" && t.priority === "high"))
    .sort((a, b) => {
      const pd = (PRIORITY_ORDER[a.priority ?? "low"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 2);
      if (pd !== 0) return pd;
      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (a.dueAt) return -1; if (b.dueAt) return 1; return 0;
    }).slice(0, 5);

  function Section({ id, accent, headerText, children }: { id: string; accent: string; headerText: string; children: React.ReactNode }) {
    const isCollapsed = collapsed[id];
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${accent}40`, background: `linear-gradient(180deg, ${accent}0a, rgba(20,20,38,0.97))` }}>
        <button type="button" onClick={() => toggle(id)} className="w-full flex items-center justify-between px-4 py-3" style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: accent, fontFamily: "Courier New, monospace", letterSpacing: "0.04em" }}>{headerText}</span>
          <span style={{ color: accent, fontSize: "9px", transition: "transform 0.2s", display: "inline-block", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>▼</span>
        </button>
        {!isCollapsed && <div className="px-4 pb-4 flex flex-col gap-2">{children}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section id="User" accent="#f97316" headerText="🔴 PERLU LO">
        {UserSubs.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "#94a3b8" }}>All clear! No pending items.</p>
        ) : UserSubs.map((item) => (
          <div key={`${item.parentId}-${item.subId}`} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <span style={{ color: "#f97316", marginTop: "1px", flexShrink: 0, fontSize: "0.9rem" }}>·</span>
            <span style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>
              <span style={{ color: "#fed7aa" }}>{item.subtaskText}</span>
              <span style={{ color: "#f97316", opacity: 0.7 }}> → </span>
              <span style={{ color: "#78716c", fontSize: "0.7rem" }}>{item.parentTitle}</span>
            </span>
          </div>
        ))}
      </Section>
      <Section id="review" accent="#eab308" headerText="👀 REVIEW">
        {reviewTasks.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Ga ada yang perlu di-review 👍</p>
        ) : reviewTasks.map((task) => (
          <MobileTaskCard key={task.id} task={task} accent="#eab308" titleColor="#fde68a" bgColor="rgba(234,179,8,0.07)" borderColor="rgba(234,179,8,0.2)" onSubtaskToggle={onSubtaskToggle} onSubtaskReorder={onSubtaskReorder} onSubtaskDelete={onSubtaskDelete} onSubtaskEdit={onSubtaskEdit} onOpenUI={onOpenUI} onCloseUI={onCloseUI} />
        ))}
      </Section>
      <Section id="working" accent="#38bdf8" headerText="⚙️ BOB LAGI KERJA">
        {workingTasks.length === 0 ? (
          <p style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Belum ada yang dikerjain 😴</p>
        ) : workingTasks.map((task) => (
          <MobileTaskCard key={task.id} task={task} accent="#38bdf8" titleColor="#bae6fd" bgColor="rgba(56,189,248,0.06)" borderColor="rgba(56,189,248,0.18)" onSubtaskToggle={onSubtaskToggle} onSubtaskReorder={onSubtaskReorder} onSubtaskDelete={onSubtaskDelete} onSubtaskEdit={onSubtaskEdit} onOpenUI={onOpenUI} onCloseUI={onCloseUI} />
        ))}
      </Section>
    </div>
  );
}

// KanbanCard
function KanbanCard({ task, isExpanded, onToggleExpand, onStatusChange, onSubtaskToggle, onSubtaskReorder, onSubtaskDelete, onSubtaskEdit, onEditTask, refreshNow, onOpenUI, onCloseUI }: {
  task: TaskItem; isExpanded: boolean; onToggleExpand: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onSubtaskToggle: (task: TaskItem, subtaskId: string) => Promise<void>;
  onSubtaskReorder: (taskId: string, subtasks: SubtaskItem[]) => Promise<void>;
  onSubtaskDelete: (taskId: string, ids: Set<string>) => Promise<void>;
  onSubtaskEdit: (taskId: string, subtaskId: string, newText: string) => Promise<void>;
  onEditTask: (task: TaskItem) => void; refreshNow: () => Promise<void>;
  onOpenUI: () => void; onCloseUI: () => void;
}) {
  const subtasks = task.subtasks ?? [];
  const pendingUser = subtasks.filter((s) => s.text.includes("[User]") && !s.done);
  const doneCount = subtasks.filter((s) => s.done).length;
  const totalCount = subtasks.length;
  const nextTransitions: Array<{ label: string; to: TaskStatus }> = [];
  if (task.status === "todo") nextTransitions.push({ label: "▶ In Progress", to: "in-progress" });
  else if (task.status === "in-progress") { nextTransitions.push({ label: "👀 Review", to: "review" }); nextTransitions.push({ label: "← Todo", to: "todo" }); }
  else if (task.status === "review") { nextTransitions.push({ label: "✅ Done", to: "done" }); nextTransitions.push({ label: "◀ In Progress", to: "in-progress" }); }
  else if (task.status === "done") nextTransitions.push({ label: "↩ Reopen", to: "in-progress" });
  const handleToggleExpand = () => { const next = !isExpanded; onToggleExpand(); if (next) onOpenUI(); else onCloseUI(); };
  return (
    <div className="flex flex-col rounded-xl overflow-hidden" style={cardStyle}>
      <button type="button" onClick={handleToggleExpand} className="w-full flex flex-col gap-2 p-3 text-left" style={{ background: "none", border: "none", cursor: "pointer" }}>
        <div className="flex items-start gap-2">
          <PriorityDot priority={task.priority} />
          <span className="flex-1 text-sm font-semibold" style={{ color: "#c8deff", lineHeight: 1.4 }}>{task.title}</span>
          <span style={{ color: "#5e7299", fontSize: "9px", flexShrink: 0, marginTop: "3px", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <GoalBadge goalId={task.goalId} />
          {totalCount > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 600, color: "#60a5fa", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: "4px", padding: "1px 5px" }}>{doneCount}/{totalCount}</span>}
          {pendingUser.length > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "4px", padding: "1px 5px" }}>🔴 {pendingUser.length} User</span>}
          <DueBadge dueAt={task.dueAt} />
        </div>
        {task.status === "in-progress" && totalCount > 0 && <SubtaskProgress subtasks={task.subtasks} />}
      </button>
      {isExpanded && (
        <div className="flex flex-col gap-3 px-3 pb-3" style={{ borderTop: "1px solid rgba(0,212,255,0.12)" }} onClick={(e) => e.stopPropagation()}>
          {task.description && <p className="text-xs pt-2" style={{ color: "#475569" }}>{task.description}</p>}
          {totalCount > 0 && (
            <div className="pt-1">
              <SubtaskList subtasks={subtasks} accentColor="#60a5fa" isMobile={false}
                onReorder={(reordered) => void onSubtaskReorder(task.id, reordered)}
                onToggle={(subtaskId) => void onSubtaskToggle(task, subtaskId)}
                onDelete={(ids) => void onSubtaskDelete(task.id, ids)}
                onEdit={(subtaskId, newText) => void onSubtaskEdit(task.id, subtaskId, newText)}
                onOpenUI={onOpenUI} onCloseUI={onCloseUI}
              />
            </div>
          )}
          <TaskCalendarSyncPanel taskId={task.id} taskTitle={task.title} hasDueDate={!!task.dueAt} onSyncChange={() => void refreshNow()} />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {nextTransitions.map((t) => (
              <button key={t.to} type="button" onClick={() => void onStatusChange(task.id, t.to)} className="px-2 py-1 text-[0.62rem] font-medium rounded cursor-pointer" style={{ background: "rgba(30,30,52,0.9)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa" }}>{t.label}</button>
            ))}
            <button type="button" onClick={() => onEditTask(task)} className="px-2 py-1 text-[0.62rem] font-medium rounded cursor-pointer ml-auto" style={{ background: "rgba(30,30,52,0.9)", border: "1px solid rgba(0,212,255,0.12)", color: "#5e7299" }}>✏️ Edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

// KanbanColumn
function KanbanColumn({ title, accentColor, highlighted, tasks, expandedIds, onToggleExpand, onStatusChange, onSubtaskToggle, onSubtaskReorder, onSubtaskDelete, onSubtaskEdit, onEditTask, refreshNow, dragOverColumn, draggingId, onDragOver, onDragLeave, onDrop, onOpenUI, onCloseUI }: {
  title: string; accentColor: string; highlighted?: boolean; tasks: TaskItem[];
  expandedIds: Set<string>; onToggleExpand: (id: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onSubtaskToggle: (task: TaskItem, subtaskId: string) => Promise<void>;
  onSubtaskReorder: (taskId: string, subtasks: SubtaskItem[]) => Promise<void>;
  onSubtaskDelete: (taskId: string, ids: Set<string>) => Promise<void>;
  onSubtaskEdit: (taskId: string, subtaskId: string, newText: string) => Promise<void>;
  onEditTask: (task: TaskItem) => void; refreshNow: () => Promise<void>;
  dragOverColumn: boolean; draggingId: string | null;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
  onOpenUI: () => void; onCloseUI: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-3"
      style={{ background: highlighted ? "rgba(34,211,238,0.04)" : dragOverColumn ? "rgba(0,255,159,0.04)" : "rgba(8,12,30,0.3)", border: `1px solid ${highlighted ? "rgba(34,211,238,0.2)" : dragOverColumn ? "rgba(0,255,159,0.2)" : "rgba(0,212,255,0.12)"}`, minHeight: "200px", transition: "background 0.15s, border-color 0.15s" }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: accentColor, fontFamily: "Courier New, monospace", letterSpacing: "0.02em" }}>{title}</h3>
        <span className="text-[0.6rem] font-bold rounded-full px-2 py-0.5" style={{ background: `${accentColor}18`, color: accentColor, border: `1px solid ${accentColor}30` }}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2"><span className="text-2xl opacity-20">📭</span><p className="text-xs" style={{ color: "#5e7299" }}>Empty</p></div>
      ) : tasks.map((task) => (
        <div key={task.id} draggable onDragStart={(e) => { e.dataTransfer.setData("taskId", task.id); e.dataTransfer.setData("fromStatus", task.status); }} style={{ opacity: draggingId === task.id ? 0.45 : 1, transition: "opacity 0.15s" }}>
          <KanbanCard task={task} isExpanded={expandedIds.has(task.id)} onToggleExpand={() => onToggleExpand(task.id)}
            onStatusChange={onStatusChange} onSubtaskToggle={onSubtaskToggle}
            onSubtaskReorder={onSubtaskReorder} onSubtaskDelete={onSubtaskDelete} onSubtaskEdit={onSubtaskEdit}
            onEditTask={onEditTask} refreshNow={refreshNow} onOpenUI={onOpenUI} onCloseUI={onCloseUI} />
        </div>
      ))}
    </div>
  );
}

// Main component
export default function TaskBoardContent() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [activityPage, setActivityPage] = useState<ActivityPage>({ offset: 0, limit: timelinePageSize, nextOffset: 0, total: 0, hasMore: false });
  const [timelineFilters, setTimelineFilters] = useState<TimelineFilters>({ eventType: "all", source: "all", taskStatus: "all" });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignee: "me" as TaskAssignee, status: "todo" as TaskStatus, dueAt: "", createCalendarReminder: false });
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // FIX 1: Pause polling when any UI is open
  const openUICountRef = useRef(0);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const handleOpenUI = useCallback(() => { openUICountRef.current += 1; if (openUICountRef.current === 1) setPollingEnabled(false); }, []);
  const handleCloseUI = useCallback(() => { openUICountRef.current = Math.max(0, openUICountRef.current - 1); if (openUICountRef.current === 0) setPollingEnabled(true); }, []);

  const loadTaskBoard = useCallback(
    async (offset: number, append = false, filters: TimelineFilters = timelineFilters) => {
      const res = await fetch(buildTaskBoardUrl(filters, offset), { cache: "no-store" });
      const data = (await res.json()) as { tasks?: TaskItem[]; activity?: TaskActivity[]; activityPage?: ActivityPage; };
      setTasks(data.tasks ?? []);
      setActivity((prev) => (append ? [...prev, ...(data.activity ?? [])] : (data.activity ?? [])));
      setActivityPage(data.activityPage ?? { offset, limit: timelinePageSize, nextOffset: offset + (data.activity?.length ?? 0), total: data.activity?.length ?? 0, hasMore: false });
    },
    [timelineFilters],
  );

  const loadTasks = useCallback(async () => { await loadTaskBoard(0, false); }, [loadTaskBoard]);
  const { isLoading, isRefreshing, lastUpdated, isVisible, refreshNow } = useVisibilityPolling(loadTasks, { intervalMs: 12000, enabled: pollingEnabled });

  const saveTask = async () => {
    setError("");
    const url = editingId ? `/api/task-board/${editingId}` : "/api/task-board";
    const method = editingId ? "PATCH" : "POST";
    const payload = { ...form, dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) { setError(data.error || "Failed to save task."); return; }
    setEditingId(null); setShowTaskModal(false);
    setForm({ title: "", description: "", assignee: "me", status: "todo", dueAt: "", createCalendarReminder: false });
    handleCloseUI();
    await refreshNow();
  };

  const loadMoreActivity = async () => {
    if (!activityPage.hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try { await loadTaskBoard(activityPage.nextOffset, true); } finally { setIsLoadingMore(false); }
  };

  const handleStatusChange = async (taskId: string, toStatus: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: toStatus } : t)));
    try { await fetch(`/api/task-board/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: toStatus }) }); }
    catch { await refreshNow(); }
  };

  // FIX 4: Auto-sink done subtasks after toggle
  const handleSubtaskToggle = async (task: TaskItem, subtaskId: string) => {
    // Use functional update to always read latest task subtasks (avoids stale closure)
    let taskId = task.id;
    let sorted: SubtaskItem[] = [];
    setTasks((prev) => {
      const latest = prev.find((t) => t.id === taskId);
      const currentSubs = latest?.subtasks ?? task.subtasks ?? [];
      const toggled = currentSubs.map((s) => s.id === subtaskId ? { ...s, done: !s.done } : s);
      sorted = sinkDoneSubtasks(toggled);
      return prev.map((t) => (t.id === taskId ? { ...t, subtasks: sorted } : t));
    });
    // Give setTasks a tick to flush, then PATCH
    setTimeout(async () => {
      try { await fetch(`/api/task-board/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subtasks: sorted }) }); }
      catch { await refreshNow(); }
    }, 0);
  };

  const handleSubtaskReorder = async (taskId: string, subtasks: SubtaskItem[]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks } : t)));
    try { await fetch(`/api/task-board/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subtasks }) }); }
    catch { await refreshNow(); }
  };

  const handleSubtaskDelete = async (taskId: string, ids: Set<string>) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks ?? []).filter((s) => !ids.has(s.id));
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: updated } : t)));
    try { await fetch(`/api/task-board/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subtasks: updated }) }); }
    catch { await refreshNow(); }
  };

  const handleSubtaskEdit = async (taskId: string, subtaskId: string, newText: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = (task.subtasks ?? []).map((s) => s.id === subtaskId ? { ...s, text: newText } : s);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks: updated } : t)));
    try { await fetch(`/api/task-board/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subtasks: updated }) }); }
    catch { await refreshNow(); }
  };

  const handleDrop = async (taskId: string, fromStatus: string, toStatus: TaskStatus) => {
    if (fromStatus === toStatus) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: toStatus } : t)));
    try { await fetch(`/api/task-board/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: toStatus }) }); }
    catch { await refreshNow(); }
  };

  const handleEditTask = (task: TaskItem) => {
    setEditingId(task.id);
    setForm({ title: task.title, description: task.description, assignee: task.assignee, status: task.status, dueAt: toDateTimeLocalInput(task.dueAt), createCalendarReminder: false });
    setShowTaskModal(true);
    handleOpenUI();
  };

  const toggleExpand = (id: string) => setExpandedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const filtered = useMemo(() => tasks.filter((t) => goalFilter === "all" || t.goalId === goalFilter), [tasks, goalFilter]);
  const todoTasks = useMemo(() => filtered.filter((t) => t.status === "todo").sort((a, b) => (PRIORITY_ORDER[a.priority ?? "low"] ?? 2) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 2)), [filtered]);
  const inProgressTasks = useMemo(() => filtered.filter((t) => t.status === "in-progress"), [filtered]);
  const reviewDoneTasks = useMemo(() => [...filtered.filter((t) => t.status === "review"), ...filtered.filter((t) => t.status === "done")], [filtered]);
  const summary = useMemo(() => ({ todo: tasks.filter((t) => t.status === "todo").length, inProgress: tasks.filter((t) => t.status === "in-progress").length, review: tasks.filter((t) => t.status === "review").length, done: tasks.filter((t) => t.status === "done").length, total: tasks.length }), [tasks]);

  const openModal = () => { setEditingId(null); setForm({ title: "", description: "", assignee: "me", status: "todo", dueAt: "", createCalendarReminder: false }); setShowTaskModal(true); handleOpenUI(); };
  const closeModal = () => { setShowTaskModal(false); setEditingId(null); setError(""); handleCloseUI(); };

  return (
    <ScreenWrapper eyebrow="Work · Tasks" title="Task Board" description="Track tasks across todo, in-progress, review, and done." maxWidth="max-w-7xl">
      <div className="flex flex-wrap items-center gap-2" role="status">
        {statusBadge("Todo", summary.todo)}
        {statusBadge("In Progress", summary.inProgress)}
        {statusBadge("Review", summary.review)}
        {statusBadge("Done", summary.done)}
        {lastUpdated && statusBadge("Updated", new Date(lastUpdated).toLocaleTimeString())}
        {!isVisible && <span className="text-[0.66rem] rounded-full px-2.5 py-1" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>Paused</span>}
        {!pollingEnabled && <span className="text-[0.66rem] rounded-full px-2.5 py-1" style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa" }}>UI Open</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
        {GOAL_FILTERS.map((g) => {
          const active = goalFilter === g.id;
          return (
            <button key={g.id} onClick={() => setGoalFilter(g.id)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.65rem", fontWeight: 700, padding: "0.25rem 0.7rem", borderRadius: "99px", border: `1px solid ${active ? g.color : g.color + "44"}`, background: active ? g.color + "22" : "transparent", color: active ? g.color : g.color + "99", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {g.emoji} {g.label}
            </button>
          );
        })}
      </div>

      {(isLoading || isRefreshing) && (
        <div style={{ position: "fixed", bottom: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 9000, display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", background: "rgba(5,5,16,0.92)", border: "1px solid rgba(37,37,64,0.9)", borderRadius: "99px", fontFamily: "Courier New, monospace", fontSize: "10px", color: "#5e7299", backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#77adff", display: "inline-block" }} />
          {isLoading ? "Loading…" : "Syncing…"}
        </div>
      )}

      <div>
        <button type="button" onClick={openModal} className="px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer flex items-center gap-2" style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#77adff", fontFamily: "Courier New, monospace", letterSpacing: "0.04em" }}>
          <span style={{ fontSize: "14px", lineHeight: 1 }}>＋</span> Create New Task
        </button>
      </div>

      {(showTaskModal || editingId) && (
        <div onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "linear-gradient(160deg, rgba(26,26,46,0.99), rgba(5,5,16,0.99))", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "16px", padding: "24px", width: "min(520px, 94vw)", boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset, 0 32px 80px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "13px", fontWeight: "bold", color: "#c8deff", fontFamily: "Courier New, monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>{editingId ? "✏️ Edit Task" : "＋ New Task"}</h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "#5e7299", fontSize: "16px", cursor: "pointer", lineHeight: 1, padding: "2px 6px" }}>✕</button>
            </div>
            <div style={{ height: "1px", background: "rgba(37,37,64,0.9)" }} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className="px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Task title" value={form.title} autoFocus onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
              <select className="px-3 py-2 text-sm outline-none" style={inputStyle} value={form.assignee} onChange={(e) => setForm((prev) => ({ ...prev, assignee: e.target.value as TaskAssignee }))}>
                <option value="me">me</option><option value="you">you</option>
              </select>
              <select className="px-3 py-2 text-sm outline-none" style={inputStyle} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}>
                {taskStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className="text-xs" style={{ color: "#5e7299" }}>Due date/time</span><input className="px-3 py-2 text-sm outline-none" style={inputStyle} type="datetime-local" value={form.dueAt} onChange={(e) => setForm((prev) => ({ ...prev, dueAt: e.target.value }))} /></label>
              <label className="flex items-center gap-2 text-xs self-end pb-2" style={{ color: "#475569" }}><input type="checkbox" checked={form.createCalendarReminder} onChange={(e) => setForm((prev) => ({ ...prev, createCalendarReminder: e.target.checked }))} />Create calendar reminder</label>
            </div>
            <textarea className="px-3 py-2 text-sm outline-none resize-none" style={{ ...inputStyle, minHeight: "72px" }} rows={3} placeholder="Task details (optional)" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            {error && <p className="text-xs font-medium" style={{ color: "#FF6B6B" }}>{error}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
              <button type="button" className="px-4 py-2 text-xs font-medium rounded-lg cursor-pointer" style={secondaryButtonStyle} onClick={closeModal}>Cancel</button>
              <button type="button" className="px-4 py-2 text-xs font-medium rounded-lg cursor-pointer" style={primaryButtonStyle} onClick={() => void saveTask()}>{editingId ? "Update Task" : "Create Task"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="block md:hidden">
        <MobileCommandCenter tasks={filtered} onStatusChange={handleStatusChange} onSubtaskToggle={handleSubtaskToggle} onSubtaskReorder={handleSubtaskReorder} onSubtaskDelete={handleSubtaskDelete} onSubtaskEdit={handleSubtaskEdit} onOpenUI={handleOpenUI} onCloseUI={handleCloseUI} />
        <div className="mt-4 text-center"><p className="text-xs" style={{ color: "#5e7299", fontFamily: "Courier New, monospace", fontSize: "0.65rem" }}>Switch to desktop for full Kanban board ↗</p></div>
      </div>

      <div className="hidden md:grid grid-cols-3 gap-4">
        <KanbanColumn title="📋 TODO" accentColor="#94a3b8" tasks={todoTasks} expandedIds={expandedIds} onToggleExpand={toggleExpand}
          onStatusChange={handleStatusChange} onSubtaskToggle={handleSubtaskToggle} onSubtaskReorder={handleSubtaskReorder} onSubtaskDelete={handleSubtaskDelete} onSubtaskEdit={handleSubtaskEdit}
          onEditTask={handleEditTask} refreshNow={refreshNow}
          dragOverColumn={dragOverColumn === "todo"} draggingId={draggingId}
          onDragOver={(e) => { e.preventDefault(); setDragOverColumn("todo"); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
          onDrop={(e) => { e.preventDefault(); setDragOverColumn(null); setDraggingId(null); const tid = e.dataTransfer.getData("taskId"); const from = e.dataTransfer.getData("fromStatus"); if (tid) void handleDrop(tid, from, "todo"); }}
          onOpenUI={handleOpenUI} onCloseUI={handleCloseUI} />

        <KanbanColumn title="⚙️ IN PROGRESS" accentColor="#22d3ee" highlighted tasks={inProgressTasks} expandedIds={expandedIds} onToggleExpand={toggleExpand}
          onStatusChange={handleStatusChange} onSubtaskToggle={handleSubtaskToggle} onSubtaskReorder={handleSubtaskReorder} onSubtaskDelete={handleSubtaskDelete} onSubtaskEdit={handleSubtaskEdit}
          onEditTask={handleEditTask} refreshNow={refreshNow}
          dragOverColumn={dragOverColumn === "in-progress"} draggingId={draggingId}
          onDragOver={(e) => { e.preventDefault(); setDragOverColumn("in-progress"); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
          onDrop={(e) => { e.preventDefault(); setDragOverColumn(null); setDraggingId(null); const tid = e.dataTransfer.getData("taskId"); const from = e.dataTransfer.getData("fromStatus"); if (tid) void handleDrop(tid, from, "in-progress"); }}
          onOpenUI={handleOpenUI} onCloseUI={handleCloseUI} />

        <KanbanColumn title="👀 REVIEW / DONE" accentColor="#fb923c" tasks={reviewDoneTasks} expandedIds={expandedIds} onToggleExpand={toggleExpand}
          onStatusChange={handleStatusChange} onSubtaskToggle={handleSubtaskToggle} onSubtaskReorder={handleSubtaskReorder} onSubtaskDelete={handleSubtaskDelete} onSubtaskEdit={handleSubtaskEdit}
          onEditTask={handleEditTask} refreshNow={refreshNow}
          dragOverColumn={dragOverColumn === "review"} draggingId={draggingId}
          onDragOver={(e) => { e.preventDefault(); setDragOverColumn("review"); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
          onDrop={(e) => { e.preventDefault(); setDragOverColumn(null); setDraggingId(null); const tid = e.dataTransfer.getData("taskId"); const from = e.dataTransfer.getData("fromStatus"); if (tid) void handleDrop(tid, from, "review"); }}
          onOpenUI={handleOpenUI} onCloseUI={handleCloseUI} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl p-4" style={{ background: "rgba(8,12,30,0.3)", border: "1px solid rgba(0,212,255,0.12)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "#c8deff" }}>Activity Timeline</h3>
          <span className="text-xs" style={{ color: "#5e7299" }}>Showing {activity.length} / {activityPage.total}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select className="px-3 py-2 text-sm outline-none" style={inputStyle} value={timelineFilters.eventType}
            onChange={async (e) => { const next = { ...timelineFilters, eventType: e.target.value as TimelineFilters["eventType"] }; setTimelineFilters(next); await loadTaskBoard(0, false, next); }}>
            {activityTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="px-3 py-2 text-sm outline-none" style={inputStyle} value={timelineFilters.source}
            onChange={async (e) => { const next = { ...timelineFilters, source: e.target.value as TimelineFilters["source"] }; setTimelineFilters(next); await loadTaskBoard(0, false, next); }}>
            {activitySourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="px-3 py-2 text-sm outline-none" style={inputStyle} value={timelineFilters.taskStatus}
            onChange={async (e) => { const next = { ...timelineFilters, taskStatus: e.target.value as TimelineFilters["taskStatus"] }; setTimelineFilters(next); await loadTaskBoard(0, false, next); }}>
            <option value="all">All task statuses</option>
            {taskStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {activity.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-2"><span className="text-lg opacity-40">📭</span><p className="text-xs" style={{ color: "#5e7299" }}>No recent activity.</p></div>
        )}
        {activity.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-1.5 rounded-xl p-3" style={cardStyle}>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.62rem] font-medium" style={chipStyle}>{entry.source}</span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.62rem] font-medium" style={chipStyle}>{new Date(entry.timestamp).toLocaleString()}</span>
              {entry.taskStatus && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.62rem] font-medium" style={chipStyle}>task: {entry.taskStatus}</span>}
            </div>
            <strong className="text-sm font-semibold" style={{ color: "#c8deff" }}>{entry.taskTitle ?? "(task removed)"}</strong>
            <p className="text-xs" style={{ color: "#475569" }}>{formatActivityLabel(entry)}</p>
            {entry.meta && <p className="text-[0.62rem]" style={{ color: "#5e7299" }}>{stringifyMeta(entry.meta)}</p>}
          </div>
        ))}
        {activityPage.hasMore && (
          <div className="flex items-center gap-2">
            <button type="button" className="px-4 py-2 text-xs font-medium rounded-lg cursor-pointer" style={primaryButtonStyle} onClick={() => void loadMoreActivity()}>{isLoadingMore ? "Loading..." : "Load more"}</button>
          </div>
        )}
      </div>
    </ScreenWrapper>
  );
}

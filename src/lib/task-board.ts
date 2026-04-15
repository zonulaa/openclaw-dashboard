import { readJsonFile, writeJsonFile } from "@/lib/local-data";

export type TaskAssignee = "me" | "you";
export type TaskStatus = "todo" | "in-progress" | "review" | "done";
export type TaskSource = "manual" | "auto";
export type TaskActivitySource = "task-board-ui" | "panel-run";
export type TaskActivityType = "created" | "updated" | "status-transition" | "run-result";

export type TaskRunResult = {
  panelId: string;
  sessionId: string | null;
  runId: string | null;
  ok: boolean;
  recordedAt: string;
};

export type TaskReminderState = "none" | "linked" | "failed";

export type TaskPriority = "high" | "medium" | "low";

export function isTaskPriority(v: unknown): v is TaskPriority {
  return v === "high" || v === "medium" || v === "low";
}

export type TaskItem = {
  id: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  status: TaskStatus;
  priority?: TaskPriority;
  createdAt: string;
  updatedAt: string;
  source?: TaskSource;
  lastActivityAt?: string;
  lastRunResult?: TaskRunResult;
  autoKey?: string;
  autoPanelId?: string;
  dueAt?: string;
  reminderState?: TaskReminderState;
  linkedJobId?: string;
  linkedEventTitle?: string;
  linkedReminderAt?: string;
  linkedReminderMethod?: string;
  reminderError?: string;
  // ── Phase 4 Track 3: Task↔Calendar Cross-Linking ──────────────────────────
  /** Linked calendar event ID (set when sync is active) */
  calendarEventId?: string;
  /** Sync mode: 'one-way' (task→cal) or 'bi-directional' */
  calendarSyncMode?: string;
  /** ISO timestamp of last successful sync */
  calendarSyncedAt?: string;
  /** Last sync error message (shown as yellow badge in UI) */
  calendarSyncError?: string;
  /** Linked goal id (from Goals page) */
  goalId?: string;
  /** Subtasks list */
  subtasks?: Array<{ id: string; text: string; done: boolean }>;
};

export type TaskActivityLogEntry = {
  id: string;
  taskId: string;
  source: TaskActivitySource;
  type: TaskActivityType;
  timestamp: string;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  meta?: Record<string, string | number | boolean | null>;
};

export type TaskBoardData = {
  tasks: TaskItem[];
  activityLog: TaskActivityLogEntry[];
};

const FILE_NAME = "task-board.json";
const EMPTY_DATA: TaskBoardData = { tasks: [], activityLog: [] };

export function isTaskStatus(value: string): value is TaskStatus {
  return ["todo", "in-progress", "review", "done"].includes(value);
}

export function isTaskAssignee(value: string): value is TaskAssignee {
  return value === "me" || value === "you";
}

export function normalizeTaskBoardData(data: Partial<TaskBoardData> | null | undefined): TaskBoardData {
  return {
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
    activityLog: Array.isArray(data?.activityLog) ? data.activityLog : [],
  };
}

export async function readTaskBoardData(): Promise<TaskBoardData> {
  const raw = await readJsonFile<Partial<TaskBoardData>>(FILE_NAME, EMPTY_DATA);
  const normalized = normalizeTaskBoardData(raw);

  // Keep existing files backward-compatible by auto-adding new top-level keys.
  if (!Array.isArray(raw.activityLog)) {
    await writeTaskBoardData(normalized);
  }

  return normalized;
}

export async function writeTaskBoardData(data: TaskBoardData): Promise<void> {
  await writeJsonFile(FILE_NAME, data);
}

export function logActivity(
  data: TaskBoardData,
  entry: Omit<TaskActivityLogEntry, "id" | "timestamp"> & { timestamp?: string },
): TaskActivityLogEntry {
  const logEntry: TaskActivityLogEntry = {
    id: crypto.randomUUID(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ...entry,
  };
  data.activityLog.unshift(logEntry);
  return logEntry;
}

export function toPanelRunAutoKey(panelId: string, taskTitle: string): string {
  const normalizedTitle = taskTitle
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `${panelId}::${normalizedTitle}`;
}

export function isTaskOpen(status: TaskStatus): boolean {
  return status !== "done";
}

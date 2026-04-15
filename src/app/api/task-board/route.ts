import { NextRequest, NextResponse } from "next/server";
import { parseFutureDate } from "@/app/api/calendar/_gateway-cron";
import { createCalendarReminder } from "@/lib/calendar-reminders";
import {
  type TaskActivityLogEntry,
  type TaskActivitySource,
  type TaskActivityType,
  type TaskAssignee,
  type TaskItem,
  type TaskReminderState,
  type TaskSource,
  type TaskStatus,
  isTaskAssignee,
  isTaskStatus,
  logActivity,
  readTaskBoardData,
  writeTaskBoardData,
} from "@/lib/task-board";

export type { TaskAssignee, TaskItem, TaskStatus };

type TaskActivityView = TaskActivityLogEntry & {
  taskTitle: string | null;
  taskStatus: TaskStatus | null;
};

type TimelineFilters = {
  eventTypes: Set<TaskActivityType>;
  sources: Set<TaskActivitySource>;
  taskStatuses: Set<TaskStatus>;
};

function parseSetParam<T extends string>(value: string | null, allowed: readonly T[]): Set<T> {
  if (!value) return new Set<T>();
  const allowedSet = new Set(allowed);
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is T => allowedSet.has(part as T));
  return new Set(parts);
}

function parseDueAt(raw: unknown): string | null | "invalid" {
  if (raw === undefined) return null;
  if (raw === null || raw === "") return null;
  const asString = String(raw).trim();
  if (!asString) return null;
  const date = new Date(asString);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date.toISOString();
}

function parseCreateReminder(raw: unknown): boolean {
  return raw === true || String(raw).trim().toLowerCase() === "1" || String(raw).trim().toLowerCase() === "true";
}

async function enrichTaskWithReminder(
  task: TaskItem,
  reminderRequested: boolean,
): Promise<Pick<TaskItem, "reminderState" | "linkedJobId" | "linkedEventTitle" | "linkedReminderAt" | "linkedReminderMethod" | "reminderError">> {
  if (!task.dueAt) {
    return {
      reminderState: "none",
      linkedJobId: undefined,
      linkedEventTitle: undefined,
      linkedReminderAt: undefined,
      linkedReminderMethod: undefined,
      reminderError: undefined,
    };
  }

  if (!reminderRequested) {
    return {
      reminderState: task.reminderState ?? "none",
      linkedJobId: task.linkedJobId,
      linkedEventTitle: task.linkedEventTitle,
      linkedReminderAt: task.linkedReminderAt,
      linkedReminderMethod: task.linkedReminderMethod,
      reminderError: task.reminderError,
    };
  }

  const dueDate = parseFutureDate(task.dueAt);
  if (!dueDate) {
    return {
      reminderState: "failed",
      reminderError: "Due date must be a valid future date/time to create a reminder.",
      linkedJobId: undefined,
      linkedEventTitle: undefined,
      linkedReminderAt: undefined,
      linkedReminderMethod: undefined,
    };
  }

  const result = await createCalendarReminder(dueDate.toISOString(), task.title);
  if (!result.ok) {
    return {
      reminderState: "failed",
      reminderError: result.error ?? "Failed to create calendar reminder.",
      linkedJobId: undefined,
      linkedEventTitle: undefined,
      linkedReminderAt: dueDate.toISOString(),
      linkedReminderMethod: undefined,
    };
  }

  return {
    reminderState: "linked",
    linkedJobId: result.linkedJobId ?? undefined,
    linkedEventTitle: result.linkedEventTitle ?? task.title,
    linkedReminderAt: dueDate.toISOString(),
    linkedReminderMethod: result.method,
    reminderError: undefined,
  };
}

const DONE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(request: NextRequest) {
  const data = await readTaskBoardData();

  // Auto-purge done tasks older than 24h
  const now = Date.now();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => {
    if (t.status !== "done") return true;
    const lastUpdate = t.lastActivityAt ?? t.updatedAt ?? t.createdAt;
    return now - new Date(lastUpdate).getTime() < DONE_TTL_MS;
  });
  if (data.tasks.length !== before) {
    await writeTaskBoardData(data);
  }
  const includeActivity = request.nextUrl.searchParams.get("includeActivity") === "1";
  const activityLimitRaw = Number(request.nextUrl.searchParams.get("activityLimit") ?? 40);
  const activityLimit = Number.isFinite(activityLimitRaw)
    ? Math.min(Math.max(Math.floor(activityLimitRaw), 1), 200)
    : 40;
  const activityOffsetRaw = Number(request.nextUrl.searchParams.get("activityOffset") ?? 0);
  const activityOffset = Number.isFinite(activityOffsetRaw)
    ? Math.max(Math.floor(activityOffsetRaw), 0)
    : 0;

  if (!includeActivity) {
    return NextResponse.json({ ok: true, tasks: data.tasks });
  }

  const filters: TimelineFilters = {
    eventTypes: parseSetParam(request.nextUrl.searchParams.get("eventType"), ["created", "updated", "status-transition", "run-result"]),
    sources: parseSetParam(request.nextUrl.searchParams.get("source"), ["task-board-ui", "panel-run"]),
    taskStatuses: parseSetParam(request.nextUrl.searchParams.get("taskStatus"), ["todo", "in-progress", "review", "done"]),
  };

  const taskMap = new Map(data.tasks.map((task) => [task.id, task]));
  const filtered = data.activityLog.filter((entry) => {
    if (filters.eventTypes.size > 0 && !filters.eventTypes.has(entry.type)) {
      return false;
    }
    if (filters.sources.size > 0 && !filters.sources.has(entry.source)) {
      return false;
    }

    if (filters.taskStatuses.size > 0) {
      const currentTaskStatus = taskMap.get(entry.taskId)?.status;
      if (!currentTaskStatus || !filters.taskStatuses.has(currentTaskStatus)) {
        return false;
      }
    }

    return true;
  });

  const page = filtered.slice(activityOffset, activityOffset + activityLimit);
  const activity: TaskActivityView[] = page.map((entry) => {
    const task = taskMap.get(entry.taskId);
    return {
      ...entry,
      taskTitle: task?.title ?? null,
      taskStatus: task?.status ?? null,
    };
  });

  const nextOffset = activityOffset + activity.length;
  const hasMore = nextOffset < filtered.length;

  return NextResponse.json({
    ok: true,
    tasks: data.tasks,
    activity,
    activityPage: {
      offset: activityOffset,
      limit: activityLimit,
      nextOffset,
      total: filtered.length,
      hasMore,
      filters: {
        eventType: Array.from(filters.eventTypes),
        source: Array.from(filters.sources),
        taskStatus: Array.from(filters.taskStatuses),
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<TaskItem> & { createCalendarReminder?: boolean };
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const assignee = String(body.assignee || "").trim();
  const status = String(body.status || "").trim();
  const sourceRaw = String(body.source || "manual").trim();
  const dueAt = parseDueAt(body.dueAt);
  const createReminder = parseCreateReminder(body.createCalendarReminder);

  if (!title) {
    return NextResponse.json({ ok: false, error: "Task title is required." }, { status: 400 });
  }
  if (!isTaskAssignee(assignee)) {
    return NextResponse.json({ ok: false, error: "Assignee must be 'me' or 'you'." }, { status: 400 });
  }
  if (!isTaskStatus(status)) {
    return NextResponse.json({ ok: false, error: "Invalid task status." }, { status: 400 });
  }
  if (dueAt === "invalid") {
    return NextResponse.json({ ok: false, error: "Due date must be a valid date/time." }, { status: 400 });
  }

  const source: TaskSource = sourceRaw === "auto" ? "auto" : "manual";
  const now = new Date().toISOString();
  const baseTask: TaskItem = {
    id: crypto.randomUUID(),
    title,
    description,
    assignee,
    status,
    dueAt: dueAt ?? undefined,
    createdAt: now,
    updatedAt: now,
    source,
    lastActivityAt: now,
    reminderState: "none",
  };

  const reminderFields = await enrichTaskWithReminder(baseTask, createReminder);
  const task: TaskItem = {
    ...baseTask,
    ...reminderFields,
  };

  const data = await readTaskBoardData();
  data.tasks.unshift(task);

  const meta: Record<string, string | number | boolean | null> = {
    source: task.source ?? "manual",
    dueAt: task.dueAt ?? null,
    reminderState: (task.reminderState ?? "none") as TaskReminderState,
  };
  if (task.linkedJobId) meta.linkedJobId = task.linkedJobId;
  if (task.reminderError) meta.reminderError = task.reminderError;

  logActivity(data, {
    taskId: task.id,
    source: "task-board-ui",
    type: "created",
    toStatus: task.status,
    meta,
  });
  await writeTaskBoardData(data);

  return NextResponse.json({ ok: true, task });
}

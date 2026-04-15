import { NextRequest, NextResponse } from "next/server";
import { parseFutureDate } from "@/app/api/calendar/_gateway-cron";
import { createCalendarReminder } from "@/lib/calendar-reminders";
import {
  isTaskAssignee,
  isTaskPriority,
  isTaskStatus,
  logActivity,
  readTaskBoardData,
  writeTaskBoardData,
} from "@/lib/task-board";
import { syncGoalsWithTasks } from "@/lib/sync-goals";
import type { TaskItem } from "../route";

function parseDueAt(raw: unknown): string | null | "invalid" | undefined {
  if (raw === undefined) return undefined;
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = String(params.id || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Task id is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<TaskItem> & { createCalendarReminder?: boolean };
  const data = await readTaskBoardData();
  const idx = data.tasks.findIndex((task) => task.id === id);

  if (idx < 0) {
    return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
  }

  const current = data.tasks[idx];
  const title = body.title !== undefined ? String(body.title).trim() : current.title;
  const description = body.description !== undefined ? String(body.description).trim() : current.description;
  const assigneeRaw = body.assignee !== undefined ? String(body.assignee).trim() : current.assignee;
  const statusRaw = body.status !== undefined ? String(body.status).trim() : current.status;
  const priorityRaw = body.priority !== undefined ? String(body.priority).trim() : undefined;
  const dueAtParsed = parseDueAt(body.dueAt);
  const createReminder = parseCreateReminder(body.createCalendarReminder);

  if (!title) {
    return NextResponse.json({ ok: false, error: "Task title is required." }, { status: 400 });
  }
  if (!isTaskAssignee(assigneeRaw)) {
    return NextResponse.json({ ok: false, error: "Assignee must be 'me' or 'you'." }, { status: 400 });
  }
  if (!isTaskStatus(statusRaw)) {
    return NextResponse.json({ ok: false, error: "Invalid task status." }, { status: 400 });
  }
  if (dueAtParsed === "invalid") {
    return NextResponse.json({ ok: false, error: "Due date must be a valid date/time." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const dueAt = dueAtParsed === undefined ? current.dueAt : dueAtParsed ?? undefined;
  let linkedJobId = current.linkedJobId;
  let linkedEventTitle = current.linkedEventTitle;
  let linkedReminderAt = current.linkedReminderAt;
  let linkedReminderMethod = current.linkedReminderMethod;
  let reminderError = current.reminderError;
  let reminderState = current.reminderState ?? "none";

  if (!dueAt) {
    linkedJobId = undefined;
    linkedEventTitle = undefined;
    linkedReminderAt = undefined;
    linkedReminderMethod = undefined;
    reminderError = undefined;
    reminderState = "none";
  } else if (createReminder) {
    const dueDate = parseFutureDate(dueAt);
    if (!dueDate) {
      reminderState = "failed";
      reminderError = "Due date must be a valid future date/time to create a reminder.";
      linkedJobId = undefined;
      linkedEventTitle = undefined;
      linkedReminderAt = undefined;
      linkedReminderMethod = undefined;
    } else {
      const result = await createCalendarReminder(dueDate.toISOString(), title);
      if (!result.ok) {
        reminderState = "failed";
        reminderError = result.error ?? "Failed to create calendar reminder.";
        linkedJobId = undefined;
        linkedEventTitle = undefined;
        linkedReminderAt = dueDate.toISOString();
        linkedReminderMethod = undefined;
      } else {
        reminderState = "linked";
        reminderError = undefined;
        linkedJobId = result.linkedJobId ?? undefined;
        linkedEventTitle = result.linkedEventTitle ?? title;
        linkedReminderAt = dueDate.toISOString();
        linkedReminderMethod = result.method;
      }
    }
  } else if (dueAtParsed !== undefined && dueAt !== current.dueAt) {
    // due date was explicitly changed without creating a new reminder: keep task valid but clear stale linkage
    reminderState = "none";
    reminderError = undefined;
    linkedJobId = undefined;
    linkedEventTitle = undefined;
    linkedReminderAt = undefined;
    linkedReminderMethod = undefined;
  }

  const priority = priorityRaw && isTaskPriority(priorityRaw) ? priorityRaw : current.priority;
  const subtasks = body.subtasks !== undefined ? body.subtasks : current.subtasks;

  const updated = {
    ...current,
    subtasks,
    title,
    description,
    assignee: assigneeRaw,
    status: statusRaw,
    priority,
    dueAt,
    reminderState,
    linkedJobId,
    linkedEventTitle,
    linkedReminderAt,
    linkedReminderMethod,
    reminderError,
    updatedAt: now,
    lastActivityAt: now,
  };

  data.tasks[idx] = updated;
  if (current.status !== updated.status) {
    logActivity(data, {
      taskId: updated.id,
      source: "task-board-ui",
      type: "status-transition",
      fromStatus: current.status,
      toStatus: updated.status,
    });
  } else {
    logActivity(data, {
      taskId: updated.id,
      source: "task-board-ui",
      type: "updated",
      meta: {
        dueAt: updated.dueAt ?? null,
        reminderState: updated.reminderState ?? "none",
        linkedJobId: updated.linkedJobId ?? null,
        reminderError: updated.reminderError ?? null,
      },
    });
  }
  await writeTaskBoardData(data);

  // Auto-sync goal steps after any task update
  void syncGoalsWithTasks().catch(() => {
    // Non-fatal: sync failure should not break the task update response
  });

  return NextResponse.json({ ok: true, task: updated });
}

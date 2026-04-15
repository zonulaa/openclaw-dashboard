/**
 * POST /api/tasks/batch-sync-calendar
 * Body: { taskIds[], syncMode, conflictResolution }
 * → { successCount, errorCount, errors[] }
 *
 * Batch-enables calendar sync for multiple tasks.
 * Each task is processed independently; failures don't block others.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isSyncMode,
  isConflictResolution,
  readSyncStore,
  writeSyncStore,
  upsertSync,
  recordSuccessfulSync,
  recordSyncError,
  acquireSyncLock,
  normalizeToUtcIso,
  type SyncMode,
  type ConflictResolution,
} from "@/lib/task-calendar-sync";
import { readTaskBoardData, writeTaskBoardData, logActivity } from "@/lib/task-board";
import { createCalendarEvent } from "@/lib/calendar-event-sync";

type BatchError = {
  taskId: string;
  error: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    taskIds?: unknown;
    syncMode?: unknown;
    conflictResolution?: unknown;
  };

  const taskIdsRaw = body.taskIds;
  if (!Array.isArray(taskIdsRaw) || taskIdsRaw.length === 0) {
    return NextResponse.json(
      { ok: false, error: "taskIds must be a non-empty array." },
      { status: 400 },
    );
  }

  const taskIds = taskIdsRaw.map((id) => String(id).trim()).filter(Boolean);
  if (taskIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "taskIds must contain at least one valid id." },
      { status: 400 },
    );
  }

  // Cap at 50 to prevent runaway requests
  if (taskIds.length > 50) {
    return NextResponse.json(
      { ok: false, error: "Cannot batch-sync more than 50 tasks at once." },
      { status: 400 },
    );
  }

  const syncMode: SyncMode = isSyncMode(body.syncMode) ? body.syncMode : "one-way";
  const conflictResolution: ConflictResolution = isConflictResolution(body.conflictResolution)
    ? body.conflictResolution
    : "task-wins";

  const taskData = await readTaskBoardData();
  let store = await readSyncStore();

  const errors: BatchError[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Track which tasks need activity log entries
  const taskDataModified = new Set<string>();

  for (const taskId of taskIds) {
    const task = taskData.tasks.find((t) => t.id === taskId);
    if (!task) {
      errors.push({ taskId, error: "Task not found." });
      errorCount++;
      continue;
    }

    // Upsert sync config
    const { store: updated, sync } = upsertSync(store, {
      taskId,
      syncMode,
      conflictResolution,
    });
    store = updated;

    // If task has a deadline, try to auto-create the calendar event
    if (task.dueAt) {
      const dueAtIso = normalizeToUtcIso(task.dueAt);
      if (!dueAtIso) {
        const { store: errStore } = recordSyncError(
          store,
          taskId,
          "Invalid due date format.",
        );
        store = errStore;
        errors.push({ taskId, error: "Invalid due date format." });
        errorCount++;
        continue;
      }

      // Acquire lock
      const syncIdx = store.syncs.findIndex((s) => s.taskId === taskId);
      if (syncIdx >= 0) {
        store.syncs[syncIdx] = acquireSyncLock(sync, "task");
      }

      const createResult = await createCalendarEvent(task.title, dueAtIso);
      if (createResult.ok && createResult.calendarEventId) {
        const { store: synced } = recordSuccessfulSync(store, taskId, createResult.calendarEventId);
        store = synced;

        // Update task
        const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
        if (taskIdx >= 0) {
          const now = new Date().toISOString();
          const t = taskData.tasks[taskIdx] as Record<string, unknown>;
          t.calendarEventId = createResult.calendarEventId;
          t.calendarSyncMode = syncMode;
          t.calendarSyncedAt = now;
          t.calendarSyncError = undefined;
          t.updatedAt = now;
          t.lastActivityAt = now;
          taskDataModified.add(taskId);
        }

        successCount++;
      } else {
        const errMsg = createResult.error ?? "Failed to create calendar event.";
        const { store: errStore } = recordSyncError(store, taskId, errMsg);
        store = errStore;
        errors.push({ taskId, error: errMsg });
        errorCount++;
      }
    } else {
      // No deadline — sync config saved, but no event created
      successCount++;
    }
  }

  // Write activity log for modified tasks
  for (const taskId of taskDataModified) {
    logActivity(taskData, {
      taskId,
      source: "task-board-ui",
      type: "updated",
      meta: {
        action: "batch-sync-calendar",
        syncMode,
        conflictResolution,
      },
    });
  }

  await writeSyncStore(store);
  if (taskDataModified.size > 0) {
    await writeTaskBoardData(taskData);
  }

  return NextResponse.json({
    ok: true,
    successCount,
    errorCount,
    errors,
    total: taskIds.length,
  });
}

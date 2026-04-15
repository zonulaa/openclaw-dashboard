/**
 * POST /api/tasks/{taskId}/sync-calendar
 *   Body: { calendarEventId?, syncMode, conflictResolution }
 *   → { synced: true, calendarEventId, lastSyncAt }
 *
 * DELETE /api/tasks/{taskId}/sync-calendar
 *   → { unlinked: true }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isSyncMode,
  isConflictResolution,
  readSyncStore,
  writeSyncStore,
  findSyncByTaskId,
  upsertSync,
  deactivateSync,
  recordSuccessfulSync,
  recordSyncError,
  acquireSyncLock,
  normalizeToUtcIso,
} from "@/lib/task-calendar-sync";
import { readTaskBoardData, writeTaskBoardData, logActivity } from "@/lib/task-board";
import { createCalendarEvent } from "@/lib/calendar-event-sync";

type RouteContext = { params: { taskId: string } };

// ─── POST: Enable/update sync ─────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: RouteContext) {
  const taskId = String(params.taskId || "").trim();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    calendarEventId?: string | null;
    syncMode?: unknown;
    conflictResolution?: unknown;
  };

  const syncMode = body.syncMode ?? "one-way";
  const conflictResolution = body.conflictResolution ?? "task-wins";

  if (!isSyncMode(syncMode)) {
    return NextResponse.json(
      { ok: false, error: "syncMode must be 'one-way' or 'bi-directional'." },
      { status: 400 },
    );
  }
  if (!isConflictResolution(conflictResolution)) {
    return NextResponse.json(
      { ok: false, error: "conflictResolution must be 'task-wins', 'calendar-wins', or 'ask'." },
      { status: 400 },
    );
  }

  // Load task
  const taskData = await readTaskBoardData();
  const task = taskData.tasks.find((t) => t.id === taskId);
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
  }

  // Upsert sync config
  let store = await readSyncStore();
  const { store: updatedStore, sync } = upsertSync(store, {
    taskId,
    calendarEventId: body.calendarEventId ?? findSyncByTaskId(store, taskId)?.calendarEventId,
    syncMode,
    conflictResolution,
  });
  store = updatedStore;

  let calendarEventId = sync.calendarEventId;

  // Auto-create calendar event if task has a deadline and no event yet
  if (!calendarEventId && task.dueAt) {
    const dueAtIso = normalizeToUtcIso(task.dueAt);
    if (dueAtIso) {
      // Acquire lock before creating
      const lockedSync = acquireSyncLock(sync, "task");
      const syncIdx = store.syncs.findIndex((s) => s.taskId === taskId);
      if (syncIdx >= 0) {
        store.syncs[syncIdx] = lockedSync;
      }

      const createResult = await createCalendarEvent(task.title, dueAtIso);
      if (createResult.ok && createResult.calendarEventId) {
        calendarEventId = createResult.calendarEventId;
        const { store: synced } = recordSuccessfulSync(store, taskId, calendarEventId);
        store = synced;
      } else {
        const { store: errStore } = recordSyncError(
          store,
          taskId,
          createResult.error ?? "Failed to create calendar event.",
        );
        store = errStore;
        // Still save the sync config, just without the event id yet
        await writeSyncStore(store);
        return NextResponse.json(
          {
            ok: false,
            error: createResult.error ?? "Failed to create calendar event.",
            warnings: createResult.warnings,
          },
          { status: 502 },
        );
      }
    }
  } else if (calendarEventId) {
    // Event already exists — mark as synced now
    const { store: synced } = recordSuccessfulSync(store, taskId, calendarEventId);
    store = synced;
  }

  await writeSyncStore(store);

  // Update task with sync metadata
  const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
  if (taskIdx >= 0) {
    const now = new Date().toISOString();
    taskData.tasks[taskIdx] = {
      ...taskData.tasks[taskIdx],
      calendarSyncMode: syncMode,
      calendarEventId: calendarEventId ?? undefined,
      calendarSyncedAt: now,
      calendarSyncError: undefined,
      updatedAt: now,
      lastActivityAt: now,
    } as typeof taskData.tasks[number];

    logActivity(taskData, {
      taskId,
      source: "task-board-ui",
      type: "updated",
      meta: {
        action: "sync-calendar-enabled",
        syncMode,
        conflictResolution,
        calendarEventId: calendarEventId ?? null,
      },
    });
    await writeTaskBoardData(taskData);
  }

  const finalSync = store.syncs.find((s) => s.taskId === taskId);
  return NextResponse.json({
    ok: true,
    synced: true,
    calendarEventId: calendarEventId ?? null,
    lastSyncAt: finalSync?.lastSyncAt ?? null,
  });
}

// ─── DELETE: Unlink sync ──────────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const taskId = String(params.taskId || "").trim();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
  }

  const store = await readSyncStore();
  const { store: updatedStore, found } = deactivateSync(store, taskId);
  await writeSyncStore(updatedStore);

  // Clear sync fields on the task
  const taskData = await readTaskBoardData();
  const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
  if (taskIdx >= 0) {
    const now = new Date().toISOString();
    const task = taskData.tasks[taskIdx] as Record<string, unknown>;
    delete task.calendarSyncMode;
    delete task.calendarEventId;
    delete task.calendarSyncedAt;
    delete task.calendarSyncError;
    task.updatedAt = now;
    task.lastActivityAt = now;

    logActivity(taskData, {
      taskId,
      source: "task-board-ui",
      type: "updated",
      meta: { action: "sync-calendar-disabled" },
    });
    await writeTaskBoardData(taskData);
  }

  return NextResponse.json({ ok: true, unlinked: true, wasActive: found });
}

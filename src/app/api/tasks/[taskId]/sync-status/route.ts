/**
 * GET /api/tasks/{taskId}/sync-status
 * → { synced: boolean, calendarEventId?, lastSyncAt, errors[] }
 *
 * POST /api/tasks/{taskId}/sync-status  (manual resync trigger)
 * Body: {}
 * → { synced: boolean, calendarEventId?, lastSyncAt }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  readSyncStore,
  writeSyncStore,
  findSyncByTaskId,
  recordSuccessfulSync,
  recordSyncError,
  acquireSyncLock,
  isSyncLocked,
  normalizeToUtcIso,
} from "@/lib/task-calendar-sync";
import { readTaskBoardData, writeTaskBoardData, logActivity } from "@/lib/task-board";
import { createCalendarEvent, updateCalendarEvent, readCalendarEvent } from "@/lib/calendar-event-sync";

type RouteContext = { params: { taskId: string } };

// ─── GET: Read sync status ────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const taskId = String(params.taskId || "").trim();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
  }

  const store = await readSyncStore();
  const sync = findSyncByTaskId(store, taskId);

  if (!sync) {
    return NextResponse.json({
      ok: true,
      synced: false,
      calendarEventId: null,
      lastSyncAt: null,
      errors: [],
    });
  }

  return NextResponse.json({
    ok: true,
    synced: sync.active && !!sync.calendarEventId,
    calendarEventId: sync.calendarEventId ?? null,
    lastSyncAt: sync.lastSyncAt,
    syncMode: sync.syncMode,
    conflictResolution: sync.conflictResolution,
    errors: sync.errors,
    syncLocked: isSyncLocked(sync),
    lastSyncSource: sync.lastSyncSource,
  });
}

// ─── POST: Manual resync ──────────────────────────────────────────────────────

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const taskId = String(params.taskId || "").trim();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
  }

  let store = await readSyncStore();
  const sync = findSyncByTaskId(store, taskId);
  if (!sync) {
    return NextResponse.json(
      { ok: false, error: "No active sync found for this task. Enable sync first." },
      { status: 404 },
    );
  }

  // Load task
  const taskData = await readTaskBoardData();
  const task = taskData.tasks.find((t) => t.id === taskId);
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
  }

  // Acquire lock (manual resync overrides existing lock)
  const lockedSync = acquireSyncLock(sync, "manual");
  const syncIdx = store.syncs.findIndex((s) => s.taskId === taskId);
  store.syncs[syncIdx] = lockedSync;

  const dueAtIso = normalizeToUtcIso(task.dueAt);
  let calendarEventId = sync.calendarEventId;

  if (!dueAtIso) {
    // Task has no deadline — nothing to sync
    const { store: errStore } = recordSyncError(
      store,
      taskId,
      "Task has no due date; nothing to sync to calendar.",
      "warning",
    );
    await writeSyncStore(errStore);
    return NextResponse.json({
      ok: false,
      error: "Task has no due date; nothing to sync to calendar.",
    });
  }

  // If no event yet, create one
  if (!calendarEventId) {
    const createResult = await createCalendarEvent(task.title, dueAtIso);
    if (createResult.ok && createResult.calendarEventId) {
      calendarEventId = createResult.calendarEventId;
      const { store: synced } = recordSuccessfulSync(store, taskId, calendarEventId);
      store = synced;
    } else {
      const { store: errStore } = recordSyncError(
        store,
        taskId,
        createResult.error ?? "Failed to create calendar event during resync.",
      );
      await writeSyncStore(errStore);
      return NextResponse.json(
        { ok: false, error: createResult.error ?? "Failed to create calendar event." },
        { status: 502 },
      );
    }
  } else {
    // Event exists — read its current state
    const readResult = await readCalendarEvent(calendarEventId);

    if (!readResult.ok && readResult.deleted) {
      // Event was deleted externally → detach sync gracefully (don't delete task)
      const { store: errStore } = recordSyncError(
        store,
        taskId,
        "Calendar event was deleted externally. Sync detached.",
        "warning",
      );
      // Deactivate sync
      const idx = errStore.syncs.findIndex((s) => s.taskId === taskId);
      if (idx >= 0) {
        errStore.syncs[idx] = { ...errStore.syncs[idx], active: false };
      }
      await writeSyncStore(errStore);

      // Clear sync fields on task
      const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
      if (taskIdx >= 0) {
        const t = taskData.tasks[taskIdx] as Record<string, unknown>;
        delete t.calendarEventId;
        delete t.calendarSyncedAt;
        t.calendarSyncError = "Calendar event deleted externally; sync detached.";
        await writeTaskBoardData(taskData);
      }

      return NextResponse.json({
        ok: false,
        error: "Calendar event was deleted externally. Sync detached.",
        detached: true,
      });
    }

    // Update the event to match the task deadline (task-wins for manual resync)
    const updateResult = await updateCalendarEvent(calendarEventId, {
      title: task.title,
      start: dueAtIso,
    });

    if (!updateResult.ok) {
      const { store: errStore } = recordSyncError(
        store,
        taskId,
        updateResult.error ?? "Failed to update calendar event during resync.",
      );
      await writeSyncStore(errStore);
      return NextResponse.json(
        { ok: false, error: updateResult.error ?? "Failed to update calendar event." },
        { status: 502 },
      );
    }

    const { store: synced } = recordSuccessfulSync(store, taskId, calendarEventId);
    store = synced;
  }

  await writeSyncStore(store);

  // Update task sync metadata
  const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
  if (taskIdx >= 0) {
    const now = new Date().toISOString();
    const t = taskData.tasks[taskIdx] as Record<string, unknown>;
    t.calendarEventId = calendarEventId;
    t.calendarSyncedAt = now;
    t.calendarSyncError = undefined;
    t.updatedAt = now;
    t.lastActivityAt = now;

    logActivity(taskData, {
      taskId,
      source: "task-board-ui",
      type: "updated",
      meta: {
        action: "manual-resync",
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

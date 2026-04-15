/**
 * POST /api/calendar/{calendarEventId}/sync-task
 * Body: { taskId, syncMode }
 * → { synced: true, taskId }
 *
 * Links an existing calendar event to a task,
 * and optionally updates the task deadline to match the event start time.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isSyncMode,
  isConflictResolution,
  readSyncStore,
  writeSyncStore,
  findSyncByCalendarEventId,
  upsertSync,
  recordSuccessfulSync,
  recordSyncError,
  isSyncLocked,
  acquireSyncLock,
  normalizeToUtcIso,
} from "@/lib/task-calendar-sync";
import { readTaskBoardData, writeTaskBoardData, logActivity } from "@/lib/task-board";
import { readCalendarEvent } from "@/lib/calendar-event-sync";

type RouteContext = { params: { calendarEventId: string } };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const calendarEventId = String(params.calendarEventId || "").trim();
  if (!calendarEventId) {
    return NextResponse.json({ ok: false, error: "calendarEventId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    taskId?: unknown;
    syncMode?: unknown;
    conflictResolution?: unknown;
  };

  const taskId = String(body.taskId || "").trim();
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required in body." }, { status: 400 });
  }

  const syncMode = body.syncMode ?? "bi-directional";
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
  const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
  if (taskIdx < 0) {
    return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
  }

  const task = taskData.tasks[taskIdx];

  // Check existing sync for this calendar event
  let store = await readSyncStore();
  const existingSync = findSyncByCalendarEventId(store, calendarEventId);
  if (existingSync && existingSync.taskId !== taskId) {
    return NextResponse.json(
      { ok: false, error: "This calendar event is already linked to a different task." },
      { status: 409 },
    );
  }

  // Check if this sync is locked
  if (existingSync && isSyncLocked(existingSync)) {
    return NextResponse.json(
      { ok: true, synced: true, taskId, message: "Sync in progress (lock active). Try again shortly." },
    );
  }

  // Read the calendar event to get its start time
  const eventRead = await readCalendarEvent(calendarEventId);
  if (!eventRead.ok) {
    if (eventRead.deleted) {
      return NextResponse.json(
        { ok: false, error: "Calendar event not found or was deleted." },
        { status: 404 },
      );
    }
    // Non-critical: we can still link without reading (event read is best-effort)
  }

  // Upsert sync
  const { store: updatedStore, sync } = upsertSync(store, {
    taskId,
    calendarEventId,
    syncMode,
    conflictResolution,
  });
  store = updatedStore;

  // Acquire sync lock
  const syncIdx = store.syncs.findIndex((s) => s.taskId === taskId);
  store.syncs[syncIdx] = acquireSyncLock(sync, "calendar");

  // If calendar event has a start time & conflict resolution = calendar-wins (or we have no task deadline)
  let taskDeadlineUpdated = false;
  if (eventRead.ok && eventRead.start) {
    const eventStartIso = normalizeToUtcIso(eventRead.start);
    if (eventStartIso) {
      if (conflictResolution === "calendar-wins" || !task.dueAt) {
        // Update task deadline to match calendar event
        const now = new Date().toISOString();
        taskData.tasks[taskIdx] = {
          ...task,
          dueAt: eventStartIso,
          calendarEventId: calendarEventId,
          calendarSyncMode: syncMode as string,
          calendarSyncedAt: now,
          calendarSyncError: undefined,
          updatedAt: now,
          lastActivityAt: now,
        } as typeof task;
        taskDeadlineUpdated = true;

        logActivity(taskData, {
          taskId,
          source: "task-board-ui",
          type: "updated",
          meta: {
            action: "calendar-sync-link",
            calendarEventId,
            syncMode: syncMode as string,
            newDueAt: eventStartIso,
          },
        });
        await writeTaskBoardData(taskData);
      } else {
        // task-wins: just update the sync fields, no deadline change
        const now = new Date().toISOString();
        taskData.tasks[taskIdx] = {
          ...task,
          calendarEventId: calendarEventId,
          calendarSyncMode: syncMode as string,
          calendarSyncedAt: now,
          calendarSyncError: undefined,
          updatedAt: now,
          lastActivityAt: now,
        } as typeof task;

        logActivity(taskData, {
          taskId,
          source: "task-board-ui",
          type: "updated",
          meta: {
            action: "calendar-sync-link",
            calendarEventId,
            syncMode: syncMode as string,
          },
        });
        await writeTaskBoardData(taskData);
      }
    }
  }

  // Record success
  const { store: syncedStore, sync: finalSync } = recordSuccessfulSync(store, taskId, calendarEventId);
  store = syncedStore;

  // If event read had errors but wasn't fatal, record as warning
  if (!eventRead.ok && !eventRead.deleted) {
    const { store: errStore } = recordSyncError(
      store,
      taskId,
      "Could not read calendar event start time (link established anyway).",
      "warning",
    );
    store = errStore;
  }

  await writeSyncStore(store);

  return NextResponse.json({
    ok: true,
    synced: true,
    taskId,
    calendarEventId,
    lastSyncAt: finalSync?.lastSyncAt ?? null,
    taskDeadlineUpdated,
  });
}

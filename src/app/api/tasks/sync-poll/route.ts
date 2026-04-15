/**
 * POST /api/tasks/sync-poll
 *
 * Bidirectional sync poller endpoint.
 * Called periodically to check for external calendar changes
 * and update tasks accordingly (calendar-event-moved, calendar-event-deleted).
 *
 * Anti-loop: skips syncs that are currently locked.
 * Conflict resolution: if conflictResolution = 'task-wins', task deadline always wins.
 * If 'calendar-wins', calendar event's start time wins.
 */

import { NextResponse } from "next/server";
import {
  readSyncStore,
  writeSyncStore,
  recordSuccessfulSync,
  recordSyncError,
  acquireSyncLock,
  isSyncLocked,
  normalizeToUtcIso,
} from "@/lib/task-calendar-sync";
import { readTaskBoardData, writeTaskBoardData, logActivity } from "@/lib/task-board";
import { readCalendarEvent, updateCalendarEvent } from "@/lib/calendar-event-sync";

type PollResult = {
  taskId: string;
  action: "skipped-lock" | "detached" | "task-wins" | "calendar-wins" | "no-change" | "error";
  detail?: string;
};

export async function POST() {
  let store = await readSyncStore();
  const taskData = await readTaskBoardData();
  const results: PollResult[] = [];
  let taskDataModified = false;

  const activeBidirectional = store.syncs.filter(
    (s) => s.active && s.calendarEventId && s.syncMode === "bi-directional",
  );

  for (const sync of activeBidirectional) {
    const { taskId, calendarEventId, conflictResolution } = sync;

    // Skip if locked (another sync in-flight)
    if (isSyncLocked(sync)) {
      results.push({ taskId, action: "skipped-lock" });
      continue;
    }

    if (!calendarEventId) continue;

    const task = taskData.tasks.find((t) => t.id === taskId);
    if (!task) continue;

    // Read current state of calendar event
    const eventRead = await readCalendarEvent(calendarEventId);

    if (!eventRead.ok) {
      if (eventRead.deleted) {
        // Calendar event deleted → detach sync, don't delete task
        const idx = store.syncs.findIndex((s) => s.taskId === taskId);
        if (idx >= 0) {
          store.syncs[idx] = { ...store.syncs[idx], active: false };
        }

        const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
        if (taskIdx >= 0) {
          const t = taskData.tasks[taskIdx] as Record<string, unknown>;
          delete t.calendarEventId;
          delete t.calendarSyncedAt;
          t.calendarSyncError = "Calendar event deleted externally. Sync detached.";
          t.updatedAt = new Date().toISOString();
          t.lastActivityAt = t.updatedAt;

          logActivity(taskData, {
            taskId,
            source: "task-board-ui",
            type: "updated",
            meta: {
              action: "calendar-event-deleted-detach",
              calendarEventId,
            },
          });
          taskDataModified = true;
        }

        results.push({ taskId, action: "detached", detail: "Calendar event was deleted externally." });
        continue;
      }

      // Non-fatal read error — record and skip
      const { store: errStore } = recordSyncError(
        store,
        taskId,
        eventRead.error ?? "Failed to read calendar event during poll.",
        "warning",
      );
      store = errStore;
      results.push({ taskId, action: "error", detail: eventRead.error });
      continue;
    }

    // Compare event start vs task deadline
    const eventStartIso = normalizeToUtcIso(eventRead.start);
    const taskDueIso = normalizeToUtcIso(task.dueAt);

    if (!eventStartIso) {
      // Event has no start — skip
      results.push({ taskId, action: "no-change" });
      continue;
    }

    const eventTime = new Date(eventStartIso).getTime();
    const taskTime = taskDueIso ? new Date(taskDueIso).getTime() : null;

    // Check if they're already in sync (within 60s tolerance)
    if (taskTime !== null && Math.abs(eventTime - taskTime) < 60_000) {
      results.push({ taskId, action: "no-change" });
      continue;
    }

    // They differ — apply conflict resolution
    const syncIdx = store.syncs.findIndex((s) => s.taskId === taskId);

    if (conflictResolution === "calendar-wins") {
      // Calendar event moved → update task deadline
      store.syncs[syncIdx] = acquireSyncLock(store.syncs[syncIdx], "calendar");

      const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
      if (taskIdx >= 0) {
        const now = new Date().toISOString();
        taskData.tasks[taskIdx] = {
          ...taskData.tasks[taskIdx],
          dueAt: eventStartIso,
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
            action: "calendar-event-moved-update-task",
            calendarEventId,
            newDueAt: eventStartIso,
            conflictResolution,
          },
        });
        taskDataModified = true;
      }

      const { store: synced } = recordSuccessfulSync(store, taskId, calendarEventId);
      store = synced;
      results.push({ taskId, action: "calendar-wins", detail: `Task deadline updated to ${eventStartIso}` });
    } else if (conflictResolution === "task-wins" && taskDueIso) {
      // Task deadline wins → push task deadline back to calendar event
      store.syncs[syncIdx] = acquireSyncLock(store.syncs[syncIdx], "task");

      const updateResult = await updateCalendarEvent(calendarEventId, { start: taskDueIso });
      if (updateResult.ok) {
        const { store: synced } = recordSuccessfulSync(store, taskId, calendarEventId);
        store = synced;

        // Update task's calendarSyncedAt
        const taskIdx = taskData.tasks.findIndex((t) => t.id === taskId);
        if (taskIdx >= 0) {
          const now = new Date().toISOString();
          const t = taskData.tasks[taskIdx] as Record<string, unknown>;
          t.calendarSyncedAt = now;
          t.calendarSyncError = undefined;
          t.updatedAt = now;
          t.lastActivityAt = now;

          logActivity(taskData, {
            taskId,
            source: "task-board-ui",
            type: "updated",
            meta: {
              action: "task-deadline-pushed-to-calendar",
              calendarEventId,
              taskDueAt: taskDueIso,
              conflictResolution,
            },
          });
          taskDataModified = true;
        }

        results.push({ taskId, action: "task-wins", detail: `Calendar event updated to ${taskDueIso}` });
      } else {
        const { store: errStore } = recordSyncError(
          store,
          taskId,
          updateResult.error ?? "Failed to push task deadline to calendar event.",
        );
        store = errStore;
        results.push({ taskId, action: "error", detail: updateResult.error });
      }
    } else {
      // 'ask' mode — record conflict but don't auto-resolve
      const { store: errStore } = recordSyncError(
        store,
        taskId,
        `Conflict detected: calendar event at ${eventStartIso}, task due at ${taskDueIso ?? "none"}. Manual resolution required.`,
        "warning",
      );
      store = errStore;
      results.push({
        taskId,
        action: "error",
        detail: "Conflict requires manual resolution (conflictResolution=ask).",
      });
    }
  }

  await writeSyncStore(store);
  if (taskDataModified) {
    await writeTaskBoardData(taskData);
  }

  return NextResponse.json({
    ok: true,
    checked: activeBidirectional.length,
    results,
  });
}

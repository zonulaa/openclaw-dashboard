/**
 * Calendar Event Sync Helper
 *
 * Handles creating/updating/deleting calendar events when syncing tasks.
 * Uses the same gateway method candidates pattern as calendar-reminders.ts
 */

import { callMethodCandidates } from "@/app/api/calendar/_gateway-cron";

export type CalendarEventCreateResult = {
  ok: boolean;
  calendarEventId?: string | null;
  warnings: string[];
  error?: string;
};

export type CalendarEventUpdateResult = {
  ok: boolean;
  warnings: string[];
  error?: string;
};

export type CalendarEventDeleteResult = {
  ok: boolean;
  warnings: string[];
  error?: string;
};

export type CalendarEventReadResult = {
  ok: boolean;
  start?: string | null;
  title?: string | null;
  deleted?: boolean;
  warnings: string[];
  error?: string;
};

// ─── Create ──────────────────────────────────────────────────────────────────

function extractEventId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const obj = result as Record<string, unknown>;
  const id =
    typeof obj.id === "string" ? obj.id :
    typeof obj.eventId === "string" ? obj.eventId :
    typeof obj.uid === "string" ? obj.uid :
    typeof obj.calendarEventId === "string" ? obj.calendarEventId :
    null;
  return id?.trim() || null;
}

/**
 * Create a new calendar event linked to a task deadline.
 */
export async function createCalendarEvent(
  title: string,
  startIso: string,
  endIso?: string,
): Promise<CalendarEventCreateResult> {
  const endTime = endIso ?? new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString(); // +1h default

  const candidates = [
    {
      method: "calendar_event_create",
      params: { title, start: startIso, end: endTime, calendar: "OPENCLAW" },
    },
    {
      method: "apple_calendar_create_event",
      params: { title, startDate: startIso, endDate: endTime, calendar: "OPENCLAW" },
    },
    {
      method: "calendar_create_event",
      params: { title, startAt: startIso, endAt: endTime },
    },
    {
      method: "event_create",
      params: { name: title, start: startIso, end: endTime },
    },
  ];

  const result = await callMethodCandidates(candidates, 15_000);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      warnings: result.warnings,
    };
  }

  return {
    ok: true,
    calendarEventId: extractEventId(result.result),
    warnings: result.warnings,
  };
}

// ─── Update ──────────────────────────────────────────────────────────────────

/**
 * Update an existing calendar event's start time (and optionally title).
 */
export async function updateCalendarEvent(
  calendarEventId: string,
  fields: { title?: string; start?: string; end?: string },
): Promise<CalendarEventUpdateResult> {
  const candidates = [
    {
      method: "calendar_event_update",
      params: { id: calendarEventId, ...fields },
    },
    {
      method: "apple_calendar_update_event",
      params: { eventId: calendarEventId, ...fields },
    },
    {
      method: "calendar_update_event",
      params: { uid: calendarEventId, ...fields },
    },
  ];

  const result = await callMethodCandidates(candidates, 15_000);

  return {
    ok: result.ok,
    warnings: result.warnings,
    error: result.ok ? undefined : (result.error ?? "Failed to update calendar event."),
  };
}

// ─── Archive/Hide ─────────────────────────────────────────────────────────────

/**
 * Archive (or delete) a calendar event when the task deadline is cleared.
 * We prefer soft-delete / archive; fall back to hard delete.
 */
export async function archiveCalendarEvent(
  calendarEventId: string,
): Promise<CalendarEventDeleteResult> {
  const candidates = [
    {
      method: "calendar_event_archive",
      params: { id: calendarEventId },
    },
    {
      method: "calendar_event_delete",
      params: { id: calendarEventId },
    },
    {
      method: "apple_calendar_delete_event",
      params: { eventId: calendarEventId },
    },
    {
      method: "calendar_delete_event",
      params: { uid: calendarEventId },
    },
  ];

  const result = await callMethodCandidates(candidates, 15_000);

  return {
    ok: result.ok,
    warnings: result.warnings,
    error: result.ok ? undefined : (result.error ?? "Failed to archive calendar event."),
  };
}

// ─── Read (for bidirectional sync polling) ────────────────────────────────────

/**
 * Fetch the current state of a calendar event.
 * Used to detect external changes (event moved/deleted).
 */
export async function readCalendarEvent(
  calendarEventId: string,
): Promise<CalendarEventReadResult> {
  const candidates = [
    {
      method: "calendar_event_get",
      params: { id: calendarEventId },
    },
    {
      method: "apple_calendar_get_event",
      params: { eventId: calendarEventId },
    },
    {
      method: "calendar_get_event",
      params: { uid: calendarEventId },
    },
  ];

  const result = await callMethodCandidates(candidates, 10_000);

  if (!result.ok) {
    // Check if the error looks like "not found" (event deleted externally)
    const errLower = (result.error ?? "").toLowerCase();
    const isDeleted =
      errLower.includes("not found") ||
      errLower.includes("404") ||
      errLower.includes("does not exist") ||
      errLower.includes("no event");

    return {
      ok: false,
      deleted: isDeleted,
      warnings: result.warnings,
      error: result.error,
    };
  }

  const obj = result.result as Record<string, unknown> | null;
  const start =
    typeof obj?.start === "string" ? obj.start :
    typeof obj?.startDate === "string" ? obj.startDate :
    typeof obj?.startAt === "string" ? obj.startAt :
    null;
  const title =
    typeof obj?.title === "string" ? obj.title :
    typeof obj?.name === "string" ? obj.name :
    null;

  return {
    ok: true,
    start: start?.trim() || null,
    title: title?.trim() || null,
    deleted: false,
    warnings: result.warnings,
  };
}

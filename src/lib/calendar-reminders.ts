import { callMethodCandidates } from "@/app/api/calendar/_gateway-cron";

export type ReminderCreateResult = {
  ok: boolean;
  method?: string;
  warnings: string[];
  error?: string;
  linkedJobId?: string | null;
  linkedEventTitle?: string | null;
};

function extractString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function extractReminderMetadata(result: unknown): { linkedJobId?: string | null; linkedEventTitle?: string | null } {
  if (!result || typeof result !== "object") return {};
  const obj = result as Record<string, unknown>;

  const linkedJobId =
    extractString(obj.jobId) ??
    extractString(obj.id) ??
    extractString(obj.reminderId) ??
    extractString(obj.cronId) ??
    null;

  const linkedEventTitle =
    extractString(obj.title) ??
    extractString(obj.eventTitle) ??
    extractString(obj.name) ??
    null;

  return { linkedJobId, linkedEventTitle };
}

export async function createCalendarReminder(atIso: string, message: string): Promise<ReminderCreateResult> {
  const candidates = [
    {
      method: "cron_create_once",
      params: {
        runAt: atIso,
        message,
      },
    },
    {
      method: "cron_once_create",
      params: {
        at: atIso,
        command: `echo ${JSON.stringify(message)}`,
      },
    },
    {
      method: "reminder_create",
      params: {
        at: atIso,
        message,
      },
    },
    {
      method: "schedule_once",
      params: {
        scheduleAt: atIso,
        task: message,
      },
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

  const metadata = extractReminderMetadata(result.result);

  return {
    ok: true,
    method: result.method,
    warnings: result.warnings,
    linkedJobId: metadata.linkedJobId,
    linkedEventTitle: metadata.linkedEventTitle,
  };
}

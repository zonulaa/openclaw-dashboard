/**
 * cron-next-run.ts
 * Calculate the next scheduled run for a 5-field cron expression.
 * Uses a simple forward-scanning approach — no external dependencies.
 *
 * Field order: minute hour dayOfMonth month dayOfWeek
 */

export interface NextRunResult {
  nextRun: Date;
  countdown: string;
}

/** Parse a cron field into a sorted list of matching integers */
function parseField(field: string, min: number, max: number): number[] | null {
  if (field === "*") {
    return range(min, max);
  }

  // */step  → every step from min
  const stepMatch = /^\*\/(\d+)$/.exec(field);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    if (step <= 0) return null;
    const result: number[] = [];
    for (let i = min; i <= max; i += step) result.push(i);
    return result;
  }

  // a-b range
  const rangeMatch = /^(\d+)-(\d+)$/.exec(field);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1], 10);
    const b = parseInt(rangeMatch[2], 10);
    if (a > b || a < min || b > max) return null;
    return range(a, b);
  }

  // a,b,c list (can contain ranges or steps — simplified: only integers)
  if (field.includes(",")) {
    const parts = field.split(",");
    const result: number[] = [];
    for (const part of parts) {
      const sub = parseField(part.trim(), min, max);
      if (sub === null) return null;
      result.push(...sub);
    }
    return [...new Set(result)].sort((a, b) => a - b);
  }

  // Single integer
  const n = parseInt(field, 10);
  if (!isNaN(n) && n >= min && n <= max) return [n];

  return null;
}

function range(a: number, b: number): number[] {
  const r: number[] = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

/**
 * getNextRun — Find the next cron fire time after `now`.
 * Returns { nextRun, countdown } or throws if the expression cannot be parsed.
 */
export function getNextRun(expression: string, now?: Date): NextRunResult {
  const base = now ?? new Date();

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Invalid cron: expected 5 fields");

  const [minuteF, hourF, domF, monthF, dowF] = parts;

  // Parse each field
  const minutes = parseField(minuteF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monthF, 1, 12);
  const dows = dowF === "*" ? null : parseField(dowF, 0, 6); // null = any DOW

  if (!minutes || !hours || !doms || !months) {
    throw new Error("Invalid cron expression");
  }

  // Start scanning one minute ahead of now
  const start = new Date(base);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  // Scan forward up to 366 days (prevents infinite loop for impossible expressions)
  const limit = new Date(start);
  limit.setDate(limit.getDate() + 366);

  const cursor = new Date(start);

  while (cursor <= limit) {
    const m = cursor.getMonth() + 1; // 1-based
    if (!months.includes(m)) {
      // Skip to next month
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const day = cursor.getDate();
    const dow = cursor.getDay(); // 0=Sunday
    const domMatch = doms.includes(day);
    const dowMatch = dows === null || dows.includes(dow);

    // cron: when both dom and dow are specified, either match counts (OR semantics)
    // when only dom or dow is *, use the other one strictly
    let dayMatch: boolean;
    if (domF === "*" && dowF === "*") {
      dayMatch = true;
    } else if (domF === "*") {
      dayMatch = dowMatch;
    } else if (dowF === "*") {
      dayMatch = domMatch;
    } else {
      dayMatch = domMatch || dowMatch; // OR semantics per POSIX cron
    }

    if (!dayMatch) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const h = cursor.getHours();
    if (!hours.includes(h)) {
      // Find next valid hour today
      const nextHour = hours.find((hr) => hr > h);
      if (nextHour !== undefined) {
        cursor.setHours(nextHour, 0, 0, 0);
      } else {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(0, 0, 0, 0);
      }
      continue;
    }

    const min = cursor.getMinutes();
    const nextMin = minutes.find((mn) => mn >= min);
    if (nextMin !== undefined) {
      cursor.setMinutes(nextMin, 0, 0);
      // We found our match
      return {
        nextRun: new Date(cursor),
        countdown: formatCountdown(cursor, base),
      };
    } else {
      // No valid minute in this hour — try next valid hour
      const nextHour = hours.find((hr) => hr > h);
      if (nextHour !== undefined) {
        cursor.setHours(nextHour, 0, 0, 0);
      } else {
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(0, 0, 0, 0);
      }
    }
  }

  throw new Error("No next run found within 366 days");
}

/** Format the gap between nextRun and now as a human countdown string */
function formatCountdown(nextRun: Date, now: Date): string {
  const diffMs = nextRun.getTime() - now.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalSeconds < 60) return "in less than a minute";
  if (totalMinutes === 1) return "in 1 minute";
  if (totalMinutes < 60) return `in ${totalMinutes} minutes`;
  if (totalHours === 1) return "in 1 hour";
  if (totalHours < 24) {
    const remainingMin = totalMinutes % 60;
    if (remainingMin === 0) return `in ${totalHours} hours`;
    return `in ${totalHours}h ${remainingMin}m`;
  }

  // Tomorrow
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  if (nextRun >= tomorrowStart && nextRun <= tomorrowEnd) {
    const timeStr = nextRun.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `tomorrow at ${timeStr}`;
  }

  if (totalDays === 1) return "in 1 day";
  if (totalDays < 7) return `in ${totalDays} days`;
  if (totalDays < 14) return "in about a week";
  if (totalDays < 31) return `in ${Math.floor(totalDays / 7)} weeks`;
  return `in ${Math.floor(totalDays / 30)} months`;
}

/**
 * safeGetNextRun — Non-throwing wrapper.
 * Returns { nextRun, countdown } or { nextRun: null, countdown: "Unknown" }.
 */
export function safeGetNextRun(
  expression: string,
  now?: Date,
): { nextRun: Date | null; countdown: string } {
  try {
    return getNextRun(expression, now);
  } catch {
    return { nextRun: null, countdown: "Unknown" };
  }
}

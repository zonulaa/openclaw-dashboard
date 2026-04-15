/**
 * cron-describe.ts
 * Convert a 5-field cron expression into a short human-readable description.
 * Uses pure regex — no external dependencies.
 *
 * Supported field format: minute hour dayOfMonth month dayOfWeek
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHour(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  if (minute === 0) return `${h}:00 ${ampm}`;
  return `${h}:${pad2(minute)} ${ampm}`;
}

/** Return "midnight" | "noon" | "9:00 AM" etc. */
function formatTime(hour: number, minute: number): string {
  if (hour === 0 && minute === 0) return "midnight";
  if (hour === 12 && minute === 0) return "noon";
  return formatHour(hour, minute);
}

/** Parse a simple integer field (e.g. "9" -> 9). Returns null if not a plain integer. */
function parseFixed(field: string): number | null {
  const n = parseInt(field, 10);
  return !isNaN(n) && String(n) === field ? n : null;
}

// Parse step form, e.g. slash15 -> 15. Returns null if not that pattern.
function parseStep(field: string): number | null {
  const m = /^\*\/(\d+)$/.exec(field);
  return m ? parseInt(m[1], 10) : null;
}

/** Parse a day-of-week range like "1-5". Returns ["Mon", "Fri"] style or null. */
function parseDowRange(field: string): [number, number] | null {
  const m = /^(\d)-(\d)$/.exec(field);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10)];
}

/** Parse a comma-separated list like "1,3,5" -> [1,3,5] */
function parseList(field: string): number[] | null {
  if (!field.includes(",")) return null;
  const parts = field.split(",").map((s) => parseInt(s.trim(), 10));
  if (parts.some(isNaN)) return null;
  return parts;
}

/**
 * describeCron(expression) — Convert a 5-field cron expression to a human sentence.
 * Falls back to the original expression string on any parse failure.
 */
export function describeCron(expression: string): string {
  try {
    const trimmed = expression.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) return expression;

    const [minuteF, hourF, domF, monthF, dowF] = parts;

    // ── Every N minutes ──────────────────────────────────────────────
    if (hourF === "*" && domF === "*" && monthF === "*" && dowF === "*") {
      const stepMin = parseStep(minuteF);
      if (stepMin !== null) {
        if (stepMin === 1) return "Every minute";
        return `Every ${stepMin} minutes`;
      }
      const fixedMin = parseFixed(minuteF);
      if (fixedMin !== null && fixedMin === 0) return "Every hour";
      if (minuteF === "*") return "Every minute";
    }

    // ── Every N hours ─────────────────────────────────────────────────
    if (minuteF === "0" && domF === "*" && monthF === "*" && dowF === "*") {
      const stepHour = parseStep(hourF);
      if (stepHour !== null) {
        if (stepHour === 1) return "Every hour";
        return `Every ${stepHour} hours`;
      }
    }

    // Extract fixed hour/minute for specific-time patterns
    const fixedHour = parseFixed(hourF);
    const fixedMinute = parseFixed(minuteF);

    // ── Weekdays at HH:MM ─────────────────────────────────────────────
    if (
      fixedHour !== null &&
      fixedMinute !== null &&
      domF === "*" &&
      monthF === "*"
    ) {
      const dowRange = parseDowRange(dowF);
      if (dowRange) {
        const [from, to] = dowRange;
        // Common patterns
        if (from === 1 && to === 5) {
          return `Weekdays at ${formatTime(fixedHour, fixedMinute)}`;
        }
        if (from === 0 && to === 6) {
          return `Daily at ${formatTime(fixedHour, fixedMinute)}`;
        }
        if (from === 6 && to === 6) {
          return `Saturdays at ${formatTime(fixedHour, fixedMinute)}`;
        }
        if (from === 0 && to === 0) {
          return `Sundays at ${formatTime(fixedHour, fixedMinute)}`;
        }
        const fromDay = DAYS[from] ?? `Day ${from}`;
        const toDay = DAYS[to] ?? `Day ${to}`;
        return `${fromDay}–${toDay} at ${formatTime(fixedHour, fixedMinute)}`;
      }

      // Specific days list
      const dowList = parseList(dowF);
      if (dowList) {
        const dayNames = dowList.map((d) => DAYS[d] ?? `Day ${d}`);
        if (dayNames.length === 1) return `${dayNames[0]}s at ${formatTime(fixedHour, fixedMinute)}`;
        return `${dayNames.join(", ")} at ${formatTime(fixedHour, fixedMinute)}`;
      }

      // Single DOW
      const fixedDow = parseFixed(dowF);
      if (fixedDow !== null && dowF !== "*") {
        const dayName = DAYS[fixedDow] ?? `Day ${fixedDow}`;
        return `${dayName}s at ${formatTime(fixedHour, fixedMinute)}`;
      }

      // Daily at time
      if (dowF === "*") {
        return `Daily at ${formatTime(fixedHour, fixedMinute)}`;
      }
    }

    // ── Monthly / first day of month ──────────────────────────────────
    if (fixedHour !== null && fixedMinute !== null && monthF === "*" && dowF === "*") {
      const fixedDom = parseFixed(domF);
      if (fixedDom !== null) {
        const suffix = ordinal(fixedDom);
        return `${suffix} of month at ${formatTime(fixedHour, fixedMinute)}`;
      }
      const stepDom = parseStep(domF);
      if (stepDom !== null) {
        return `Every ${stepDom} days at ${formatTime(fixedHour, fixedMinute)}`;
      }
    }

    // ── Specific month ────────────────────────────────────────────────
    if (
      fixedHour !== null &&
      fixedMinute !== null &&
      dowF === "*"
    ) {
      const fixedMonth = parseFixed(monthF);
      const fixedDom = parseFixed(domF);
      if (fixedMonth !== null && fixedDom !== null) {
        const monthName = MONTHS[fixedMonth] ?? `Month ${fixedMonth}`;
        const suffix = ordinal(fixedDom);
        return `${monthName} ${suffix} at ${formatTime(fixedHour, fixedMinute)}`;
      }
    }

    // ── Every N minutes during certain hour ───────────────────────────
    if (domF === "*" && monthF === "*" && dowF === "*") {
      const stepMin = parseStep(minuteF);
      const fixedHr = parseFixed(hourF);
      if (stepMin !== null && fixedHr !== null) {
        return `Every ${stepMin} minutes at ${formatHour(fixedHr, 0).replace(/:00/, "")} hour`;
      }
    }

    // ── Fallback: try to build a partial description ──────────────────
    return expression;
  } catch {
    return expression;
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

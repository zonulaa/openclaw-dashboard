import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import { callGatewayMethod } from '@/lib/openclaw-gateway'
import path from 'node:path'
import os from 'node:os'

const execFileAsync = promisify(execFile)

// Resolved once at module load — works in both dev and prod
const APPLE_CAL_SCRIPT = path.join(
  os.homedir(),
  '.openclaw/workspace/skills/apple-calendar/scripts/list_events.sh',
)
const DEFAULT_CALENDAR = process.env.NEXT_PUBLIC_DEFAULT_CALENDAR || "Default Calendar"
const EXTRA_CALENDARS = (process.env.EXTRA_CALENDARS || "").split(",").map(s => s.trim()).filter(Boolean)

type CalendarEvent = {
  title: string
  start: string
  end?: string
  calendar?: string
}

type CalendarJob = {
  id: string
  name?: string
  kind: 'cron' | 'reminder'
  schedule: string
  command: string
  runAt?: string
  source: 'gateway' | 'local'
  editable: boolean
  deletable: boolean
}

function normalizeEvents(raw: unknown): CalendarEvent[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      const title = String(obj.title ?? obj.name ?? '').trim()
      const start = String(obj.start ?? obj.startDate ?? obj.when ?? '').trim()
      if (!title || !start) return null
      return {
        title,
        start,
        end: typeof obj.end === 'string' ? obj.end : typeof obj.endDate === 'string' ? obj.endDate : undefined,
        calendar: typeof obj.calendar === 'string' ? obj.calendar : typeof obj.calendarName === 'string' ? obj.calendarName : undefined,
      }
    })
    .filter(Boolean) as CalendarEvent[]
}

async function eventsFromGateway(): Promise<CalendarEvent[]> {
  // Only use methods that are known to exist in the OpenClaw gateway.
  // Dead methods (calendar_events_list, apple_calendar_list_events, calendar_list_events)
  // have been removed to avoid gateway warnings on every page load.
  const methodCandidates = ['calendar.events', 'calendar_events', 'events_list']

  for (const method of methodCandidates) {
    try {
      const result = (await callGatewayMethod(method, { calendar: 'OPENCLAW', daysAhead: 14, limit: 20 }, 12_000)) as
        | Record<string, unknown>
        | unknown[]
      const events = normalizeEvents(Array.isArray(result) ? result : (result as Record<string, unknown>)?.events)
      if (events.length > 0) return events
    } catch {
      // try next method
    }
  }

  return []
}

/** Format a Date as "YYYY-MM-DD HH:MM" for the shell script */
function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Normalize Apple Calendar date strings like "Wednesday, March 25, 2026 at 10:00:00 AM"
 * to ISO 8601 format "2026-03-25T10:00:00" for reliable cross-browser parsing.
 */
function normalizeAppleDate(raw: string): string {
  if (!raw || raw === 'missing value') return raw
  const trimmed = raw.trim()
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed
  // Parse "Weekday, Month D, YYYY at H:MM:SS AM/PM"
  const match = trimmed.match(
    /(\w+),\s+(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+):(\d+)\s+(AM|PM)/i
  )
  if (!match) {
    // Fallback: try native parse
    const d = new Date(trimmed)
    return isNaN(d.getTime()) ? trimmed : d.toISOString()
  }
  const [, , month, day, year, hourRaw, min, sec, ampm] = match
  const months: Record<string, string> = {
    January:'01',February:'02',March:'03',April:'04',May:'05',June:'06',
    July:'07',August:'08',September:'09',October:'10',November:'11',December:'12',
  }
  const mm = months[month] ?? '01'
  let hour = parseInt(hourRaw, 10)
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0
  const hh = String(hour).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}T${hh}:${min}:${sec}`
}

/** Parse a tab-delimited line from list_events.sh: calName\ttitle\tstart\tend\tloc */
function parseScriptLine(line: string): CalendarEvent | null {
  const parts = line.split('\t')
  // Script outputs: calName, title, start, end, location
  const [calendar, title, start, end] = parts
  if (!title?.trim() || !start?.trim()) return null
  return {
    title: title.trim(),
    start: normalizeAppleDate(start.trim()),
    end: end?.trim() && end.trim() !== 'missing value' ? normalizeAppleDate(end.trim()) : undefined,
    calendar: calendar?.trim() || DEFAULT_CALENDAR,
  }
}

async function fetchCalendarEvents(calendarName: string, start: Date, end: Date): Promise<CalendarEvent[]> {
  try {
    const { stdout } = await execFileAsync(
      'bash',
      [
        APPLE_CAL_SCRIPT,
        '--start', fmtDate(start),
        '--end',   fmtDate(end),
        '--calendar', calendarName,
      ],
      { timeout: 12_000 },
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseScriptLine)
      .filter(Boolean) as CalendarEvent[]
  } catch {
    return []
  }
}

async function eventsFromAppleScript(): Promise<CalendarEvent[]> {
  const now = new Date()
  const ahead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const allCalendars = [DEFAULT_CALENDAR, ...EXTRA_CALENDARS]
  const results = await Promise.all(allCalendars.map(cal => fetchCalendarEvents(cal, now, ahead)))

  // Merge + dedupe by title+start
  const seen = new Set<string>()
  const merged: CalendarEvent[] = []
  for (const events of results) {
    for (const ev of events) {
      const key = `${ev.title}|${ev.start}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(ev)
      }
    }
  }
  return merged
}

function isReminderShape(job: Record<string, unknown>): boolean {
  const type = String(job.type ?? job.kind ?? '').toLowerCase()
  return Boolean(
    type.includes('reminder') ||
      type.includes('once') ||
      job.once === true ||
      typeof job.runAt === 'string' ||
      typeof job.at === 'string' ||
      typeof job.scheduledAt === 'string',
  )
}

function normalizeGatewayJobs(raw: unknown): CalendarJob[] {
  const jobs = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.jobs)
      ? ((raw as Record<string, unknown>).jobs as unknown[])
      : []

  return jobs
    .map((job, index) => {
      if (!job || typeof job !== 'object') return null
      const obj = job as Record<string, unknown>

      // Schedule: handle both object form { kind, expr } and plain string/expression
      const scheduleObj = obj.schedule && typeof obj.schedule === 'object' ? obj.schedule as Record<string, unknown> : null
      const schedule = String(scheduleObj?.expr ?? scheduleObj?.expression ?? obj.schedule ?? obj.cron ?? obj.expression ?? '').trim()

      // Payload: OpenClaw gateway cron jobs store the task info inside a `payload` object
      const payload = obj.payload && typeof obj.payload === 'object' ? obj.payload as Record<string, unknown> : null

      // Command: try top-level fields first, then fall back to payload.text / payload.kind
      const command = String(
        obj.command ?? obj.task ?? obj.message ?? obj.name ??
        payload?.text ?? payload?.kind ?? payload?.message ?? payload?.command ?? ''
      ).trim()

      const runAt = String(obj.runAt ?? obj.at ?? obj.scheduledAt ?? '').trim() || undefined
      const idRaw = String(obj.id ?? obj.jobId ?? obj.uuid ?? '').trim()
      if (!schedule && !runAt) return null
      if (!command) return null

      const kind = isReminderShape(obj) ? 'reminder' : 'cron'
      const id = idRaw || `gw-${index}-${schedule || runAt}-${command}`

      const name = String(obj.name ?? obj.label ?? '').trim() || undefined

      return {
        id,
        name,
        kind,
        schedule: schedule || runAt || '-',
        runAt,
        command,
        source: 'gateway' as const,
        editable: true,
        deletable: true,
      }
    })
    .filter(Boolean) as CalendarJob[]
}

function parseCronLines(lines: string[]): CalendarJob[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line, index) => {
      const parts = line.split(/\s+/)
      if (parts.length < 6) return null
      const schedule = parts.slice(0, 5).join(' ')
      const command = parts.slice(5).join(' ')
      return {
        id: `local-${index}-${schedule}-${command}`,
        kind: 'cron' as const,
        schedule,
        command,
        source: 'local' as const,
        editable: false,
        deletable: false,
      }
    })
    .filter(Boolean) as CalendarJob[]
}

async function cronFromGateway(): Promise<CalendarJob[]> {
  const methods = ['cron.list', 'cron_list', 'crons_list', 'schedule_list']
  for (const method of methods) {
    try {
      const result = (await callGatewayMethod(method, {}, 10_000)) as Record<string, unknown> | unknown[]
      const mapped = normalizeGatewayJobs(result)
      if (mapped.length) return mapped
    } catch {
      // try next
    }
  }

  return []
}

async function cronFromLocal(): Promise<CalendarJob[]> {
  try {
    const { stdout } = await execFileAsync('crontab', ['-l'], { timeout: 5000 })
    return parseCronLines(stdout.split(/\r?\n/))
  } catch {
    return []
  }
}

export async function GET() {
  const errors: string[] = []

  let events = await eventsFromGateway()
  if (!events.length) {
    events = await eventsFromAppleScript()
    if (!events.length) errors.push('No events found from OpenClaw Gateway or Apple Calendar.')
  }

  let jobs = await cronFromGateway()
  if (!jobs.length) {
    jobs = await cronFromLocal()
    if (!jobs.length) errors.push('No cron jobs available from Gateway or local crontab.')
  }

  events = events
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 30)
  jobs = jobs.slice(0, 50)

  return NextResponse.json({
    ok: true,
    events,
    cronJobs: jobs,
    warnings: errors,
    sources: {
      events: events.length
        ? events.some((e) => e.calendar === 'OPENCLAW')
          ? 'openclaw-calendar'
          : `apple-calendar (${DEFAULT_CALENDAR})`
        : 'none',
      cron: jobs.length ? (jobs[0].source === 'gateway' ? 'gateway' : 'local') : 'none',
    },
  })
}

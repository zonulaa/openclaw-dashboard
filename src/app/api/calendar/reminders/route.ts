import { NextRequest, NextResponse } from 'next/server'
import { parseFutureDate, sanitizeText } from '@/app/api/calendar/_gateway-cron'
import { createCalendarReminder } from '@/lib/calendar-reminders'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const message = sanitizeText(body.message, 280)
  const when = parseFutureDate(body.at)

  if (!message) {
    return NextResponse.json({ ok: false, error: 'Reminder message is required.' }, { status: 400 })
  }

  if (!when) {
    return NextResponse.json({ ok: false, error: 'Reminder time must be a valid future date/time.' }, { status: 400 })
  }

  const isoAt = when.toISOString()

  const result = await createCalendarReminder(isoAt, message)

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        warnings: result.warnings,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    action: 'one-shot-reminder-created',
    method: result.method,
    scheduledAt: isoAt,
    warnings: result.warnings,
  })
}

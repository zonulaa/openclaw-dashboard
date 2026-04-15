import { NextRequest, NextResponse } from 'next/server'
import { callMethodCandidates, isLikelyCronExpression, parseFutureDate, sanitizeText } from '@/app/api/calendar/_gateway-cron'

type UpdatePayload = {
  id?: string
  source?: string
  kind?: string
  previousSchedule?: string
  previousCommand?: string
  schedule?: string
  command?: string
  runAt?: string
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as UpdatePayload

  const source = sanitizeText(body.source, 20)
  if (source && source !== 'gateway') {
    return NextResponse.json(
      { ok: false, error: 'Only gateway-backed jobs can be updated from this panel.' },
      { status: 400 },
    )
  }

  const kindRaw = sanitizeText(body.kind, 20).toLowerCase()
  const kind = kindRaw === 'reminder' ? 'reminder' : 'cron'

  const id = sanitizeText(body.id, 160)
  const previousSchedule = sanitizeText(body.previousSchedule, 120)
  const previousCommand = sanitizeText(body.previousCommand, 400)
  const schedule = sanitizeText(body.schedule, 120)
  const command = sanitizeText(body.command, 400)

  const runAt = body.runAt ? parseFutureDate(body.runAt) : null

  if (!id && !previousSchedule && !previousCommand) {
    return NextResponse.json(
      { ok: false, error: 'A job reference is required (id or previous schedule/command).' },
      { status: 400 },
    )
  }

  if (kind === 'cron') {
    if (!schedule || !isLikelyCronExpression(schedule)) {
      return NextResponse.json({ ok: false, error: 'Cron expression is required (5 or 6 fields).' }, { status: 400 })
    }
    if (!command) {
      return NextResponse.json({ ok: false, error: 'Cron command/message is required.' }, { status: 400 })
    }
  }

  if (kind === 'reminder') {
    if (!command) {
      return NextResponse.json({ ok: false, error: 'Reminder message is required.' }, { status: 400 })
    }
    if (!runAt) {
      return NextResponse.json({ ok: false, error: 'Reminder runAt must be a valid future date/time.' }, { status: 400 })
    }
  }

  const selector = {
    ...(id ? { id } : {}),
    ...(previousSchedule ? { schedule: previousSchedule } : {}),
    ...(previousCommand ? { command: previousCommand } : {}),
  }

  const candidates = kind === 'reminder'
    ? [
        {
          method: 'reminder_update',
          params: { ...selector, at: runAt!.toISOString(), message: command },
        },
        {
          method: 'cron_update_once',
          params: { ...selector, runAt: runAt!.toISOString(), command },
        },
        {
          method: 'schedule_update',
          params: { ...selector, scheduleAt: runAt!.toISOString(), task: command, once: true },
        },
      ]
    : [
        {
          // Primary OpenClaw gateway cron update — structured patch format
          method: 'cron.update',
          params: {
            id,
            patch: {
              name: command,
              schedule: { kind: 'cron', expr: schedule },
            },
          },
        },
        {
          method: 'cron_update',
          params: { ...selector, schedule, command },
        },
        {
          method: 'cron_edit',
          params: { ...selector, cron: schedule, command },
        },
        {
          method: 'schedule_update',
          params: { ...selector, schedule, task: command },
        },
        {
          method: 'crons_update',
          params: { ...selector, expression: schedule, command },
        },
      ]

  const result = await callMethodCandidates(candidates, 15_000)

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
    action: kind === 'reminder' ? 'reminder-updated' : 'cron-job-updated',
    method: result.method,
    warnings: result.warnings,
  })
}

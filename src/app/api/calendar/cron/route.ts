import { NextRequest, NextResponse } from 'next/server'
import { callMethodCandidates, isLikelyCronExpression, sanitizeText } from '@/app/api/calendar/_gateway-cron'

const DISALLOWED_COMMAND_PATTERN = /\b(rm\s+-rf|shutdown|reboot|mkfs|dd\s+if=|:(){:|curl\s+.+\|\s*sh)\b/i

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const schedule = sanitizeText(body.schedule, 120)
  const command = sanitizeText(body.command, 400)

  if (!isLikelyCronExpression(schedule)) {
    return NextResponse.json({ ok: false, error: 'Cron expression is required (5 or 6 fields).' }, { status: 400 })
  }

  if (!command) {
    return NextResponse.json({ ok: false, error: 'Cron command/message is required.' }, { status: 400 })
  }

  if (DISALLOWED_COMMAND_PATTERN.test(command)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Command contains a disallowed high-risk pattern. Use a safe command/message.',
      },
      { status: 400 },
    )
  }

  const candidates = [
    {
      method: 'cron_create',
      params: {
        schedule,
        command,
      },
    },
    {
      method: 'cron_add',
      params: {
        cron: schedule,
        command,
      },
    },
    {
      method: 'schedule_create',
      params: {
        schedule,
        task: command,
      },
    },
    {
      method: 'crons_create',
      params: {
        expression: schedule,
        command,
      },
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
    action: 'cron-job-created',
    method: result.method,
    schedule,
    warnings: result.warnings,
  })
}

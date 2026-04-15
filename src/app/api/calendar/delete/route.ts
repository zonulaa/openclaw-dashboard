import { NextRequest, NextResponse } from 'next/server'
import { callMethodCandidates, sanitizeText } from '@/app/api/calendar/_gateway-cron'

type DeletePayload = {
  id?: string
  source?: string
  kind?: string
  schedule?: string
  command?: string
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as DeletePayload

  const source = sanitizeText(body.source, 20)
  if (source && source !== 'gateway') {
    return NextResponse.json(
      { ok: false, error: 'Only gateway-backed jobs can be deleted from this panel.' },
      { status: 400 },
    )
  }

  const kindRaw = sanitizeText(body.kind, 20).toLowerCase()
  const kind = kindRaw === 'reminder' ? 'reminder' : 'cron'

  const id = sanitizeText(body.id, 160)
  const schedule = sanitizeText(body.schedule, 120)
  const command = sanitizeText(body.command, 400)

  if (!id && !schedule && !command) {
    return NextResponse.json(
      { ok: false, error: 'A job reference is required (id or schedule/command).' },
      { status: 400 },
    )
  }

  const selector = {
    ...(id ? { id } : {}),
    ...(schedule ? { schedule } : {}),
    ...(command ? { command } : {}),
  }

  const candidates = kind === 'reminder'
    ? [
        {
          method: 'reminder_delete',
          params: selector,
        },
        {
          method: 'cron_delete_once',
          params: selector,
        },
        {
          method: 'schedule_delete',
          params: { ...selector, once: true },
        },
      ]
    : [
        {
          // Primary OpenClaw gateway cron delete — confirmed working method
          method: 'cron.remove',
          params: selector,
        },
        {
          method: 'cron.delete',
          params: selector,
        },
        {
          method: 'cron_delete',
          params: selector,
        },
        {
          method: 'cron_remove',
          params: selector,
        },
        {
          method: 'schedule_delete',
          params: selector,
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
    action: kind === 'reminder' ? 'reminder-deleted' : 'cron-job-deleted',
    method: result.method,
    warnings: result.warnings,
  })
}

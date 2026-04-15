import { NextResponse } from "next/server";
import { callGatewayMethod } from "@/lib/openclaw-gateway";

type RawCronJob = {
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string; tz?: string };
  payload?: {
    kind?: string;
    message?: string;
    model?: string;
    timeoutSeconds?: number;
  };
  state?: {
    lastRunStatus?: string;
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastStatus?: string;
  };
};

/** Convert a cron expression to a human-readable schedule label */
function humanizeCron(expr: string, tz?: string): string {
  if (!expr) return "Unknown schedule";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;

  const [min, hour, , , dow] = parts;

  // Common patterns
  if (dow === "*") {
    // Daily
    if (min !== "*" && hour !== "*") {
      const h = parseInt(hour);
      const m = parseInt(min);
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const tzLabel = tz ? ` (${tz})` : "";
      return `Daily at ${hh}:${mm}${tzLabel}`;
    }
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (dow !== "*" && min !== "*" && hour !== "*") {
    const dayNames = dow
      .split(",")
      .map((d) => days[parseInt(d)] ?? d)
      .join(", ");
    const h = parseInt(hour);
    const m = parseInt(min);
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const tzLabel = tz ? ` (${tz})` : "";
    return `${dayNames} at ${hh}:${mm}${tzLabel}`;
  }

  return expr;
}

export async function GET() {
  try {
    const result = (await callGatewayMethod("cron.list", {}, 10_000)) as
      | { jobs?: RawCronJob[] }
      | RawCronJob[]
      | null;

    const rawJobs: RawCronJob[] = Array.isArray(result)
      ? result
      : ((result as { jobs?: RawCronJob[] })?.jobs ?? []);

    const jobs = rawJobs.map((j) => ({
      id: j.id ?? "",
      name: j.name ?? "Unnamed",
      enabled: j.enabled ?? true,
      scheduleExpr: j.schedule?.expr ?? "",
      scheduleTz: j.schedule?.tz ?? "",
      scheduleHuman: humanizeCron(
        j.schedule?.expr ?? "",
        j.schedule?.tz
      ),
      model: j.payload?.model ?? null,
      payloadKind: j.payload?.kind ?? "unknown",
      lastRunStatus: j.state?.lastRunStatus ?? null,
      lastRunAtMs: j.state?.lastRunAtMs ?? null,
      nextRunAtMs: j.state?.nextRunAtMs ?? null,
      lastDurationMs: j.state?.lastDurationMs ?? null,
      consecutiveErrors: j.state?.consecutiveErrors ?? 0,
    }));

    return NextResponse.json({ ok: true, jobs });
  } catch (err) {
    return NextResponse.json({ ok: false, jobs: [], error: String(err) });
  }
}

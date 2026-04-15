import { NextResponse } from "next/server";
import { callGatewayMethod } from "@/lib/openclaw-gateway";

type RawCronJob = {
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: { kind?: string; expr?: string };
  payload?: { kind?: string; message?: string };
  state?: {
    lastRunStatus?: string;
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastDurationMs?: number;
  };
};

export async function GET() {
  try {
    const result = await callGatewayMethod("cron.list", {}, 10_000) as
      | { jobs?: RawCronJob[] }
      | RawCronJob[]
      | null;

    const rawJobs: RawCronJob[] = Array.isArray(result)
      ? result
      : (result as { jobs?: RawCronJob[] })?.jobs ?? [];

    const jobs = rawJobs.map((j) => ({
      id: j.id ?? "",
      name: j.name ?? "Unnamed",
      enabled: j.enabled ?? true,
      schedule: j.schedule?.expr ?? j.schedule?.kind ?? "",
      lastRunStatus: j.state?.lastRunStatus ?? null,
      lastRunAtMs: j.state?.lastRunAtMs ?? null,
      nextRunAtMs: j.state?.nextRunAtMs ?? null,
    }));

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json({ jobs: [], error: String(err) });
  }
}

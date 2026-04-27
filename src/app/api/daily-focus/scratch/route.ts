import { NextRequest, NextResponse } from "next/server";
import { readJsonFile, writeJsonFile } from "@/lib/local-data";

export const runtime = "nodejs";

const FILE_NAME = "daily-focus-scratch.json";

type DailyItem = {
  id: string;
  text: string;
  done: boolean;
  fromTaskId?: string;
  fromParentId?: string;
};

type DailyFocusFile = {
  items: DailyItem[];
};

const EMPTY: DailyFocusFile = { items: [] };

async function readFile(): Promise<DailyFocusFile> {
  const raw = await readJsonFile<Partial<DailyFocusFile>>(FILE_NAME, EMPTY);
  return { items: Array.isArray(raw.items) ? raw.items : [] };
}

async function writeFile(data: DailyFocusFile): Promise<void> {
  await writeJsonFile(FILE_NAME, data);
}

function makeId(): string {
  // Avoid pulling crypto.randomUUID dep so this works in any node version
  // the dashboard ships against.
  return `df-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const file = await readFile();
  return NextResponse.json(file);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<DailyItem>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const file = await readFile();
  const item: DailyItem = {
    id: makeId(),
    text,
    done: false,
    fromTaskId: typeof body.fromTaskId === "string" ? body.fromTaskId : undefined,
    fromParentId: typeof body.fromParentId === "string" ? body.fromParentId : undefined,
  };
  file.items.push(item);
  await writeFile(file);
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const file = await readFile();
  const before = file.items.length;
  file.items = file.items.filter((i) => i.id !== id);
  if (file.items.length !== before) await writeFile(file);
  return NextResponse.json({ ok: true });
}

// PATCH supports three shapes:
//   { id, done }         → toggle completion
//   { id, text }         → rename
//   { items: [...] }     → reorder (replaces the whole list, preserving each item's other fields)
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    done?: boolean;
    text?: string;
    items?: DailyItem[];
  };
  const file = await readFile();

  if (Array.isArray(body.items)) {
    // Reorder. Trust the client's ordering but keep server-side fields where present.
    const byId = new Map(file.items.map((i) => [i.id, i]));
    const next: DailyItem[] = [];
    for (const incoming of body.items) {
      if (!incoming || typeof incoming.id !== "string") continue;
      const existing = byId.get(incoming.id);
      if (existing) {
        next.push(existing);
        byId.delete(incoming.id);
      }
    }
    file.items = next;
    await writeFile(file);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id === "string") {
    const idx = file.items.findIndex((i) => i.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (typeof body.done === "boolean") {
      file.items[idx].done = body.done;
    }
    if (typeof body.text === "string") {
      const trimmed = body.text.trim();
      if (trimmed) file.items[idx].text = trimmed;
    }
    await writeFile(file);
    return NextResponse.json(file.items[idx]);
  }

  return NextResponse.json({ error: "id or items required" }, { status: 400 });
}

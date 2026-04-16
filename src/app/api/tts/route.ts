import { NextRequest, NextResponse } from "next/server";
import { exec } from "node:child_process";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

// TTS endpoint — tries edge-tts (Python) first, returns audio/mpeg.
// If edge-tts is not installed, returns a JSON hint to use browser TTS fallback.
// POST { text: string, voice?: string }

const DEFAULT_VOICE = process.env.TTS_VOICE || "id-ID-ArdiNeural"; // Indonesian voice

function runEdgeTts(text: string, voice: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Escape single quotes in text for shell safety
    const safeText = text.replace(/'/g, "'\\''");
    const cmd = `edge-tts --voice "${voice}" --text '${safeText}' --write-media "${outPath}"`;
    exec(cmd, { timeout: 15000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve();
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text;
    const voice: string = body.voice || DEFAULT_VOICE;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { ok: false, error: "text is required" },
        { status: 400 },
      );
    }

    // Limit text length to prevent abuse
    const trimmed = text.slice(0, 2000);

    const tmpFile = join(tmpdir(), `tts-${randomUUID()}.mp3`);

    try {
      await runEdgeTts(trimmed, voice, tmpFile);
      const audioData = await readFile(tmpFile);
      // Clean up temp file
      unlink(tmpFile).catch(() => {});

      return new NextResponse(audioData, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      // edge-tts not available — tell the client to use browser TTS
      return NextResponse.json(
        { ok: false, fallback: "browser", error: "edge-tts not available, use browser SpeechSynthesis" },
        { status: 501 },
      );
    }
  } catch (err) {
    console.error("[/api/tts] Error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}

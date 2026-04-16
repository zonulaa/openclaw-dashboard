import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Chat proxy endpoint for voice chat and text chat.
// Forwards messages to the configured LLM API (GLM/Gemini/OpenAI-compatible).
// Expects: POST { messages: Array<{role: string, content: string}> }
// Returns: { ok: boolean, reply: string }

const LLM_API_URL =
  process.env.LLM_API_URL ||
  process.env.OPENAI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai";

const LLM_API_KEY =
  process.env.LLM_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  "";

const LLM_MODEL =
  process.env.LLM_MODEL ||
  process.env.OPENAI_MODEL ||
  "gemini-2.0-flash";

const SYSTEM_PROMPT =
  process.env.VOICE_CHAT_SYSTEM_PROMPT ||
  "You are a helpful AI assistant. Respond concisely and naturally, as this is a voice conversation. Keep responses under 3 sentences unless the user asks for detail.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "messages array is required" },
        { status: 400 },
      );
    }

    if (!LLM_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "LLM API key not configured. Set LLM_API_KEY env var." },
        { status: 500 },
      );
    }

    // Build OpenAI-compatible request
    const apiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const res = await fetch(`${LLM_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: apiMessages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[/api/chat] LLM error:", res.status, errText);
      return NextResponse.json(
        { ok: false, error: `LLM API error: ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const reply =
      data.choices?.[0]?.message?.content?.trim() || "[No response]";

    return NextResponse.json({ ok: true, reply });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}

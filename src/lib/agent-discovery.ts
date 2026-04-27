// Discover installed OpenClaw agents by scanning ~/.openclaw/agents/.
//
// The dashboard ships to students who clone it locally, run `npm run dev`,
// and expect every agent they've installed via OpenClaw to show up
// automatically — no hardcoded list of "main / community / claude-code"
// (that's the dashboard author's personal install).
//
// Convention: each subdirectory of ~/.openclaw/agents/ is treated as one
// agent. The directory name IS the agent id (e.g. ~/.openclaw/agents/lena
// → agent id "lena", session keys begin with "agent:lena:..."). This
// matches what `openclaw agents create` writes on disk.

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export const HOME = process.env.HOME ?? "/Users/user";
export const AGENTS_BASE = join(HOME, ".openclaw/agents");

export type AgentInfo = {
  id: string;
  /** Filesystem dir name; in practice equals id. Kept separate in case future installs map differently. */
  dir: string;
  label: string;
  emoji: string;
};

const EMOJI_BY_ID: Record<string, string> = {
  main: "\u{1F9A5}", // sloth — main orchestrator
  community: "\u{1F4AC}",
  claude: "\u{1F4BB}",
  "claude-code": "\u{1F4BB}",
};

const LABEL_BY_ID: Record<string, string> = {
  main: "Main",
  community: "Community",
  claude: "Claude Code / ACP",
  "claude-code": "Claude Code / ACP",
};

function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Read ~/.openclaw/agents/ and return one AgentInfo per subdirectory.
 *
 * - Skips dotfiles and non-directories.
 * - Sorts so "main" comes first, then alphabetical.
 * - Returns [] if AGENTS_BASE doesn't exist (fresh install before any agent
 *   is created); callers should treat empty as a valid "no agents yet" state.
 */
export async function discoverInstalledAgents(): Promise<AgentInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(AGENTS_BASE);
  } catch {
    return [];
  }

  const found: AgentInfo[] = [];
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const safeId = entry.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeId) continue;
    try {
      const s = await stat(join(AGENTS_BASE, entry));
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }
    found.push({
      id: safeId,
      dir: entry,
      label: LABEL_BY_ID[safeId] ?? titleCase(safeId),
      emoji: EMOJI_BY_ID[safeId] ?? "\u{1F916}",
    });
  }

  found.sort((a, b) => {
    if (a.id === "main") return -1;
    if (b.id === "main") return 1;
    return a.id.localeCompare(b.id);
  });

  return found;
}

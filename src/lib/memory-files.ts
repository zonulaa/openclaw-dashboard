import { promises as fs } from "node:fs";
import path from "node:path";
import { getMemoryRoot, getWorkspaceRoot } from "@/lib/workspace";

const DAILY_MEMORY_RE = /^memory\/[^/]+\.md$/;

// Skills SKILL.md files — absolute paths allowed from these roots
const ALLOWED_SKILL_ROOTS = [
  "/Users/user/.openclaw/workspace/skills",
  "/opt/homebrew/lib/node_modules/openclaw/skills",
];

const WORKSPACE_ROOT_FILES = new Set([
  "MEMORY.md",
  "SOUL.md",
  "HEARTBEAT.md",
  "AGENTS.md",
  "USER.md",
  "TOOLS.md",
  "IDENTITY.md",
]);

function isAllowedSkillPath(absPath: string): boolean {
  return ALLOWED_SKILL_ROOTS.some((root) => absPath.startsWith(root)) &&
    absPath.endsWith("SKILL.md");
}

export function normalizeMemoryDocPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Accept absolute workspace paths like /Users/user/.openclaw/workspace/SOUL.md
  const workspaceRoot = getWorkspaceRoot();
  if (trimmed.startsWith(workspaceRoot)) {
    const rel = trimmed.slice(workspaceRoot.length).replace(/^\//, "");
    if (WORKSPACE_ROOT_FILES.has(rel) || DAILY_MEMORY_RE.test(rel)) return rel;
    // Allow skills under workspace
    if (isAllowedSkillPath(trimmed)) return trimmed;
    return null;
  }

  // Allow bundled skills (outside workspace root)
  if (isAllowedSkillPath(trimmed)) return trimmed;

  const normalized = trimmed.replace(/\\/g, "/").replace(/^\.\//, "");
  if (WORKSPACE_ROOT_FILES.has(normalized)) return normalized;
  if (DAILY_MEMORY_RE.test(normalized)) return normalized;
  return null;
}

export function resolveAllowedMemoryDocPath(relativePath: string): string | null {
  const normalized = normalizeMemoryDocPath(relativePath);
  if (!normalized) return null;

  // Absolute paths (skills) — return as-is
  if (path.isAbsolute(normalized)) return normalized;

  if (WORKSPACE_ROOT_FILES.has(normalized)) {
    return path.join(getWorkspaceRoot(), normalized);
  }

  const fileName = path.basename(normalized);
  return path.join(getMemoryRoot(), fileName);
}

export async function listAllowedMemoryDocPaths(): Promise<string[]> {
  const workspaceRoot = getWorkspaceRoot();
  const memoryRoot = getMemoryRoot();
  const files: string[] = [path.join(workspaceRoot, "MEMORY.md")];

  try {
    const daily = await fs.readdir(memoryRoot);
    const dailyMd = daily.filter((name) => name.endsWith(".md"));
    files.push(...dailyMd.map((name) => path.join(memoryRoot, name)));
  } catch {
    // memory folder optional
  }

  return files;
}

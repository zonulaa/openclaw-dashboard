import { promises as fs } from "node:fs";
import path from "node:path";
import { readJsonFile } from "@/lib/local-data";
import { readTaskBoardData } from "@/lib/task-board";
import type { ContentItem } from "@/lib/content-pipeline";

// ─── Types ──────────────────────────────────────────────────────────────────

type GoalStatus = "active" | "planning" | "idea" | "done";

type GoalStep = {
  step?: number;
  text: string;
  taskId?: string;
  done?: boolean;
};

type Goal = {
  id: string;
  title: string;
  emoji: string;
  status: GoalStatus;
  description: string;
  nextSteps: (string | GoalStep)[];
  tags: string[];
  postedCount?: number;
  [key: string]: unknown;
};

type GoalsData = { goals: Goal[] };

type ContentPipelineData = {
  items: ContentItem[];
  attachments: unknown[];
};

// ─── Paths ───────────────────────────────────────────────────────────────────

const GOALS_PATH = path.join(process.cwd(), ".data/goals.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readGoals(): Promise<GoalsData> {
  try {
    const raw = await fs.readFile(GOALS_PATH, "utf8");
    return JSON.parse(raw) as GoalsData;
  } catch {
    return { goals: [] };
  }
}

async function writeGoals(data: GoalsData): Promise<void> {
  await fs.writeFile(GOALS_PATH, JSON.stringify(data, null, 2), "utf8");
}

// Video channels — used to count posted video content toward show-work-monetize
const VIDEO_CHANNELS = new Set(["tiktok", "youtube", "instagram"]);

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Sync goal steps with task board statuses, and update show-work-monetize
 * postedCount from the content pipeline.
 *
 * Returns { updated: number } — how many goal steps changed their `done` flag.
 */
export async function syncGoalsWithTasks(): Promise<{ updated: number }> {
  // Read all data sources in parallel
  const [goalsData, taskBoardData, contentData] = await Promise.all([
    readGoals(),
    readTaskBoardData(),
    readJsonFile<ContentPipelineData>("content-pipeline.json", { items: [], attachments: [] }),
  ]);

  // Build a quick task lookup map: id → status
  const taskStatusMap = new Map<string, string>(
    taskBoardData.tasks.map((t) => [t.id, t.status]),
  );

  // Count posted video content items
  const postedVideoCount = contentData.items.filter(
    (item) => item.stage === "posted" && VIDEO_CHANNELS.has(item.channel),
  ).length;

  let updatedCount = 0;

  const updatedGoals = goalsData.goals.map((goal) => {
    let goalChanged = false;

    // Update nextSteps based on task statuses
    const updatedSteps = goal.nextSteps.map((step) => {
      // String steps have no taskId — leave them alone
      if (typeof step === "string") return step;

      const { taskId } = step;
      if (!taskId) return step;

      const taskStatus = taskStatusMap.get(taskId);
      if (taskStatus === undefined) return step; // task not found — don't touch it

      const newDone = taskStatus === "done";
      if (step.done !== newDone) {
        updatedCount++;
        goalChanged = true;
        return { ...step, done: newDone };
      }
      return step;
    });

    // Update postedCount for show-work-monetize goal
    if (goal.id === "show-work-monetize") {
      if (goal.postedCount !== postedVideoCount) {
        goalChanged = true;
      }
      return {
        ...goal,
        nextSteps: updatedSteps,
        postedCount: postedVideoCount,
      };
    }

    if (goalChanged) {
      return { ...goal, nextSteps: updatedSteps };
    }
    return goal;
  });

  await writeGoals({ goals: updatedGoals });

  return { updated: updatedCount };
}

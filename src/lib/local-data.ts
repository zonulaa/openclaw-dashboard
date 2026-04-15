import { promises as fs } from "fs";
import path from "path";

const baseDir = path.join(process.cwd(), ".data");

async function ensureBaseDir() {
  await fs.mkdir(baseDir, { recursive: true });
}

export async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  await ensureBaseDir();
  const fullPath = path.join(baseDir, fileName);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      await writeJsonFile(fileName, fallback);
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile<T>(fileName: string, data: T): Promise<void> {
  await ensureBaseDir();
  const fullPath = path.join(baseDir, fileName);
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), "utf8");
}

export async function ensureUploadsDir(): Promise<string> {
  const uploadDir = path.join(baseDir, "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

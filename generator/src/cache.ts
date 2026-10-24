import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
// README_CACHE_DIR lets tests point at a throwaway dir so runs never touch the committed cache.
export const CACHE_DIR = process.env.README_CACHE_DIR
  ? resolve(process.env.README_CACHE_DIR)
  : resolve(here, "..", ".cache");

function pathFor(key: string): string {
  // basename() strips any path traversal; keys are flat filenames.
  return join(CACHE_DIR, `${basename(key)}.json`);
}

export function readCache<T>(key: string): T | null {
  try {
    const p = pathFor(key);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(pathFor(key), JSON.stringify(value, null, 2), "utf8");
  } catch {
    /* cache write failures are non-fatal */
  }
}

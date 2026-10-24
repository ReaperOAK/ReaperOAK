import { defineConfig } from "vitest/config";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Tests write to a throwaway cache dir, never the committed generator/.cache.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { README_CACHE_DIR: join(tmpdir(), "roak-readme-test-cache") },
    // Every adapter test clears that one shared cache dir in beforeEach, so files
    // running in parallel delete each other's fixtures mid-test. The suite runs in
    // well under a second — sequential files cost nothing and remove the race.
    fileParallelism: false,
  },
});

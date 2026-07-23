import { defineConfig } from "vitest/config";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Tests write to a throwaway cache dir, never the committed generator/.cache.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { README_CACHE_DIR: join(tmpdir(), "roak-readme-test-cache") },
  },
});

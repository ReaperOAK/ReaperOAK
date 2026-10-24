import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { getGithubSnapshot } from "./data/github.js";
import { getWakatime } from "./data/wakatime.js";
import { getLeetcode } from "./data/leetcode.js";
import { getNeetcode } from "./data/neetcode.js";
import { checkUptime } from "./data/uptime.js";
import { getFeed } from "./data/feed.js";
import { computeLanguageShares } from "./data/languages.js";
import { rankRepos } from "./data/ranking.js";
import { getDynamicFields } from "./llm/prompts.js";
import { assemble, writeOutputs } from "./assemble.js";
import { content } from "./content.js";
import type { Snapshot } from "./panels/types.js";

async function main(): Promise<void> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const root = resolve(here, "..", ".."); // repo root (generator/src → repo)
  const config = loadConfig();

  // Independent network calls run concurrently; only the LLM step needs github first.
  const [github, waka, leetcode, neetcode, uptime, feed] = await Promise.all([
    getGithubSnapshot(config),
    getWakatime(config),
    getLeetcode(config),
    getNeetcode(config),
    checkUptime(config),
    getFeed(config),
  ]);
  const fields = await getDynamicFields(config, github);
  const todayISO = new Date().toISOString();

  const ctx: Snapshot = {
    github,
    fields,
    languages: computeLanguageShares(github.repos, todayISO),
    featured: rankRepos(github.repos, {
      todayISO,
      pins: content.featuredPins,
      blocks: content.featuredBlocks,
      limit: 6,
    }),
    waka,
    leetcode,
    neetcode,
    uptime,
    feed,
    syncedAt: github.fetchedAt,
  };

  const built = assemble(ctx);
  writeOutputs(root, built);
  console.log("README generated:", Object.keys(built.assets).join(", "));
}

main().catch((err) => { console.error(err); process.exit(1); });

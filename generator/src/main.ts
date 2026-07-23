import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { getGithubSnapshot } from "./data/github.js";
import { getDynamicFields } from "./llm/prompts.js";
import { assemble, writeOutputs } from "./assemble.js";

async function main(): Promise<void> {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const root = resolve(here, "..", ".."); // repo root (generator/src → repo)
  const config = loadConfig();
  const snap = await getGithubSnapshot(config);
  const fields = await getDynamicFields(config, snap);
  const built = assemble(fields, snap);
  writeOutputs(root, built);
  console.log("README generated:", Object.keys(built.assets).join(", "));
}

main().catch((err) => { console.error(err); process.exit(1); });

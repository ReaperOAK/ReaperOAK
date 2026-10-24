import type { MarkdownPanel } from "../types.js";
import { content } from "../../content.js";
import type { StatNumber } from "../../types.js";

export const numbersPanel: MarkdownPanel<StatNumber[]> = {
  id: "numbers",
  kind: "markdown",
  select: () => (content.numbers.length ? content.numbers : null),
  render: (nums) => `<!-- section:numbers -->
### Selected numbers

${nums.map((n) => `\`${n.value}\` ${n.label}`).join("  ·  ")}`,
};

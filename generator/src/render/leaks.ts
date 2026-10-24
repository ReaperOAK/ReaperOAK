/** Text that means a template token or a stringified JS value leaked into the output.
 *  Untrusted text is checked against this where it enters the README, and each site drops or
 *  blanks the offender instead of printing it:
 *    - llm/prompts.ts   isSafeLlmText, which covers LLM replies (sanitizeLine, sanitizeBullets)
 *                       and the cached copies of them (strField, strArray)
 *    - data/feed.ts     parseFeed and the feed cache read, on an item's title and url
 *    - panels/md/featured.ts  ranked GitHub repos: name, url and stack (repo dropped),
 *                       description (blanked)
 *  validateReadme (assemble.ts) is the last gate and enforces the whole pattern on the finished
 *  page, so a leak a source missed fails the build instead of reaching GitHub. Sources should
 *  still call it: it lets them drop one bad item rather than lose the whole page. Deliberately
 *  has no `g` flag: a global regex keeps `lastIndex` between `.test()` calls and would give
 *  alternating answers. */
export const LEAK_PATTERN = /\{\{|\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/;

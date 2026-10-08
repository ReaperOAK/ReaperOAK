/** Text that means a template token or a stringified JS value leaked into the output.
 *  Every untrusted string headed for the README (LLM replies, feed items, cache rows) is
 *  checked against this, and validateReadme rejects the whole file on a match — so one stray
 *  "NaN" in a bullet would fail the daily refresh. Deliberately has no `g` flag: a global
 *  regex keeps `lastIndex` between `.test()` calls and would give alternating answers. */
export const LEAK_PATTERN = /\{\{|\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/;

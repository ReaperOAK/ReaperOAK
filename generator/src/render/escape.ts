const ESCAPES: Record<string, string> = { "<": "&lt;", ">": "&gt;" };

/** The one escape for untrusted text that lands inside inline markdown: a link's text
 *  (`[text](url)`) or a table cell. Used by every panel that prints feed or GitHub text.
 *
 *  - Whitespace runs (newlines, `\r`, tabs, unicode spaces) collapse to one space, so the text
 *    can never start a heading, rule, list or a new table row, or end the line the link sits on.
 *  - `<` `>` become entities, so it cannot open an html tag.
 *  - `[` `]` and `\` are backslash-escaped so it cannot close the link early (an unescaped
 *    backslash would defeat the bracket escapes).
 *  - `|` is backslash-escaped, which a table cell requires and which renders as a plain `|`
 *    everywhere else. */
export function escapeMd(s: string): string {
  return s.replace(/\s+/g, " ").trim()
    .replace(/[<>[\]\\|]/g, (c) => ESCAPES[c] ?? `\\${c}`);
}

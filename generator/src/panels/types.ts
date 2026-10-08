import type { Tokens } from "../render/svg-util.js";
import type { DynamicFields, GithubSnapshot } from "../types.js";
import type { LanguageShare, RankedRepo, WakaSnapshot, LeetcodeSnapshot,
  NeetcodeSnapshot, UptimeResult, FeedItem } from "../types.js";

/** A rectangle a panel draws inside. The composer decides x/y; the panel never does. */
export interface Box { x: number; y: number; w: number; h: number; }

/** Everything a panel may read. Null on a field means that source had nothing to say. */
export interface Snapshot {
  github: GithubSnapshot;
  languages: LanguageShare[] | null;
  featured: RankedRepo[] | null;
  waka: WakaSnapshot | null;
  leetcode: LeetcodeSnapshot | null;
  neetcode: NeetcodeSnapshot | null;
  uptime: UptimeResult[] | null;
  feed: FeedItem[] | null;
  /** ISO timestamp of the DATA, not of the run. Cached data keeps its original fetch time. */
  syncedAt: string;
  fields: DynamicFields;
}

export interface SvgPanel<D> {
  id: string;
  kind: "svg";
  size: { w: number; h: number };
  /** Return null to omit this panel entirely. */
  select(ctx: Snapshot): D | null;
  render(d: D, t: Tokens, box: Box): string;
}

export interface MarkdownPanel<D> {
  id: string;
  kind: "markdown";
  /** Return null to omit this panel entirely. */
  select(ctx: Snapshot): D | null;
  render(d: D, ctx: Snapshot): string;
}

export type Panel = SvgPanel<any> | MarkdownPanel<any>;

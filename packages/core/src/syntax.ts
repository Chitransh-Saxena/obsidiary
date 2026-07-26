/**
 * Obsidian inline syntax parsing — wikilinks, embeds, tags, block anchors.
 *
 * Kept as pure string functions so both the remark plugins and the indexer can
 * share exactly one interpretation of the syntax. Two parsers that disagree
 * about what `[[a#b|c]]` means is how link graphs drift out of sync with the
 * rendered HTML.
 */

import type { ParsedWikilink, Subpath } from './types.js';

/**
 * Matches `[[target]]` and `![[target]]`.
 *
 * The inner group rejects `]` so an unclosed link can't swallow the rest of the
 * line, and rejects newlines so it can't span paragraphs.
 */
export const WIKILINK_RE = /(!?)\[\[([^\]\n]+)\]\]/g;

/**
 * A tag: `#tag`, `#nested/tag`.
 *
 * Requires a non-word character (or start of string) before the `#` so URL
 * fragments like `example.com#top` and markdown headings don't match, and
 * requires at least one non-digit so `#1` (an issue reference) is not a tag.
 */
export const TAG_RE = /(^|[^\w`/#])#([\wÀ-￿/_-]*[A-Za-zÀ-￿_-][\wÀ-￿/_-]*)/g;

/** A trailing block anchor: `... some text ^block-id` at end of line. */
export const BLOCK_ANCHOR_RE = /(?:^|\s)\^([A-Za-z0-9][A-Za-z0-9-]*)\s*$/;

/**
 * Split the inside of a wikilink into target, subpath and alias.
 *
 * Order matters and is not obvious: the alias is split on the *first* `|` (so
 * aliases may contain `#`), then the subpath on the *first* `#` of what remains
 * (so targets may not contain `#`, which matches Obsidian).
 */
export function parseWikilinkBody(body: string, embed: boolean, raw: string): ParsedWikilink {
  let rest = body;
  let alias: string | undefined;

  const pipe = rest.indexOf('|');
  if (pipe !== -1) {
    alias = rest.slice(pipe + 1).trim();
    rest = rest.slice(0, pipe);
  }

  let subpath: Subpath | undefined;
  const hash = rest.indexOf('#');
  if (hash !== -1) {
    const rawSub = rest.slice(hash + 1);
    rest = rest.slice(0, hash);
    subpath = parseSubpath(rawSub);
  }

  const link: ParsedWikilink = { target: rest.trim(), embed, raw };
  if (subpath) link.subpath = subpath;
  if (alias !== undefined && alias !== '') link.alias = alias;
  return link;
}

function parseSubpath(rawSub: string): Subpath {
  if (rawSub.startsWith('^')) {
    return { kind: 'block', segments: [rawSub.slice(1).trim()], raw: rawSub };
  }
  // `#A#B` addresses a heading nested under another heading.
  const segments = rawSub.split('#').map((s) => s.trim()).filter(Boolean);
  return { kind: 'heading', segments, raw: rawSub };
}

/** Find every wikilink in a string, in source order. */
export function findWikilinks(text: string): ParsedWikilink[] {
  const out: ParsedWikilink[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) {
    const [raw, bang, body] = m;
    if (body === undefined) continue;
    const link = parseWikilinkBody(body, bang === '!', raw);
    link.offset = m.index ?? 0;
    out.push(link);
  }
  return out;
}

/** Find every tag in a string, deduped, without the leading `#`. */
export function findTags(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) {
    const tag = m[2];
    if (tag) seen.add(tag.replace(/\/+$/, ''));
  }
  return [...seen];
}

/**
 * Image embed dimensions: `![[img.png|300]]` or `![[img.png|300x200]]`.
 * Returns null when the alias is ordinary link text rather than a size.
 */
export function parseEmbedSize(alias: string | undefined): { width: number; height?: number } | null {
  if (!alias) return null;
  const m = /^(\d+)(?:x(\d+))?$/.exec(alias.trim());
  if (!m || !m[1]) return null;
  const size: { width: number; height?: number } = { width: Number(m[1]) };
  if (m[2]) size.height = Number(m[2]);
  return size;
}

/**
 * Parsing a single markdown file into a `Note` — everything that can be known
 * without seeing the rest of the vault. Link *resolution* happens later, in
 * `vault.ts`, once every note is known.
 */

import GithubSlugger from 'github-slugger';
import { canvasLinks, parseCanvas } from './canvas.js';
import { normalizeAliases, normalizeFrontmatterTags, splitFrontmatter } from './frontmatter.js';
import { basename, dirname, stripExt } from './paths.js';
import { noteSlug, slugToUrl } from './slug.js';
import { BLOCK_ANCHOR_RE, findTags, findWikilinks } from './syntax.js';
import type { BlockAnchor, Heading, Note, ParsedWikilink, VaultFile, VaultOptions } from './types.js';

/**
 * Blank out fenced code blocks. Both the line count *and* every line's length
 * are preserved, so line numbers and character offsets computed from the masked
 * text still address the original body. `[[not a link]]` inside a code fence
 * must not end up in the graph.
 */
function maskCodeFences(body: string): string {
  const lines = body.split('\n');
  let fence: string | null = null;

  return lines
    .map((line) => {
      const blank = ' '.repeat(line.length);
      const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (fence === null) {
        if (open && open[1]) {
          fence = open[1][0] === '`' ? '`' : '~';
          return blank;
        }
        return line;
      }
      // Inside a fence: look for a closing run of the same character.
      if (open && open[1] && open[1][0] === fence) fence = null;
      return blank;
    })
    .join('\n');
}

/**
 * Blank inline code spans, preserving length and newlines so every offset and
 * line number computed from the masked text still points at the right place.
 *
 * The renderer gets this for free — mdast has already split `inlineCode` into
 * its own node type. The indexer works on raw text, so without this a note that
 * merely *documents* `[[wikilink]]` syntax fills the graph with phantom broken
 * links, and the graph stops agreeing with the rendered page.
 */
function maskInlineCode(text: string): string {
  return text.replace(/(`+)(?:(?!\1)[\s\S])*?\1/g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Additionally blank wikilinks and link destinations, for tag scanning. */
function maskForTags(masked: string): string {
  return masked
    .replace(/!?\[\[[^\]\n]*\]\]/g, '')
    .replace(/\]\([^)\n]*\)/g, '](')
    .replace(/<[^>\n]+>/g, '');
}

function extractHeadings(masked: string, bodyStartLine: number): Heading[] {
  const slugger = new GithubSlugger();
  const out: Heading[] = [];
  const lines = masked.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m || !m[1] || m[2] === undefined) continue;
    const text = m[2].trim();
    if (!text) continue;
    out.push({
      depth: m[1].length,
      text,
      slug: slugger.slug(text),
      line: bodyStartLine + i,
    });
  }
  return out;
}

function extractBlocks(masked: string, bodyStartLine: number): BlockAnchor[] {
  const out: BlockAnchor[] = [];
  const lines = masked.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const m = BLOCK_ANCHOR_RE.exec(lines[i] ?? '');
    if (m && m[1]) out.push({ id: m[1], line: bodyStartLine + i });
  }
  return out;
}

/** Standard markdown links that point somewhere inside the vault. */
function extractMarkdownLinks(masked: string): ParsedWikilink[] {
  const out: ParsedWikilink[] = [];
  const re = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const m of masked.matchAll(re)) {
    const [raw, bang, text, href] = m;
    if (!href) continue;
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) continue;

    const hashAt = href.indexOf('#');
    const target = hashAt === -1 ? href : href.slice(0, hashAt);
    const link: ParsedWikilink = { target, embed: bang === '!', raw: raw ?? '', offset: m.index ?? 0 };
    if (text) link.alias = text;
    if (hashAt !== -1) {
      const rawSub = href.slice(hashAt + 1);
      link.subpath = rawSub.startsWith('^')
        ? { kind: 'block', segments: [rawSub.slice(1)], raw: rawSub }
        : { kind: 'heading', segments: [rawSub], raw: rawSub };
    }
    out.push(link);
  }
  return out;
}

export interface ParsedNote extends Omit<Note, 'links'> {
  /** Links as written, not yet resolved. */
  rawLinks: ParsedWikilink[];
}

export function parseNote(file: VaultFile, options: VaultOptions = {}): ParsedNote {
  const raw = file.content ?? '';
  const { data: frontmatter, body, bodyStartLine } = splitFrontmatter(raw);

  // Headings and block anchors are line-oriented, so they only need fences
  // blanked. Links and tags must also ignore inline code.
  const masked = maskCodeFences(body);
  const maskedCode = maskInlineCode(masked);

  const aliases = normalizeAliases(frontmatter);
  const bodyTags = findTags(maskForTags(maskedCode));
  const tags = [...new Set([...normalizeFrontmatterTags(frontmatter), ...bodyTags])];

  const slug = noteSlug(file.path, frontmatter);
  const base = options.base ?? '';
  const bname = basename(stripExt(file.path));

  const note: ParsedNote = {
    kind: 'markdown',
    path: file.path,
    slug,
    url: slugToUrl(slug, { base }),
    basename: bname,
    folder: dirname(file.path),
    title: typeof frontmatter.title === 'string' && frontmatter.title.trim() ? frontmatter.title.trim() : bname,
    body,
    frontmatter,
    aliases,
    tags,
    headings: extractHeadings(masked, bodyStartLine),
    blocks: extractBlocks(masked, bodyStartLine),
    rawLinks: [...findWikilinks(maskedCode), ...extractMarkdownLinks(maskedCode)],
  };
  if (file.content === undefined) note.body = '';
  return note;
}

/**
 * A `.canvas` file as a note. Returns null when the JSON is unusable, so a
 * corrupt canvas drops out of the build rather than breaking it.
 */
export function parseCanvasNote(file: VaultFile, options: VaultOptions = {}): ParsedNote | null {
  const raw = file.content ?? '';
  const doc = parseCanvas(raw);
  if (!doc) return null;

  const bname = basename(stripExt(file.path));
  const slug = noteSlug(file.path);
  const tags = [
    ...new Set(
      doc.nodes.flatMap((node) => (node.type === 'text' ? findTags(node.text) : [])),
    ),
  ];

  return {
    kind: 'canvas',
    path: file.path,
    slug,
    url: slugToUrl(slug, { base: options.base ?? '' }),
    basename: bname,
    folder: dirname(file.path),
    title: bname,
    body: raw,
    frontmatter: {},
    aliases: [],
    tags,
    headings: [],
    blocks: [],
    rawLinks: canvasLinks(doc),
  };
}

export { maskCodeFences };

/**
 * Search: index builder plus a ranked matcher.
 *
 * Hand-rolled and dependency-free for two reasons. It has to run in the browser
 * unchanged for M3's live mode, and a command palette lives or dies on ranking
 * that understands *what* matched — an exact title beats a body mention no
 * matter what a generic BM25 score says.
 */

import { canvasText, parseCanvas } from './canvas.js';
import { summarize, toSearchText } from './excerpt.js';
import type { Note, VaultIndex } from './types.js';

/** Markdown for indexing purposes — for a canvas, its node text rather than its JSON. */
function indexableBody(note: Note): string {
  if (note.kind !== 'canvas') return note.body;
  const doc = parseCanvas(note.body);
  return doc ? canvasText(doc) : '';
}

export interface SearchDoc {
  path: string;
  url: string;
  title: string;
  aliases: string[];
  tags: string[];
  headings: string[];
  /** Plain-text body, truncated. */
  text: string;
  /** Short preview for the palette. */
  summary: string;
}

export type HitKind = 'title' | 'alias' | 'heading' | 'tag' | 'text' | 'fuzzy';

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  kind: HitKind;
  /** Body context around the match, when the match was in the body. */
  snippet?: string;
  /** The heading that matched, when the match was in a heading. */
  heading?: string;
}

export interface BuildSearchOptions {
  /**
   * Cap on indexed body characters per note. The whole index ships to the
   * browser as one JSON file, so an unbounded vault would mean a multi-megabyte
   * download before the first keystroke.
   */
  maxTextChars?: number;
}

export function buildSearchIndex(index: VaultIndex, options: BuildSearchOptions = {}): SearchDoc[] {
  const { maxTextChars = 8000 } = options;

  return index.order.flatMap((path) => {
    const note = index.notes[path];
    if (!note) return [];
    const source = indexableBody(note);
    const text = toSearchText(source);
    return [
      {
        path: note.path,
        url: note.url,
        title: note.title,
        aliases: note.aliases,
        tags: note.tags,
        headings: note.headings.map((h) => h.text),
        text: text.length > maxTextChars ? text.slice(0, maxTextChars) : text,
        summary: summarize(source),
      },
    ];
  });
}

/** Lowercase and strip diacritics, so `cafe` finds `café`. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 100 exact · 80 prefix · 60 word-start · 40 substring · 0 miss. */
function scoreField(field: string, term: string): number {
  if (!field) return 0;
  const f = normalize(field);
  if (f === term) return 100;
  if (f.startsWith(term)) return 80;
  if (new RegExp(`\\b${escapeRegExp(term)}`).test(f)) return 60;
  if (f.includes(term)) return 40;
  return 0;
}

function bestOf(fields: string[], term: string): number {
  let best = 0;
  for (const field of fields) {
    const s = scoreField(field, term);
    if (s > best) best = s;
    if (best === 100) break;
  }
  return best;
}

/** Typo tolerance: are `term`'s characters in order within `field`? */
function isSubsequence(field: string, term: string): boolean {
  const f = normalize(field);
  let i = 0;
  for (const ch of f) {
    if (ch === term[i]) i++;
    if (i === term.length) return true;
  }
  return term.length === 0;
}

const WEIGHTS = { title: 3, alias: 2.4, heading: 1.6, tag: 1.5, text: 1 } as const;

export interface SearchOptions {
  limit?: number;
  /** Include body-text matches. Off makes the palette title-only and much faster. */
  includeBody?: boolean;
}

export function search(docs: SearchDoc[], query: string, options: SearchOptions = {}): SearchHit[] {
  const { limit = 20, includeBody = true } = options;
  const q = normalize(query).trim();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];

  for (const doc of docs) {
    let total = 0;
    let bestKind: HitKind = 'text';
    let bestTermScore = -1;
    let matchedHeading: string | undefined;
    let matchedTerm: string | undefined;
    let ok = true;

    for (const term of terms) {
      const scores: Array<[HitKind, number]> = [
        ['title', scoreField(doc.title, term) * WEIGHTS.title],
        ['alias', bestOf(doc.aliases, term) * WEIGHTS.alias],
        ['heading', bestOf(doc.headings, term) * WEIGHTS.heading],
        ['tag', bestOf(doc.tags, term) * WEIGHTS.tag],
      ];
      if (includeBody) {
        scores.push(['text', scoreField(doc.text, term) * WEIGHTS.text]);
      }

      let termBest = 0;
      let termKind: HitKind = 'text';
      for (const [kind, score] of scores) {
        if (score > termBest) {
          termBest = score;
          termKind = kind;
        }
      }

      // Every term must land somewhere, or the document isn't a match at all.
      if (termBest === 0) {
        if (terms.length === 1 && isSubsequence(doc.title, term)) {
          termBest = 25;
          termKind = 'fuzzy';
        } else {
          ok = false;
          break;
        }
      }

      total += termBest;
      if (termBest > bestTermScore) {
        bestTermScore = termBest;
        bestKind = termKind;
        matchedTerm = term;
        if (termKind === 'heading') {
          matchedHeading = doc.headings.find((h) => scoreField(h, term) > 0);
        }
      }
    }

    if (!ok || total === 0) continue;

    // Nudge shorter titles up: between two equal matches, the more specific note
    // is almost always the one with the tighter name.
    total += Math.max(0, 24 - doc.title.length) * 0.4;

    const hit: SearchHit = { doc, score: total, kind: bestKind };
    if (bestKind === 'heading' && matchedHeading) hit.heading = matchedHeading;
    if (bestKind === 'text' && matchedTerm) {
      const at = normalize(doc.text).indexOf(matchedTerm);
      if (at !== -1) hit.snippet = snippetAround(doc.text, at, matchedTerm.length);
    }
    hits.push(hit);
  }

  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, limit);
}

function snippetAround(text: string, at: number, length: number, radius = 60): string {
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + length + radius);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`;
}

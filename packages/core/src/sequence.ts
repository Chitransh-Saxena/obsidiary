/**
 * Reading order, taken from the hub notes.
 *
 * A vault has no inherent order. The sidebar is alphabetical, which is a filing
 * order and not a reading one — "Deploying" does not come before "Setup" in any
 * sense a reader cares about. So rather than inventing an order or asking people
 * to number their frontmatter, this reads the one that already exists: a
 * folder's hub note lists its notes in the order someone should read them. That
 * list *is* the contents page, and the order of its links is the sequence.
 *
 * Nothing needs configuring, and a vault that has no hub notes simply has no
 * sequences — which is the honest answer, rather than a confident "next" that
 * points somewhere arbitrary.
 */

import { dirname, stripExt, basename } from './paths.js';
import type { Note, VaultIndex } from './types.js';

export interface Sequence {
  /** The hub note whose links define this order. */
  hubPath: string;
  /** The folder the hub governs. `''` for the vault root. */
  folder: string;
  /** Ordered note paths, deduplicated, hub excluded. */
  items: string[];
}

export interface Neighbours {
  prev?: Note;
  next?: Note;
  /** The hub this sequence came from — the "up" link. */
  hub?: Note;
  /** 1-based position of the current note within the sequence. */
  position: number;
  total: number;
}

/** A hub is a folder's `index` note: `index.md`, `fpv/index.md`, … */
export function isHubPath(path: string): boolean {
  return basename(stripExt(path)).toLowerCase() === 'index';
}

/** The folder a hub governs. `index.md` → `''`, `fpv/index.md` → `'fpv'`. */
function hubFolder(path: string): string {
  const dir = dirname(path);
  return dir === '.' ? '' : dir;
}

function within(folder: string, path: string): boolean {
  return folder === '' ? true : path.startsWith(`${folder}/`);
}

/**
 * One sequence per hub note, keyed by the folder it governs.
 *
 * Only links to notes *under* the hub's own folder count — a hub commonly links
 * back to the vault root or sideways to a neighbouring area, and neither is the
 * "next page". Embeds are excluded too: transcluding a note is not the same as
 * listing it.
 */
export function buildSequences(index: VaultIndex): Record<string, Sequence> {
  const out: Record<string, Sequence> = {};

  for (const note of Object.values(index.notes)) {
    if (!isHubPath(note.path)) continue;
    const folder = hubFolder(note.path);

    const items: string[] = [];
    const seen = new Set<string>([note.path]);
    for (const link of note.links) {
      const to = link.toPath;
      if (!to || link.embed || link.kind !== 'note') continue;
      if (seen.has(to) || !within(folder, to)) continue;
      seen.add(to);
      items.push(to);
    }

    if (items.length) out[folder] = { hubPath: note.path, folder, items };
  }

  return out;
}

/**
 * Where a note sits in its reading order, or `null` if nothing lists it.
 *
 * A note can appear in more than one hub — an area hub lists it, and the root
 * hub might too. The deepest folder wins, because that is the most specific
 * claim about where the note belongs.
 */
export function neighboursOf(
  index: VaultIndex,
  path: string,
  sequences: Record<string, Sequence> = buildSequences(index),
): Neighbours | null {
  let best: { seq: Sequence; at: number } | null = null;

  for (const seq of Object.values(sequences)) {
    const at = seq.items.indexOf(path);
    if (at === -1) continue;
    if (!best || seq.folder.length > best.seq.folder.length) best = { seq, at };
  }

  if (!best) return null;

  const { seq, at } = best;
  const result: Neighbours = { position: at + 1, total: seq.items.length };

  const prev = index.notes[seq.items[at - 1] ?? ''];
  const next = index.notes[seq.items[at + 1] ?? ''];
  const hub = index.notes[seq.hubPath];
  if (prev) result.prev = prev;
  if (next) result.next = next;
  if (hub) result.hub = hub;

  return result;
}

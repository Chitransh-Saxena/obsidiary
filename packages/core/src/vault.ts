/**
 * Vault assembly: raw files in, fully resolved `VaultIndex` out.
 *
 * Two passes, and they can't be collapsed into one — a link in the first file
 * may point at the last file, so nothing can be resolved until every note has
 * been parsed and indexed.
 */

import { buildBacklinks, buildGraph, buildTagIndex } from './graph.js';
import { parseCanvasNote, parseNote, type ParsedNote } from './note.js';
import { basename, extname, isAssetPath, isNotePath, normalizeSlashes, stripExt } from './paths.js';
import { buildLookups, resolveTarget, type ResolveContext } from './resolve.js';
import { assetUrl } from './slug.js';
import type { Asset, Note, ResolvedLink, VaultFile, VaultIndex, VaultOptions } from './types.js';

const DEFAULT_IGNORE = ['.obsidian/', '.trash/', '.git/', 'node_modules/'];

function isIgnored(path: string, ignore: string[]): boolean {
  const lower = path.toLowerCase();
  return ignore.some((prefix) => {
    const p = prefix.toLowerCase();
    return p.endsWith('/') ? lower.startsWith(p) || lower.includes(`/${p}`) : lower === p;
  });
}

/** Whether a parsed note survives the publish/draft filters. */
function isPublished(note: ParsedNote, options: VaultOptions): boolean {
  const fm = note.frontmatter;
  if (options.removeDrafts !== false && fm.draft === true) return false;
  if (options.explicitPublish && fm.publish !== true) return false;
  if (fm.publish === false) return false;
  return true;
}

export function buildVault(files: VaultFile[], options: VaultOptions = {}): VaultIndex {
  const ignore = [...DEFAULT_IGNORE, ...(options.ignore ?? [])];
  const assetBase = options.assetBase ?? '/_assets';

  const notes: Record<string, Note> = {};
  const assets: Record<string, Asset> = {};
  const parsed: ParsedNote[] = [];

  for (const file of files) {
    const path = normalizeSlashes(file.path).replace(/^\.?\/+/, '');
    if (!path || isIgnored(path, ignore)) continue;

    if (isNotePath(path)) {
      const note = parseNote({ ...file, path }, options);
      if (isPublished(note, options)) parsed.push(note);
      continue;
    }

    if (extname(path) === '.canvas') {
      // A canvas carries no frontmatter, so it has no way to opt in to explicit
      // publishing. Under `explicitPublish` it is skipped entirely rather than
      // falling through to assets, which would publish the raw JSON.
      const canvas = options.explicitPublish ? null : parseCanvasNote({ ...file, path }, options);
      if (canvas) parsed.push(canvas);
      continue;
    }

    if (isAssetPath(path)) {
      assets[path] = {
        path,
        url: assetUrl(path, assetBase, options.preserveAssetPaths),
        basename: basename(stripExt(path)),
        ext: extname(path),
      };
    }
  }

  // Two notes can slug to the same URL (`My Note.md` and `my note.md`). Left
  // alone that silently drops a page, so disambiguate and keep both.
  const usedSlugs = new Set<string>();
  for (const note of parsed.sort((a, b) => (a.path < b.path ? -1 : 1))) {
    let slug = note.slug;
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
      note.slug = slug;
      note.url = note.url.replace(/[^/]*$/, basename(slug));
    }
    usedSlugs.add(slug);

    const { rawLinks: _rawLinks, ...rest } = note;
    notes[note.path] = { ...rest, links: [] };
  }

  const ctx: ResolveContext = { notes, assets, lookups: buildLookups(notes, assets) };

  for (const p of parsed) {
    const note = notes[p.path];
    if (!note) continue;
    note.links = p.rawLinks.map((link): ResolvedLink => {
      const resolution = resolveTarget(ctx, link.target, p.path);
      return { ...link, ...resolution };
    });
  }

  return {
    notes,
    assets,
    order: Object.keys(notes).sort(),
    lookups: ctx.lookups,
    graph: buildGraph(notes),
    tags: buildTagIndex(notes),
    backlinks: buildBacklinks(notes),
  };
}

/** Convenience accessor — notes in stable path order. */
export function listNotes(index: VaultIndex): Note[] {
  return index.order.map((p) => index.notes[p]).filter((n): n is Note => Boolean(n));
}

export function findBySlug(index: VaultIndex, slug: string): Note | undefined {
  const want = slug.replace(/^\/+|\/+$/g, '');
  return listNotes(index).find((n) => n.slug === want);
}

/**
 * Obsidian-compatible link resolution.
 *
 * Obsidian never writes down its algorithm, so this encodes the observed
 * behaviour. Targets containing a slash are treated as paths:
 *
 *   1. exact vault-root-relative path       `[[dev/Zettel]]`
 *   2. path relative to the linking note    `[[../Zettel]]`, `[[sub/Zettel]]`
 *   3. bare filename, anywhere in the vault `[[Zettel]]`
 *   4. a frontmatter alias                  `aliases: [Zettel]`
 *
 * Bare targets skip step 1 — see the note on proximity in `resolveTarget`.
 *
 * Matching is case-insensitive (Obsidian's is), but an exact-case hit always
 * beats a case-folded one so that a vault containing both `Note.md` and
 * `note.md` still resolves each link to the file the author meant.
 *
 * When a bare filename is ambiguous, the tie-break is: same folder as the
 * linking note first, then the shallowest path, then alphabetical. The last
 * rule exists purely so builds are deterministic — an ambiguous link that
 * silently points somewhere different on each build is worse than one that
 * points somewhere wrong but stable.
 */

import { basename, dirname, extname, isAssetPath, normalizeSlashes, resolveRelative, stripExt } from './paths.js';
import type { Asset, Note, Resolution, VaultLookups } from './types.js';

export interface ResolveContext {
  notes: Record<string, Note>;
  assets: Record<string, Asset>;
  lookups: VaultLookups;
}

/** Clean up a link target as written: slashes, `./`, percent-encoding, whitespace. */
export function normalizeTarget(raw: string): string {
  let t = normalizeSlashes(raw).trim();
  if (t.includes('%')) {
    try {
      t = decodeURIComponent(t);
    } catch {
      // Leave a malformed escape sequence alone rather than throwing mid-build.
    }
  }
  return t.replace(/^\.\//, '').replace(/^\/+/, '');
}

function push(record: Record<string, string[]>, key: string, value: string): void {
  const k = key.toLowerCase();
  const bucket = record[k];
  if (bucket) {
    if (!bucket.includes(value)) bucket.push(value);
  } else {
    record[k] = [value];
  }
}

export function buildLookups(
  notes: Record<string, Note>,
  assets: Record<string, Asset>,
): VaultLookups {
  const lookups: VaultLookups = {
    byPath: {},
    byBasename: {},
    byAlias: {},
    assetByPath: {},
    assetByBasename: {},
  };

  for (const note of Object.values(notes)) {
    const noExt = stripExt(note.path);
    push(lookups.byPath, noExt, note.path);
    push(lookups.byBasename, basename(noExt), note.path);
    for (const alias of note.aliases) {
      push(lookups.byAlias, alias, note.path);
    }
  }

  for (const asset of Object.values(assets)) {
    push(lookups.assetByPath, asset.path, asset.path);
    push(lookups.assetByBasename, basename(asset.path), asset.path);
  }

  return lookups;
}

/**
 * Choose between candidates for an ambiguous link.
 *
 * `exact` is the key as the author wrote it and `keyOf` extracts the comparable
 * key from a candidate path. They must describe the same *kind* of key — a
 * basename lookup has to compare basenames. Comparing a bare `[[Zettel]]`
 * against full paths quietly promotes the root-level file over the one sitting
 * in the linking note's own folder, which is the opposite of what Obsidian does.
 */
function pickBest(
  candidates: string[],
  fromPath: string,
  exact?: string,
  keyOf: (p: string) => string = (p) => p,
): string | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const fromDir = dirname(fromPath);
  const ranked = candidates.slice().sort((a, b) => {
    if (exact) {
      const aExact = keyOf(a) === exact ? 0 : 1;
      const bExact = keyOf(b) === exact ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
    }
    const aSame = dirname(a) === fromDir ? 0 : 1;
    const bSame = dirname(b) === fromDir ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;

    const aDepth = a.split('/').length;
    const bDepth = b.split('/').length;
    if (aDepth !== bDepth) return aDepth - bDepth;

    return a < b ? -1 : a > b ? 1 : 0;
  });
  return ranked[0];
}

function lookup(
  record: Record<string, string[]>,
  key: string,
  fromPath: string,
  exact?: string,
  keyOf?: (p: string) => string,
): string | undefined {
  const bucket = record[key.toLowerCase()];
  if (!bucket || bucket.length === 0) return undefined;
  return pickBest(bucket, fromPath, exact, keyOf);
}

function noteResolution(ctx: ResolveContext, path: string, viaAlias = false): Resolution {
  const note = ctx.notes[path];
  const res: Resolution = { kind: 'note', toPath: path };
  if (note) res.toUrl = note.url;
  if (viaAlias) res.viaAlias = true;
  return res;
}

function assetResolution(ctx: ResolveContext, path: string): Resolution {
  const asset = ctx.assets[path];
  const res: Resolution = { kind: 'asset', toPath: path };
  if (asset) res.toUrl = asset.url;
  return res;
}

/**
 * Resolve a link target against the vault.
 *
 * @param rawTarget the target as written, without subpath or alias
 * @param fromPath  vault path of the note containing the link
 */
export function resolveTarget(
  ctx: ResolveContext,
  rawTarget: string,
  fromPath: string,
): Resolution {
  const target = normalizeTarget(rawTarget);

  // `[[#heading]]` / `[[#^block]]` — a link into the current note.
  if (!target) return { kind: 'self', toPath: fromPath, toUrl: ctx.notes[fromPath]?.url };

  const fromDir = dirname(fromPath);
  const looksLikeAsset = isAssetPath(target);

  const asPath = (p: string) => p;
  const asBasename = (p: string) => basename(p);
  const asPathNoExt = (p: string) => stripExt(p);
  const asBasenameNoExt = (p: string) => basename(stripExt(p));

  /**
   * A target containing a slash is a path and is matched as one. A bare name is
   * matched by proximity instead — checking the vault root first would make
   * `[[Zettel]]` inside `dev/deep/` jump to a root-level `Zettel.md` while
   * ignoring the `Zettel.md` sitting right next to it, which is not what
   * Obsidian does and not what the author meant.
   */
  const hasSlash = target.includes('/');

  if (looksLikeAsset) {
    const relative = resolveRelative(fromDir, target);
    const direct = hasSlash
      ? lookup(ctx.lookups.assetByPath, target, fromPath, target, asPath) ??
        lookup(ctx.lookups.assetByPath, relative, fromPath, relative, asPath) ??
        lookup(ctx.lookups.assetByBasename, basename(target), fromPath, basename(target), asBasename)
      : lookup(ctx.lookups.assetByPath, relative, fromPath, relative, asPath) ??
        lookup(ctx.lookups.assetByBasename, target, fromPath, target, asBasename);
    if (direct) return assetResolution(ctx, direct);
    return { kind: 'unresolved' };
  }

  // Notes are keyed without their extension, so `[[a/b]]` and `[[a/b.md]]` share a key.
  const noExt = stripExt(target);
  const relativeNoExt = resolveRelative(fromDir, noExt);

  const hit = hasSlash
    ? lookup(ctx.lookups.byPath, noExt, fromPath, noExt, asPathNoExt) ??
      lookup(ctx.lookups.byPath, relativeNoExt, fromPath, relativeNoExt, asPathNoExt) ??
      lookup(ctx.lookups.byBasename, basename(noExt), fromPath, basename(noExt), asBasenameNoExt)
    : lookup(ctx.lookups.byPath, relativeNoExt, fromPath, relativeNoExt, asPathNoExt) ??
      lookup(ctx.lookups.byBasename, noExt, fromPath, noExt, asBasenameNoExt);
  if (hit) return noteResolution(ctx, hit);

  const aliased = lookup(ctx.lookups.byAlias, target, fromPath);
  if (aliased) return noteResolution(ctx, aliased, true);

  // A link with no extension may still mean an attachment whose extension the
  // author omitted, and `[[note.canvas]]` lands here too.
  const asAsset =
    lookup(ctx.lookups.assetByPath, target, fromPath, target, asPath) ??
    lookup(ctx.lookups.assetByBasename, basename(target), fromPath, basename(target), asBasename);
  if (asAsset) return assetResolution(ctx, asAsset);

  return { kind: 'unresolved' };
}

/**
 * Resolve the href of a standard markdown link (`[text](Some%20Note.md)`).
 * External, protocol-relative and anchor-only hrefs are left untouched.
 */
export function resolveMarkdownHref(
  ctx: ResolveContext,
  href: string,
  fromPath: string,
): Resolution | null {
  if (!href || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;
  if (href.startsWith('#')) return { kind: 'self', toPath: fromPath, toUrl: ctx.notes[fromPath]?.url };

  const hashAt = href.indexOf('#');
  const bare = hashAt === -1 ? href : href.slice(0, hashAt);
  if (!bare) return null;

  // Only treat it as an internal link if it has no extension or a vault-ish one;
  // `](style.css)` in a raw HTML block is not a note reference.
  const ext = extname(bare);
  if (ext && !isAssetPath(bare) && ext !== '.md' && ext !== '.markdown' && ext !== '.canvas') {
    return null;
  }
  return resolveTarget(ctx, bare, fromPath);
}

/**
 * Vault path → URL slug.
 *
 * Readability over purity: `dev/My Great Note.md` becomes `dev/my-great-note`,
 * not a hash or a percent-encoded mess. Unicode letters are preserved because a
 * vault written in Devanagari or Japanese should not slug down to nothing.
 */

import { basename, dirname, extname, join, stripExt } from './paths.js';
import type { NoteFrontmatter } from './types.js';

/** Characters that are legal in a URL path but hostile in practice. */
const UNSAFE = /[<>:"\\|?*#\[\]()'`!$&+,;=@%^{}~]/g;

export function slugifySegment(segment: string): string {
  return segment
    .normalize('NFC')
    .replace(UNSAFE, '')
    .replace(/\s+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase();
}

export function slugifyPath(path: string): string {
  return path
    .split('/')
    .map(slugifySegment)
    .filter(Boolean)
    .join('/');
}

export interface SlugOptions {
  /** URL prefix, e.g. `/notes`. */
  base?: string;
}

/**
 * Slug for a note, honouring a `permalink` override and collapsing `index.md`
 * to its containing folder so `guides/index.md` serves at `/guides`.
 */
export function noteSlug(path: string, frontmatter: NoteFrontmatter = {}): string {
  const permalink = frontmatter.permalink;
  if (typeof permalink === 'string' && permalink.trim()) {
    return permalink.trim().replace(/^\/+|\/+$/g, '');
  }

  const withoutExt = stripExt(path);
  const name = basename(withoutExt);
  if (name.toLowerCase() === 'index') {
    return slugifyPath(dirname(withoutExt));
  }
  return slugifyPath(withoutExt);
}

export function slugToUrl(slug: string, options: SlugOptions = {}): string {
  const base = (options.base ?? '').replace(/\/+$/, '');
  if (!slug) return base || '/';
  return `${base}/${slug}`;
}

export function assetUrl(path: string, assetBase = '/_assets', preservePath = false): string {
  const base = assetBase.replace(/\/+$/, '');
  // Remote vaults point straight at raw.githubusercontent, where the path must
  // match the repository byte for byte — slugging it would 404 every image.
  if (preservePath) {
    return `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  const dir = slugifyPath(dirname(path));
  // Keep the real filename (slugged, extension intact) so the file on disk and
  // the URL agree — the loader copies assets verbatim.
  const ext = extname(path);
  const name = slugifySegment(stripExt(basename(path)));
  return `${base}/${join(dir, name + ext)}`;
}

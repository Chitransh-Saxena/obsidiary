/**
 * POSIX-style path helpers.
 *
 * Deliberately not `node:path` — this module has to run in the browser for live
 * mode, and vault paths are always POSIX regardless of the host OS.
 */

export function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

export function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

export function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

export function extname(p: string): string {
  const base = basename(p);
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i).toLowerCase();
}

/**
 * Strip a *known* file extension.
 *
 * Not "everything after the last dot" — a vault note called `v1.2 spec` would
 * lose its tail and index as `v1`, and every link to it would 404.
 */
export function stripExt(p: string): string {
  const ext = extname(p);
  return ext && KNOWN_EXTENSIONS.has(ext) ? p.slice(0, -ext.length) : p;
}

export function join(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/{2,}/g, '/');
}

/** Collapse `.` and `..` segments. Leading `..` are dropped — nothing exists above the vault root. */
export function resolveRelative(from: string, target: string): string {
  const stack: string[] = from ? from.split('/') : [];
  for (const seg of target.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') stack.pop();
    else stack.push(seg);
  }
  return stack.join('/');
}

/**
 * Extensions we treat as attachments rather than notes.
 *
 * An allowlist rather than "anything after the last dot", because vault files are
 * routinely named things like `2024.03.01` or `v1.2 spec` — a generic extension
 * regex misfiles those as assets and the link silently dies.
 */
export const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp', '.ico',
  '.pdf',
  '.mp4', '.webm', '.mov', '.ogv',
  '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.3gp',
  '.zip',
]);

export const NOTE_EXTENSIONS = new Set(['.md', '.markdown']);

export const KNOWN_EXTENSIONS = new Set([
  ...ASSET_EXTENSIONS,
  ...NOTE_EXTENSIONS,
  '.canvas',
  '.excalidraw',
]);

export function isAssetPath(p: string): boolean {
  return ASSET_EXTENSIONS.has(extname(p));
}

export function isNotePath(p: string): boolean {
  return NOTE_EXTENSIONS.has(extname(p));
}

export function isCanvasPath(p: string): boolean {
  return extname(p) === '.canvas';
}

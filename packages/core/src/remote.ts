/**
 * Loading a vault from a public GitHub repository.
 *
 * One code path serves both the static build and in-browser live mode, which is
 * only possible because it uses plain `fetch` against two endpoints that both
 * send `Access-Control-Allow-Origin: *`:
 *
 *   - `api.github.com/.../git/trees/<ref>?recursive=1` — one call, whole file list
 *   - `raw.githubusercontent.com/...`                  — the file contents
 *
 * A repo tarball would be one request instead of N, but `codeload.github.com`
 * sends no CORS headers, so it cannot be used from a browser — and two loaders
 * that drift apart is exactly what the isomorphic core exists to avoid.
 */

import { isAssetPath, isNotePath, extname } from './paths.js';
import type { VaultFile } from './types.js';

export interface RemoteRef {
  owner: string;
  repo: string;
  /** Branch, tag or commit. Defaults to the repo's default branch. */
  ref?: string;
  /** Only load files under this folder. */
  subdir?: string;
}

/**
 * Accepts the shapes people actually paste:
 *   owner/repo · owner/repo@branch · owner/repo/sub/dir
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch/sub/dir
 */
export function parseRepoRef(input: string): RemoteRef | null {
  let text = input.trim();
  if (!text) return null;

  text = text
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/, '')
    .replace(/^\/+|\/+$/g, '');

  let ref: string | undefined;
  const at = text.indexOf('@');
  if (at !== -1) {
    ref = text.slice(at + 1).trim() || undefined;
    text = text.slice(0, at);
  }

  const parts = text.split('/').filter(Boolean);
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;

  let rest = parts.slice(2);
  // `/tree/<ref>/<subdir>` is what the GitHub UI puts in the address bar.
  if (rest[0] === 'tree' || rest[0] === 'blob') {
    ref = rest[1] ?? ref;
    rest = rest.slice(2);
  }

  const result: RemoteRef = { owner, repo };
  if (ref) result.ref = ref;
  const subdir = rest.join('/');
  if (subdir) result.subdir = subdir;
  return result;
}

export function rawBase(ref: RemoteRef, resolvedRef: string): string {
  return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${resolvedRef}`;
}

export interface FetchVaultOptions {
  /** A token lifts the API rate limit from 60/hr to 5000/hr. Never required. */
  token?: string;
  /** Parallel file downloads. Default 12. */
  concurrency?: number;
  /** Refuse to load more than this many notes. Default 3000. */
  maxFiles?: number;
  onProgress?: (loaded: number, total: number) => void;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface RemoteVault {
  files: VaultFile[];
  /** The branch or commit actually used. */
  resolvedRef: string;
  /** Base URL for attachments. */
  rawBase: string;
  /** True when GitHub truncated the tree, or `maxFiles` clipped it. */
  truncated: boolean;
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

async function json<T>(
  url: string,
  options: FetchVaultOptions,
  what: string,
): Promise<T> {
  const doFetch = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { accept: 'application/vnd.github+json' };
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  const res = await doFetch(url, { headers });
  if (!res.ok) {
    // The rate limit is the failure people actually hit, so name it.
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error(
        `GitHub API rate limit reached while ${what}. Wait an hour, or set a token (GITHUB_TOKEN) to raise the limit to 5000/hour.`,
      );
    }
    if (res.status === 404) {
      throw new Error(`Not found while ${what} — check the repository name, and that it is public.`);
    }
    throw new Error(`GitHub returned ${res.status} while ${what}.`);
  }
  return (await res.json()) as T;
}

/** Files worth loading: notes, canvases, and attachments (paths only). */
function isInteresting(path: string): boolean {
  return isNotePath(path) || extname(path) === '.canvas' || isAssetPath(path);
}

export async function fetchVaultFiles(
  ref: RemoteRef,
  options: FetchVaultOptions = {},
): Promise<RemoteVault> {
  const { concurrency = 12, maxFiles = 3000 } = options;
  const doFetch = options.fetchImpl ?? fetch;

  let resolvedRef = ref.ref;
  if (!resolvedRef) {
    const meta = await json<{ default_branch?: string }>(
      `https://api.github.com/repos/${ref.owner}/${ref.repo}`,
      options,
      'looking up the repository',
    );
    resolvedRef = meta.default_branch ?? 'main';
  }

  const tree = await json<{ tree?: TreeEntry[]; truncated?: boolean }>(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(resolvedRef)}?recursive=1`,
    options,
    'listing the repository',
  );

  const prefix = ref.subdir ? `${ref.subdir.replace(/^\/+|\/+$/g, '')}/` : '';
  let truncated = Boolean(tree.truncated);

  const entries = (tree.tree ?? []).filter(
    (entry) => entry.type === 'blob' && entry.path.startsWith(prefix) && isInteresting(entry.path),
  );

  const textEntries: TreeEntry[] = [];
  const files: VaultFile[] = [];

  for (const entry of entries) {
    // Vault-relative path: the subdir is the root as far as links are concerned.
    const relative = entry.path.slice(prefix.length);
    if (!relative) continue;

    if (isNotePath(relative) || extname(relative) === '.canvas') {
      if (textEntries.length >= maxFiles) {
        truncated = true;
        continue;
      }
      textEntries.push({ ...entry, path: relative });
    } else {
      // Attachments are never downloaded — the site points at raw.githubusercontent.
      files.push({ path: relative });
    }
  }

  const base = rawBase(ref, resolvedRef);
  let loaded = 0;

  // A fixed pool of workers pulling from a shared cursor: bounded concurrency
  // without a queue library, and it keeps every worker busy to the last file.
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      const entry = textEntries[index];
      if (!entry) return;

      const url = `${base}/${prefix}${entry.path.split('/').map(encodeURIComponent).join('/')}`;
      try {
        const res = await doFetch(url);
        files.push({ path: entry.path, content: res.ok ? await res.text() : '' });
      } catch {
        // One unreadable file shouldn't sink the whole vault.
        files.push({ path: entry.path, content: '' });
      }
      options.onProgress?.(++loaded, textEntries.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, textEntries.length || 1)) }, worker),
  );

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, resolvedRef, rawBase: `${base}/${prefix}`.replace(/\/+$/, '/'), truncated };
}

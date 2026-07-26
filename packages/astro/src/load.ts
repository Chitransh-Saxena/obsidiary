/**
 * The Node half: reading a vault off disk.
 *
 * This is the only place in Obsidiary allowed to touch the filesystem. In M3 a
 * sibling loader will fetch a repo tarball instead and hand `buildVault` the
 * same `VaultFile[]`, which is why the split is worth keeping strict.
 */

import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname as nodeDirname, join as nodeJoin, resolve as nodeResolve } from 'node:path';
import {
  assetUrl,
  buildVault,
  isNotePath,
  type VaultFile,
  type VaultIndex,
  type VaultOptions,
} from 'obsidiary';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.obsidian', '.trash', '.astro', 'dist']);

function safeReaddir(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Every file under `dir`, as POSIX paths relative to it. Dotfiles are skipped. */
export function listVaultFiles(dir: string): string[] {
  const out: string[] = [];

  const walk = (current: string, prefix: string): void => {
    for (const entry of safeReaddir(current)) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(nodeJoin(current, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };

  walk(dir, '');
  return out.sort();
}

export interface LoadedVault {
  index: VaultIndex;
  /** Absolute path of the vault root, for asset copying. */
  root: string;
  /** Vault-relative paths of every file read, for watch registration. */
  files: string[];
}

export function loadVaultFromDir(dir: string, options: VaultOptions = {}): LoadedVault {
  const root = nodeResolve(dir);
  const relPaths = listVaultFiles(root);

  const files: VaultFile[] = relPaths.map((rel) => {
    // Only text files need their content read; attachments are copied verbatim later.
    if (isNotePath(rel) || rel.endsWith('.canvas')) {
      try {
        return { path: rel, content: readFileSync(nodeJoin(root, rel), 'utf8') };
      } catch {
        return { path: rel };
      }
    }
    return { path: rel };
  });

  return { index: buildVault(files, options), root, files: relPaths };
}

/**
 * Copy attachments into the site's public directory at the exact URLs the
 * resolver generated, so `![[photo.png]]` and the file on disk agree.
 */
export function syncAssets(loaded: LoadedVault, publicDir: string, assetBase = '/_assets'): number {
  let copied = 0;
  for (const asset of Object.values(loaded.index.assets)) {
    const url = asset.url.startsWith(assetBase) ? asset.url : assetUrl(asset.path, assetBase);
    const dest = nodeJoin(publicDir, url.replace(/^\//, ''));
    try {
      const src = nodeJoin(loaded.root, asset.path);
      const srcStat = statSync(src);
      let destStat: ReturnType<typeof statSync> | null = null;
      try {
        destStat = statSync(dest);
      } catch {
        destStat = null;
      }
      // Skip unchanged files so a large vault doesn't re-copy on every dev restart.
      if (destStat && destStat.mtimeMs >= srcStat.mtimeMs && destStat.size === srcStat.size) continue;

      mkdirSync(nodeDirname(dest), { recursive: true });
      copyFileSync(src, dest);
      copied++;
    } catch {
      // A missing or unreadable attachment shouldn't fail the build.
    }
  }
  return copied;
}

/**
 * The folder tree behind the sidebar.
 *
 * Built from note paths rather than the filesystem, so a remote vault in M3
 * produces exactly the same tree as a local one.
 */

import { basename, dirname } from './paths.js';
import type { Note, VaultIndex } from './types.js';

export interface TreeFolder {
  type: 'folder';
  /** Folder name for display. */
  name: string;
  /** Vault-relative folder path. */
  path: string;
  children: TreeNode[];
  /** A note that acts as this folder's landing page (`folder/index.md`). */
  indexUrl?: string;
  /** Vault path of that landing note, so the sidebar can mark it current. */
  indexPath?: string;
}

export interface TreeNote {
  type: 'note';
  name: string;
  path: string;
  url: string;
  title: string;
}

export type TreeNode = TreeFolder | TreeNote;

export interface TreeOptions {
  /** Hide `index.md` entries, folding them into their folder. Default true. */
  foldIndexNotes?: boolean;
}

function compare(a: TreeNode, b: TreeNode): number {
  // Folders first, then notes; alphabetical within each, case-insensitively so
  // `apple` and `Banana` sort the way a human expects.
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function buildFileTree(index: VaultIndex, options: TreeOptions = {}): TreeNode[] {
  const { foldIndexNotes = true } = options;

  const root: TreeFolder = { type: 'folder', name: '', path: '', children: [] };
  const folders = new Map<string, TreeFolder>([['', root]]);

  const folderFor = (path: string): TreeFolder => {
    const existing = folders.get(path);
    if (existing) return existing;

    const parent = folderFor(dirname(path));
    const folder: TreeFolder = { type: 'folder', name: basename(path), path, children: [] };
    folders.set(path, folder);
    parent.children.push(folder);
    return folder;
  };

  // Create every folder first so empty-looking intermediate folders still appear.
  for (const path of index.order) {
    const dir = dirname(path);
    if (dir) folderFor(dir);
  }

  for (const path of index.order) {
    const note = index.notes[path];
    if (!note) continue;

    const folder = folderFor(dirname(path));
    if (foldIndexNotes && note.basename.toLowerCase() === 'index') {
      // The root index is the site home, not a folder landing page.
      if (folder.path !== '') {
        folder.indexUrl = note.url;
        folder.indexPath = note.path;
        continue;
      }
    }

    folder.children.push({
      type: 'note',
      name: note.basename,
      path: note.path,
      url: note.url,
      title: note.title,
    });
  }

  const sortDeep = (node: TreeFolder): void => {
    node.children.sort(compare);
    for (const child of node.children) {
      if (child.type === 'folder') sortDeep(child);
    }
  };
  sortDeep(root);

  return root.children;
}

/** Folder paths from the vault root down to (but not including) a note. */
export function ancestorFolders(notePath: string): string[] {
  const dir = dirname(notePath);
  if (!dir) return [];
  const segments = dir.split('/');
  return segments.map((_, i) => segments.slice(0, i + 1).join('/'));
}

/** Flatten a tree back to its notes, in display order. */
export function flattenTree(nodes: TreeNode[]): TreeNote[] {
  const out: TreeNote[] = [];
  const walk = (list: TreeNode[]): void => {
    for (const node of list) {
      if (node.type === 'note') out.push(node);
      else walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function noteCount(nodes: TreeNode[]): number {
  return flattenTree(nodes).length;
}

/** Notes with no incoming links — the sidebar can surface these as orphans. */
export function orphanNotes(index: VaultIndex): Note[] {
  return index.order
    .map((p) => index.notes[p])
    .filter((n): n is Note => {
      if (!n) return false;
      const node = index.graph.nodes[n.path];
      return !!node && node.incoming.length === 0;
    });
}

import { buildVault } from '../src/vault.js';
import type { ResolveContext } from '../src/resolve.js';
import type { VaultFile, VaultIndex } from '../src/types.js';

/**
 * A deliberately nasty vault: duplicate basenames at three depths, a case
 * collision, a dotted filename, aliases that shadow real notes, spaces, and
 * unicode. Every one of these has broken a real Obsidian-to-web tool.
 */
export const FILES: VaultFile[] = [
  { path: 'index.md', content: '# Home\n' },
  { path: 'Zettelkasten.md', content: '# Root Zettelkasten\n' },
  { path: 'dev/Zettelkasten.md', content: '# Dev Zettelkasten\n' },
  { path: 'dev/deep/Zettelkasten.md', content: '# Deep Zettelkasten\n' },
  { path: 'dev/Astro.md', content: '# Astro\n' },
  { path: 'dev/deep/leaf.md', content: '# Leaf\n' },
  { path: 'dev/sibling.md', content: '# Sibling\n' },
  { path: 'notes/My Great Note.md', content: '# My Great Note\n' },
  { path: 'notes/Case Test.md', content: '# Upper\n' },
  { path: 'notes/case test.md', content: '# Lower\n' },
  { path: 'notes/v1.2 spec.md', content: '# Spec\n' },
  { path: 'notes/日本語.md', content: '# Japanese\n' },
  {
    path: 'aliased.md',
    content: '---\naliases:\n  - AKA\n  - Second Name\n  - Astro\n---\n# Aliased\n',
  },
  { path: 'private/secret.md', content: '---\npublish: false\n---\n# Secret\n' },
  { path: 'drafts/wip.md', content: '---\ndraft: true\n---\n# WIP\n' },
  { path: '.obsidian/workspace.json', content: '{}' },
  { path: 'assets/photo.png' },
  { path: 'notes/photo.png' },
  { path: 'assets/clip.mp4' },
  { path: 'assets/paper.pdf' },
  { path: 'boards/map.canvas', content: '{"nodes":[],"edges":[]}' },
];

export function makeVault(files: VaultFile[] = FILES): VaultIndex {
  return buildVault(files);
}

export function makeCtx(index: VaultIndex): ResolveContext {
  return { notes: index.notes, assets: index.assets, lookups: index.lookups };
}

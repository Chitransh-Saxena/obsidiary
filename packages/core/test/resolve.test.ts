import { describe, expect, it } from 'vitest';
import { resolveTarget } from '../src/resolve.js';
import { makeCtx, makeVault } from './fixture.js';

const index = makeVault();
const ctx = makeCtx(index);

const r = (target: string, from = 'index.md') => resolveTarget(ctx, target, from);

describe('exact path matching', () => {
  it('resolves a vault-root-relative path', () => {
    expect(r('dev/Zettelkasten').toPath).toBe('dev/Zettelkasten.md');
  });

  it('accepts an explicit .md extension', () => {
    expect(r('dev/Zettelkasten.md').toPath).toBe('dev/Zettelkasten.md');
  });

  it('ignores a leading ./ and duplicate slashes', () => {
    expect(r('./dev/Zettelkasten').toPath).toBe('dev/Zettelkasten.md');
    expect(r('/dev/Zettelkasten').toPath).toBe('dev/Zettelkasten.md');
  });
});

describe('ambiguous basenames', () => {
  it('prefers the linking note’s own folder', () => {
    expect(r('Zettelkasten', 'dev/deep/leaf.md').toPath).toBe('dev/deep/Zettelkasten.md');
    expect(r('Zettelkasten', 'dev/sibling.md').toPath).toBe('dev/Zettelkasten.md');
  });

  it('falls back to the shallowest match', () => {
    expect(r('Zettelkasten', 'notes/My Great Note.md').toPath).toBe('Zettelkasten.md');
  });

  it('is deterministic across repeated resolution', () => {
    const runs = new Set(
      Array.from({ length: 25 }, () => resolveTarget(ctx, 'Zettelkasten', 'notes/photo.png').toPath),
    );
    expect(runs.size).toBe(1);
  });
});

describe('case handling', () => {
  it('matches case-insensitively', () => {
    expect(r('zettelkasten', 'dev/sibling.md').toPath).toBe('dev/Zettelkasten.md');
    expect(r('DEV/ASTRO').toPath).toBe('dev/Astro.md');
  });

  it('prefers an exact-case match when a vault has both spellings', () => {
    expect(r('Case Test', 'notes/My Great Note.md').toPath).toBe('notes/Case Test.md');
    expect(r('case test', 'notes/My Great Note.md').toPath).toBe('notes/case test.md');
  });
});

describe('relative paths', () => {
  it('walks up with ..', () => {
    expect(r('../Astro', 'dev/deep/leaf.md').toPath).toBe('dev/Astro.md');
  });

  it('walks down from the current folder', () => {
    expect(r('deep/leaf', 'dev/Astro.md').toPath).toBe('dev/deep/leaf.md');
  });
});

describe('aliases', () => {
  it('resolves a frontmatter alias', () => {
    expect(r('AKA').toPath).toBe('aliased.md');
    expect(r('Second Name').toPath).toBe('aliased.md');
  });

  it('lets a real file win over an alias of the same name', () => {
    // `aliased.md` claims the alias "Astro", but dev/Astro.md is a real note.
    const hit = r('Astro');
    expect(hit.toPath).toBe('dev/Astro.md');
    expect(hit.viaAlias).toBeUndefined();
  });

  it('flags alias hits so the UI can style them', () => {
    expect(r('AKA').viaAlias).toBe(true);
  });
});

describe('awkward filenames', () => {
  it('handles spaces', () => {
    expect(r('My Great Note').toPath).toBe('notes/My Great Note.md');
  });

  it('decodes percent-encoding', () => {
    expect(r('notes/My%20Great%20Note').toPath).toBe('notes/My Great Note.md');
  });

  it('does not mistake a dotted filename for an extension', () => {
    const hit = r('v1.2 spec');
    expect(hit.kind).toBe('note');
    expect(hit.toPath).toBe('notes/v1.2 spec.md');
  });

  it('handles non-latin filenames', () => {
    expect(r('日本語').toPath).toBe('notes/日本語.md');
  });
});

describe('attachments', () => {
  it('prefers an asset in the linking note’s folder', () => {
    expect(r('photo.png', 'notes/My Great Note.md').toPath).toBe('notes/photo.png');
    expect(r('photo.png', 'dev/Astro.md').toPath).toBe('assets/photo.png');
  });

  it('resolves an explicit asset path', () => {
    expect(r('assets/clip.mp4').kind).toBe('asset');
  });

  it('resolves canvas files', () => {
    expect(r('map.canvas').toPath).toBe('boards/map.canvas');
  });
});

describe('non-hits', () => {
  it('reports unresolved targets', () => {
    expect(r('No Such Note').kind).toBe('unresolved');
    expect(r('No Such Note').toPath).toBeUndefined();
  });

  it('treats an empty target as a link into the current note', () => {
    expect(r('', 'dev/Astro.md').kind).toBe('self');
    expect(r('', 'dev/Astro.md').toPath).toBe('dev/Astro.md');
  });

  it('does not resolve to unpublished notes', () => {
    expect(r('secret').kind).toBe('unresolved');
    expect(r('wip').kind).toBe('unresolved');
  });
});

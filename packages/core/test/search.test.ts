import { describe, expect, it } from 'vitest';
import { excerptAround, summarize, toPlainText, toSearchText } from '../src/excerpt.js';
import { buildSearchIndex, normalize, search, type SearchDoc } from '../src/search.js';
import { ancestorFolders, buildFileTree, flattenTree, orphanNotes } from '../src/tree.js';
import { buildVault } from '../src/vault.js';

describe('plain text', () => {
  it('drops fenced code entirely', () => {
    expect(toSearchText('before\n\n```js\nconst x = 1\n```\n\nafter')).toBe('before after');
  });

  it('keeps inline code contents, which are exactly what people search for', () => {
    expect(toSearchText('use `useState` here')).toBe('use useState here');
  });

  it('collapses wikilinks to their visible label', () => {
    expect(toSearchText('see [[Note]] and [[Note|the alias]] and [[Note#Heading]]')).toBe(
      'see Note and the alias and Note',
    );
  });

  it('collapses markdown links to their text', () => {
    expect(toSearchText('a [link](https://example.com) here')).toBe('a link here');
  });

  it('strips heading, quote, list and callout markers', () => {
    expect(toSearchText('## Title')).toBe('Title');
    expect(toSearchText('> [!note] Heads up\n> body')).toBe('Heads up body');
    expect(toSearchText('- one\n- two')).toBe('one two');
  });

  it('strips block anchors', () => {
    expect(toSearchText('A quotable line. ^abc-1')).toBe('A quotable line.');
  });

  it('leaves ordinary prose alone', () => {
    expect(toPlainText('Just a sentence.').trim()).toBe('Just a sentence.');
  });
});

describe('excerpts', () => {
  const text = `${'a'.repeat(200)} TARGET ${'b'.repeat(200)}`;

  it('windows around an offset and marks truncation', () => {
    const out = excerptAround(text, text.indexOf('TARGET'), 40);
    expect(out).toContain('TARGET');
    expect(out.startsWith('…')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
  });

  it('does not mark truncation when the whole text fits', () => {
    expect(excerptAround('short text', 0, 500)).toBe('short text');
  });

  it('trims half-words left behind at the edges', () => {
    const prose = 'the quick brown fox jumps over TARGET and then keeps running onwards forever';
    const out = excerptAround(prose, prose.indexOf('TARGET'), 22);
    expect(out).toContain('TARGET');

    // The raw slice would begin mid-word ("…ck brown fox"). The excerpt must
    // begin with a token that is a whole word in the source.
    const firstWord = out.replace(/^…/, '').split(' ')[0] ?? '';
    expect(new RegExp(`\\b${firstWord}\\b`).test(prose)).toBe(true);
    expect(out).not.toContain('ck brown');
  });

  it('summarises to a word boundary', () => {
    const summary = summarize('one two three four five six seven eight nine ten', 20);
    expect(summary.endsWith('…')).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(21);
  });
});

describe('file tree', () => {
  const index = buildVault([
    { path: 'index.md', content: '# Home' },
    { path: 'Banana.md', content: '# Banana' },
    { path: 'apple.md', content: '# apple' },
    { path: 'dev/index.md', content: '# Dev' },
    { path: 'dev/astro.md', content: '# Astro' },
    { path: 'dev/deep/leaf.md', content: '# Leaf' },
  ]);
  const tree = buildFileTree(index);

  it('puts folders before notes', () => {
    expect(tree[0]?.type).toBe('folder');
    expect(tree.filter((n) => n.type === 'note').length).toBe(3);
  });

  it('sorts case-insensitively', () => {
    const notes = tree.filter((n) => n.type === 'note').map((n) => n.name);
    expect(notes).toEqual(['apple', 'Banana', 'index']);
  });

  it('nests folders', () => {
    const dev = tree.find((n) => n.type === 'folder' && n.name === 'dev');
    expect(dev?.type === 'folder' && dev.children.some((c) => c.name === 'deep')).toBe(true);
  });

  it('folds a folder index note into the folder itself', () => {
    const dev = tree.find((n) => n.type === 'folder' && n.name === 'dev');
    expect(dev?.type === 'folder' && dev.indexUrl).toBe('/dev');
    expect(dev?.type === 'folder' && dev.children.some((c) => c.name === 'index')).toBe(false);
  });

  it('keeps the root index note, which is the site home', () => {
    expect(tree.some((n) => n.type === 'note' && n.name === 'index')).toBe(true);
  });

  it('flattens back to every note node', () => {
    // 6 notes in the vault, minus `dev/index.md`, which is folded into its folder.
    expect(flattenTree(tree)).toHaveLength(5);
    expect(flattenTree(tree).map((n) => n.path)).not.toContain('dev/index.md');
  });

  it('lists ancestor folders of a note', () => {
    expect(ancestorFolders('dev/deep/leaf.md')).toEqual(['dev', 'dev/deep']);
    expect(ancestorFolders('root.md')).toEqual([]);
  });

  it('finds orphans', () => {
    const v = buildVault([
      { path: 'a.md', content: 'links to [[b]]' },
      { path: 'b.md', content: 'linked' },
      { path: 'lonely.md', content: 'nobody links here' },
    ]);
    expect(orphanNotes(v).map((n) => n.path).sort()).toEqual(['a.md', 'lonely.md']);
  });
});

describe('search ranking', () => {
  const index = buildVault([
    { path: 'Astro.md', content: '---\naliases: [AstroJS]\ntags: [web]\n---\n# Astro\nA web framework.' },
    { path: 'Notes on Astro.md', content: '# Notes on Astro\n## Astro islands\nMore about it.' },
    { path: 'Unrelated.md', content: '# Unrelated\nMentions astro once in the body somewhere.' },
    { path: 'Café.md', content: '# Café\nCoffee notes.' },
  ]);
  const docs = buildSearchIndex(index);

  it('builds one doc per note', () => {
    expect(docs).toHaveLength(4);
    expect(docs.every((d) => d.url && d.title)).toBe(true);
  });

  it('ranks an exact title above a body mention', () => {
    const hits = search(docs, 'astro');
    expect(hits[0]?.doc.title).toBe('Astro');
    expect(hits[0]?.kind).toBe('title');
    const unrelated = hits.findIndex((h) => h.doc.title === 'Unrelated');
    expect(unrelated).toBeGreaterThan(0);
  });

  it('reports why a document matched', () => {
    const kinds = new Set(search(docs, 'astro').map((h) => h.kind));
    expect(kinds.has('title')).toBe(true);
  });

  it('matches aliases', () => {
    const hits = search(docs, 'astrojs');
    expect(hits[0]?.doc.title).toBe('Astro');
    expect(hits[0]?.kind).toBe('alias');
  });

  it('matches headings and names the heading', () => {
    const hits = search(docs, 'islands');
    expect(hits[0]?.doc.title).toBe('Notes on Astro');
    expect(hits[0]?.heading).toBe('Astro islands');
  });

  it('matches tags', () => {
    const hits = search(docs, 'web');
    expect(hits.some((h) => h.doc.title === 'Astro')).toBe(true);
  });

  it('returns a snippet for body matches', () => {
    const hit = search(docs, 'somewhere').find((h) => h.doc.title === 'Unrelated');
    expect(hit?.snippet).toContain('somewhere');
  });

  it('requires every term to match (AND, not OR)', () => {
    expect(search(docs, 'astro coffee')).toHaveLength(0);
    expect(search(docs, 'notes astro').map((h) => h.doc.title)).toContain('Notes on Astro');
  });

  it('ignores diacritics in both directions', () => {
    expect(normalize('Café')).toBe('cafe');
    expect(search(docs, 'cafe')[0]?.doc.title).toBe('Café');
  });

  it('falls back to a fuzzy title match for typos', () => {
    const hits = search(docs, 'astr');
    expect(hits[0]?.doc.title).toBe('Astro');
    const fuzzy = search(docs, 'unrltd');
    expect(fuzzy[0]?.doc.title).toBe('Unrelated');
    expect(fuzzy[0]?.kind).toBe('fuzzy');
  });

  it('can skip the body for a titles-only palette', () => {
    expect(search(docs, 'somewhere', { includeBody: false })).toHaveLength(0);
  });

  it('honours the limit and returns nothing for an empty query', () => {
    expect(search(docs, 'a', { limit: 2 }).length).toBeLessThanOrEqual(2);
    expect(search(docs, '   ')).toHaveLength(0);
  });

  it('caps indexed body length', () => {
    const big = buildVault([{ path: 'big.md', content: `# Big\n${'word '.repeat(5000)}` }]);
    expect(buildSearchIndex(big, { maxTextChars: 100 })[0]?.text.length).toBeLessThanOrEqual(100);
  });
});

describe('backlink context', () => {
  const v = buildVault([
    { path: 'src.md', content: 'A sentence that mentions [[Target]] in the middle of prose.' },
    { path: 'Target.md', content: '# Target' },
  ]);

  it('captures the prose around each backlink', () => {
    const context = v.backlinks['Target.md']?.[0]?.context ?? '';
    expect(context).toContain('mentions');
    expect(context).toContain('middle of prose');
  });
});

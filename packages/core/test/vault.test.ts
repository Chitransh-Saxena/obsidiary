import { describe, expect, it } from 'vitest';
import { buildVault, findBySlug, listNotes } from '../src/vault.js';
import { FILES, makeVault } from './fixture.js';

const index = makeVault();

describe('publishing filters', () => {
  it('drops drafts and publish:false by default', () => {
    expect(index.notes['drafts/wip.md']).toBeUndefined();
    expect(index.notes['private/secret.md']).toBeUndefined();
  });

  it('ignores .obsidian and other vault plumbing', () => {
    expect(Object.keys(index.notes).some((p) => p.startsWith('.obsidian'))).toBe(false);
  });

  it('honours explicitPublish', () => {
    const strict = buildVault(
      [
        { path: 'a.md', content: '---\npublish: true\n---\nyes' },
        { path: 'b.md', content: 'no frontmatter' },
      ],
      { explicitPublish: true },
    );
    expect(Object.keys(strict.notes)).toEqual(['a.md']);
  });

  it('honours a custom ignore list', () => {
    const filtered = buildVault(FILES, { ignore: ['dev/'] });
    expect(Object.keys(filtered.notes).some((p) => p.startsWith('dev/'))).toBe(false);
  });
});

describe('slugs and urls', () => {
  it('serves index.md at the site root', () => {
    expect(index.notes['index.md']?.url).toBe('/');
  });

  it('slugifies spaces and case', () => {
    expect(index.notes['notes/My Great Note.md']?.slug).toBe('notes/my-great-note');
  });

  it('keeps non-latin filenames intact', () => {
    expect(index.notes['notes/日本語.md']?.slug).toBe('notes/日本語');
  });

  it('disambiguates notes that would slug to the same url', () => {
    const slugs = listNotes(index).map((n) => n.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('honours a permalink override', () => {
    const v = buildVault([{ path: 'deep/thing.md', content: '---\npermalink: /custom//\n---\nhi' }]);
    expect(v.notes['deep/thing.md']?.slug).toBe('custom');
  });

  it('applies a base prefix', () => {
    const v = buildVault([{ path: 'a.md', content: 'hi' }], { base: '/notes' });
    expect(v.notes['a.md']?.url).toBe('/notes/a');
  });

  it('finds notes by slug', () => {
    expect(findBySlug(index, 'dev/astro')?.path).toBe('dev/Astro.md');
  });
});

describe('frontmatter', () => {
  it('reads aliases in list form', () => {
    expect(index.notes['aliased.md']?.aliases).toEqual(['AKA', 'Second Name', 'Astro']);
  });

  it('reads comma-separated aliases and tags', () => {
    const v = buildVault([
      { path: 'a.md', content: '---\naliases: One, Two\ntags: x, y/z\n---\nbody' },
    ]);
    expect(v.notes['a.md']?.aliases).toEqual(['One', 'Two']);
    expect(v.notes['a.md']?.tags).toEqual(['x', 'y/z']);
  });

  it('survives malformed yaml rather than failing the build', () => {
    const v = buildVault([{ path: 'a.md', content: '---\n: : bad: [\n---\n# Fine\n' }]);
    expect(v.notes['a.md']?.headings[0]?.text).toBe('Fine');
  });

  it('does not treat a body-leading --- as frontmatter when unterminated', () => {
    const v = buildVault([{ path: 'a.md', content: '---\nnot closed\n\n# Heading\n' }]);
    expect(v.notes['a.md']?.headings[0]?.text).toBe('Heading');
  });
});

describe('headings, blocks and tags', () => {
  const v = buildVault([
    {
      path: 'a.md',
      content: [
        '---',
        'tags: [front]',
        '---',
        '# Title',
        '',
        'Body with #inline and #nest/ed tags.',
        '',
        '## Section',
        '',
        'A quotable paragraph. ^quote-1',
        '',
        '```',
        '# not a heading',
        '[[not a link]]',
        '#not-a-tag',
        '```',
      ].join('\n'),
    },
  ]);
  const note = v.notes['a.md'];

  it('extracts headings with line numbers offset past the frontmatter', () => {
    expect(note?.headings.map((h) => h.text)).toEqual(['Title', 'Section']);
    expect(note?.headings[0]?.line).toBe(4);
  });

  it('extracts block anchors', () => {
    expect(note?.blocks).toEqual([{ id: 'quote-1', line: 10 }]);
  });

  it('merges frontmatter and inline tags', () => {
    expect(note?.tags).toEqual(['front', 'inline', 'nest/ed']);
  });

  it('ignores fenced code when scanning', () => {
    expect(note?.tags).not.toContain('not-a-tag');
    expect(note?.links).toHaveLength(0);
  });
});

describe('inline code is not content', () => {
  const v = buildVault([
    {
      path: 'doc.md',
      content: [
        'Write `[[Target]]` to link, or `![[Target]]` to embed.',
        '',
        'A ``literal `#tag` `` stays literal.',
        '',
        'But [[Target]] out here is a real link.',
      ].join('\n'),
      },
    { path: 'Target.md', content: '# Target' },
  ]);

  it('does not index wikilinks written inside inline code', () => {
    // Otherwise any note documenting the syntax fills the graph with phantoms,
    // and the index disagrees with what the renderer actually produced.
    expect(v.notes['doc.md']?.links).toHaveLength(1);
    expect(v.graph.unresolved).toEqual({});
  });

  it('still indexes links outside code', () => {
    expect(v.graph.nodes['doc.md']?.outgoing).toEqual(['Target.md']);
  });

  it('does not index tags written inside inline code', () => {
    expect(v.notes['doc.md']?.tags).toEqual([]);
  });
});

describe('graph', () => {
  const v = buildVault([
    { path: 'a.md', content: 'links to [[b]] twice [[b]] and [[ghost]]' },
    { path: 'b.md', content: 'links back to [[a]]' },
    { path: 'c.md', content: 'nothing here' },
  ]);

  it('records outgoing links once each', () => {
    expect(v.graph.nodes['a.md']?.outgoing).toEqual(['b.md']);
  });

  it('records incoming links', () => {
    expect(v.graph.nodes['b.md']?.incoming).toEqual(['a.md']);
    expect(v.graph.nodes['c.md']?.incoming).toEqual([]);
  });

  it('keeps every individual backlink, not just the source note', () => {
    expect(v.backlinks['b.md']).toHaveLength(2);
    expect(v.backlinks['b.md']?.[0]?.fromPath).toBe('a.md');
  });

  it('tracks unresolved targets and who referenced them', () => {
    expect(v.graph.unresolved['ghost']).toEqual(['a.md']);
  });

  it('produces a deduped edge list', () => {
    expect(v.graph.edges).toEqual([
      { from: 'a.md', to: 'b.md' },
      { from: 'b.md', to: 'a.md' },
    ]);
  });
});

describe('tag index', () => {
  const v = buildVault([
    { path: 'a.md', content: '#project/alpha/deep' },
    { path: 'b.md', content: '#project/beta' },
  ]);

  it('indexes every ancestor of a nested tag', () => {
    expect(v.tags['project']).toEqual(['a.md', 'b.md']);
    expect(v.tags['project/alpha']).toEqual(['a.md']);
    expect(v.tags['project/alpha/deep']).toEqual(['a.md']);
  });
});

describe('serialisability', () => {
  it('round-trips through JSON unchanged, so live mode can ship it as-is', () => {
    const round = JSON.parse(JSON.stringify(index));
    expect(round).toEqual(index);
  });
});

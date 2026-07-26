import { describe, expect, it } from 'vitest';
import { createRenderer } from '../src/markdown/pipeline.js';
import { buildVault } from '../src/vault.js';
import type { VaultFile } from '../src/types.js';

function render(files: VaultFile[], path: string, options = {}) {
  const index = buildVault(files);
  return createRenderer(index, options).renderNote(path);
}

describe('wikilinks', () => {
  const files: VaultFile[] = [
    { path: 'a.md', content: 'see [[Target]] and [[Target|the alias]] and [[Nope]]' },
    { path: 'Target.md', content: '# Target\n' },
  ];

  it('renders a resolved link', () => {
    const html = render(files, 'a.md');
    expect(html).toContain('href="/target"');
    expect(html).toContain('class="internal-link"');
    expect(html).toContain('>Target</a>');
  });

  it('uses the alias as the label', () => {
    expect(render(files, 'a.md')).toContain('>the alias</a>');
  });

  it('renders an unresolved link as a non-link span', () => {
    const html = render(files, 'a.md');
    expect(html).toContain('class="internal-link is-unresolved"');
    expect(html).toContain('data-target="Nope"');
    expect(html).not.toContain('href="/nope"');
  });

  it('appends a heading anchor', () => {
    const html = render(
      [
        { path: 'a.md', content: '[[Target#Some Section]]' },
        { path: 'Target.md', content: '## Some Section\n' },
      ],
      'a.md',
    );
    expect(html).toContain('href="/target#some-section"');
  });

  it('reads an aliased link inside a table when the pipe is escaped', () => {
    // Inside a GFM table the pipe is a cell separator first, so `[[a|b]]` splits
    // the row. `\|` is the escape, and Obsidian has the same constraint.
    const html = render(
      [
        { path: 'a.md', content: '| x | y |\n| - | - |\n| one | [[Target\\|the label]] |' },
        { path: 'Target.md', content: '# Target' },
      ],
      'a.md',
    );
    expect(html).toContain('href="/target"');
    expect(html).toContain('>the label</a>');
  });

  it('leaves wikilinks inside code alone', () => {
    const html = render([{ path: 'a.md', content: 'text\n\n```\n[[Target]]\n```\n' }], 'a.md');
    expect(html).toContain('[[Target]]');
    expect(html).not.toContain('internal-link');
  });

  it('leaves wikilinks inside inline code alone', () => {
    const html = render([{ path: 'a.md', content: 'use `[[Target]]` to link' }], 'a.md');
    expect(html).toContain('<code>[[Target]]</code>');
  });
});

describe('tags', () => {
  it('links inline tags', () => {
    const html = render([{ path: 'a.md', content: 'about #rust and #lang/rust' }], 'a.md');
    expect(html).toContain('href="/tags/rust"');
    expect(html).toContain('href="/tags/lang/rust"');
    expect(html).toContain('>#rust</a>');
  });

  it('does not linkify a heading', () => {
    const html = render([{ path: 'a.md', content: '# Heading\n' }], 'a.md');
    expect(html).not.toContain('/tags/');
  });
});

describe('callouts', () => {
  it('renders a plain callout', () => {
    const html = render([{ path: 'a.md', content: '> [!note] Remember\n> body text' }], 'a.md');
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('class="callout callout-note"');
    expect(html).toContain('>Remember<');
    expect(html).toContain('body text');
  });

  it('falls back to the type as the title', () => {
    expect(render([{ path: 'a.md', content: '> [!warning]\n> careful' }], 'a.md')).toContain('>Warning<');
  });

  it('maps aliases to a canonical type', () => {
    expect(render([{ path: 'a.md', content: '> [!tldr] X\n> y' }], 'a.md')).toContain('data-callout="abstract"');
  });

  it('renders a foldable callout as details/summary with no javascript', () => {
    const collapsed = render([{ path: 'a.md', content: '> [!tip]- Hidden\n> body' }], 'a.md');
    expect(collapsed).toContain('<details');
    expect(collapsed).toContain('<summary');
    expect(collapsed).not.toContain('open');

    const expanded = render([{ path: 'a.md', content: '> [!tip]+ Shown\n> body' }], 'a.md');
    expect(expanded).toContain('open');
  });

  it('leaves an ordinary blockquote alone', () => {
    const html = render([{ path: 'a.md', content: '> just a quote' }], 'a.md');
    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('callout');
  });
});

describe('transclusion', () => {
  const files: VaultFile[] = [
    { path: 'host.md', content: 'before\n\n![[Source]]\n\nafter' },
    {
      path: 'Source.md',
      content: [
        '# Source',
        '',
        'Intro paragraph.',
        '',
        '## Section One',
        '',
        'One body.',
        '',
        '## Section Two',
        '',
        'Two body. ^two-block',
      ].join('\n'),
    },
  ];

  it('inlines the whole note', () => {
    const html = render(files, 'host.md');
    expect(html).toContain('class="obsidiary-embed"');
    expect(html).toContain('Intro paragraph.');
    expect(html).toContain('One body.');
  });

  it('does not nest a block embed inside a paragraph', () => {
    expect(render(files, 'host.md')).not.toMatch(/<p>\s*<div class="obsidiary-embed"/);
  });

  it('inlines only the requested section', () => {
    const html = render(
      [{ path: 'host.md', content: '![[Source#Section One]]' }, files[1]!],
      'host.md',
    );
    expect(html).toContain('One body.');
    expect(html).not.toContain('Two body.');
    expect(html).not.toContain('Intro paragraph.');
  });

  it('inlines only the requested block', () => {
    const html = render(
      [{ path: 'host.md', content: '![[Source#^two-block]]' }, files[1]!],
      'host.md',
    );
    expect(html).toContain('Two body.');
    expect(html).not.toContain('One body.');
  });

  it('strips the ^block-id marker from the text and anchors it url-safely', () => {
    const html = render(files, 'Source.md');
    expect(html).toContain('<p id="block-two-block"');
    expect(html).toContain('>Two body.</p>');
    expect(html).not.toContain('^two-block');
  });

  it('points a block link at the safe anchor', () => {
    const html = render(
      [{ path: 'host.md', content: 'see [[Source#^two-block]]' }, files[1]!],
      'host.md',
    );
    expect(html).toContain('href="/source#block-two-block"');
  });

  it('degrades an embed of a missing note to an unresolved link', () => {
    const html = render([{ path: 'a.md', content: '![[Ghost]]' }], 'a.md');
    expect(html).toContain('is-unresolved');
  });

  it('terminates on a cycle instead of hanging', () => {
    const html = render(
      [
        { path: 'a.md', content: 'A body ![[b]]' },
        { path: 'b.md', content: 'B body ![[a]]' },
      ],
      'a.md',
    );
    expect(html).toContain('B body');
    // The inner embed of `a` degrades to a link rather than recursing.
    expect(html).toContain('href="/a"');
  });

  it('stops at maxEmbedDepth', () => {
    const chain: VaultFile[] = [
      { path: 'l0.md', content: 'zero ![[l1]]' },
      { path: 'l1.md', content: 'one ![[l2]]' },
      { path: 'l2.md', content: 'two ![[l3]]' },
      { path: 'l3.md', content: 'three ![[l4]]' },
      { path: 'l4.md', content: 'four' },
    ];
    const html = render(chain, 'l0.md', { maxEmbedDepth: 2 });
    expect(html).toContain('two');
    expect(html).not.toContain('four');
  });
});

describe('attachment embeds', () => {
  const files: VaultFile[] = [
    { path: 'a.md', content: '![[pic.png]]\n\n![[pic.png|320x200]]\n\n![[clip.mp4]]\n\n![[song.mp3]]\n\n![[doc.pdf]]' },
    { path: 'pic.png' },
    { path: 'clip.mp4' },
    { path: 'song.mp3' },
    { path: 'doc.pdf' },
  ];

  it('renders images', () => {
    const html = render(files, 'a.md');
    expect(html).toContain('<img src="/_assets/pic.png"');
    expect(html).toContain('loading="lazy"');
  });

  it('applies embed dimensions', () => {
    const html = render(files, 'a.md');
    expect(html).toContain('width="320"');
    expect(html).toContain('height="200"');
  });

  it('renders video, audio and pdf', () => {
    const html = render(files, 'a.md');
    expect(html).toContain('<video');
    expect(html).toContain('<audio');
    expect(html).toContain('<iframe');
  });
});

describe('security defaults', () => {
  it('drops raw html unless allowHtml is set', () => {
    const html = render([{ path: 'a.md', content: 'hi <script>alert(1)</script>' }], 'a.md');
    expect(html).not.toContain('<script>');
  });

  it('passes html through when explicitly allowed', () => {
    const html = render([{ path: 'a.md', content: '<mark>ok</mark>' }], 'a.md', { allowHtml: true });
    expect(html).toContain('<mark>ok</mark>');
  });
});

describe('markdown extras', () => {
  it('renders gfm tables and task lists', () => {
    const html = render(
      [{ path: 'a.md', content: '| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n- [ ] todo' }],
      'a.md',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('type="checkbox"');
  });

  it('renders math', () => {
    const html = render([{ path: 'a.md', content: 'inline $e^{i\\pi}+1=0$ math' }], 'a.md');
    expect(html).toContain('katex');
  });

  it('adds heading ids', () => {
    expect(render([{ path: 'a.md', content: '## Some Section' }], 'a.md')).toContain('id="some-section"');
  });
});

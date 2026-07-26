import { describe, expect, it } from 'vitest';
import { findTags, findWikilinks, parseEmbedSize, parseWikilinkBody } from '../src/syntax.js';

describe('wikilink parsing', () => {
  const parse = (body: string) => parseWikilinkBody(body, false, `[[${body}]]`);

  it('reads a bare target', () => {
    expect(parse('Note')).toMatchObject({ target: 'Note', embed: false });
  });

  it('reads an alias', () => {
    expect(parse('Note|Display')).toMatchObject({ target: 'Note', alias: 'Display' });
  });

  it('splits on the first pipe, so aliases may contain # and |', () => {
    expect(parse('Note|a#b')).toMatchObject({ target: 'Note', alias: 'a#b' });
  });

  it('reads a heading subpath', () => {
    expect(parse('Note#Section')).toMatchObject({
      target: 'Note',
      subpath: { kind: 'heading', segments: ['Section'] },
    });
  });

  it('reads a nested heading path', () => {
    expect(parse('Note#Outer#Inner').subpath?.segments).toEqual(['Outer', 'Inner']);
  });

  it('reads a block reference', () => {
    expect(parse('Note#^abc123').subpath).toMatchObject({ kind: 'block', segments: ['abc123'] });
  });

  it('reads a same-note heading link', () => {
    expect(parse('#Section')).toMatchObject({
      target: '',
      subpath: { kind: 'heading', segments: ['Section'] },
    });
  });

  it('combines subpath and alias', () => {
    expect(parse('Note#Section|Label')).toMatchObject({
      target: 'Note',
      alias: 'Label',
      subpath: { kind: 'heading', segments: ['Section'] },
    });
  });
});

describe('finding links in text', () => {
  it('finds several links on a line', () => {
    const found = findWikilinks('see [[A]] and ![[B]] and [[C|c]]');
    expect(found.map((l) => l.target)).toEqual(['A', 'B', 'C']);
    expect(found[1]?.embed).toBe(true);
  });

  it('does not let an unclosed link swallow the rest of the line', () => {
    expect(findWikilinks('[[unclosed and [[Real]]')).toHaveLength(1);
    expect(findWikilinks('[[unclosed and [[Real]]')[0]?.target).toBe('unclosed and [[Real');
  });

  it('does not span newlines', () => {
    expect(findWikilinks('[[a\nb]]')).toHaveLength(0);
  });
});

describe('tags', () => {
  it('finds plain and nested tags', () => {
    expect(findTags('a #tag and #nested/tag here')).toEqual(['tag', 'nested/tag']);
  });

  it('ignores a bare number', () => {
    expect(findTags('closes #123')).toEqual([]);
  });

  it('ignores a URL fragment', () => {
    expect(findTags('see https://example.com#section')).toEqual([]);
  });

  it('ignores markdown headings', () => {
    expect(findTags('# Heading\n## Another')).toEqual([]);
  });

  it('accepts a tag at the very start of the text', () => {
    expect(findTags('#first thing')).toEqual(['first']);
  });

  it('dedupes', () => {
    expect(findTags('#a and #a again')).toEqual(['a']);
  });
});

describe('embed sizes', () => {
  it('reads a width', () => {
    expect(parseEmbedSize('300')).toEqual({ width: 300 });
  });

  it('reads width x height', () => {
    expect(parseEmbedSize('300x200')).toEqual({ width: 300, height: 200 });
  });

  it('treats ordinary alias text as not-a-size', () => {
    expect(parseEmbedSize('a caption')).toBeNull();
    expect(parseEmbedSize(undefined)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { buildVault, buildSequences, neighboursOf, isHubPath } from '../src/index.js';

/** A vault whose hubs list their notes in a deliberate, non-alphabetical order. */
function vault() {
  return buildVault([
    {
      path: 'index.md',
      content: '# Home\n\n- [[Guitar]]\n- [[Photos]]\n',
    },
    {
      path: 'music/index.md',
      // Deliberately not alphabetical: this is the reading order.
      // The alias is what lets `[[Guitar]]` reach a file named `index.md` —
      // real hub notes carry one for exactly this reason.
      content: [
        '---',
        'title: Guitar',
        'aliases: [Guitar]',
        '---',
        '',
        '# Guitar',
        '',
        '1. [[The fretboard]]',
        '2. [[Chords]]',
        '3. [[The capo]]',
        '',
        'Back to [[index|home]], and see [[Photos]].',
        '',
        '![[The fretboard]]',
      ].join('\n'),
    },
    { path: 'music/theory/The fretboard.md', content: '# The fretboard' },
    { path: 'music/theory/Chords.md', content: '# Chords' },
    { path: 'music/theory/The capo.md', content: '# The capo' },
    {
      path: 'photography/index.md',
      content: '---\ntitle: Photos\naliases: [Photos]\n---\n\n# Photos\n\n- [[Low light]]\n',
    },
    { path: 'photography/Low light.md', content: '# Low light' },
    { path: 'loose/Orphan.md', content: '# Orphan' },
  ]);
}

describe('reading order from hub notes', () => {
  it('recognises hub notes at any depth', () => {
    expect(isHubPath('index.md')).toBe(true);
    expect(isHubPath('fpv/index.md')).toBe(true);
    expect(isHubPath('fpv/Index.MD')).toBe(true);
    expect(isHubPath('fpv/indexing.md')).toBe(false);
    expect(isHubPath('fpv/Note.md')).toBe(false);
  });

  it('takes the order the hub lists, not alphabetical order', () => {
    const seqs = buildSequences(vault());
    expect(seqs['music']?.items).toEqual([
      'music/theory/The fretboard.md',
      'music/theory/Chords.md',
      'music/theory/The capo.md',
    ]);
  });

  it('ignores links that leave the hub folder', () => {
    const seqs = buildSequences(vault());
    // `[[index|home]]` and `[[Photos]]` are links, but neither is a "next page".
    expect(seqs['music']?.items).not.toContain('index.md');
    expect(seqs['music']?.items).not.toContain('photography/index.md');
  });

  it('ignores prose mentions — only the list is the contents page', () => {
    const seqs = buildSequences(vault());
    // "Back to [[index|home]], and see [[Photos]]." is prose, and so is any
    // later sentence about a note that is already listed.
    expect(seqs['music']?.items).toHaveLength(3);
  });

  it('counts links in a table row, which is how a root index is often written', () => {
    const index = buildVault([
      {
        path: 'index.md',
        content: [
          '# Home',
          '',
          '| Folder | Area |',
          '| --- | --- |',
          '| `a/` | [[Alpha]] |',
          '| `b/` | [[Beta]] |',
          '',
          'Some prose about [[Gamma]] that is not a contents entry.',
        ].join('\n'),
      },
      { path: 'a/index.md', content: '---\naliases: [Alpha]\n---\n\n# Alpha' },
      { path: 'b/index.md', content: '---\naliases: [Beta]\n---\n\n# Beta' },
      { path: 'c/index.md', content: '---\naliases: [Gamma]\n---\n\n# Gamma' },
    ]);
    expect(buildSequences(index)['']?.items).toEqual(['a/index.md', 'b/index.md']);
  });

  it('ignores embeds — transcluding a note is not listing it', () => {
    const seqs = buildSequences(vault());
    // `![[The fretboard]]` appears after the list; it must not duplicate.
    expect(seqs['music']?.items.filter((p) => p.endsWith('The fretboard.md'))).toHaveLength(1);
  });

  it('gives the root hub a sequence of the area hubs', () => {
    const seqs = buildSequences(vault());
    expect(seqs['']?.items).toEqual(['music/index.md', 'photography/index.md']);
  });

  it('finds neighbours in the middle of a sequence', () => {
    const index = vault();
    const n = neighboursOf(index, 'music/theory/Chords.md');
    expect(n?.prev?.path).toBe('music/theory/The fretboard.md');
    expect(n?.next?.path).toBe('music/theory/The capo.md');
    expect(n?.hub?.path).toBe('music/index.md');
    expect(n?.position).toBe(2);
    expect(n?.total).toBe(3);
  });

  it('omits the missing side at each end', () => {
    const index = vault();
    const first = neighboursOf(index, 'music/theory/The fretboard.md');
    expect(first?.prev).toBeUndefined();
    expect(first?.next?.path).toBe('music/theory/Chords.md');

    const last = neighboursOf(index, 'music/theory/The capo.md');
    expect(last?.prev?.path).toBe('music/theory/Chords.md');
    expect(last?.next).toBeUndefined();
  });

  it('returns null for a note nothing lists, rather than guessing', () => {
    expect(neighboursOf(vault(), 'loose/Orphan.md')).toBeNull();
  });

  it('prefers the deepest hub when two list the same note', () => {
    const index = buildVault([
      { path: 'index.md', content: '# Home\n\n- [[Deep]]\n- [[Area]]\n' },
      {
        path: 'area/index.md',
        content: '---\ntitle: Area\naliases: [Area]\n---\n\n- [[Other]]\n- [[Deep]]\n',
      },
      { path: 'area/Deep.md', content: '# Deep' },
      { path: 'area/Other.md', content: '# Other' },
    ]);
    // Root lists it too, but the area hub is the more specific claim.
    const n = neighboursOf(index, 'area/Deep.md');
    expect(n?.hub?.path).toBe('area/index.md');
    expect(n?.prev?.path).toBe('area/Other.md');
  });

  it('a vault with no hubs has no sequences', () => {
    const index = buildVault([
      { path: 'a.md', content: '# A\n[[b]]' },
      { path: 'b.md', content: '# B' },
    ]);
    expect(buildSequences(index)).toEqual({});
    expect(neighboursOf(index, 'a.md')).toBeNull();
  });
});

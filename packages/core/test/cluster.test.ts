import { describe, expect, it } from 'vitest';
import { detectCommunities } from '../src/cluster.js';

/** Two tight groups joined by a single bridge — the textbook case. */
const NODES = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'];
const LINKS = [
  { source: 'a1', target: 'a2' },
  { source: 'a2', target: 'a3' },
  { source: 'a3', target: 'a1' },
  { source: 'b1', target: 'b2' },
  { source: 'b2', target: 'b3' },
  { source: 'b3', target: 'b1' },
  { source: 'a1', target: 'b1' },
];

describe('community detection', () => {
  it('separates two densely linked groups', () => {
    const { of } = detectCommunities(NODES, LINKS);
    expect(of.a1).toBe(of.a2);
    expect(of.a2).toBe(of.a3);
    expect(of.b1).toBe(of.b2);
    expect(of.b2).toBe(of.b3);
    expect(of.a1).not.toBe(of.b1);
  });

  it('is deterministic across runs', () => {
    const runs = Array.from({ length: 8 }, () =>
      JSON.stringify(detectCommunities(NODES, LINKS).of),
    );
    expect(new Set(runs).size).toBe(1);
  });

  it('does not depend on the order the nodes arrive in', () => {
    const forward = detectCommunities(NODES, LINKS).of;
    const backward = detectCommunities([...NODES].reverse(), [...LINKS].reverse()).of;
    // Ids may differ; the partition must not.
    const sameGroup = (o: Record<string, number>, x: string, y: string) => o[x] === o[y];
    for (const [x, y] of [['a1', 'a3'], ['b1', 'b3']] as const) {
      expect(sameGroup(forward, x, y)).toBe(sameGroup(backward, x, y));
    }
    expect(sameGroup(backward, 'a1', 'b1')).toBe(false);
  });

  it('numbers the largest community 0, so colours stay put as a vault grows', () => {
    const { communities } = detectCommunities(
      ['big1', 'big2', 'big3', 'small1', 'small2'],
      [
        { source: 'big1', target: 'big2' },
        { source: 'big2', target: 'big3' },
        { source: 'big3', target: 'big1' },
        { source: 'small1', target: 'small2' },
      ],
    );
    expect(communities[0]?.members).toHaveLength(3);
    expect(communities[0]?.id).toBe(0);
    expect(communities[1]?.members).toHaveLength(2);
  });

  it('names each community after its most connected member', () => {
    const { communities } = detectCommunities(
      ['hub', 'x', 'y', 'z'],
      [
        { source: 'hub', target: 'x' },
        { source: 'hub', target: 'y' },
        { source: 'hub', target: 'z' },
      ],
    );
    expect(communities[0]?.hub).toBe('hub');
  });

  it('leaves an unlinked note in a community of its own', () => {
    const { of, communities } = detectCommunities(
      ['a', 'b', 'lonely'],
      [{ source: 'a', target: 'b' }],
    );
    expect(of.lonely).not.toBe(of.a);
    expect(communities.find((c) => c.members.includes('lonely'))?.members).toEqual(['lonely']);
  });

  it('handles an empty graph and a graph with no links', () => {
    expect(detectCommunities([], [])).toEqual({ of: {}, communities: [], modularity: 0 });
    const none = detectCommunities(['a', 'b'], []);
    expect(none.communities).toHaveLength(2);
  });

  it('reports a modularity that reflects real structure', () => {
    // Two triangles joined by one edge is textbook community structure.
    expect(detectCommunities(NODES, LINKS).modularity).toBeGreaterThan(0.3);
    // A complete graph has none to find.
    const clique = ['a', 'b', 'c', 'd'];
    const all = clique.flatMap((s, i) => clique.slice(i + 1).map((t) => ({ source: s, target: t })));
    expect(detectCommunities(clique, all).modularity).toBeLessThan(0.2);
  });

  it('ignores self-links', () => {
    const { communities } = detectCommunities(['a'], [{ source: 'a', target: 'a' }]);
    expect(communities).toHaveLength(1);
  });
});

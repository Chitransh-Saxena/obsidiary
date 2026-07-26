import { describe, expect, it } from 'vitest';
import { boundsOf, createSimulation } from '../src/graphsim.js';
import { fullGraph, neighborhood } from '../src/graph.js';
import { buildVault } from '../src/vault.js';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('force simulation', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const links = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];

  it('is deterministic — the same vault always lays out the same way', () => {
    const one = createSimulation(ids, links);
    const two = createSimulation(ids, links);
    one.run();
    two.run();
    expect(one.nodes.map((n) => [n.x, n.y])).toEqual(two.nodes.map((n) => [n.x, n.y]));
  });

  it('produces finite positions', () => {
    const sim = createSimulation(ids, links);
    sim.run();
    for (const node of sim.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('settles rather than running forever', () => {
    const sim = createSimulation(ids, links);
    const steps = sim.run(5000);
    expect(steps).toBeLessThan(5000);
    expect(sim.tick()).toBe(false);
  });

  it('pulls linked nodes closer than unlinked ones', () => {
    const sim = createSimulation(['a', 'b', 'lonely'], [{ source: 'a', target: 'b' }]);
    sim.run();
    const [a, b, lonely] = sim.nodes as [(typeof sim.nodes)[0], (typeof sim.nodes)[0], (typeof sim.nodes)[0]];
    expect(dist(a, b)).toBeLessThan(dist(a, lonely));
  });

  it('records degree and ignores self-links and dangling links', () => {
    const sim = createSimulation(['a', 'b'], [
      { source: 'a', target: 'a' },
      { source: 'a', target: 'ghost' },
      { source: 'a', target: 'b' },
    ]);
    expect(sim.links).toHaveLength(1);
    expect(sim.nodes.find((n) => n.id === 'a')?.degree).toBe(1);
  });

  it('separates coincident nodes instead of producing NaN', () => {
    const sim = createSimulation(['a', 'b'], []);
    sim.nodes[0]!.x = 0;
    sim.nodes[0]!.y = 0;
    sim.nodes[1]!.x = 0;
    sim.nodes[1]!.y = 0;
    sim.run(50);
    expect(Number.isFinite(sim.nodes[0]!.x)).toBe(true);
    expect(dist(sim.nodes[0]!, sim.nodes[1]!)).toBeGreaterThan(0);
  });

  it('leaves pinned nodes where they were put', () => {
    const sim = createSimulation(['a', 'b'], [{ source: 'a', target: 'b' }]);
    sim.nodes[0]!.x = 5;
    sim.nodes[0]!.y = 7;
    sim.nodes[0]!.fixed = true;
    sim.run();
    expect(sim.nodes[0]!.x).toBe(5);
    expect(sim.nodes[0]!.y).toBe(7);
  });

  it('can be reheated', () => {
    const sim = createSimulation(ids, links);
    sim.run();
    expect(sim.tick()).toBe(false);
    sim.reheat();
    expect(sim.tick()).toBe(true);
  });

  it('handles an empty graph', () => {
    const sim = createSimulation([], []);
    expect(sim.run()).toBeGreaterThanOrEqual(0);
    expect(sim.nodes).toEqual([]);
  });
});

describe('bounds', () => {
  it('measures a point set with padding', () => {
    const b = boundsOf([{ x: -10, y: 5 }, { x: 20, y: 30 }], 5);
    expect(b).toMatchObject({ minX: -15, minY: 0, maxX: 25, maxY: 35, width: 40, height: 35 });
  });

  it('handles no points', () => {
    expect(boundsOf([]).width).toBe(0);
  });
});

describe('neighbourhood extraction', () => {
  const index = buildVault([
    { path: 'hub.md', content: 'links [[one]] [[two]]' },
    { path: 'one.md', content: 'links [[deep]]' },
    { path: 'two.md', content: 'nothing' },
    { path: 'deep.md', content: 'nothing' },
    { path: 'island.md', content: 'unconnected' },
  ]);

  it('collects direct neighbours at depth 1', () => {
    const sub = neighborhood(index, 'hub.md', 1);
    expect(sub.nodes.sort()).toEqual(['hub.md', 'one.md', 'two.md']);
    expect(sub.truncated).toBe(false);
  });

  it('reaches further at depth 2', () => {
    expect(neighborhood(index, 'hub.md', 2).nodes).toContain('deep.md');
  });

  it('follows links in both directions', () => {
    // `one` is linked *from* hub; the local graph should still show hub.
    expect(neighborhood(index, 'one.md', 1).nodes.sort()).toEqual(['deep.md', 'hub.md', 'one.md']);
  });

  it('excludes unconnected notes', () => {
    expect(neighborhood(index, 'hub.md', 2).nodes).not.toContain('island.md');
  });

  it('collapses a mutual link into a single edge', () => {
    const mutual = buildVault([
      { path: 'a.md', content: '[[b]]' },
      { path: 'b.md', content: '[[a]]' },
    ]);
    expect(neighborhood(mutual, 'a.md', 1).links).toHaveLength(1);
  });

  it('caps breadth-first, so the nearest neighbours are the ones that survive', () => {
    const wide = buildVault([
      { path: 'hub.md', content: '[[a]] [[b]] [[c]] [[d]]' },
      { path: 'a.md', content: '' },
      { path: 'b.md', content: '' },
      { path: 'c.md', content: '' },
      { path: 'd.md', content: '' },
    ]);
    const sub = neighborhood(wide, 'hub.md', 1, 3);
    expect(sub.nodes).toHaveLength(3);
    expect(sub.nodes).toContain('hub.md');
    expect(sub.truncated).toBe(true);
  });

  it('returns nothing for a note that is not in the vault', () => {
    expect(neighborhood(index, 'nope.md', 1).nodes).toEqual([]);
  });
});

describe('full graph', () => {
  const index = buildVault([
    { path: 'hub.md', content: '[[a]] [[b]] [[c]]' },
    { path: 'a.md', content: '[[b]]' },
    { path: 'b.md', content: '' },
    { path: 'c.md', content: '' },
  ]);

  it('includes everything when under the cap', () => {
    const g = fullGraph(index);
    expect(g.nodes).toHaveLength(4);
    expect(g.truncated).toBe(false);
  });

  it('keeps the most connected notes when over the cap', () => {
    const g = fullGraph(index, 2);
    expect(g.truncated).toBe(true);
    expect(g.nodes).toContain('hub.md');
    expect(g.nodes).toHaveLength(2);
  });
});

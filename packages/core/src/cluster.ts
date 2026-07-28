/**
 * Community detection over the link graph.
 *
 * Colouring a graph by folder is easy and slightly dishonest — it shows you the
 * filesystem, which you already know. This finds clusters in the *links*: notes
 * that actually reference each other end up together, whatever folder they sit
 * in. When a vault is well organised the two mostly agree, and where they differ
 * the links are the more interesting answer.
 *
 * Louvain modularity optimisation (Blondel et al., 2008). The obvious cheaper
 * choice, label propagation, breaks ties randomly; making it deterministic makes
 * it degenerate — every tie resolves the same direction and the whole graph
 * cascades into one community. Louvain has no such failure mode, and fixing the
 * visit order to sorted node order makes it reproducible, so a vault's colours
 * never shuffle between builds.
 */

import type { SimLink } from './graphsim.js';

export interface Community {
  /** Stable index — 0 is the largest cluster. */
  id: number;
  members: string[];
  /** The most connected member; the cluster is named after it. */
  hub: string;
}

export interface ClusterResult {
  /** Note path → community id. */
  of: Record<string, number>;
  communities: Community[];
  /** Modularity of the final partition: ~0 is no structure, 0.3+ is strong. */
  modularity: number;
}

type Graph = Array<Map<number, number>>;

/** One Louvain pass: move nodes to the neighbouring community that gains most. */
function oneLevel(graph: Graph, selfLoops: number[]): number[] {
  const n = graph.length;
  const degree = graph.map((edges, i) => {
    let sum = selfLoops[i] ?? 0;
    for (const [j, w] of edges) sum += i === j ? 0 : w;
    return sum + (selfLoops[i] ?? 0);
  });

  const m2 = degree.reduce((a, b) => a + b, 0);
  if (m2 === 0) return graph.map((_, i) => i);

  const community = graph.map((_, i) => i);
  const total = degree.slice();

  for (let pass = 0; pass < 20; pass++) {
    let moved = false;

    for (let i = 0; i < n; i++) {
      const from = community[i] as number;
      const ki = degree[i] as number;

      // Weight from i into each neighbouring community.
      const toCommunity = new Map<number, number>();
      for (const [j, w] of graph[i] as Map<number, number>) {
        if (j === i) continue;
        const c = community[j] as number;
        toCommunity.set(c, (toCommunity.get(c) ?? 0) + w);
      }

      total[from] = (total[from] as number) - ki;

      let best = from;
      let bestGain = (toCommunity.get(from) ?? 0) - ((total[from] as number) * ki) / m2;

      // Sorted iteration and a strict `>` keep the choice reproducible.
      for (const c of [...toCommunity.keys()].sort((a, b) => a - b)) {
        const gain = (toCommunity.get(c) ?? 0) - ((total[c] as number) * ki) / m2;
        if (gain > bestGain) {
          bestGain = gain;
          best = c;
        }
      }

      total[best] = (total[best] as number) + ki;
      if (best !== from) {
        community[i] = best;
        moved = true;
      }
    }

    if (!moved) break;
  }

  return community;
}

/** Collapse each community into a single node, summing the edges between them. */
function aggregate(graph: Graph, selfLoops: number[], community: number[]) {
  const ids = [...new Set(community)].sort((a, b) => a - b);
  const index = new Map(ids.map((c, i) => [c, i]));

  const next: Graph = ids.map(() => new Map<number, number>());
  const nextSelf = ids.map(() => 0);

  for (let i = 0; i < graph.length; i++) {
    const ci = index.get(community[i] as number) as number;
    nextSelf[ci] = (nextSelf[ci] as number) + (selfLoops[i] ?? 0);

    for (const [j, w] of graph[i] as Map<number, number>) {
      const cj = index.get(community[j] as number) as number;
      if (ci === cj) {
        // Each internal edge is seen twice; halve to keep the weight honest.
        nextSelf[ci] = (nextSelf[ci] as number) + w / 2;
      } else {
        const bucket = next[ci] as Map<number, number>;
        bucket.set(cj, (bucket.get(cj) ?? 0) + w);
      }
    }
  }

  return { graph: next, selfLoops: nextSelf, index };
}

function modularityOf(graph: Graph, selfLoops: number[], community: number[]): number {
  const degree = graph.map((edges, i) => {
    let sum = 2 * (selfLoops[i] ?? 0);
    for (const [j, w] of edges) if (i !== j) sum += w;
    return sum;
  });
  const m2 = degree.reduce((a, b) => a + b, 0);
  if (m2 === 0) return 0;

  const inside = new Map<number, number>();
  const totals = new Map<number, number>();
  for (let i = 0; i < graph.length; i++) {
    const c = community[i] as number;
    totals.set(c, (totals.get(c) ?? 0) + (degree[i] as number));
    inside.set(c, (inside.get(c) ?? 0) + 2 * (selfLoops[i] ?? 0));
    for (const [j, w] of graph[i] as Map<number, number>) {
      if (community[j] === c && i !== j) inside.set(c, (inside.get(c) ?? 0) + w);
    }
  }

  let q = 0;
  for (const [c, tot] of totals) {
    q += (inside.get(c) ?? 0) / m2 - ((tot / m2) * tot) / m2;
  }
  return q;
}

export function detectCommunities(nodes: string[], links: SimLink[]): ClusterResult {
  const ordered = [...nodes].sort();
  if (ordered.length === 0) return { of: {}, communities: [], modularity: 0 };

  const at = new Map(ordered.map((id, i) => [id, i]));
  const base: Graph = ordered.map(() => new Map<number, number>());
  const baseSelf = ordered.map(() => 0);

  for (const link of links) {
    const a = at.get(link.source);
    const b = at.get(link.target);
    if (a === undefined || b === undefined || a === b) continue;
    const ga = base[a] as Map<number, number>;
    const gb = base[b] as Map<number, number>;
    ga.set(b, (ga.get(b) ?? 0) + 1);
    gb.set(a, (gb.get(a) ?? 0) + 1);
  }

  // Walk the Louvain hierarchy, keeping each node's community at every level.
  let graph = base;
  let selfLoops = baseSelf;
  let assignment = ordered.map((_, i) => i);

  for (let level = 0; level < 10; level++) {
    const community = oneLevel(graph, selfLoops);
    const distinct = new Set(community).size;

    const collapsed = aggregate(graph, selfLoops, community);
    assignment = assignment.map((c) => collapsed.index.get(community[c] as number) as number);

    if (distinct === graph.length) break; // nothing merged; we are done
    graph = collapsed.graph;
    selfLoops = collapsed.selfLoops;
    if (graph.length === 1) break;
  }

  const degreeOf = new Map<string, number>(
    ordered.map((id, i) => [id, (base[i] as Map<number, number>).size]),
  );

  const grouped = new Map<number, string[]>();
  ordered.forEach((id, i) => {
    const c = assignment[i] as number;
    const bucket = grouped.get(c);
    if (bucket) bucket.push(id);
    else grouped.set(c, [id]);
  });

  // Renumber largest-first, so cluster 0 is always dominant and the colour
  // assignment stays put as the vault grows.
  const communities: Community[] = [...grouped.values()]
    .sort((a, b) => b.length - a.length || (a[0] ?? '').localeCompare(b[0] ?? ''))
    .map((members, id) => ({
      id,
      members,
      hub: members
        .slice()
        .sort(
          (a, b) => (degreeOf.get(b) ?? 0) - (degreeOf.get(a) ?? 0) || a.localeCompare(b),
        )[0] as string,
    }));

  const of: Record<string, number> = {};
  for (const community of communities) {
    for (const member of community.members) of[member] = community.id;
  }

  return { of, communities, modularity: modularityOf(base, baseSelf, assignment) };
}

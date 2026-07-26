/**
 * A small force-directed layout.
 *
 * Hand-rolled rather than pulling in d3-force, for the same reason the search is:
 * it has to run in the browser for live mode, and it is the kind of thing that
 * is 150 lines or four dependencies.
 *
 * Deterministic by construction — no `Math.random()` anywhere. Initial positions
 * come from a phyllotaxis spiral, so the same vault always lays out the same
 * way. A graph that reshuffles itself on every page load is disorienting, and a
 * non-deterministic layout can't be tested.
 */

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Link count — drives node radius and repulsion weight. */
  degree: number;
  /** Pinned nodes are drawn but never moved (used for the focused note). */
  fixed?: boolean;
}

export interface SimLink {
  source: string;
  target: string;
}

export interface SimOptions {
  /** Rest length of a link spring. */
  linkDistance?: number;
  linkStrength?: number;
  /** Repulsion constant; larger pushes nodes further apart. */
  repulsion?: number;
  /** Nodes further apart than this exert no repulsion — what keeps this O(n·k). */
  repulsionCutoff?: number;
  /** Pull towards the origin, which stops disconnected components drifting away. */
  centerStrength?: number;
  velocityDecay?: number;
  alphaDecay?: number;
  alphaMin?: number;
}

const DEFAULTS: Required<SimOptions> = {
  linkDistance: 48,
  linkStrength: 0.07,
  repulsion: 900,
  repulsionCutoff: 320,
  centerStrength: 0.014,
  velocityDecay: 0.72,
  alphaDecay: 0.021,
  alphaMin: 0.004,
};

/** Golden-angle spiral: even, deterministic, and never places two nodes on top of each other. */
function seedPosition(i: number): { x: number; y: number } {
  const radius = 14 * Math.sqrt(0.5 + i);
  const angle = i * Math.PI * (3 - Math.sqrt(5));
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

export interface Simulation {
  nodes: SimNode[];
  links: SimLink[];
  alpha: number;
  /** Advance one step. Returns false once the layout has settled. */
  tick(): boolean;
  /** Run until settled, or until `maxSteps`. Returns the steps taken. */
  run(maxSteps?: number): number;
  /** Re-heat, e.g. after a drag. */
  reheat(alpha?: number): void;
}

export function createSimulation(
  ids: string[],
  links: SimLink[],
  options: SimOptions = {},
): Simulation {
  const opts = { ...DEFAULTS, ...options };

  const degree = new Map<string, number>();
  for (const id of ids) degree.set(id, 0);
  const valid: SimLink[] = [];
  for (const link of links) {
    if (!degree.has(link.source) || !degree.has(link.target) || link.source === link.target) continue;
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    valid.push(link);
  }

  const nodes: SimNode[] = ids.map((id, i) => {
    const { x, y } = seedPosition(i);
    return { id, x, y, vx: 0, vy: 0, degree: degree.get(id) ?? 0 };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const state = { alpha: 1 };
  const cutoff2 = opts.repulsionCutoff * opts.repulsionCutoff;

  /**
   * Repulsion, bucketed into a uniform grid of cutoff-sized cells. Only the
   * nine cells around a node can contain anything close enough to matter, which
   * turns the naive all-pairs pass into something a 2000-note vault survives.
   */
  const repel = (alpha: number): void => {
    const cell = opts.repulsionCutoff;
    const grid = new Map<string, SimNode[]>();
    for (const node of nodes) {
      const key = `${Math.floor(node.x / cell)},${Math.floor(node.y / cell)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(node);
      else grid.set(key, [node]);
    }

    for (const node of nodes) {
      const cx = Math.floor(node.x / cell);
      const cy = Math.floor(node.y / cell);

      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(`${gx},${gy}`);
          if (!bucket) continue;

          for (const other of bucket) {
            if (other === node) continue;
            let dx = node.x - other.x;
            let dy = node.y - other.y;
            let d2 = dx * dx + dy * dy;
            if (d2 > cutoff2) continue;

            // Coincident nodes get a deterministic nudge apart rather than NaN.
            if (d2 === 0) {
              dx = (node.id < other.id ? 1 : -1) * 0.5;
              dy = 0.5;
              d2 = 0.5;
            }
            const d = Math.sqrt(d2);
            const weight = 1 + Math.min(other.degree, 12) * 0.14;
            const force = (opts.repulsion * alpha * weight) / d2;
            node.vx += (dx / d) * force;
            node.vy += (dy / d) * force;
          }
        }
      }
    }
  };

  const spring = (alpha: number): void => {
    for (const link of valid) {
      const a = byId.get(link.source);
      const b = byId.get(link.target);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const force = ((d - opts.linkDistance) * opts.linkStrength * alpha) / d;

      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }
  };

  const center = (alpha: number): void => {
    for (const node of nodes) {
      node.vx -= node.x * opts.centerStrength * alpha;
      node.vy -= node.y * opts.centerStrength * alpha;
    }
  };

  const integrate = (): void => {
    for (const node of nodes) {
      if (node.fixed) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= opts.velocityDecay;
      node.vy *= opts.velocityDecay;
      node.x += node.vx;
      node.y += node.vy;
    }
  };

  const sim: Simulation = {
    nodes,
    links: valid,
    get alpha() {
      return state.alpha;
    },
    tick() {
      if (state.alpha < opts.alphaMin) return false;
      state.alpha *= 1 - opts.alphaDecay;
      repel(state.alpha);
      spring(state.alpha);
      center(state.alpha);
      integrate();
      return true;
    },
    run(maxSteps = 400) {
      let steps = 0;
      while (steps < maxSteps && sim.tick()) steps++;
      return steps;
    },
    reheat(alpha = 0.6) {
      state.alpha = alpha;
    },
  };

  return sim;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function boundsOf(nodes: Array<{ x: number; y: number }>, padding = 0): Bounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

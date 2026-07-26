/**
 * Obsidian `.canvas` files.
 *
 * The format is a documented, stable JSON schema — nodes with absolute
 * coordinates, and edges that attach to named sides. Rendering it faithfully is
 * mostly a geometry problem, which is why almost nothing else publishes canvases:
 * it's not markdown, so a markdown pipeline has nowhere to put it.
 */

import { findWikilinks } from './syntax.js';
import type { ParsedWikilink } from './types.js';

export type CanvasSide = 'top' | 'right' | 'bottom' | 'left';
export type CanvasEnd = 'none' | 'arrow';

export interface CanvasNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Preset `1`–`6`, or a hex colour. */
  color?: string;
}

export interface CanvasTextNode extends CanvasNodeBase {
  type: 'text';
  text: string;
}

export interface CanvasFileNode extends CanvasNodeBase {
  type: 'file';
  file: string;
  subpath?: string;
}

export interface CanvasLinkNode extends CanvasNodeBase {
  type: 'link';
  url: string;
}

export interface CanvasGroupNode extends CanvasNodeBase {
  type: 'group';
  label?: string;
}

export type CanvasNode = CanvasTextNode | CanvasFileNode | CanvasLinkNode | CanvasGroupNode;

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: CanvasSide;
  fromEnd?: CanvasEnd;
  toNode: string;
  toSide?: CanvasSide;
  toEnd?: CanvasEnd;
  color?: string;
  label?: string;
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface CanvasDoc {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  bounds: CanvasBounds;
}

const SIDES: CanvasSide[] = ['top', 'right', 'bottom', 'left'];

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function side(value: unknown): CanvasSide | undefined {
  return typeof value === 'string' && SIDES.includes(value as CanvasSide)
    ? (value as CanvasSide)
    : undefined;
}

/**
 * Parse canvas JSON. Returns null for anything unusable.
 *
 * Deliberately forgiving: a canvas with one malformed node should render the
 * other twenty, not blank the page.
 */
export function parseCanvas(json: string): CanvasDoc | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const data = raw as { nodes?: unknown; edges?: unknown };
  // A canvas always has a `nodes` array, even when empty. Requiring it stops
  // arbitrary JSON that happens to be named `.canvas` from becoming a blank page.
  if (!Array.isArray(data.nodes)) return null;

  const nodes: CanvasNode[] = [];

  for (const entry of data.nodes) {
    if (!entry || typeof entry !== 'object') continue;
    const n = entry as Record<string, unknown>;
    const id = str(n.id);
    if (!id) continue;

    const base: CanvasNodeBase = {
      id,
      x: num(n.x),
      y: num(n.y),
      width: Math.max(1, num(n.width, 250)),
      height: Math.max(1, num(n.height, 60)),
    };
    const color = str(n.color);
    if (color) base.color = color;

    switch (n.type) {
      case 'text':
        nodes.push({ ...base, type: 'text', text: typeof n.text === 'string' ? n.text : '' });
        break;
      case 'file': {
        const file = str(n.file);
        if (!file) continue;
        const node: CanvasFileNode = { ...base, type: 'file', file };
        const subpath = str(n.subpath);
        if (subpath) node.subpath = subpath;
        nodes.push(node);
        break;
      }
      case 'link': {
        const url = str(n.url);
        if (!url) continue;
        nodes.push({ ...base, type: 'link', url });
        break;
      }
      case 'group': {
        const node: CanvasGroupNode = { ...base, type: 'group' };
        const label = str(n.label);
        if (label) node.label = label;
        nodes.push(node);
        break;
      }
      default:
        break;
    }
  }

  const ids = new Set(nodes.map((n) => n.id));
  const edges: CanvasEdge[] = [];

  for (const entry of Array.isArray(data.edges) ? data.edges : []) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = str(e.id);
    const fromNode = str(e.fromNode);
    const toNode = str(e.toNode);
    // An edge to a node that isn't there would draw a line to nowhere.
    if (!id || !fromNode || !toNode || !ids.has(fromNode) || !ids.has(toNode)) continue;

    const edge: CanvasEdge = { id, fromNode, toNode };
    const fs = side(e.fromSide);
    const ts = side(e.toSide);
    const color = str(e.color);
    const label = str(e.label);
    if (fs) edge.fromSide = fs;
    if (ts) edge.toSide = ts;
    if (color) edge.color = color;
    if (label) edge.label = label;
    if (e.toEnd === 'none') edge.toEnd = 'none';
    if (e.fromEnd === 'arrow') edge.fromEnd = 'arrow';
    edges.push(edge);
  }

  return { nodes, edges, bounds: canvasBounds(nodes) };
}

export function canvasBounds(nodes: CanvasNode[], padding = 40): CanvasBounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export interface Point {
  x: number;
  y: number;
}

export function sideAnchor(node: CanvasNodeBase, which: CanvasSide): Point {
  switch (which) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

/** Which side an edge should leave from, when the file didn't say. */
export function inferSide(from: CanvasNodeBase, to: CanvasNodeBase): CanvasSide {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

function normal(which: CanvasSide): Point {
  switch (which) {
    case 'top':
      return { x: 0, y: -1 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
  }
}

export interface EdgeGeometry {
  /** SVG cubic bezier path. */
  d: string;
  start: Point;
  end: Point;
  /** Midpoint, for placing a label. */
  mid: Point;
  /** Incoming direction at `end`, in degrees — used to rotate the arrowhead. */
  endAngle: number;
}

export function edgeGeometry(
  edge: CanvasEdge,
  from: CanvasNodeBase,
  to: CanvasNodeBase,
): EdgeGeometry {
  const fromSide = edge.fromSide ?? inferSide(from, to);
  const toSide = edge.toSide ?? inferSide(to, from);

  const start = sideAnchor(from, fromSide);
  const end = sideAnchor(to, toSide);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // Enough curve to read as a connection, capped so long edges don't balloon.
  const pull = Math.min(Math.max(distance * 0.4, 30), 180);

  const n1 = normal(fromSide);
  const n2 = normal(toSide);
  const c1 = { x: start.x + n1.x * pull, y: start.y + n1.y * pull };
  const c2 = { x: end.x + n2.x * pull, y: end.y + n2.y * pull };

  // Cubic bezier midpoint at t = 0.5.
  const mid = {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
  };

  return {
    d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
    start,
    end,
    mid,
    // The tangent arriving at `end` runs from the second control point.
    endAngle: (Math.atan2(end.y - c2.y, end.x - c2.x) * 180) / Math.PI,
  };
}

const PRESET_COLORS: Record<string, string> = {
  '1': 'var(--red)',
  '2': 'var(--amber)',
  '3': 'var(--amber)',
  '4': 'var(--green)',
  '5': 'var(--teal)',
  '6': 'var(--violet)',
};

/** Obsidian's presets map onto theme tokens; anything else is passed through. */
export function canvasColor(color: string | undefined, fallback = 'var(--border-strong)'): string {
  if (!color) return fallback;
  return PRESET_COLORS[color] ?? color;
}

/** Links a canvas makes into the vault, so canvases take part in the graph. */
export function canvasLinks(doc: CanvasDoc): ParsedWikilink[] {
  const out: ParsedWikilink[] = [];

  for (const node of doc.nodes) {
    if (node.type === 'file') {
      const link: ParsedWikilink = {
        target: node.file,
        embed: true,
        raw: `![[${node.file}]]`,
      };
      if (node.subpath) {
        const sub = node.subpath.replace(/^#/, '');
        link.subpath = sub.startsWith('^')
          ? { kind: 'block', segments: [sub.slice(1)], raw: sub }
          : { kind: 'heading', segments: sub.split('#').filter(Boolean), raw: sub };
      }
      out.push(link);
    } else if (node.type === 'text') {
      // Offsets index into the text node, not the canvas file, so drop them —
      // a backlink excerpt computed against raw JSON would be gibberish.
      for (const link of findWikilinks(node.text)) {
        delete link.offset;
        out.push(link);
      }
    }
  }
  return out;
}

/**
 * The readable text of a canvas, for search.
 * Indexing the raw JSON would fill the index with braces and coordinates.
 */
export function canvasText(doc: CanvasDoc): string {
  return doc.nodes
    .map((node) => {
      if (node.type === 'text') return node.text;
      if (node.type === 'group') return node.label ?? '';
      if (node.type === 'file') return node.file;
      return node.url;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Group nodes sit behind everything else; text and file cards sit on top. */
export function sortForPaint(nodes: CanvasNode[]): CanvasNode[] {
  return nodes
    .slice()
    .sort((a, b) => (a.type === 'group' ? 0 : 1) - (b.type === 'group' ? 0 : 1));
}

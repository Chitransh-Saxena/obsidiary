import { describe, expect, it } from 'vitest';
import {
  canvasColor,
  canvasLinks,
  canvasText,
  edgeGeometry,
  inferSide,
  parseCanvas,
  sideAnchor,
  sortForPaint,
} from '../src/canvas.js';
import { buildSearchIndex, search } from '../src/search.js';
import { buildFileTree, flattenTree } from '../src/tree.js';
import { buildVault } from '../src/vault.js';

const CANVAS = JSON.stringify({
  nodes: [
    { id: 'g1', type: 'group', label: 'Cluster', x: -40, y: -40, width: 600, height: 400 },
    { id: 'n1', type: 'text', text: '# Idea\nLinks to [[Target]] and #topic', x: 0, y: 0, width: 260, height: 120, color: '4' },
    { id: 'n2', type: 'file', file: 'Target.md', x: 320, y: 0, width: 260, height: 200 },
    { id: 'n3', type: 'link', url: 'https://example.com', x: 0, y: 200, width: 260, height: 60 },
  ],
  edges: [
    { id: 'e1', fromNode: 'n1', fromSide: 'right', toNode: 'n2', toSide: 'left', label: 'supports', color: '1' },
    { id: 'e2', fromNode: 'n1', toNode: 'n3' },
    { id: 'e3', fromNode: 'n1', toNode: 'missing' },
  ],
});

describe('parsing', () => {
  const doc = parseCanvas(CANVAS)!;

  it('reads all four node types', () => {
    expect(doc.nodes.map((n) => n.type).sort()).toEqual(['file', 'group', 'link', 'text']);
  });

  it('reads edge sides, labels and colours', () => {
    const edge = doc.edges.find((e) => e.id === 'e1');
    expect(edge).toMatchObject({ fromSide: 'right', toSide: 'left', label: 'supports', color: '1' });
  });

  it('drops edges pointing at nodes that do not exist', () => {
    expect(doc.edges.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('computes padded bounds covering every node', () => {
    expect(doc.bounds.minX).toBe(-80);
    expect(doc.bounds.maxX).toBe(620);
    expect(doc.bounds.width).toBeGreaterThan(0);
  });

  it('returns null for anything that is not a canvas', () => {
    expect(parseCanvas('not json')).toBeNull();
    expect(parseCanvas('[]')).toBeNull();
    expect(parseCanvas('{"some":"other json"}')).toBeNull();
    expect(parseCanvas('null')).toBeNull();
  });

  it('accepts a legitimately empty canvas', () => {
    expect(parseCanvas('{"nodes":[],"edges":[]}')).toMatchObject({ nodes: [], edges: [] });
  });

  it('renders the good nodes when one is malformed', () => {
    const partial = parseCanvas(
      JSON.stringify({
        nodes: [
          { id: 'ok', type: 'text', text: 'fine', x: 0, y: 0, width: 100, height: 40 },
          { type: 'text', text: 'no id' },
          { id: 'nofile', type: 'file' },
          { id: 'weird', type: 'unknown-type' },
        ],
      }),
    )!;
    expect(partial.nodes.map((n) => n.id)).toEqual(['ok']);
  });

  it('defaults missing geometry rather than producing NaN', () => {
    const doc2 = parseCanvas(JSON.stringify({ nodes: [{ id: 'a', type: 'text', text: 'x' }] }))!;
    const node = doc2.nodes[0]!;
    expect([node.x, node.y, node.width, node.height].every(Number.isFinite)).toBe(true);
    expect(node.width).toBeGreaterThan(0);
  });

  it('paints groups behind everything else', () => {
    expect(sortForPaint(doc.nodes)[0]?.type).toBe('group');
  });
});

describe('geometry', () => {
  const box = { id: 'b', x: 100, y: 100, width: 200, height: 100 };

  it('anchors to the middle of each side', () => {
    expect(sideAnchor(box, 'top')).toEqual({ x: 200, y: 100 });
    expect(sideAnchor(box, 'bottom')).toEqual({ x: 200, y: 200 });
    expect(sideAnchor(box, 'left')).toEqual({ x: 100, y: 150 });
    expect(sideAnchor(box, 'right')).toEqual({ x: 300, y: 150 });
  });

  it('infers a side from relative position', () => {
    expect(inferSide(box, { id: 'r', x: 500, y: 100, width: 50, height: 50 })).toBe('right');
    expect(inferSide(box, { id: 'l', x: -500, y: 100, width: 50, height: 50 })).toBe('left');
    expect(inferSide(box, { id: 'd', x: 100, y: 900, width: 50, height: 50 })).toBe('bottom');
    expect(inferSide(box, { id: 'u', x: 100, y: -900, width: 50, height: 50 })).toBe('top');
  });

  it('draws a bezier between the declared anchors', () => {
    const from = { id: 'a', x: 0, y: 0, width: 100, height: 100 };
    const to = { id: 'b', x: 400, y: 0, width: 100, height: 100 };
    const geo = edgeGeometry(
      { id: 'e', fromNode: 'a', toNode: 'b', fromSide: 'right', toSide: 'left' },
      from,
      to,
    );
    expect(geo.start).toEqual({ x: 100, y: 50 });
    expect(geo.end).toEqual({ x: 400, y: 50 });
    expect(geo.d).toMatch(/^M 100 50 C /);
    // Arriving horizontally from the left, so the arrowhead points along +x.
    expect(Math.abs(geo.endAngle)).toBeLessThan(1);
  });

  it('puts the label midpoint between the endpoints', () => {
    const geo = edgeGeometry(
      { id: 'e', fromNode: 'a', toNode: 'b', fromSide: 'right', toSide: 'left' },
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 400, y: 0, width: 100, height: 100 },
    );
    expect(geo.mid.x).toBeGreaterThan(100);
    expect(geo.mid.x).toBeLessThan(400);
  });

  it('maps preset colours onto theme tokens and passes hex through', () => {
    expect(canvasColor('1')).toBe('var(--red)');
    expect(canvasColor('#ff0000')).toBe('#ff0000');
    expect(canvasColor(undefined)).toBe('var(--border-strong)');
  });
});

describe('canvas links and text', () => {
  const doc = parseCanvas(CANVAS)!;

  it('treats file nodes as embeds and picks up wikilinks in text nodes', () => {
    const links = canvasLinks(doc);
    expect(links.map((l) => l.target).sort()).toEqual(['Target', 'Target.md']);
    expect(links.find((l) => l.target === 'Target.md')?.embed).toBe(true);
  });

  it('parses a file node subpath', () => {
    const withSub = parseCanvas(
      JSON.stringify({
        nodes: [{ id: 'a', type: 'file', file: 'N.md', subpath: '#Section', x: 0, y: 0, width: 1, height: 1 }],
      }),
    )!;
    expect(canvasLinks(withSub)[0]?.subpath).toMatchObject({ kind: 'heading', segments: ['Section'] });
  });

  it('drops offsets, which would index into json rather than prose', () => {
    expect(canvasLinks(doc).every((l) => l.offset === undefined)).toBe(true);
  });

  it('extracts readable text rather than json', () => {
    const text = canvasText(doc);
    expect(text).toContain('Idea');
    expect(text).toContain('Cluster');
    expect(text).not.toContain('"width"');
  });
});

describe('a canvas is a note', () => {
  const index = buildVault([
    { path: 'boards/Map.canvas', content: CANVAS },
    { path: 'Target.md', content: '# Target\nthe target note' },
  ]);
  const canvas = index.notes['boards/Map.canvas'];

  it('gets a page, a slug and a url', () => {
    expect(canvas?.kind).toBe('canvas');
    expect(canvas?.slug).toBe('boards/map');
    expect(canvas?.url).toBe('/boards/map');
  });

  it('is not published as a raw asset', () => {
    expect(index.assets['boards/Map.canvas']).toBeUndefined();
  });

  it('appears in the file tree', () => {
    expect(flattenTree(buildFileTree(index)).map((n) => n.path)).toContain('boards/Map.canvas');
  });

  it('contributes links, so canvases take part in the graph', () => {
    expect(index.graph.nodes['boards/Map.canvas']?.outgoing).toEqual(['Target.md']);
    expect(index.backlinks['Target.md']?.[0]?.fromPath).toBe('boards/Map.canvas');
  });

  it('picks up tags written in text nodes', () => {
    expect(canvas?.tags).toContain('topic');
  });

  it('is searchable by its node text, not its json', () => {
    const docs = buildSearchIndex(index);
    const hit = docs.find((d) => d.path === 'boards/Map.canvas');
    expect(hit?.text).toContain('Idea');
    expect(hit?.text).not.toContain('width');
    expect(search(docs, 'cluster')[0]?.doc.path).toBe('boards/Map.canvas');
  });

  it('resolves by name, with or without the extension', () => {
    const links = buildVault([
      { path: 'boards/Map.canvas', content: CANVAS },
      { path: 'a.md', content: 'see [[Map]] and [[Map.canvas]]' },
    ]);
    expect(links.notes['a.md']?.links.every((l) => l.toPath === 'boards/Map.canvas')).toBe(true);
  });

  it('stays out of the build entirely under explicitPublish', () => {
    const strict = buildVault([{ path: 'boards/Map.canvas', content: CANVAS }], {
      explicitPublish: true,
    });
    expect(Object.keys(strict.notes)).toHaveLength(0);
    expect(Object.keys(strict.assets)).toHaveLength(0);
  });
});

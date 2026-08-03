# obsidiary

The isomorphic core of [Obsidiary](https://obsidiary.pulsar-projects.org):
parses a folder of Obsidian markdown into notes, links, a graph and a search
index.

**Nothing in this package imports `node:*`.** That is the constraint the whole
design hangs on — the static build and the in-browser live mode run this exact
code, and a stray Node import is what turns "one renderer" back into two
renderers that quietly disagree.

Most people want **[@obsidiary/astro](https://www.npmjs.com/package/@obsidiary/astro)**,
which wraps this into a site. Use this package directly if you are building a
different front end.

## Install

```bash
npm i obsidiary
```

## Use

```js
import { buildVault, createRenderer } from 'obsidiary';

const index = buildVault([
  { path: 'index.md', content: '# Home\n\nSee [[Ideas/Zettelkasten]].' },
  { path: 'Ideas/Zettelkasten.md', content: '# Zettelkasten\n\n#method' },
]);

index.notes['index.md'].links;   // resolved outgoing links
index.backlinks['Ideas/Zettelkasten.md'];
index.graph;                     // { nodes, edges, unresolved }

const renderer = createRenderer(index);
renderer.renderNote('index.md');            // HTML, embeds expanded
renderer.renderMarkdown('[[Home]]', 'a.md') // arbitrary markdown, resolved from a path
renderer.astFor('index.md');                // transformed mdast
```

`buildVault(files, options)` takes `{ path, content }` pairs from anywhere — a
filesystem, a git host, a database — which is why it works unchanged in a
browser.

## Reading a vault straight from GitHub

```js
import { parseRepoRef, fetchVaultFiles, buildVault } from 'obsidiary';

const ref = parseRepoRef('you/notes@main');
const remote = await fetchVaultFiles(ref);
const index = buildVault(remote.files, {
  assetBase: remote.rawBase,
  preserveAssetPaths: true,
});
```

Two endpoints, both CORS-open, so this runs in a browser as happily as in a
build. The ref is resolved to a **commit SHA** first and every file is read at
that SHA — branch-name raw URLs are CDN-cached per edge with independent expiry,
so reading a hundred files by branch can return a mixture of revisions.

## What it handles

- Wikilinks in every form: `[[note]]`, `[[note|alias]]`, `[[note#heading]]`,
  `[[note#^block]]`, `[[#heading]]`, relative and absolute paths
- **Obsidian's real resolution rules**, including proximity — a bare
  `[[Zettel]]` finds the one in your folder before the one at the root — with
  case-insensitive matching that still prefers an exact case hit, and aliases last
- Transclusion that inlines real content: whole notes, sections, single blocks,
  with cycle and depth guards
- Callouts, all types and aliases, folding via `<details>` with no JavaScript
- Tags (nested, indexed by ancestor), frontmatter aliases, block anchors, GFM
  tables and task lists, LaTeX
- Backlinks, a link graph, unresolved-link tracking
- Attachments including `|300x200` sizing, video, audio, PDF
- **`.canvas` files as first-class notes** — a canvas gets a slug, a URL, a place
  in the tree, an entry in search (indexed by node text, not JSON) and its own
  graph links, because it is a `Note` with `kind: 'canvas'` rather than a special
  case bolted on the side

## Also exported

- `buildSearchIndex()` and `search()` — ranked, typo-tolerant, and it reports
  *why* something matched: title, alias, heading, tag or body
- `createSimulation()` — a dependency-free force layout, ~150 lines, grid cutoff
  for repulsion, and **no `Math.random()`**, so the same vault always lays out
  identically. Less disorienting, and testable.
- `detectCommunities()` — Louvain modularity optimisation, used to colour graph
  clusters
- `buildGraph()`, `fullGraph()`, `neighborhood()`, `orphanNotes()` — the graph
- `buildFileTree()`, `buildBacklinks()`, `buildTagIndex()`, `buildLookups()`
- `parseCanvas()`, `canvasLinks()`, `edgeGeometry()` — canvas internals
- `resolveTarget()`, `parseNote()`, `splitFrontmatter()`, `noteSlug()`,
  `excerptAround()`, `summarize()`

## Options

`explicitPublish` · `removeDrafts` · `ignore` · `base` · `assetBase` ·
`preserveAssetPaths` — see
**[the docs](https://obsidiary.pulsar-projects.org/docs)**.

## License

MIT

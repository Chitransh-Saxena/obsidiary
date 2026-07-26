# Obsidiary

Publish an Obsidian vault as a fast, linked, free website — with your notes
living in their own repository, and upgrades that are `npm update` rather than a
merge conflict.

**[Site & docs](https://obsidiary.chitransh-aang.workers.dev)** ·
**[Live demo](https://obsidiary.chitransh-aang.workers.dev/live)** — render any
public vault in your browser ·
**[A vault it publishes](https://chitransh-notes.chitransh-aang.workers.dev)**

> **Status: working, not yet on npm.** Everything below runs. The packages have
> not been published to the registry yet, so `npm create obsidiary@latest` will
> not resolve until they are — clone the repo to try it today.

## Why another one

[Quartz](https://quartz.jzhao.xyz/) is good and most people should use it today.
Obsidiary exists because of three things it doesn't do:

1. **Your notes stay in their own repo.** Content decoupling is the core
   primitive, not a submodule workaround.
2. **Upgrades don't fight you.** The engine is an npm package, so your vault
   never shares a git history with the renderer's source. Quartz ships a
   `content/` folder upstream, which is why nearly every `npx quartz update`
   ends in a merge conflict; distributing as a package was
   [proposed and declined](https://github.com/jackyzha0/quartz/issues/2357).
3. **It reads like the app, not like docs.** Sidebar, backlinks, outline,
   command palette, graph, canvas.

## Try the demo

```bash
npm install
npm run dev
```

The demo vault in `apps/demo/vault/` is deliberately awkward: three notes named
`Zettelkasten` at three depths, a note called `v1.2 spec`, a case collision,
aliases that shadow real filenames. Every one of those has broken a real
publishing tool.

## Packages

| Package | What it is |
| --- | --- |
| `obsidiary` | The isomorphic core: vault model, link resolution, markdown pipeline. No `node:*` imports — the static build and the in-browser live mode run this exact code. |
| `@obsidiary/astro` | Astro integration. Point it at a directory, get a site. |
| `apps/demo` | The demo site and its vault. |

## What works today

- Wikilinks in every form: `[[note]]`, `[[note\|alias]]`, `[[note#heading]]`,
  `[[note#^block]]`, `[[#heading]]`, plus relative and absolute paths
- Obsidian's resolution rules, including proximity — a bare `[[Zettel]]` finds
  the one in your folder before the one at the root
- Transclusion that inlines real content: whole notes, single sections, single
  blocks, with cycle and depth guards
- Callouts, all types and aliases, folding via `<details>` with no JavaScript
- Tags (nested, indexed by ancestor), frontmatter aliases, block anchors,
  GFM tables and task lists, LaTeX
- Backlinks, a link graph, and unresolved-link tracking
- Attachments: images with `|300x200` sizing, video, audio, PDF
- Draft and `publish:` filtering
- Light and dark themes

And the app around them:

- Collapsible file-tree sidebar with persisted state, becoming a drawer on small
  screens
- Outline with scroll-spy, and a backlinks panel that shows the surrounding
  prose rather than just a list of names
- ⌘K command palette with ranked search that tells you *why* something matched —
  title, alias, heading, tag or body — plus typo tolerance and recents
- Hover previews of linked notes
- Local graph in the rail and a whole-vault graph at `/graph` — click to
  navigate, drag to pan, scroll to zoom, hover to isolate a neighbourhood
- **Obsidian `.canvas` files render as pages**: text, file, link and group
  nodes, edges with labels, arrows and side anchors. File nodes are real embeds,
  subpath slicing included
- `/search-index.json` and `/graph` injected automatically; the search index is
  fetched on first search, so readers who never search never download it

182 tests cover the parts that are easy to get subtly wrong.

### A canvas is a note

Not a special case bolted on the side — a `.canvas` gets a slug, a URL, a place
in the sidebar, an entry in search (indexed by its node text, not its JSON) and
its own links in the graph. Everything downstream works because there is only
one kind of thing.

### The graph is dependency-free and deterministic

No d3. The force layout is ~150 lines in the core, uses a grid cutoff for
repulsion so large vaults stay cheap, and contains no `Math.random()` — the same
vault always lays out the same way, which is both less disorienting and
testable.

## Deploy it free

Full walkthrough: **[the setup guide](https://obsidiary.chitransh-aang.workers.dev/docs/setup)**.

```bash
npm create obsidiary@latest my-notes
cd my-notes && npm install
npx wrangler deploy
```

| Host | Bandwidth | Custom domain | Commercial use |
| --- | --- | --- | --- |
| **Cloudflare** (recommended) | unlimited | free | allowed |
| Vercel | 100 GB | free | **not on free** |
| Netlify | 100 GB | free | allowed |
| GitHub Pages | 100 GB soft | free | **not on free** |

## Notes in their own repository

The configuration this exists for — the site is one repo, your notes are another:

```js
obsidiary({ repo: 'you/notes' })
```

One GitHub API call lists the vault; notes come from the CDN. Attachments are
never downloaded — the built site points at them in place, so a vault full of
photographs doesn't bloat your deploy.

## Next

- Publish `obsidiary`, `@obsidiary/astro` and `create-obsidiary` to npm, so
  `npm create obsidiary@latest` resolves
- Self-host the fonts instead of loading them from Google Fonts
- Mermaid rendering; a tags browser; RSS

## A warning worth repeating

If your notes repo is public, everything in it is public — including
attachments, and including anything a `publish: false` note links to. Obsidiary
never writes an unpublished note to the build output, but it cannot make a
public repo private. Notes that must stay private belong in a different repo.

## License

MIT

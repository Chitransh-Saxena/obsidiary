# @obsidiary/astro

Astro integration for [Obsidiary](https://obsidiary.pulsar-projects.org). Point
it at a folder of Obsidian markdown — or at a GitHub repository — and get a
fast, linked, searchable site.

**[Docs](https://obsidiary.pulsar-projects.org/docs/setup)** ·
**[Live demo](https://obsidiary.pulsar-projects.org/live)** ·
**[A vault it publishes](https://notes.pulsar-projects.org)**

Most people should start with the scaffolder rather than installing this by hand:

```bash
npm create obsidiary@latest my-notes
```

## Install

```bash
npm i @obsidiary/astro astro
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  integrations: [obsidiary({ vault: './vault', title: 'My Notes' })],
});
```

That is the whole setup. The integration builds the vault index, injects every
route, and renders the reading app — sidebar, backlinks, outline, command
palette, graph, canvas.

## Notes in their own repository

The configuration this exists for. Your site is one repo; your notes are
another, so publishing never touches the thing you actually write in:

```js
obsidiary({ repo: 'you/notes' })
```

One GitHub API call lists the vault and the files come from the CDN. The build
is pinned to a single commit, so it can never mix revisions. **Attachments are
never downloaded** — the built site points at them in place, so a vault full of
photographs doesn't bloat your deploy.

Accepts `owner/repo`, `owner/repo@branch`, `owner/repo/subdir`, or a full GitHub
URL.

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `vault` | `string` | — | Vault directory, relative to the project root. |
| `repo` | `string` | — | A public GitHub repo to publish instead. One of `vault` or `repo` is required. |
| `title` | `string` | `'Notes'` | Header and `<title>`. |
| `description` | `string` | `''` | Site header and metadata. |
| `token` | `string` | `$GITHUB_TOKEN` | Only lifts the API rate limit from 60/hr to 5000/hr. Never required for a public vault locally; CI usually wants one. |
| `lastModified` | `boolean` | `false` | "Last updated" dates and source links. Free locally (mtime); one API call per note for a remote vault, degrading to no dates rather than failing. |
| `source` | `{ repo, ref?, path? }` | derived | Where the vault lives, for edit links. Automatic in `repo` mode. |
| `live` | `boolean` | `false` | Add `/live`, which renders any public vault the visitor names. |
| `liveExamples` | `{ label, repo }[]` | `[]` | One-click examples on `/live`. |
| `credit` | `boolean` | `true` | A quiet "Published with Obsidiary" link in the sidebar foot. Set `false` to remove it; nothing checks. |

Plus everything from `VaultOptions` in the core package:

| Option | Type | Default | |
| --- | --- | --- | --- |
| `explicitPublish` | `boolean` | `false` | Only publish notes with `publish: true`. Worth turning on for a public repo. |
| `removeDrafts` | `boolean` | `true` | Drop `draft: true` notes. |
| `ignore` | `string[]` | — | Path prefixes to exclude, e.g. `['private/', '.obsidian/']`. |
| `base` | `string` | `''` | Prefix for every generated URL. |

## Routes it injects

`/` and a page per note · `/graph` · `/tags` and `/tags/[...tag]` ·
`/search-index.json` · `/vault-index.json` · `/live` when enabled.

The search index is fetched on first search, so readers who never search never
download it.

## The vault index, in your own pages

```astro
---
import { index, site } from 'virtual:obsidiary';
const recent = Object.values(index.notes).slice(0, 5);
---
```

## A warning worth repeating

If your notes repo is public, everything in it is public — including
attachments, and including anything a `publish: false` note links to. Obsidiary
never writes an unpublished note to the build output, but it cannot make a
public repo private. Notes that must stay private belong in a different repo.

## License

MIT

---
title: Notes in their own repo
aliases: [Remote vaults]
---

# Notes in their own repo

The configuration Obsidiary was built for: the site is one repository, your notes
are another, and neither knows much about the other.

```js
obsidiary({
  repo: 'you/notes',
})
```

That is the whole change. Accepted forms:

| Written | Means |
| --- | --- |
| `you/notes` | default branch, whole repo |
| `you/notes@main` | a specific branch, tag or commit |
| `you/notes/garden` | only the `garden/` folder, treated as the vault root |
| `https://github.com/you/notes/tree/main/garden` | the URL from your browser |

## Why bother

- Your vault stays a vault. No build config, no `node_modules`, no site scaffolding
  cluttering the folder you write in.
- You can publish a vault you don't own — a study group's shared notes, a public
  spec, someone's open wiki. Nothing to fork.
- Several sites can publish different folders of one vault.
- Upgrading the engine never touches your notes, because they aren't in the same
  repository.

## How it works

One call to the GitHub API lists the repository, then each note is pulled from
`raw.githubusercontent.com`. Attachments are **not** downloaded — the built site
points at GitHub's CDN, so a vault full of photographs doesn't bloat your deploy.

## Rate limits

Unauthenticated, GitHub allows 60 API calls an hour per IP. A build uses one. If
you build a lot, or you're on shared CI, set `GITHUB_TOKEN` and the limit becomes
5000:

```yaml
- run: npm run build
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The token only lifts the rate limit. A public vault never needs one to be read.

## Rebuilding when notes change

A push to your notes repo doesn't rebuild the site by itself. See
[[Deploying#Keeping a remote vault fresh]].

## The live view

`live: true` adds `/live`, which renders any public vault a visitor names —
in their browser, with no build at all. It is the same engine: resolver,
transclusion, backlinks and search all run client-side.

Useful as a demo, and useful for reading a vault you have no intention of
deploying.

---
title: Setup
---

# Setup

From nothing to a live site. Assumes Node 20+ and a GitHub account. Everything
below is free.

## 1. Scaffold

```bash
npm create obsidiary@latest my-notes
```

It asks two things: a title, and whether your notes are a **local folder** or a
**GitHub repository**. Either is fine — you can change it later in one line.

```bash
cd my-notes
npm install
npm run dev
```

Open <http://localhost:4321>. The sample vault is there so the site isn't empty;
delete it once you have your own notes.

## 2. Add your notes

**Local folder.** Put markdown in `vault/`. Point Obsidian at that folder and use
it exactly as you normally would — Obsidiary re-reads it on every save.

**Your existing vault.** Copy it in, or replace `vault/` with a symlink to it:

```bash
rm -rf vault && ln -s ~/Documents/MyVault vault
```

**A repository.** See [[Notes in their own repo]].

> [!warning] Before you make anything public
> A public repository means a public site — including attachments. Read
> [[Publishing only some notes]] first. It takes two minutes and it is the one
> mistake that is genuinely hard to undo.

## 3. Put it on GitHub

```bash
git init
git add -A
git commit -m "my notes site"
gh repo create my-notes --public --source=. --push
```

No `gh`? Create the repo on github.com and follow the instructions it gives you.

## 4. Deploy

Pick one — full walkthroughs in [[Deploying]].

| Host | What you run |
| --- | --- |
| Cloudflare | `npx wrangler deploy` |
| Vercel | import the repo on vercel.com |
| Netlify | import the repo on netlify.com |
| GitHub Pages | Settings → Pages → Source → GitHub Actions |

Cloudflare is the recommendation: unlimited bandwidth, free custom domains, no
restriction on commercial use.

## 5. Keep it updated

```bash
npm update obsidiary @obsidiary/astro
```

That is the whole upgrade. Your notes and your config are yours; the engine is a
dependency, so there is never a merge to resolve.

## Configuration

Everything lives in `astro.config.mjs`:

```js
obsidiary({
  vault: './vault',          // or: repo: 'you/notes'
  title: 'My Notes',
  description: '',
  explicitPublish: false, // only publish: true
  removeDrafts: true,        // drop `draft: true`
  ignore: ['private/'],   // folders to skip
  base: '',               // serve under /notes
  live: false,            // add the /live page
})
```

## What you get for free

Three routes are added without any wiring:

- `/graph` — the whole vault as a graph
- `/search-index.json` — powers ⌘K, fetched on first search only
- `/vault-index.json` — the entire parsed vault as data, for anything else

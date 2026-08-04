---
title: Obsidiary docs
---

# Obsidiary

Publish an Obsidian vault as a fast, linked, free website.

These docs are themselves an Obsidian vault, published with Obsidiary. If
something here looks broken, the product is broken.

## Start here

- [[Setup]] — from nothing to a deployed site, step by step
- [[Shaping a vault with an AI agent]] — you have a folder of files, not a
  vault. A prompt that turns one into the other: folders, tags, links, hubs
- [[The art of documenting]] — the craft, not the tool: how much to explain,
  tags that survive, links that carry the argument, and citing your sources
- [[Deploying]] — Cloudflare, Vercel, Netlify, GitHub Pages
- [[Notes in their own repo]] — the interesting configuration
- [[Publishing only some notes]] — read this before making a vault public
- [[Syntax]] — everything Obsidiary understands

## The short version

```bash
npm create obsidiary@latest my-notes
cd my-notes
npm install
npm run dev
```

Put markdown in `vault/`, or point the config at a GitHub repository instead.
Then deploy — see [[Deploying]].

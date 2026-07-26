---
title: Obsidiary
tags: [meta]
---

# Obsidiary

This is an ordinary Obsidian vault. No plugin, no export step, no build folder
checked into the notes. The markdown files here are exactly what you'd get if
you opened this folder in Obsidian — and this page is what they look like
published.

## What's in the demo

- [[Wikilinks]] — every link form Obsidian supports, including the ones that
  usually break
- [[Callouts]] — the full set, folding included, with no JavaScript
- [[Transclusion]] — `![[embeds]]` that inline real content
- [[Aliases]] — one note, many names
- [[Reading map]] — an Obsidian `.canvas`, rendered as a page

## The awkward cases

A vault is never as tidy as a docs site. There are three notes called
`Zettelkasten` in this vault, at three different depths. A link written from
inside a folder finds the one next to it:

- [[dev/Zettelkasten]] resolves by path
- [[Zettelkasten]] from here resolves to the root one

There's also a note called [[v1.2 spec]], whose name would be truncated to `v1`
by anything that treats "text after the last dot" as a file extension.

> [!tip] Try it
> Press `t` to switch between light and dark.

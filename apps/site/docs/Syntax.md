---
title: Syntax
tags: [reference]
---

# Syntax

Everything Obsidiary understands. If it works in Obsidian and it's listed here,
it works on your site.

## Links

| Written | Does |
| --- | --- |
| `[[Note]]` | link, resolved by proximity then by name |
| `[[Note\|label]]` | link with different text |
| `[[Note#Heading]]` | link to a heading |
| `[[Note#^block-id]]` | link to a specific block |
| `[[#Heading]]` | link within the current note |
| `[[folder/Note]]` | link by path |
| `[text](Note.md)` | ordinary markdown links resolve too |

A link to a note that doesn't exist renders visibly but isn't clickable, so a
published garden is never full of silent 404s.

**Resolution order.** A target containing a slash is a path. A bare name is
matched by proximity: the note in your own folder wins, then the shallowest
match, then alphabetically. Matching is case-insensitive, but an exact-case hit
always wins — a vault with both `Note.md` and `note.md` resolves each correctly.

> [!warning] Pipes inside tables
> A `|` separates table cells before it does anything else, so an aliased link in
> a table must escape it: `[[Note\|label]]`. Obsidian has the same constraint.

## Embeds

| Written | Does |
| --- | --- |
| `![[Note]]` | inlines the whole note |
| `![[Note#Section]]` | inlines one section |
| `![[Note#^block-id]]` | inlines one block |
| `![[image.png]]` | image |
| `![[image.png\|400]]` | image, 400px wide |
| `![[image.png\|400x300]]` | image, sized |
| `![[clip.mp4]]`, `![[song.mp3]]`, `![[doc.pdf]]` | media players |

Embeds nest up to three levels. Two notes embedding each other degrade to links
rather than recursing — a cycle in a vault is a normal Tuesday.

## Callouts

```markdown
> [!note] Title
> Body

> [!warning]- Starts collapsed
> [!tip]+ Starts open
```

All Obsidian types and aliases: note, abstract/summary/tldr, info, todo,
tip/hint/important, success/check/done, question/help/faq,
warning/caution/attention, failure/fail/missing, danger/error, bug, example,
quote/cite.

Foldable callouts are `<details>` elements — folding works with JavaScript off,
and the content stays findable by in-page search.

## Tags

`#tag` and `#nested/tag`, in the body or in frontmatter. Indexed under every
ancestor, so `#project/alpha/deep` is findable as `#project`.

Not tags: `#1` (a number), `example.com#section` (a URL fragment), `# Heading`,
and anything inside code.

## Frontmatter

```yaml
---
title: Shown instead of the filename
aliases: [Other Name, AKA]
tags: [one, two]
publish: true
draft: false
permalink: /custom-url
description: Used for meta tags
---
```

## Canvas

`.canvas` files render as pages, with text, file, link and group nodes, and edges
with labels and arrows. File nodes are real embeds — including subpath slicing,
so a canvas card can show one section of another note.

A canvas is an ordinary note as far as everything else is concerned: it has a
URL, appears in the sidebar and search, and its links are in the graph.

## Also supported

GFM tables, task lists, footnotes and strikethrough · LaTeX via `$…$` and `$$…$$`
· block anchors (`^an-id`) · heading anchors · aliases as alternative link
targets.

## Not supported

Dataview, Templater and other plugin syntaxes render as the plain text they are.
Excalidraw files are treated as attachments.

Related: [[Setup]], [[Publishing only some notes]].

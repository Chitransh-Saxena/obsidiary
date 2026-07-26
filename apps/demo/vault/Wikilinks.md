---
tags: [reference]
---

# Wikilinks

Every form below is real Obsidian syntax, and every one of them resolves here.

## The basics

| Written | Result |
| --- | --- |
| `[[Callouts]]` | [[Callouts]] |
| `[[Callouts\|with an alias]]` | [[Callouts\|with an alias]] |
| `[[Callouts#Folding]]` | [[Callouts#Folding]] |

> [!warning] Pipes inside tables
> A `\|` is a cell separator before it is anything else, so an aliased link
> written inside a table must escape it: `[[Note\|label]]`. Obsidian has exactly
> the same constraint — the table wins the argument in both.

## Links that go nowhere

A link to a note you haven't written yet stays visible but isn't clickable —
[[A Note I Haven't Written]]. Hover it. Nothing worse than a published garden
full of links that 404 silently.

## Ambiguity

There are three notes named `Zettelkasten` in this vault:

- `Zettelkasten.md`
- `dev/Zettelkasten.md`
- `dev/deep/Zettelkasten.md`

From this note, at the vault root, a bare [[Zettelkasten]] means the root one.
Open [[dev/deep/Zettelkasten]] and you'll see the same bare link there points at
its own neighbour instead. Proximity wins, exactly as it does in the app.

## Paths

Absolute-from-root and relative both work: [[dev/Zettelkasten]] and
[[dev/deep/Zettelkasten]].

## Tags

Tags become links: #reference and nested ones like #demo/syntax. A `#1` in prose
is not a tag, and neither is the fragment in <https://example.com#section>.

Inside code, nothing is touched:

```md
[[This is not a link]]
#not-a-tag
```

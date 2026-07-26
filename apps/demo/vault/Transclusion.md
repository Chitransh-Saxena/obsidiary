---
tags: [reference]
---

# Transclusion

`![[Note]]` pulls the real content in, rendered, not a link and not a preview
card.

## A whole note

![[Aliases]]

## One section

`![[Callouts#Folding]]` inlines just that heading and everything under it:

![[Callouts#Folding]]

## One block

A paragraph marked with `^an-id` can be embedded on its own. Here is
`![[dev/Zettelkasten#^atomic]]`:

![[dev/Zettelkasten#^atomic]]

## Safety rails

Embeds nest, up to a configurable depth. If two notes embed each other, the
inner one degrades to a link rather than recursing forever — a cycle in a vault
is a normal Tuesday, not a crash.

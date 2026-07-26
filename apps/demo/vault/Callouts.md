---
tags: [reference]
---

# Callouts

> [!note] Every Obsidian callout type works
> Including the aliases — `[!tldr]` renders as an abstract, `[!hint]` as a tip.

> [!tip] Tip
> The accent colours come from the same tokens as the rest of the theme.

> [!warning] Warning
> Anything in a public repo is public. Frontmatter `publish: false` keeps a note
> out of the build entirely — it is never written to disk.

> [!danger] Danger
> There is no partial publishing of a public repo. If a note must stay private,
> it belongs in a different repo.

> [!success] Success
> Callout bodies take full markdown — [[Wikilinks|links]], lists, code:
> ```js
> const vault = await load('./vault')
> ```

> [!quote] Quote
> A commonplace book is a garden carried in the pocket.

## Folding

> [!question]- This one starts collapsed
> Because it was written with `[!question]-`. It's a `<details>` element, so
> folding works with JavaScript disabled and the content is still findable by
> in-page search.

> [!example]+ This one starts open
> Written with `[!example]+`. Click the title to collapse it.

## Not a callout

> An ordinary blockquote is left completely alone.

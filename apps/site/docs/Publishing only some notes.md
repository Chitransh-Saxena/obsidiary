---
title: Publishing only some notes
---

# Publishing only some notes

> [!danger] The thing to understand first
> If the repository holding your notes is public, everything in it is public —
> including attachments, including files Obsidiary never renders. Obsidiary can
> keep a note out of the built site. It cannot make a public repository private.
>
> Notes that must stay private belong in a **different, private repository**.

With that said, there are three ways to control what reaches the site.

## Opt in, per note

```js
obsidiary({ explicitPublish: true })
```

Now only notes with `publish: true` are built:

```markdown
---
publish: true
---
```

This is the right default for a vault you also use for private thinking. Nothing
else is written to `dist/` — unpublished notes aren't hidden, they're absent.

## Opt out, per note

Without `explicitPublish`, everything is published except:

```markdown
---
publish: false     # never built
draft: true    # never built; removeDrafts: false
---
```

## Skip whole folders

```js
obsidiary({
  ignore: ['private/', 'journal/'],
})
```

Skipped before parsing, so nothing in them is indexed, linked or searchable.

`.obsidian/`, `.trash/`, `.git/` and `node_modules/` are always skipped.

## What happens to links pointing at unpublished notes

They become unresolved links — visible, styled as unwritten, and not clickable.
They do not leak the note's contents or its path in the page text.

If you'd rather they disappear entirely, don't link to private notes from public
ones. Obsidiary won't rewrite your prose for you.

## Canvases

A `.canvas` file has no frontmatter, so it has no way to opt in. Under
`explicitPublish: true`, canvases are skipped entirely — including as raw files,
because publishing the JSON would leak exactly what the setting is meant to
protect.

## Checking before you deploy

```bash
npm run build
grep -ril "something private" dist/ | head
```

`dist/` is the whole site. If it isn't in there, it isn't published.

Related: [[Setup]], [[Notes in their own repo]].

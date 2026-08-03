---
title: Shaping a vault with an AI agent
aliases: [AI agent, Shape my notes, From a folder of files to a vault]
tags: [guide]
---

# Shaping a vault with an AI agent

Most people do not have a vault. They have a folder — three years of markdown,
some `Untitled 4.md`, a few things written on a train, no tags, no links, and no
structure anybody planned.

Obsidiary publishes a vault beautifully. It cannot invent one. But an AI agent
with access to that folder can, and it turns out to be mostly a matter of saying
precisely what you want.

This page is that prompt.

Any agent that can read and write local files will do: **Claude Code**,
**Codex**, **Cursor**, **Copilot in agent mode**, **Gemini CLI**. The prompt
below is deliberately tool-agnostic.

> [!warning] Commit first. Genuinely.
> The agent renames files, moves them, and edits frontmatter. If your notes are
> not in git, make them so before you start — one command, and every change
> becomes reversible:
>
> ```bash
> cd /path/to/your/notes
> git init && git add -A && git commit -m "before the agent"
> ```
>
> If you would rather not use git, copy the folder first. Do not skip this.

## The method

Point your agent at the folder and paste the prompt. Then **read what it did** —
you are the editor, it is the typesetter.

```bash
cd /path/to/your/notes
claude          # or: codex, or open the folder in Cursor
```

## The prompt

````markdown
You are reorganising a folder of markdown notes into an Obsidian-compatible
vault that will be published with Obsidiary. Work in place, in this folder.

RULES
1. Never change the words of a note. You may add frontmatter, add links, and
   rename or move files. You may not rewrite, reword, summarise or delete prose.
2. Never delete a file. If something looks like junk, list it at the end and
   leave it where it is.
3. Verify this folder is a clean git repository before you touch anything. If it
   is not, stop and tell me.
4. Anything you are unsure about: leave it alone and report it.

PASS 1 — INVENTORY
Read every .md file. For each, record its real subject, what it mentions or
refers to, and whether it is a finished note, a stub, or a scrap.
Write this to _inventory.md as a table. Move nothing yet. Show me the table.

PASS 2 — FOLDERS
Propose 4 to 8 top-level folders based on what is actually in the inventory —
not a generic PARA or Zettelkasten template. Folder names: lowercase, one word
where possible.
Move each note into exactly one folder.
Filenames are the note's real title: "Low light.md", not "note-2023-04-11.md".
When you rename a file, add its old name to `aliases:` so old links still work.

PASS 3 — FRONTMATTER AND TAGS
Decide the complete tag list BEFORE tagging anything. Keep the top level to
5–10 tags. Tags are lowercase and nested at most two deep: `#music`,
`#music/theory`. Obsidiary indexes `#a/b` under `#a` as well, so a small top
level is what makes tags useful.
Then give every note:

---
title: <human title, if different from the filename>
aliases: [<old filename, other names people would search>]
tags: [<area>, <area>/<topic>]
---

Write the full tag list to tags.md as a registry — one line per tag, what it
means, and which notes use it. This is the thing that stops tags multiplying.

PASS 4 — HUB NOTES
Two tiers, and usually only two.

Give every TOP-LEVEL folder an index.md:

---
title: <Human name of the area>
aliases: [<the other word people call this>]
tags: [area, <area>]
---

with a sentence on what lives there, then a list of [[Wikilinks]] to every note
in that area — including notes in its subfolders — each with half a line of
description. It should read like a contents page, not a file listing.

LIST THEM IN THE ORDER SOMEONE SHOULD READ THEM, not alphabetically. That order
is load-bearing: it is what the site uses to build previous/next links between
notes. Alphabetical is a filing order, not a reading one.

Do NOT give every subfolder its own index.md. A subfolder of three notes that
the area hub already lists is a page nobody needs and one more click to the
thing they wanted. Add a sub-hub only when a subfolder has grown past roughly
six notes and genuinely needs its own contents page — and when you do, the area
hub should link to the sub-hub rather than to every note beneath it.

PASS 5 — LINKS
Where one note genuinely refers to another's subject, link it: [[Note name]].
Use bare names, not [[folder/Note]] — bare links resolve by proximity and
survive files being moved later; path links break the moment you reorganise.
Do not manufacture links. Three real ones beat thirty invented ones.
Where it helps, end a note with a "Related:" line of 2–4 links.
Do not write "linked from" or maintain any backlink list by hand — backlinks are
built automatically from the forward links.

PASS 6 — ROOT
Write index.md at the vault root — the master index. What this collection is,
and a table of the areas, each with a [[link]] to its hub note and a line on
what it covers. It links to the area hubs, not to individual notes.

PASS 7 — CHECK AND REPORT
Report, and fix only the first of these:
- every [[link]] whose target matches no filename and no alias
- any note you could not classify
- ANY file that looks private — money, health, addresses, credentials, other
  people's names — because this vault is about to become a public website.
List those last two. Do not act on them. I will decide.
````

## What you get

| Before | After |
| --- | --- |
| `Untitled 4.md` at the root | `photography/Low light.md` |
| no frontmatter | `title`, `aliases`, `tags` on every note |
| tags invented per note, or none | a fixed taxonomy, written down in `tags.md` |
| no links | real `[[wikilinks]]`, and backlinks for free |
| no entry point | a hub `index.md` per folder, and one at the root |

Backlinks, the graph, the tag index and search all come from that structure —
you never build them. Obsidiary derives them from the forward links.

## The shape: one master index, one hub per area

Two tiers, and that is usually the right number:

```
index.md                 ← the master index: what this is, and the areas
  music/index.md         ← an area hub: the contents page for music
    music/theory/…       ← subfolders organise files; they need no page
    music/pieces/…
  photography/index.md
```

The **master index** links to the area hubs, not to individual notes. Each
**area hub** lists every note in its area, including ones in subfolders, in the
order someone should read them.

**Subfolders do not need their own index.** A folder of three notes that the
area hub already lists is a page nobody needs, and one more click to the thing
they wanted. Add a third tier only when a subfolder outgrows the hub — past
roughly six notes — and then have the hub link to the sub-hub instead of to
everything beneath it.

> [!tip] The order of a hub's links is load-bearing
> Obsidiary reads it as the reading order and builds **previous / next** links
> from it, at the top and bottom of every note in that area. A vault has no
> inherent sequence and the sidebar is alphabetical — which is a filing order,
> not a reading one — so the hub's list is the only honest source of "what
> comes next".
>
> Notes that no hub lists simply get no previous/next, rather than a link
> pointing somewhere arbitrary. That is also the quickest way to spot a note
> you forgot to add to its contents page.

## Then read it

The agent is good at structure and confident about meaning. Check three things
before you publish:

1. **The tag registry.** If `tags.md` has thirty tags, tell the agent to cut it
   to eight and re-tag. A taxonomy nobody can hold in their head is decoration.
2. **The links.** Skim for links that assert a connection you would not have
   made. Delete those — a garden of invented links is worse than a garden of none.
3. **The privacy list from Pass 7.** This is the one that matters. See
   [[Publishing only some notes]] before making anything public.

## Doing it in pieces

The full prompt in one go works on a few hundred notes. Beyond that, or if you
want more control, run the passes one at a time — each is a usable prompt on its
own, and you can stop after any of them:

> Do Pass 1 only. Show me the inventory table and wait.

A smaller, honest version if you just want it tidy:

> Organise the markdown in this folder into 5–7 lowercase folders by subject.
> Do not change any wording. Add `title`, `aliases` and `tags` frontmatter to
> each file, drawing tags from one list you decide first. Give each folder an
> `index.md` linking to its notes with `[[wikilinks]]`. Report anything that
> looks private.

## Publishing it

Once the folder has a shape, it is a vault. Two ways to publish it, both about
five minutes.

### Your notes stay on your machine

Scaffold a site and point it at the folder:

```bash
npm create obsidiary@latest my-site
cd my-site
```

Copy your notes into `my-site/vault/`, then:

```bash
npm install
npm run dev          # look at it: http://localhost:4321
npx wrangler deploy  # publish it
```

### Your notes in their own repository — recommended

Better, because your writing never shares a repository with the renderer, and
publishing is then just `git push`. Put the vault in its own **public** GitHub
repo, then:

```bash
npm create obsidiary@latest my-site -- --repo you/notes
cd my-site && npm install && npx wrangler deploy
```

Or set it by hand in `astro.config.mjs`:

```js
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  integrations: [
    obsidiary({
      repo: 'you/notes',        // owner/repo, or owner/repo@branch
      title: 'My Notes',
      lastModified: true,       // dates and edit links, from git
    }),
  ],
});
```

From then on, writing in Obsidian and pushing is the whole publishing workflow.
The build reads the repository at a single commit, and attachments are served
from GitHub rather than copied, so a vault full of photographs doesn't bloat the
deploy.

Details and the other hosts: [[Setup]] · [[Deploying]] ·
[[Notes in their own repo]].

> [!warning] A public repo is public
> Everything in it — including attachments, and including anything a
> `publish: false` note links to. Obsidiary never writes an unpublished note
> into the build, but it cannot make a public repository private. Read
> [[Publishing only some notes]] first.

Related: [[Setup]] · [[Syntax]] · [[Publishing only some notes]]

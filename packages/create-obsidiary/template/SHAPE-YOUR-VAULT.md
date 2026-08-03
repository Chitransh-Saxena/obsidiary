# Turning a folder of files into a vault

If your notes are already organised — folders, tags, wikilinks — ignore this
file, put them in `vault/` and carry on.

If they are three years of markdown with no structure, that is the normal case,
and an AI agent can give them a shape in one pass. Any agent with access to
local files works: **Claude Code**, **Codex**, **Cursor**, **Gemini CLI**.

Full guide, including how to run it in stages:
<https://obsidiary.pulsar-projects.org/docs/shaping-a-vault-with-an-ai-agent>

---

## First: make it reversible

The agent renames files, moves them and edits frontmatter. Put the notes in git
before you start.

```bash
cd /path/to/your/notes
git init && git add -A && git commit -m "before the agent"
```

## Then: point an agent at the folder and paste this

```bash
cd /path/to/your/notes
claude          # or: codex, or open the folder in Cursor
```

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
Give every folder an index.md:

---
title: <Human name of the area>
aliases: [<the other word people call this>]
tags: [area, <area>]
---

with a sentence on what lives there, then a list of [[Wikilinks]] to every note
in that folder, each with half a line of description. This is the page people
land on, so it should read like a contents page, not a file listing.

PASS 5 — LINKS
Where one note genuinely refers to another's subject, link it: [[Note name]].
Use bare names, not [[folder/Note]] — bare links resolve by proximity and
survive files being moved later; path links break the moment you reorganise.
Do not manufacture links. Three real ones beat thirty invented ones.
Where it helps, end a note with a "Related:" line of 2–4 links.
Do not write "linked from" or maintain any backlink list by hand — backlinks are
built automatically from the forward links.

PASS 6 — ROOT
Write index.md at the vault root: what this collection is, and a table of the
folders, each with a [[link]] to its hub note.

PASS 7 — CHECK AND REPORT
Report, and fix only the first of these:
- every [[link]] whose target matches no filename and no alias
- any note you could not classify
- ANY file that looks private — money, health, addresses, credentials, other
  people's names — because this vault is about to become a public website.
List those last two. Do not act on them. I will decide.
````

## Then read what it did

Check three things: the tag registry (cut it to eight if it sprawled), the links
(delete any connection you would not have made yourself), and the privacy list
from Pass 7 — that last one matters, because a public repo is public, including
attachments.

## Then publish

Put the shaped notes in `vault/`, or better, in their own public GitHub repo and
set `repo: 'you/notes'` in `astro.config.mjs`.

```bash
npm install
npm run dev          # look at it
npx wrangler deploy  # publish it
```

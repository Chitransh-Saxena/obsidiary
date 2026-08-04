---
title: The art of documenting
aliases: [Writing notes, How to write notes, Documenting]
tags: [guide]
---

# The art of documenting

Obsidiary will publish whatever you give it. Whether that is worth reading is a
separate craft, and it is mostly unteachable in the abstract — so this page is
concrete rules with the reasoning attached, which you should feel free to break
once you know why they are there.

One idea underneath all of it:

> [!tip] Write for the person who has forgotten
> Not for a stranger, and not for yourself today. For **you, in eighteen
> months**, who has forgotten the context entirely but still thinks the way you
> think. That reader is specific enough to write for and forgiving enough to
> write freely for.

Everything below is a consequence of taking that reader seriously.

## Explaining: the two failures

**Under-explaining** is writing down the conclusion and not the reason.

> Use `--depth 1` when cloning CI.

In a year you will not know whether that was a real finding or something you
read once. You cannot act on it, and you cannot correct it.

**Over-explaining** is copying the manual.

> Git is a distributed version control system. Cloning creates a local copy of a
> repository. The `--depth` flag creates a shallow clone with a truncated
> history…

You will never read that. It is already written, better, elsewhere, and it will
be out of date before you return.

The note you want holds **only the part that is not in the manual**: the thing
you had to work out, the thing that surprised you, or the number you measured.

> Shallow-clone CI (`--depth 1`). Our checkout went 41s → 6s, because the repo
> carries ~4 GB of history nobody needs at build time. Not for release jobs —
> `git describe` needs tags. ([docs](https://git-scm.com/docs/git-clone))

Same subject. It states a **measurement**, a **reason**, an **exception**, and a
**source**. That is the whole shape.

### The test

Ask of every paragraph: *would I have found this in the first three results of a
search?* If yes, delete it and link the source instead. What remains is yours,
and it is the only part worth keeping.

## Tailoring it to how you think

This is the part people leave out, and it is the highest-value thing in a
personal vault.

A textbook explains a subject in the order the subject has. **You do not
understand it in that order.** You understand it by the thing it hooked onto —
an analogy, a language you already speak, a mistake you made once.

Write down the hook.

The guitar notes on this project's own [example
vault](https://notes.pulsar-projects.org/music/theory) are the model: every
piece of Western theory is explained against **sargam**, because the author grew
up hearing sa re ga ma and learning C D E F, and spent years not noticing they
describe the same thing. No textbook would organise it that way. It is the only
organisation that works *for him* — which is the point of a personal vault, and
the reason it is worth writing rather than bookmarking.

Ask: *what made this click?* Then lead with that, even if it is idiosyncratic.
**Especially** if it is idiosyncratic.

## Tags

Tags are a **filing system**, not a description. Their only job is to make a set
of notes findable together later.

The failure is always the same — tags invented one note at a time, until there
are sixty and none of them are used twice.

1. **Decide the whole list first.** Five to ten at the top level. Write it in a
   `tags.md` note with a line on what each means. If it will not fit in your
   head, it will not be applied consistently.
2. **Two levels, at most.** `#music`, `#music/theory`. Obsidiary indexes
   `#a/b` under `#a` too, so the top level stays useful automatically.
3. **Tag the kind of thing, not the subject.** The subject is already in the
   title, the folder, and the links. `#reference`, `#decision`, `#howto`,
   `#open-question` earn their place; `#guitar` on a note called "Chords" in
   `music/` does not.
4. **If a tag has one note, it is not a tag.** Delete it, or find its siblings.

The registry is what makes this hold. Without a written list you are
re-inventing the taxonomy on every note, and it drifts within a fortnight.

## Links carry the argument

A tag says *this note is that sort of thing*. A link says *this note has
something to do with that one* — which is far more information, and it is what
turns a folder into a vault.

- **Link where you would otherwise re-explain.** The link is the explanation.
- **Three real links beat thirty.** A note wired to everything says nothing.
- **Bare `[[names]]`, not `[[folder/names]]`.** Bare links resolve by proximity
  and survive reorganisation; path links break the moment you move a file.
- **Never maintain a "linked from" list.** Backlinks are derived. Writing them
  by hand is bookkeeping that goes stale.

The link you should always add is the one to the **hub note** of the area, so
nothing is an orphan. See [[Shaping a vault with an AI agent]] for how the hubs
and the reading order fit together.

## Citations

A personal note is not a paper, but the moment you publish it, an unsourced
claim is just an assertion — and the person most misled by it will be you, later.

**Cite anything you did not work out yourself.** The rule is that simple.

```markdown
Shallow clones drop history, so `git describe` cannot find tags
([git-clone docs](https://git-scm.com/docs/git-clone)).

Kahneman puts the anchoring effect at ~55% of the anchor
(*Thinking, Fast and Slow*, ch. 11).
```

Four things worth doing:

1. **Inline, next to the claim** — not in a bibliography at the foot. The claim
   and its source should not be separated by a scroll.
2. **Say what kind of source it is.** "the docs", "a blog post", "someone on
   Discord" and "I measured it" carry very different weight, and future-you
   needs to know which one this was.
3. **Date anything that will rot.** Prices, versions, benchmarks, API
   behaviour. `(as of 2026-03)` costs four words and saves an hour.
4. **Mark the boundary between the source and you.** This is the important one:

```markdown
> The docs say connection pooling is per-process.

So our four workers each hold a pool — which is why the DB sees 4× the
connections we configured. (My conclusion, not theirs. Unverified.)
```

That last parenthesis is worth more than the citation. It tells you which part
to re-check when something turns out to be wrong.

> [!warning] Quote briefly, and never at length
> A published vault is a public website. Short quotes with attribution are
> ordinary practice; reproducing a chapter, a lyric, or a full transcription is
> not, and it is what gets takedowns. Link generously, quote sparingly, and
> write the summary in your own words — which you should be doing anyway,
> because the summary is the part that is yours.

## What not to write down

- **Anything you will never read again.** Meeting notes with no decision in
  them. Tutorials you followed once and completed.
- **Anything that will be wrong next month** unless you date it.
- **Anything private.** A public repo is public, including attachments, and
  including anything a `publish: false` note links to. See
  [[Publishing only some notes]].
- **Second copies.** Two notes on one subject will disagree within a year. Merge
  them and keep the links pointing at the survivor.

## The shape of a note that works

```markdown
---
title: Shallow clones in CI
aliases: [--depth 1]
tags: [howto, ci]
---

# Shallow clones in CI

`--depth 1` cut our checkout from 41s to 6s (measured, 2026-03).

## Why

The repo carries ~4 GB of history. CI needs one commit.
Depth-1 fetches that one ([docs](https://git-scm.com/docs/git-clone)).

## When not to

Release jobs — `git describe` needs tags, and a shallow clone has none.
Use `fetch-depth: 0` there.

Related: [[Build times]] · [[Release process]]
```

Forty lines. It contains a measurement, a reason, an exception, a source, and
two links. Nothing in it is in the manual, and none of it needs rewriting when
Git changes.

## And then let the tooling do the rest

Backlinks, the graph, the tag index, search and the reading order are all
**derived** from what you have already written. You do not maintain any of them.
That is the whole bargain: write the note and the links honestly, and the
structure appears.

Related: [[Shaping a vault with an AI agent]] · [[Syntax]] ·
[[Publishing only some notes]]

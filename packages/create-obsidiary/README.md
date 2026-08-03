# create-obsidiary

Scaffold a site that publishes your Obsidian vault.

```bash
npm create obsidiary@latest my-notes
cd my-notes && npm install && npm run dev
```

**[Obsidiary](https://obsidiary.pulsar-projects.org)** ·
**[Setup guide](https://obsidiary.pulsar-projects.org/docs/setup)**

It asks three questions — folder, title, and whether your notes are a local
folder or a GitHub repo — then writes a working Astro project. **Zero
dependencies**, on purpose: this is the first thing anyone runs, and a
scaffolder that pulls forty packages before asking a single question is a bad
first impression.

## Non-interactive

```bash
npm create obsidiary@latest my-notes -- --yes --title "My Notes" --repo you/notes
```

| Flag | |
| --- | --- |
| `--title` | Site title. |
| `--repo` | Publish a GitHub repo instead of a local folder. Accepts `owner/repo`, `owner/repo@branch`, a subdirectory, or a full URL. |
| `--vault` | Use a local vault folder (the default). |
| `--yes` | Accept defaults, ask nothing. |

## Then deploy it free

```bash
npx wrangler deploy
```

| Host | Bandwidth | Custom domain | Commercial use |
| --- | --- | --- | --- |
| **Cloudflare** (recommended) | unlimited | free | allowed |
| Vercel | 100 GB | free | **not on free** |
| Netlify | 100 GB | free | allowed |
| GitHub Pages | 100 GB soft | free | **not on free** |

## Upgrading

Your notes never share a git history with the renderer, so upgrades are a
version bump rather than a merge conflict:

```bash
npm update obsidiary @obsidiary/astro
```

## Requires

Node **>= 22.12**.

## License

MIT

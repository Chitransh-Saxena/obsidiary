# Getting started

## Write

Point Obsidian at the `vault/` folder and use it normally. `npm run dev` picks
up every change.

## Publish

Any of these, all free:

| Host | Command |
| --- | --- |
| Cloudflare | `npx wrangler deploy` |
| Vercel | import the repo, no config needed |
| Netlify | import the repo, no config needed |
| GitHub Pages | Settings → Pages → Source → GitHub Actions |

Cloudflare is the recommendation: unlimited bandwidth, free custom domains, and
no restriction on commercial use. Vercel and GitHub Pages both cap free
bandwidth at 100 GB and forbid commercial sites.

## Notes in their own repository

Swap `vault: './vault'` for `repo: 'owner/notes'` in `astro.config.mjs` and this
site publishes a vault it doesn't contain. Use `.github/workflows/rebuild.yml`
to keep it fresh.

See [[index|the home note]] to get back.

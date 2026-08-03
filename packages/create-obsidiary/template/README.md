# My notes site

Built with [Obsidiary](https://github.com/Chitransh-Saxena/obsidiary).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
```

## Where the notes are

`astro.config.mjs` points at either a local folder or a GitHub repository:

```js
obsidiary({
  vault: './vault',        // a folder in this project
  // repo: 'owner/notes',  // …or a public repository
})
```

## Deploy

| Host | How | Free tier |
| --- | --- | --- |
| **Cloudflare** | `npx wrangler deploy` | unlimited bandwidth, free custom domain |
| Vercel | import the repo | 100 GB, non-commercial only |
| Netlify | import the repo | 100 GB |
| GitHub Pages | Settings → Pages → GitHub Actions | 100 GB, non-commercial only |

For GitHub Pages on a project URL (`user.github.io/repo`), set `site` and `base`
in `astro.config.mjs` — see the comment at the top of
`.github/workflows/deploy-pages.yml`.

## Upgrading

```bash
npm update obsidiary @obsidiary/astro
```

That's the whole upgrade. Your notes and this config are yours; the engine is a
dependency, so there is never a merge to resolve.

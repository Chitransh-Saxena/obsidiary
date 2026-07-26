---
title: Deploying
---

# Deploying

Four hosts, all free, in the order I would pick them.

## Cloudflare — recommended

Unlimited bandwidth, free custom domains, 500 builds a month, and no restriction
on commercial use. The scaffold already includes `wrangler.jsonc`.

```bash
npx wrangler login
npx wrangler deploy
```

That's it — you get `https://<name>.<your-subdomain>.workers.dev`. Rename the
site by editing `name` in `wrangler.jsonc`.

**Custom domain.** Add the domain to Cloudflare, then in the dashboard:
Workers & Pages → your worker → Settings → Domains & Routes → Add custom domain.
No certificate to buy or renew.

**Deploy on push** instead of from your laptop: add a
[Wrangler action](https://github.com/cloudflare/wrangler-action) with a
`CLOUDFLARE_API_TOKEN` secret.

## Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). Astro is
detected; `vercel.json` is already in the scaffold. Every push deploys.

Free tier: 100 GB bandwidth, and the Hobby plan **forbids commercial use** —
if the site is for a business, this is the wrong host.

## Netlify

Import at [app.netlify.com/start](https://app.netlify.com/start). `netlify.toml`
is already there. 100 GB bandwidth and 300 build minutes a month.

## GitHub Pages

The scaffold includes `.github/workflows/deploy-pages.yml`. Turn it on:
**Settings → Pages → Source → GitHub Actions**, then push.

> [!warning] The base path
> Publishing to `you.github.io/my-notes` means the site lives under `/my-notes`,
> not `/`. Astro has to be told, or you get an unstyled page with dead links:
> ```js
> export default defineConfig({
>   site: 'https://you.github.io',
>   base: '/my-notes',
>   integrations: [obsidiary({ /* … */ })],
> })
> ```
> This does not apply to a custom domain, or to a repository named
> `you.github.io`. It is the single most common way a Pages deploy goes wrong.

## Keeping a remote vault fresh

If your notes live in [[Notes in their own repo|their own repository]], pushing a
note doesn't rebuild the site — nothing told it to.

The scaffold's `.github/workflows/rebuild.yml` rebuilds hourly and adds a **Run
workflow** button. It needs no secrets in your notes repo, which is why it is the
default.

Want instant rebuilds? Have the notes repo fire a `repository_dispatch` at the
site repo. That needs a personal access token stored in the notes repo, which is
a real trade-off — an hourly schedule is usually enough for notes.

## Costs, honestly

| Host | Bandwidth | Custom domain | Commercial use |
| --- | --- | --- | --- |
| Cloudflare | unlimited | free | allowed |
| Vercel | 100 GB | free | **not on free** |
| Netlify | 100 GB | free | allowed |
| GitHub Pages | 100 GB soft | free | **not on free** |

import { defineConfig } from 'astro/config';
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    obsidiary({
      // The vault is its own repository. This site holds no notes at all —
      // which is the configuration Obsidiary exists for.
      // Pinning the branch skips the "what's the default branch?" lookup, so a
      // build costs exactly one GitHub API call. The limit is 60/hour unauthenticated.
      repo: 'Chitransh-Saxena/notes@main',
      // The repo's README explains the repo, not the notes — it belongs on
      // GitHub, not as a page on the site.
      ignore: ['README.md'],
      // `lastModified: true` would add a "last set" date to every note, but it
      // costs one GitHub API call per note and so wants a token. Left off: the
      // whole point is that publishing a public vault needs no credentials.
      title: 'Chitransh · Notes',
      description: 'Public working notes — engineering, drones, guitar, photography, reading.',
    }),
  ],
});

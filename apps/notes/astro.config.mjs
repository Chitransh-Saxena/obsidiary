import { defineConfig } from 'astro/config';
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    obsidiary({
      // The vault is its own repository. This site holds no notes at all —
      // which is the configuration Obsidiary exists for.
      repo: 'Chitransh-Saxena/notes',
      // The repo's README explains the repo, not the notes — it belongs on
      // GitHub, not as a page on the site.
      ignore: ['README.md'],
      title: 'Chitransh · Notes',
      description: 'Public working notes — engineering, drones, guitar, photography, reading.',
    }),
  ],
});

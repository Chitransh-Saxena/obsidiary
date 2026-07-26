import { defineConfig } from 'astro/config';
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    obsidiary({
      vault: './vault',
      title: 'Obsidiary',
      description: 'An Obsidian vault, published.',
      live: true,
    }),
  ],
});

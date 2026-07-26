import { defineConfig } from 'astro/config';
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    obsidiary({
      // The documentation is itself an Obsidian vault, published by the tool it
      // documents. If the docs break, the product is broken.
      vault: './docs',
      base: '/docs',
      title: 'Obsidiary',
      description: 'Publish an Obsidian vault as a fast, linked, free website.',
      live: true,
    }),
  ],
});

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
      // This site *is* Obsidiary; a credit pointing at itself would be silly.
      credit: false,
      liveExamples: [
        { label: 'the demo vault', repo: 'Chitransh-Saxena/obsidiary/apps/demo/vault' },
        { label: "Chitransh's notes", repo: 'Chitransh-Saxena/notes' },
        // Someone else's vault entirely — the point of the live view.
        { label: "Quartz's own docs", repo: 'jackyzha0/quartz/docs' },
      ],
    }),
  ],
});

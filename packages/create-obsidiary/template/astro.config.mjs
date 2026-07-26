import { defineConfig } from 'astro/config';
import { obsidiary } from '@obsidiary/astro';

export default defineConfig({
  output: 'static',
  integrations: [
    obsidiary({
      // Where your notes live. Either a folder in this project…
      vault: './vault',
      // …or a public GitHub repository, instead of the line above:
      //   repo: 'owner/notes',
      //   repo: 'owner/notes@main',
      //   repo: 'owner/notes/garden',   // a subfolder

      title: '__TITLE__',
      description: '',

      // Only publish notes with `publish: true` in their frontmatter.
      // Strongly recommended if the vault repository is public.
      // explicitPublish: true,

      // Add /live, which renders any public vault a visitor names.
      // live: true,
    }),
  ],
});

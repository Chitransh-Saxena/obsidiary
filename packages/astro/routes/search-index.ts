/**
 * `/search-index.json` — injected by the integration so every site gets working
 * search without wiring up a route.
 *
 * Kept as a separate file rather than inlined into the palette because it is
 * fetched on first search, not on page load. A reader who never searches never
 * downloads it.
 */

import type { APIRoute } from 'astro';
import { index } from 'virtual:obsidiary';
import { buildSearchIndex } from 'obsidiary';

export const prerender = true;

const docs = buildSearchIndex(index);

export const GET: APIRoute = () =>
  new Response(JSON.stringify(docs), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });

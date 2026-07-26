/**
 * `/vault-index.json` — the whole parsed vault, as data.
 *
 * The core's model is JSON-native by design, so this is a `JSON.stringify` and
 * nothing more. It is what lets another site, a script, or the live renderer
 * consume a published vault without re-parsing a single markdown file.
 */

import type { APIRoute } from 'astro';
import { index } from 'virtual:obsidiary';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(index), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });

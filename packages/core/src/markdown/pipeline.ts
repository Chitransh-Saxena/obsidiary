/**
 * The renderer: a `VaultIndex` in, HTML per note out.
 *
 * Deliberately synchronous and dependency-light so the exact same code path
 * serves the static build and the in-browser live mode. Anything async or
 * Node-only (Shiki, image processing) plugs in from the outside via
 * `rehypePlugins` rather than being baked in here.
 */

import { unified, type PluggableList } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import type { Root } from 'mdast';
import type { ResolveContext } from '../resolve.js';
import type { VaultIndex } from '../types.js';
import { remarkCallout } from './remark-callout.js';
import { remarkObsidian } from './remark-obsidian.js';

export interface RenderOptions {
  /**
   * Pass raw HTML in notes straight through.
   *
   * Off by default, and it should stay off for any vault you didn't write:
   * live mode renders a stranger's markdown on *your* origin, which turns an
   * inline `<script>` into stored XSS against your visitors.
   */
  allowHtml?: boolean;
  /** How deep `![[embeds]]` may nest before degrading to a link. Default 3. */
  maxEmbedDepth?: number;
  /** URL prefix for tag links. Default `/tags`. */
  tagBase?: string;
  /** Extra plugins, e.g. Shiki at build time. */
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
}

export interface Renderer {
  /** Rendered HTML for a note, embeds expanded. */
  renderNote(path: string): string;
  /** Render an arbitrary markdown string as if it lived at `fromPath`. */
  renderMarkdown(markdown: string, fromPath: string): string;
  /** The transformed mdast for a note — useful for excerpts and search indexing. */
  astFor(path: string): Root | null;
}

export function createRenderer(index: VaultIndex, options: RenderOptions = {}): Renderer {
  const { allowHtml = false, maxEmbedDepth = 3, tagBase = '/tags' } = options;

  const ctx: ResolveContext = {
    notes: index.notes,
    assets: index.assets,
    lookups: index.lookups,
  };

  const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  const parseCache = new Map<string, Root>();

  function parseBody(markdown: string, cacheKey?: string): Root {
    if (cacheKey) {
      const hit = parseCache.get(cacheKey);
      // Transforms mutate, so hand out a copy and keep the pristine parse.
      if (hit) return structuredClone(hit);
    }
    const tree = parser.parse(markdown) as Root;
    if (cacheKey) parseCache.set(cacheKey, structuredClone(tree));
    return tree;
  }

  function transform(tree: Root, fromPath: string, stack: string[]): Root {
    const expandEmbed = (target: string): Root | null => {
      if (stack.length >= maxEmbedDepth) return null;
      if (stack.includes(target) || target === fromPath) return null;
      const note = index.notes[target];
      if (!note) return null;
      // A canvas's body is JSON. Parsing it as markdown would inline a wall of
      // braces, so `![[board.canvas]]` degrades to a link instead.
      if (note.kind === 'canvas') return null;
      return transform(parseBody(note.body, target), target, [...stack, fromPath]);
    };

    remarkObsidian({ ctx, fromPath, expandEmbed, tagBase })(tree);
    remarkCallout()(tree);
    for (const plugin of options.remarkPlugins ?? []) {
      applyPlugin(plugin, tree);
    }
    return tree;
  }

  const toHtml = unified()
    .use(remarkRehype, { allowDangerousHtml: allowHtml })
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(options.rehypePlugins ?? [])
    .use(rehypeStringify, { allowDangerousHtml: allowHtml });

  function render(tree: Root): string {
    // `runSync` walks the transformers (remark-rehype converts mdast → hast),
    // then `stringify` hands the hast to rehype-stringify.
    const hast = toHtml.runSync(tree as never);
    return toHtml.stringify(hast as never);
  }

  return {
    astFor(path) {
      const note = index.notes[path];
      if (!note) return null;
      return transform(parseBody(note.body, path), path, []);
    },
    renderNote(path) {
      const note = index.notes[path];
      if (!note || note.kind === 'canvas') return '';
      return render(transform(parseBody(note.body, path), path, []));
    },
    renderMarkdown(markdown, fromPath) {
      return render(transform(parseBody(markdown), fromPath, []));
    },
  };
}

/** Run a plugin that was supplied as a bare function or a `[fn, options]` pair. */
function applyPlugin(plugin: unknown, tree: Root): void {
  if (typeof plugin === 'function') {
    (plugin as (t: Root) => void)(tree);
    return;
  }
  if (Array.isArray(plugin) && typeof plugin[0] === 'function') {
    const [fn, opts] = plugin as [(o?: unknown) => (t: Root) => void, unknown];
    fn(opts)(tree);
  }
}

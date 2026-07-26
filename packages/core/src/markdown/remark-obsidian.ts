/**
 * The Obsidian flavour of markdown, as a remark transform: wikilinks, embeds,
 * inline tags and block anchors.
 *
 * Only `text` nodes are rewritten, which is what keeps `[[not a link]]` inside a
 * code span or fenced block inert — mdast has already separated those into
 * `inlineCode` / `code` nodes by the time we run.
 */

import { visit, SKIP } from 'unist-util-visit';
import type { Nodes, Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast';
import { extname } from '../paths.js';
import { resolveTarget, type ResolveContext } from '../resolve.js';
import { BLOCK_ANCHOR_RE, TAG_RE, WIKILINK_RE, parseEmbedSize, parseWikilinkBody } from '../syntax.js';
import type { ParsedWikilink, Resolution } from '../types.js';

export interface ObsidianOptions {
  ctx: ResolveContext;
  /** Vault path of the note being rendered — links resolve relative to it. */
  fromPath: string;
  /**
   * Supplies an already-transformed AST for a note, so transclusion inlines
   * content whose own links were resolved relative to *that* note, not this one.
   * Returns null to render the embed as a plain link instead.
   */
  expandEmbed?: (path: string) => Root | null;
  /** URL prefix for tag pages. Default `/tags`. */
  tagBase?: string;
}

const EMBED_NODE = 'obsidiaryEmbed';

interface EmbedNode {
  type: typeof EMBED_NODE;
  children: RootContent[];
  data: { hName: string; hProperties: Record<string, unknown> };
}

function textNode(value: string): Text {
  return { type: 'text', value };
}

function internalLink(label: string, resolution: Resolution, link: ParsedWikilink): PhrasingContent {
  const className = ['internal-link'];
  if (resolution.viaAlias) className.push('is-alias');

  if (resolution.kind === 'unresolved') {
    return {
      type: 'emphasis',
      children: [textNode(label)],
      data: {
        hName: 'span',
        hProperties: {
          className: ['internal-link', 'is-unresolved'],
          'data-target': link.target,
          title: `“${link.target}” has not been written yet`,
        },
      },
    } as PhrasingContent;
  }

  let url = resolution.toUrl ?? '#';
  if (link.subpath) {
    url +=
      link.subpath.kind === 'block'
        ? `#${blockAnchorId(link.subpath.segments[0] ?? '')}`
        : `#${slugAnchor(link.subpath.segments)}`;
  }

  return {
    type: 'link',
    url,
    children: [textNode(label)],
    data: {
      hProperties: {
        className,
        'data-note': resolution.toPath ?? '',
      },
    },
  } as PhrasingContent;
}

/** HTML id for a block anchor. Prefixed so it can never collide with a heading slug. */
export function blockAnchorId(id: string): string {
  return `block-${id}`;
}

/** Lowercased, hyphenated heading anchor — matches rehype-slug's output closely enough to link into. */
function slugAnchor(segments: string[]): string {
  const last = segments[segments.length - 1] ?? '';
  return last
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

/** Default label when the author didn't supply an alias. */
function defaultLabel(link: ParsedWikilink): string {
  if (link.alias) return link.alias;
  if (!link.target && link.subpath) return link.subpath.segments.join(' › ');
  if (link.subpath && link.subpath.kind === 'heading') {
    return `${link.target} › ${link.subpath.segments.join(' › ')}`;
  }
  return link.target;
}

function assetEmbed(url: string, link: ParsedWikilink, ext: string): PhrasingContent | EmbedNode {
  const size = parseEmbedSize(link.alias);
  const props: Record<string, unknown> = {};
  if (size) {
    props.width = size.width;
    if (size.height) props.height = size.height;
  }

  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp', '.ico'].includes(ext)) {
    return {
      type: 'image',
      url,
      alt: size ? '' : link.alias ?? link.target,
      data: { hProperties: { ...props, loading: 'lazy', decoding: 'async' } },
    } as PhrasingContent;
  }

  if (['.mp4', '.webm', '.mov', '.ogv'].includes(ext)) {
    return {
      type: EMBED_NODE,
      children: [],
      data: { hName: 'video', hProperties: { ...props, src: url, controls: true, preload: 'metadata' } },
    };
  }

  if (['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.3gp'].includes(ext)) {
    return {
      type: EMBED_NODE,
      children: [],
      data: { hName: 'audio', hProperties: { src: url, controls: true, preload: 'none' } },
    };
  }

  if (ext === '.pdf') {
    return {
      type: EMBED_NODE,
      children: [],
      data: {
        hName: 'iframe',
        hProperties: { src: url, className: ['obsidiary-pdf'], loading: 'lazy', title: link.target },
      },
    };
  }

  return { type: 'link', url, children: [textNode(link.alias ?? link.target)] } as PhrasingContent;
}

export function remarkObsidian(options: ObsidianOptions) {
  const { ctx, fromPath, expandEmbed, tagBase = '/tags' } = options;

  return (tree: Root): void => {
    stripBlockAnchors(tree);
    rewriteWikilinks(tree, ctx, fromPath, expandEmbed);
    rewriteTags(tree, tagBase);
    liftBlockEmbeds(tree);
  };
}

/**
 * Remove trailing `^block-id` from rendered text and hang the id on the node as
 * an anchor, so `[[note#^id]]` has somewhere to land without the marker showing.
 */
function stripBlockAnchors(tree: Root): void {
  visit(tree, (node) => {
    if (!('children' in node) || !Array.isArray(node.children)) return;
    const last = node.children[node.children.length - 1];
    if (!last || last.type !== 'text') return;

    const m = BLOCK_ANCHOR_RE.exec(last.value);
    if (!m || !m[1]) return;

    last.value = last.value.slice(0, m.index).replace(/\s+$/, '');
    const data = ((node as Nodes).data ??= {}) as Record<string, unknown>;
    const props = ((data.hProperties ??= {}) as Record<string, unknown>);
    // `^` is not legal in a URL fragment (RFC 3986), so the anchor gets a
    // prefixed, encodable id. The raw id stays on data-block-id for slicing.
    props.id = blockAnchorId(m[1]);
    props['data-block-id'] = m[1];
  });
}

function rewriteWikilinks(
  tree: Root,
  ctx: ResolveContext,
  fromPath: string,
  expandEmbed?: (path: string) => Root | null,
): void {
  visit(tree, 'text', (node: Text, index, parent) => {
    if (!parent || index === undefined || !node.value.includes('[[')) return;

    const replacements: RootContent[] = [];
    let cursor = 0;
    WIKILINK_RE.lastIndex = 0;

    for (const m of node.value.matchAll(WIKILINK_RE)) {
      const at = m.index ?? 0;
      const [raw, bang, body] = m;
      if (body === undefined) continue;

      if (at > cursor) replacements.push(textNode(node.value.slice(cursor, at)));
      cursor = at + raw.length;

      const link = parseWikilinkBody(body, bang === '!', raw);
      const resolution = resolveTarget(ctx, link.target, fromPath);

      if (link.embed) {
        replacements.push(...renderEmbed(link, resolution, expandEmbed));
      } else {
        replacements.push(internalLink(defaultLabel(link), resolution, link) as RootContent);
      }
    }

    if (replacements.length === 0) return;
    if (cursor < node.value.length) replacements.push(textNode(node.value.slice(cursor)));

    parent.children.splice(index, 1, ...(replacements as never[]));
    return [SKIP, index + replacements.length];
  });
}

function renderEmbed(
  link: ParsedWikilink,
  resolution: Resolution,
  expandEmbed?: (path: string) => Root | null,
): RootContent[] {
  if (resolution.kind === 'unresolved') {
    return [internalLink(defaultLabel(link), resolution, link) as RootContent];
  }

  if (resolution.kind === 'asset' && resolution.toUrl) {
    return [assetEmbed(resolution.toUrl, link, extname(resolution.toPath ?? '')) as RootContent];
  }

  if (resolution.kind === 'note' && resolution.toPath && expandEmbed) {
    const embedded = expandEmbed(resolution.toPath);
    if (embedded) {
      const children = link.subpath ? sliceSubpath(embedded, link) : embedded.children;
      const node: EmbedNode = {
        type: EMBED_NODE,
        children: structuredCloneish(children),
        data: {
          hName: 'div',
          hProperties: {
            className: ['obsidiary-embed'],
            'data-embed': resolution.toPath,
          },
        },
      };
      return [node as unknown as RootContent];
    }
  }

  // Cycle, depth limit, or an embed we can't expand — degrade to a link.
  return [internalLink(defaultLabel(link), resolution, link) as RootContent];
}

/** Extract the `#heading` or `#^block` slice of an embedded note. */
function sliceSubpath(root: Root, link: ParsedWikilink): RootContent[] {
  const sub = link.subpath;
  if (!sub) return root.children;

  if (sub.kind === 'block') {
    const id = sub.segments[0];
    if (!id) return root.children;
    const hit = root.children.find((child) => {
      const props = (child.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties;
      return props?.['data-block-id'] === id;
    });
    return hit ? [hit] : [];
  }

  // Walk the heading path, narrowing the candidate range at each segment.
  let scope = root.children;
  for (const segment of sub.segments) {
    const want = segment.toLowerCase();
    const start = scope.findIndex(
      (child) => child.type === 'heading' && headingText(child).toLowerCase() === want,
    );
    if (start === -1) return [];

    const heading = scope[start];
    const depth = heading && heading.type === 'heading' ? heading.depth : 6;
    let end = scope.length;
    for (let i = start + 1; i < scope.length; i++) {
      const child = scope[i];
      if (child && child.type === 'heading' && child.depth <= depth) {
        end = i;
        break;
      }
    }
    scope = scope.slice(start, end);
  }
  return scope;
}

function headingText(node: RootContent): string {
  if (!('children' in node) || !Array.isArray(node.children)) return '';
  return node.children
    .map((c) => ('value' in c && typeof c.value === 'string' ? c.value : 'children' in c ? headingText(c as RootContent) : ''))
    .join('')
    .trim();
}

/** Cheap deep clone that survives the plain-object ASTs remark produces. */
function structuredCloneish<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rewriteTags(tree: Root, tagBase: string): void {
  const base = tagBase.replace(/\/+$/, '');

  visit(tree, 'text', (node: Text, index, parent) => {
    if (!parent || index === undefined || !node.value.includes('#')) return;
    // Don't turn `#tag` inside a link's own label into a nested link.
    if (parent.type === 'link' || parent.type === 'linkReference') return;

    const replacements: RootContent[] = [];
    let cursor = 0;
    TAG_RE.lastIndex = 0;

    for (const m of node.value.matchAll(TAG_RE)) {
      const tag = m[2];
      if (!tag) continue;
      const lead = m[1] ?? '';
      const at = (m.index ?? 0) + lead.length;

      if (at > cursor) replacements.push(textNode(node.value.slice(cursor, at)));
      cursor = at + tag.length + 1;

      replacements.push({
        type: 'link',
        url: `${base}/${tag.toLowerCase()}`,
        children: [textNode(`#${tag}`)],
        data: { hProperties: { className: ['tag'], 'data-tag': tag } },
      } as RootContent);
    }

    if (replacements.length === 0) return;
    if (cursor < node.value.length) replacements.push(textNode(node.value.slice(cursor)));

    parent.children.splice(index, 1, ...(replacements as never[]));
    return [SKIP, index + replacements.length];
  });
}

/**
 * `![[Note]]` alone on a line parses as a paragraph wrapping a block element.
 * Left as-is that emits `<p><div>…</div></p>`, which browsers silently tear
 * apart. Lift the embed out of its paragraph instead.
 */
function liftBlockEmbeds(tree: Root): void {
  visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
    if (!parent || index === undefined) return;
    const meaningful = node.children.filter(
      (c) => !(c.type === 'text' && c.value.trim() === ''),
    );
    if (meaningful.length !== 1) return;

    const only = meaningful[0] as { type?: string } | undefined;
    if (!only || only.type !== EMBED_NODE) return;

    parent.children.splice(index, 1, only as never);
    return [SKIP, index + 1];
  });
}

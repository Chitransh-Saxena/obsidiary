/**
 * Obsidian callouts: `> [!note] Title`, `> [!warning]- Collapsed`.
 *
 * Foldable callouts become `<details>/<summary>`, so folding works with no
 * JavaScript at all — including in the live-mode renderer and in RSS readers.
 */

import { visit } from 'unist-util-visit';
import type { Blockquote, Paragraph, Root, RootContent } from 'mdast';

/** Aliases Obsidian accepts, mapped to the canonical type used for styling. */
const ALIASES: Record<string, string> = {
  note: 'note',
  abstract: 'abstract', summary: 'abstract', tldr: 'abstract',
  info: 'info',
  todo: 'todo',
  tip: 'tip', hint: 'tip', important: 'tip',
  success: 'success', check: 'success', done: 'success',
  question: 'question', help: 'question', faq: 'question',
  warning: 'warning', caution: 'warning', attention: 'warning',
  failure: 'failure', fail: 'failure', missing: 'failure',
  danger: 'danger', error: 'danger',
  bug: 'bug',
  example: 'example',
  quote: 'quote', cite: 'quote',
};

const MARKER = /^\[!([A-Za-z-]+)\]([+-]?)[ \t]*(.*)$/;

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function remarkCallout() {
  return (tree: Root): void => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0];
      if (!first || first.type !== 'paragraph') return;

      const firstChild = first.children[0];
      if (!firstChild || firstChild.type !== 'text') return;

      const newlineAt = firstChild.value.indexOf('\n');
      const firstLine = newlineAt === -1 ? firstChild.value : firstChild.value.slice(0, newlineAt);
      const m = MARKER.exec(firstLine);
      if (!m || !m[1]) return;

      const rawType = m[1].toLowerCase();
      const type = ALIASES[rawType] ?? rawType;
      const fold = m[2] ?? '';
      const inlineTitle = (m[3] ?? '').trim();

      // Drop the marker line from the body.
      firstChild.value = newlineAt === -1 ? '' : firstChild.value.slice(newlineAt + 1);

      // A title may carry inline markup, so keep it as nodes rather than a string.
      const titleChildren: RootContent[] = inlineTitle
        ? [{ type: 'text', value: inlineTitle }]
        : [{ type: 'text', value: titleCase(type) }];

      const bodyChildren: RootContent[] = [...node.children];
      if (firstChild.value.trim() === '' && first.children.length === 1) {
        bodyChildren.shift();
      }

      const foldable = fold === '+' || fold === '-';
      const titleNode: Paragraph = {
        type: 'paragraph',
        children: titleChildren as Paragraph['children'],
        data: {
          hName: foldable ? 'summary' : 'div',
          hProperties: { className: ['callout-title'] },
        },
      };

      const contentNode = {
        type: 'blockquote',
        children: bodyChildren,
        data: { hName: 'div', hProperties: { className: ['callout-content'] } },
      } as Blockquote;

      node.children = [titleNode, contentNode] as Blockquote['children'];
      node.data = {
        hName: foldable ? 'details' : 'div',
        hProperties: {
          className: ['callout', `callout-${type}`],
          'data-callout': type,
          ...(foldable ? { open: fold === '+' } : {}),
        },
      };
    });
  };
}

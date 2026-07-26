/**
 * YAML frontmatter extraction and normalisation.
 */

import { parse as parseYaml } from 'yaml';
import type { NoteFrontmatter } from './types.js';

export interface FrontmatterResult {
  data: NoteFrontmatter;
  /** Markdown with the frontmatter block removed. */
  body: string;
  /** 1-based line in the original file where `body` starts, so heading and block line numbers stay truthful. */
  bodyStartLine: number;
}

const FENCE = /^---[ \t]*\r?\n/;

export function splitFrontmatter(raw: string): FrontmatterResult {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  if (!FENCE.test(text)) {
    return { data: {}, body: text, bodyStartLine: 1 };
  }

  const lines = text.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---[ \t]*$/.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  // An unterminated fence is just a document that happens to start with `---`.
  if (end === -1) return { data: {}, body: text, bodyStartLine: 1 };

  const yamlText = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');

  let data: NoteFrontmatter = {};
  try {
    const parsed = parseYaml(yamlText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as NoteFrontmatter;
    }
  } catch {
    // Malformed YAML shouldn't take down the whole build — treat it as absent.
    data = {};
  }

  return { data, body, bodyStartLine: end + 2 };
}

/**
 * Obsidian accepts `aliases: one`, `aliases: [one, two]` and a YAML list
 * interchangeably. Same for `tags`. Normalise all of it to `string[]`.
 */
export function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  return [];
}

export function normalizeAliases(fm: NoteFrontmatter): string[] {
  // `alias` (singular) is common enough in the wild to be worth accepting.
  return [...toStringArray(fm['aliases']), ...toStringArray(fm['alias'])];
}

export function normalizeFrontmatterTags(fm: NoteFrontmatter): string[] {
  return [...toStringArray(fm['tags']), ...toStringArray(fm['tag'])].map((t) =>
    t.replace(/^#/, ''),
  );
}

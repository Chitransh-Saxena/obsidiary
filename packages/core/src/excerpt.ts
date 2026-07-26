/**
 * Markdown → readable plain text, for search bodies, backlink context and
 * hover-preview summaries.
 *
 * This is lossy on purpose. It is never rendered as content; it exists so a
 * human can recognise a note from a fragment of it.
 */

const FENCED = /^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]{0,3}\1[^\n]*$|$)/gm;

export function toPlainText(markdown: string): string {
  let t = markdown;

  t = t.replace(FENCED, ' ');
  // Keep inline-code *contents* — `useState` is exactly the kind of thing
  // someone searches for — but drop the backticks.
  t = t.replace(/(`+)((?:(?!\1)[\s\S])*?)\1/g, '$2');

  // Embeds and wikilinks collapse to their visible label.
  t = t.replace(/!?\[\[([^\]\n]+)\]\]/g, (_m, body: string) => {
    const pipe = body.indexOf('|');
    const label = pipe === -1 ? body : body.slice(pipe + 1);
    const hash = label.indexOf('#');
    return (hash === -1 ? label : label.slice(0, hash)).trim() || body.trim();
  });

  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/<[^>\n]+>/g, ' ');

  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '');
  t = t.replace(/^[ \t]*>[ \t]?/gm, '');
  t = t.replace(/\[!\w+\][+-]?/g, '');
  t = t.replace(/^[ \t]*[-*+][ \t]+/gm, '');
  t = t.replace(/^[ \t]*\d+\.[ \t]+/gm, '');
  t = t.replace(/^\[[ xX]\][ \t]*/gm, '');
  t = t.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, '');

  t = t.replace(/[*_~]{1,3}/g, '');
  t = t.replace(/\|/g, ' ');
  t = t.replace(/\s*\^[A-Za-z0-9][A-Za-z0-9-]*\s*$/gm, '');

  return t;
}

/** Plain text, whitespace collapsed to single spaces. */
export function toSearchText(markdown: string): string {
  return toPlainText(markdown).replace(/\s+/g, ' ').trim();
}

/**
 * A window of prose around a character offset in the raw markdown.
 * Used to show *why* a backlink exists rather than just that it does.
 */
export function excerptAround(markdown: string, offset: number, radius = 120): string {
  const start = Math.max(0, offset - radius);
  const end = Math.min(markdown.length, offset + radius);
  let text = toSearchText(markdown.slice(start, end));
  if (!text) return '';

  // Snap off the half-words the raw slice leaves at each edge. "…d get if you
  // opened" reads like a bug; "…if you opened" reads like an excerpt.
  const EDGE = 30;
  if (start > 0) {
    const firstSpace = text.indexOf(' ');
    if (firstSpace > 0 && firstSpace < EDGE) text = text.slice(firstSpace + 1);
  }
  if (end < markdown.length) {
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > 0 && lastSpace > text.length - EDGE) text = text.slice(0, lastSpace);
  }

  return `${start > 0 ? '…' : ''}${text}${end < markdown.length ? '…' : ''}`;
}

/** First meaningful prose from a note, for previews and cards. */
export function summarize(markdown: string, maxChars = 200): string {
  const text = toSearchText(markdown);
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : maxChars).trimEnd()}…`;
}

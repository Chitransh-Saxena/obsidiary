#!/usr/bin/env node
/**
 * Crawl a deployed Obsidiary site and fail on anything a reader would actually
 * hit: dead internal links, broken images, and wikilinks that never resolved.
 *
 *   node scripts/e2e.mjs https://notes.pulsar-projects.org
 *   node scripts/e2e.mjs http://localhost:4321 --external
 *
 * A vault is a graph, and the failure mode of a graph is a link that points at
 * nothing. Unit tests cannot see that — the resolver is correct in isolation and
 * the page still ends up with a dead link, because the *content* moved. So this
 * walks the built site the way a reader would and reports what breaks.
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 */

const CONCURRENCY = 12;
const TIMEOUT_MS = 20_000;

const argv = process.argv.slice(2);
const roots = argv.filter((a) => !a.startsWith('-'));
const checkExternal = argv.includes('--external');

if (roots.length === 0) {
  console.error('usage: node scripts/e2e.mjs <base-url> [base-url...] [--external]');
  process.exit(2);
}

const origins = new Set(roots.map((r) => new URL(r).origin));
const seen = new Map(); // url -> 'queued' | status
const failures = [];
const unresolved = [];
let pagesCrawled = 0;
let linksChecked = 0;

/** Strip the fragment; it never changes what the server returns. */
function normalise(url) {
  const u = new URL(url);
  u.hash = '';
  return u.href;
}

function skippable(href) {
  return (
    !href ||
    href.startsWith('#') ||
    /^(mailto|javascript|data|tel):/i.test(href)
  );
}

async function get(url, method = 'GET') {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(url, { method, redirect: 'follow', signal });
}

const HREF = /<a\b[^>]*?\shref=["']([^"']+)["']/gi;
const IMG = /<img\b[^>]*?\ssrc=["']([^"']+)["']/gi;
// `<span class="internal-link is-unresolved" data-target="...">` — a wikilink
// whose target does not exist. Rendered, but dead.
const UNRESOLVED = /class=["'][^"']*\bis-unresolved\b[^"']*["'][^>]*?\sdata-target=["']([^"']*)["']/gi;

function matchAll(re, text) {
  re.lastIndex = 0;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

const queue = roots.map((url) => ({ url: normalise(url), from: '(root)' }));
for (const item of queue) seen.set(item.url, 'queued');

async function visit({ url, from }) {
  const internal = origins.has(new URL(url).origin);
  if (!internal && !checkExternal) {
    seen.set(url, 'skipped');
    return;
  }

  let res;
  try {
    // HEAD first for anything we are not going to read — cheaper, and most
    // static hosts answer it. Some CDNs do not, hence the GET fallback.
    res = internal ? await get(url) : await get(url, 'HEAD');
    if (!internal && (res.status === 405 || res.status === 501)) res = await get(url);
  } catch (err) {
    seen.set(url, 'error');
    failures.push({ url, from, why: `request failed — ${err.message}` });
    return;
  }

  seen.set(url, res.status);
  if (!res.ok) {
    failures.push({ url, from, why: `HTTP ${res.status}` });
    return;
  }

  if (!internal) return;
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return;

  const html = await res.text();
  pagesCrawled++;

  for (const target of matchAll(UNRESOLVED, html)) {
    unresolved.push({ page: url, target });
  }

  const found = [
    ...matchAll(HREF, html).map((h) => ({ href: h, kind: 'link' })),
    ...matchAll(IMG, html).map((h) => ({ href: h, kind: 'image' })),
  ];

  for (const { href, kind } of found) {
    if (skippable(href)) continue;
    let next;
    try {
      next = normalise(new URL(href, url).href);
    } catch {
      failures.push({ url: href, from: url, why: 'unparseable URL' });
      continue;
    }
    linksChecked++;
    // Images are always checked, even off-origin — a broken attachment is the
    // most common real breakage and it is nearly always on GitHub's CDN.
    const off = !origins.has(new URL(next).origin);
    if (off && kind !== 'image' && !checkExternal) continue;
    if (seen.has(next)) continue;
    seen.set(next, 'queued');
    queue.push({ url: next, from: url, forceCheck: kind === 'image' });
  }
}

// A fixed pool pulling from a queue that grows while they work.
let cursor = 0;
let active = 0;

async function worker() {
  for (;;) {
    if (cursor >= queue.length) {
      if (active === 0) return; // nothing in flight can enqueue more
      await new Promise((r) => setTimeout(r, 25));
      continue;
    }
    const item = queue[cursor++];
    active++;
    try {
      // An off-origin image still has to be checked even without --external.
      const wasExternal = !origins.has(new URL(item.url).origin);
      if (wasExternal && item.forceCheck && !checkExternal) {
        try {
          let r = await get(item.url, 'HEAD');
          if (r.status === 405 || r.status === 501) r = await get(item.url);
          seen.set(item.url, r.status);
          if (!r.ok) failures.push({ url: item.url, from: item.from, why: `image HTTP ${r.status}` });
        } catch (err) {
          failures.push({ url: item.url, from: item.from, why: `image failed — ${err.message}` });
        }
      } else {
        await visit(item);
      }
    } finally {
      active--;
    }
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const secs = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\ncrawled ${pagesCrawled} pages · ${linksChecked} links · ${secs}s`);

if (unresolved.length) {
  console.log(`\n${unresolved.length} unresolved wikilink(s):`);
  for (const u of unresolved.slice(0, 40)) {
    console.log(`  [[${u.target}]]  on ${u.page}`);
  }
  if (unresolved.length > 40) console.log(`  … and ${unresolved.length - 40} more`);
}

if (failures.length) {
  console.log(`\n${failures.length} broken link(s):`);
  for (const f of failures.slice(0, 40)) {
    console.log(`  ${f.why}  ${f.url}\n    linked from ${f.from}`);
  }
  if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
}

if (!failures.length && !unresolved.length) {
  console.log('no broken links, no unresolved wikilinks, no missing images.\n');
  process.exit(0);
}
process.exit(1);

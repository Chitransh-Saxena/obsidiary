/**
 * Adoption counters for the Obsidiary landing page.
 *
 * Public data only — npm's download API and GitHub's repo API. There is no
 * telemetry in Obsidiary and there never will be: an open-source tool that
 * phones home is one people stop trusting, and these numbers say enough.
 *
 * Upstream responses are cached at Cloudflare's edge for an hour via `cf.cacheTtl`,
 * so a busy day costs the same number of API calls as a quiet one.
 */

interface Env {
  GITHUB_REPO?: string;
  NPM_PACKAGES?: string;
}

const DEFAULT_REPO = 'Chitransh-Saxena/obsidiary';
const DEFAULT_PACKAGES = 'obsidiary,@obsidiary/astro,create-obsidiary';

const CACHE_SECONDS = 3600;

interface Counters {
  stars: number | null;
  forks: number | null;
  downloadsWeek: number | null;
  downloadsMonth: number | null;
  repo: string;
  updated: string;
}

async function cachedJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        // GitHub rejects requests without one.
        'user-agent': 'obsidiary-adoption-counter',
      },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function downloads(packages: string[], period: string): Promise<number | null> {
  const results = await Promise.all(
    packages.map((name) =>
      cachedJson<{ downloads?: number }>(
        `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(name)}`,
      ),
    ),
  );
  const found = results.filter((r): r is { downloads?: number } => r !== null);
  // Nothing published yet is different from zero downloads; report null so the
  // page can stay quiet rather than boasting about a zero.
  if (found.length === 0) return null;
  return found.reduce((sum, r) => sum + (r.downloads ?? 0), 0);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
        },
      });
    }

    const repo = env.GITHUB_REPO ?? DEFAULT_REPO;
    const packages = (env.NPM_PACKAGES ?? DEFAULT_PACKAGES).split(',').map((s) => s.trim()).filter(Boolean);

    const [meta, week, month] = await Promise.all([
      cachedJson<{ stargazers_count?: number; forks_count?: number }>(
        `https://api.github.com/repos/${repo}`,
      ),
      downloads(packages, 'last-week'),
      downloads(packages, 'last-month'),
    ]);

    const body: Counters = {
      stars: meta?.stargazers_count ?? null,
      forks: meta?.forks_count ?? null,
      downloadsWeek: week,
      downloadsMonth: month,
      repo,
      updated: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': `public, max-age=600, s-maxage=${CACHE_SECONDS}`,
      },
    });
  },
};

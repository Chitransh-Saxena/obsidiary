import { describe, expect, it } from 'vitest';
import { fetchVaultFiles, parseRepoRef } from '../src/remote.js';
import { buildVault } from '../src/vault.js';

describe('parsing a repo reference', () => {
  it('reads owner/repo', () => {
    expect(parseRepoRef('chitransh/notes')).toEqual({ owner: 'chitransh', repo: 'notes' });
  });

  it('reads a github url', () => {
    expect(parseRepoRef('https://github.com/chitransh/notes')).toEqual({
      owner: 'chitransh',
      repo: 'notes',
    });
    expect(parseRepoRef('https://www.github.com/chitransh/notes.git')).toMatchObject({
      repo: 'notes',
    });
  });

  it('reads a branch after @', () => {
    expect(parseRepoRef('chitransh/notes@dev')).toEqual({
      owner: 'chitransh',
      repo: 'notes',
      ref: 'dev',
    });
  });

  it('reads the /tree/branch/subdir form the github ui produces', () => {
    expect(parseRepoRef('https://github.com/chitransh/notes/tree/main/garden/public')).toEqual({
      owner: 'chitransh',
      repo: 'notes',
      ref: 'main',
      subdir: 'garden/public',
    });
  });

  it('reads a bare subdirectory', () => {
    expect(parseRepoRef('chitransh/notes/garden')).toEqual({
      owner: 'chitransh',
      repo: 'notes',
      subdir: 'garden',
    });
  });

  it('rejects nonsense', () => {
    expect(parseRepoRef('')).toBeNull();
    expect(parseRepoRef('chitransh')).toBeNull();
    expect(parseRepoRef('   ')).toBeNull();
  });
});

/** A fake GitHub: a tree listing plus raw file bodies. */
function fakeGitHub(tree: Array<{ path: string; type?: string }>, bodies: Record<string, string>, opts: { truncated?: boolean } = {}) {
  const calls: string[] = [];
  const impl = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);

    if (url.includes('/git/trees/')) {
      return new Response(
        JSON.stringify({ tree: tree.map((t) => ({ type: 'blob', ...t })), truncated: opts.truncated ?? false }),
        { status: 200 },
      );
    }
    if (url.startsWith('https://api.github.com/repos/')) {
      return new Response(JSON.stringify({ default_branch: 'trunk' }), { status: 200 });
    }
    const path = decodeURIComponent(url.split('/').slice(6).join('/'));
    const body = bodies[path];
    return body === undefined
      ? new Response('nope', { status: 404 })
      : new Response(body, { status: 200 });
  }) as unknown as typeof fetch;

  return { impl, calls };
}

describe('fetching a remote vault', () => {
  const tree = [
    { path: 'index.md' },
    { path: 'dev/Astro.md' },
    { path: 'boards/Map.canvas' },
    { path: 'assets/photo.png' },
    { path: 'README.md' },
    { path: 'package.json' },
    { path: 'src/code.ts' },
  ];
  const bodies = {
    'index.md': '# Home\n[[dev/Astro]]',
    'dev/Astro.md': '# Astro',
    'boards/Map.canvas': '{"nodes":[],"edges":[]}',
    'README.md': '# Readme',
  };

  it('resolves the default branch when none is given', async () => {
    const gh = fakeGitHub(tree, bodies);
    const out = await fetchVaultFiles({ owner: 'o', repo: 'r' }, { fetchImpl: gh.impl });
    expect(out.resolvedRef).toBe('trunk');
  });

  it('skips the repo lookup when a ref is given', async () => {
    const gh = fakeGitHub(tree, bodies);
    await fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: gh.impl });
    expect(gh.calls.some((c) => c === 'https://api.github.com/repos/o/r')).toBe(false);
  });

  it('downloads notes and canvases but not attachments or source code', async () => {
    const gh = fakeGitHub(tree, bodies);
    const out = await fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: gh.impl });

    const withContent = out.files.filter((f) => f.content !== undefined).map((f) => f.path);
    expect(withContent.sort()).toEqual(['README.md', 'boards/Map.canvas', 'dev/Astro.md', 'index.md']);

    // The attachment is known about, but never downloaded.
    expect(out.files.find((f) => f.path === 'assets/photo.png')?.content).toBeUndefined();
    expect(out.files.some((f) => f.path === 'package.json')).toBe(false);
    expect(out.files.some((f) => f.path === 'src/code.ts')).toBe(false);
  });

  it('produces files that build into a working vault', async () => {
    const gh = fakeGitHub(tree, bodies);
    const out = await fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: gh.impl });
    const index = buildVault(out.files, {
      assetBase: out.rawBase,
      preserveAssetPaths: true,
    });

    expect(index.notes['index.md']?.links[0]?.toPath).toBe('dev/Astro.md');
    expect(index.notes['boards/Map.canvas']?.kind).toBe('canvas');
    expect(index.assets['assets/photo.png']?.url).toBe(
      'https://raw.githubusercontent.com/o/r/main/assets/photo.png',
    );
  });

  it('treats a subdirectory as the vault root', async () => {
    const gh = fakeGitHub(tree, bodies);
    const out = await fetchVaultFiles(
      { owner: 'o', repo: 'r', ref: 'main', subdir: 'dev' },
      { fetchImpl: gh.impl },
    );
    expect(out.files.map((f) => f.path)).toEqual(['Astro.md']);
  });

  it('reports progress', async () => {
    const gh = fakeGitHub(tree, bodies);
    const seen: number[] = [];
    await fetchVaultFiles(
      { owner: 'o', repo: 'r', ref: 'main' },
      { fetchImpl: gh.impl, onProgress: (done) => seen.push(done) },
    );
    expect(seen.at(-1)).toBe(4);
  });

  it('caps the file count and says so', async () => {
    const gh = fakeGitHub(tree, bodies);
    const out = await fetchVaultFiles(
      { owner: 'o', repo: 'r', ref: 'main' },
      { fetchImpl: gh.impl, maxFiles: 2 },
    );
    expect(out.truncated).toBe(true);
    expect(out.files.filter((f) => f.content !== undefined)).toHaveLength(2);
  });

  it('passes through a truncated tree from github', async () => {
    const gh = fakeGitHub(tree, bodies, { truncated: true });
    const out = await fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: gh.impl });
    expect(out.truncated).toBe(true);
  });

  it('survives a file that will not download', async () => {
    const gh = fakeGitHub([...tree, { path: 'broken.md' }], bodies);
    const out = await fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: gh.impl });
    expect(out.files.find((f) => f.path === 'broken.md')?.content).toBe('');
  });

  it('explains a rate limit rather than reporting a bare 403', async () => {
    const impl = (async () =>
      new Response('{}', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0' },
      })) as unknown as typeof fetch;

    await expect(
      fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: impl }),
    ).rejects.toThrow(/rate limit/i);
  });

  it('explains a missing repository', async () => {
    const impl = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    await expect(
      fetchVaultFiles({ owner: 'o', repo: 'r', ref: 'main' }, { fetchImpl: impl }),
    ).rejects.toThrow(/public/i);
  });
});

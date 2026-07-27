/**
 * The Astro integration.
 *
 * One config entry — a local `vault` directory *or* a `repo` — and the whole
 * index is available to every page through `virtual:obsidiary`. Nothing about a
 * user's site needs to know how Obsidiary parses anything, which is what makes
 * `npm update` a real upgrade path rather than a merge conflict.
 */

import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  buildVault,
  fetchLastModified,
  fetchVaultFiles,
  parseRepoRef,
  type VaultIndex,
  type VaultOptions,
  type VaultSource,
} from 'obsidiary';
import { loadVaultFromDir, syncAssets, type LoadedVault } from './load.js';

export * from './load.js';

export interface ObsidiaryOptions extends VaultOptions {
  /** Path to a vault directory, relative to the Astro project root. */
  vault?: string;
  /**
   * A public GitHub repository to publish instead of a local folder.
   * Accepts `owner/repo`, `owner/repo@branch`, a subdirectory, or a full URL.
   */
  repo?: string;
  /**
   * Optional token for the repo listing. Only lifts the API rate limit from
   * 60/hour to 5000/hour — a public vault never needs one locally, but CI does.
   * Defaults to `process.env.GITHUB_TOKEN`.
   */
  token?: string;
  /** Shown in the header and `<title>`. */
  title?: string;
  /** One-line description for the site header and metadata. */
  description?: string;
  /**
   * Add `/live`, a page that renders *any* public vault the visitor names.
   * Off by default: it is a demo surface, not something most sites want.
   */
  live?: boolean;
  /**
   * Vaults offered as one-click examples on `/live`. Left empty the page just
   * shows its input — a hardcoded example that points at a repository the user
   * doesn't own is worse than none.
   */
  liveExamples?: Array<{ label: string; repo: string }>;
  /**
   * Show a "last updated" date and links back to the source file.
   *
   * Free for a local vault (filesystem mtime). For a remote vault it costs one
   * GitHub API call per note — fine with a token, and it degrades to no dates
   * rather than failing if the rate limit is hit.
   */
  lastModified?: boolean;
  /**
   * Where the vault lives, for source links. Derived automatically in `repo`
   * mode; supply it for a local vault that is committed somewhere.
   */
  source?: { repo: string; ref?: string; path?: string };
}

const VIRTUAL_ID = 'virtual:obsidiary';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export function obsidiary(options: ObsidiaryOptions): AstroIntegration {
  const {
    vault,
    repo,
    token,
    title,
    description,
    live = false,
    liveExamples = [],
    lastModified = false,
    source: sourceOption,
    ...vaultOptions
  } = options;

  if (!vault && !repo) {
    throw new Error('[obsidiary] Set either `vault` (a local folder) or `repo` (a GitHub repository).');
  }

  let index: VaultIndex | null = null;
  let local: LoadedVault | null = null;
  let vaultRoot = '';
  let publicDir = '';

  let source: VaultSource | null = null;
  const site: {
    title: string;
    description: string;
    liveExamples: typeof liveExamples;
    source: VaultSource | null;
  } = {
    title: title ?? 'Notes',
    description: description ?? '',
    liveExamples,
    source: null,
  };

  const makeSource = (repo: string, ref: string, path?: string): VaultSource => {
    const home = `https://github.com/${repo}`;
    const prefix = path ? `${path.replace(/^\.?\/+|\/+$/g, '')}/` : '';
    const result: VaultSource = {
      repo,
      ref,
      homeUrl: home,
      blobBase: `${home}/blob/${ref}/${prefix}`,
      editBase: `${home}/edit/${ref}/${prefix}`,
    };
    if (prefix) result.subdir = prefix.replace(/\/$/, '');
    return result;
  };

  return {
    name: '@obsidiary/astro',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, addWatchFile, injectRoute, logger }) => {
        publicDir = fileURLToPath(config.publicDir);

        if (repo) {
          const ref = parseRepoRef(repo);
          if (!ref) throw new Error(`[obsidiary] Could not read repository "${repo}".`);

          logger.info(`fetching ${ref.owner}/${ref.repo}${ref.ref ? `@${ref.ref}` : ''}…`);
          const remote = await fetchVaultFiles(ref, {
            token: token ?? process.env.GITHUB_TOKEN,
          });
          index = buildVault(remote.files, {
            ...vaultOptions,
            // Attachments stay on GitHub's CDN rather than being copied into the
            // build, so a vault full of images doesn't bloat the deploy.
            assetBase: remote.rawBase,
            preserveAssetPaths: true,
          });
          if (remote.truncated) {
            logger.warn('the repository listing was truncated — some notes were not loaded.');
          }

          source = makeSource(`${ref.owner}/${ref.repo}`, remote.resolvedRef, ref.subdir);

          if (lastModified) {
            const paths = Object.keys(index.notes);
            const dates = await fetchLastModified(ref, paths, remote.resolvedRef, {
              token: token ?? process.env.GITHUB_TOKEN,
            });
            for (const [path, ms] of Object.entries(dates)) {
              const note = index.notes[path];
              if (note) note.mtime = ms;
            }
            const found = Object.keys(dates).length;
            if (found < paths.length) {
              logger.warn(
                `last-modified dates for ${found}/${paths.length} notes — ` +
                  'the GitHub API rate limit was likely reached. Set GITHUB_TOKEN to raise it.',
              );
            }
          }
        } else {
          vaultRoot = fileURLToPath(new URL(vault!, config.root));
          local = loadVaultFromDir(vaultRoot, vaultOptions);
          index = local.index;
          const copied = syncAssets(local, publicDir, vaultOptions.assetBase ?? '/_assets');
          if (copied) logger.info(`${copied} attachments copied`);
          for (const rel of local.files) addWatchFile(new URL(rel, `file://${vaultRoot}/`));
        }

        if (sourceOption) {
          source = makeSource(sourceOption.repo, sourceOption.ref ?? 'main', sourceOption.path);
        }
        site.source = source;

        const noteCount = Object.keys(index.notes).length;
        const unresolved = Object.keys(index.graph.unresolved).length;
        logger.info(
          `${noteCount} notes, ${Object.keys(index.assets).length} attachments` +
            (unresolved ? `, ${unresolved} unresolved links` : ''),
        );

        // Search, the vault graph and the machine-readable index all work out of
        // the box; no route wiring in the user's project.
        injectRoute({ pattern: '/search-index.json', entrypoint: '@obsidiary/astro/routes/search-index.ts' });
        injectRoute({ pattern: '/vault-index.json', entrypoint: '@obsidiary/astro/routes/vault-index.ts' });
        injectRoute({ pattern: '/graph', entrypoint: '@obsidiary/astro/routes/graph.astro' });
        // The renderer links every `#tag` at /tags/<tag>; without these routes
        // every tagged note ships dead links.
        injectRoute({ pattern: '/tags', entrypoint: '@obsidiary/astro/routes/tags.astro' });
        injectRoute({ pattern: '/tags/[...tag]', entrypoint: '@obsidiary/astro/routes/tag.astro' });
        if (live) {
          injectRoute({ pattern: '/live', entrypoint: '@obsidiary/astro/routes/live.astro' });
        }

        updateConfig({
          vite: {
            plugins: [
              {
                name: 'obsidiary:virtual',
                resolveId(id: string) {
                  return id === VIRTUAL_ID ? RESOLVED_ID : null;
                },
                load(id: string) {
                  if (id !== RESOLVED_ID) return null;
                  return [
                    `export const index = ${JSON.stringify(index ?? {})};`,
                    `export const site = ${JSON.stringify(site)};`,
                    `export default index;`,
                  ].join('\n');
                },
                handleHotUpdate(hot: {
                  file: string;
                  server: {
                    moduleGraph: { getModuleById(id: string): unknown };
                    reloadModule(mod: never): void;
                    ws: { send(payload: unknown): void };
                  };
                }) {
                  if (!vaultRoot || !hot.file.startsWith(vaultRoot)) return;
                  // Re-read the whole vault: a single edit can change link
                  // resolution and backlinks anywhere, so partial updates lie.
                  local = loadVaultFromDir(vaultRoot, vaultOptions);
                  index = local.index;
                  syncAssets(local, publicDir, vaultOptions.assetBase ?? '/_assets');
                  const mod = hot.server.moduleGraph.getModuleById(RESOLVED_ID);
                  if (mod) hot.server.reloadModule(mod as never);
                  hot.server.ws.send({ type: 'full-reload' });
                  return [];
                },
              },
            ],
          },
        });
      },
    },
  };
}

export default obsidiary;

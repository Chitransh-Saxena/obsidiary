/**
 * Core data model.
 *
 * Everything here is JSON-native on purpose: plain objects and records, no Maps,
 * no class instances, no functions. A `VaultIndex` can be `JSON.stringify`'d
 * straight into `vault-index.json` and re-hydrated in the browser for live mode
 * without a serialisation layer in between.
 */

/** A raw file handed to the vault builder. */
export interface VaultFile {
  /** POSIX path relative to the vault root, e.g. `dev/Zettelkasten.md`. */
  path: string;
  /** Text content. Omitted for binary attachments — we only need their paths. */
  content?: string;
}

export type SubpathKind = 'heading' | 'block';

/** The `#heading` / `#^block-id` portion of a link. */
export interface Subpath {
  kind: SubpathKind;
  /** Heading path segments (Obsidian allows `#A#B`), or a single block id. */
  segments: string[];
  /** Raw text as written, after the leading `#`. */
  raw: string;
}

/** A wikilink as written, before it has been resolved against the vault. */
export interface ParsedWikilink {
  /** Link target with subpath and alias stripped. Empty string for `[[#heading]]`. */
  target: string;
  subpath?: Subpath;
  /** Text after `|`. For image embeds this carries dimensions instead. */
  alias?: string;
  /** True for `![[...]]`. */
  embed: boolean;
  /** The full source text including brackets. */
  raw: string;
  /** Character offset of the link within the note body, for backlink context. */
  offset?: number;
}

export interface Heading {
  depth: number;
  text: string;
  /** GitHub-style slug, unique within the note. */
  slug: string;
  line: number;
}

/** An Obsidian block anchor — a trailing `^block-id` on a paragraph or list item. */
export interface BlockAnchor {
  id: string;
  line: number;
}

export interface NoteFrontmatter {
  title?: string;
  aliases?: string[];
  tags?: string[];
  publish?: boolean;
  draft?: boolean;
  permalink?: string;
  cssclasses?: string[];
  [key: string]: unknown;
}

export type LinkKind = 'note' | 'asset' | 'unresolved' | 'self';

/** A wikilink (or markdown link) after resolution against the vault. */
export interface ResolvedLink extends ParsedWikilink {
  kind: LinkKind;
  /** Vault path of the target, when resolved. */
  toPath?: string;
  /** Site URL of the target, when resolved. */
  toUrl?: string;
  /** True when the link matched via a frontmatter alias rather than a filename. */
  viaAlias?: boolean;
}

export type NoteKind = 'markdown' | 'canvas';

export interface Note {
  /**
   * A canvas is a note too — that is what makes routing, the sidebar, search
   * and backlinks work for `.canvas` files without a parallel code path.
   * For canvases, `body` holds the raw JSON rather than markdown.
   */
  kind: NoteKind;
  /** Vault path, e.g. `dev/Zettelkasten.md`. */
  path: string;
  /** URL path without leading slash, e.g. `dev/zettelkasten`. */
  slug: string;
  /** Site-absolute URL, e.g. `/dev/zettelkasten`. */
  url: string;
  /** Filename without extension. */
  basename: string;
  /** Containing folder, `''` at the vault root. */
  folder: string;
  title: string;
  /** Markdown body with frontmatter removed. */
  body: string;
  frontmatter: NoteFrontmatter;
  aliases: string[];
  /** Tags from both frontmatter and body, deduped, without the leading `#`. */
  tags: string[];
  headings: Heading[];
  blocks: BlockAnchor[];
  links: ResolvedLink[];
  /** Unix mtime in ms, when the loader can supply one. */
  mtime?: number;
}

export interface Asset {
  path: string;
  url: string;
  basename: string;
  ext: string;
}

export interface Backlink {
  /** Path of the note containing the link. */
  fromPath: string;
  /** The link as it appeared. */
  link: ResolvedLink;
  /** Surrounding prose, so the panel can show why the link exists. */
  context?: string;
}

export interface LinkGraphNode {
  path: string;
  outgoing: string[];
  incoming: string[];
}

export interface LinkGraph {
  nodes: Record<string, LinkGraphNode>;
  /** Deduped edge list, useful for the graph view in M2. */
  edges: Array<{ from: string; to: string }>;
  /** Link targets that matched nothing, mapped to the notes that referenced them. */
  unresolved: Record<string, string[]>;
}

/**
 * Lookup tables built once and reused for every link resolution.
 * All keys are lowercased; values point at real, case-preserved vault paths.
 */
export interface VaultLookups {
  /** Path without extension → real paths. */
  byPath: Record<string, string[]>;
  /** Basename without extension → real paths (may be ambiguous). */
  byBasename: Record<string, string[]>;
  /** Frontmatter alias → real paths. */
  byAlias: Record<string, string[]>;
  /** Asset path → real paths. */
  assetByPath: Record<string, string[]>;
  /** Asset basename with extension → real paths. */
  assetByBasename: Record<string, string[]>;
}

export interface VaultIndex {
  notes: Record<string, Note>;
  assets: Record<string, Asset>;
  /** Note paths in stable display order. */
  order: string[];
  lookups: VaultLookups;
  graph: LinkGraph;
  /** Tag → note paths. */
  tags: Record<string, string[]>;
  backlinks: Record<string, Backlink[]>;
}

export interface Resolution {
  kind: LinkKind;
  toPath?: string;
  toUrl?: string;
  viaAlias?: boolean;
}

export interface VaultOptions {
  /**
   * Only publish notes with `publish: true` in frontmatter.
   * Off by default so a fresh vault renders without touching every file, but the
   * setup guide pushes people towards turning it on for public repos.
   */
  explicitPublish?: boolean;
  /** Drop notes with `draft: true`. Default: true. */
  removeDrafts?: boolean;
  /** Glob-ish prefixes to exclude, e.g. `['private/', '.obsidian/']`. */
  ignore?: string[];
  /** Prefix for every generated URL, e.g. `/notes`. Default: `''`. */
  base?: string;
  /** Where attachments are served from. Default: `/_assets`. */
  assetBase?: string;
  /**
   * Append the attachment's exact vault path to `assetBase` instead of a
   * slugified one. Required when `assetBase` is a raw CDN URL.
   */
  preserveAssetPaths?: boolean;
}

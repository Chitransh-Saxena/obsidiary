/**
 * Obsidiary core — the isomorphic half.
 *
 * Nothing in this package may import `node:*`. The static build and the
 * in-browser live mode share this exact code, and a stray Node import is what
 * turns "one renderer" back into two renderers that disagree.
 */

export * from './types.js';
export * from './paths.js';
export * from './syntax.js';
export * from './frontmatter.js';
export * from './slug.js';
export * from './resolve.js';
export * from './note.js';
export * from './graph.js';
export * from './vault.js';
export * from './excerpt.js';
export * from './tree.js';
export * from './search.js';
export * from './canvas.js';
export * from './graphsim.js';
export * from './cluster.js';
export * from './sequence.js';
export * from './remote.js';
export { remarkObsidian, type ObsidianOptions } from './markdown/remark-obsidian.js';
export { remarkCallout } from './markdown/remark-callout.js';
export { createRenderer, type Renderer, type RenderOptions } from './markdown/pipeline.js';

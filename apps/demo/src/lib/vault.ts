import { index, site } from 'virtual:obsidiary';
import { createRenderer } from 'obsidiary';

/**
 * One renderer for the whole build. It memoises parsed ASTs, so creating a new
 * one per page would re-parse every transcluded note on every page that embeds it.
 */
export const renderer = createRenderer(index);

export { index, site };

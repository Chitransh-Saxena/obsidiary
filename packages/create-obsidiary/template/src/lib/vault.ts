import { index, site } from 'virtual:obsidiary';
import { createRenderer } from 'obsidiary';

/**
 * One renderer for the whole build. It memoises parsed notes, so creating a new
 * one per page would re-parse every transcluded note on every page embedding it.
 */
export const renderer = createRenderer(index);

export { index, site };

import { index, site } from 'virtual:obsidiary';
import { createRenderer } from 'obsidiary';

export const renderer = createRenderer(index);
export { index, site };

/// <reference types="astro/client" />

declare module 'virtual:obsidiary' {
  import type { VaultIndex } from 'obsidiary';
  export const index: VaultIndex;
  export const site: { title: string; description: string };
  export default index;
}

/// <reference types="astro/client" />

declare module 'virtual:obsidiary' {
  import type { VaultIndex, VaultSource } from 'obsidiary';
  export const index: VaultIndex;
  export const site: {
    title: string;
    description: string;
    liveExamples: Array<{ label: string; repo: string }>;
    source: VaultSource | null;
  };
  export default index;
}

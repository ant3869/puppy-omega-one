// global.d.ts — full window.omega typing for the renderer.
// The preload (src/preload/index.ts) is the source of truth for the shape;
// this file mirrors it so pages get types without importing main-process code.

import type { OmegaRun, PuppyStatus } from '@shared/types';

declare global {
  interface Window {
    omega: {
      puppy: {
        getStatus: () => Promise<PuppyStatus>;
        ensureServer: () => Promise<PuppyStatus>;
        listAgents: () => Promise<unknown>;
        listModels: () => Promise<unknown>;
        getActiveModel: () => Promise<unknown>;
        listSessions: () => Promise<unknown>;
        getActiveSession: () => Promise<unknown>;
        getCost: () => Promise<unknown>;
        sendPrompt: (prompt: string) => Promise<unknown>;
      };
      runs: {
        list: () => Promise<OmegaRun[]>;
        save: (run: OmegaRun) => Promise<OmegaRun>;
      };
      app: {
        pickProject: () => Promise<string | null>;
        readDocs: (projectDir: string) => Promise<Record<string, string | null>>;
      };
    };
  }
}

export {};

// global.d.ts — full window.omega typing for the renderer.
// The preload (src/preload/index.ts) is the source of truth for the shape;
// this file mirrors it so pages get types without importing main-process code.

import type { OmegaRun, PuppyStatus } from '@shared/types';
import type { WorkflowTelemetry } from '@shared/workflow-events';

declare global {
  interface Window {
    omega: {
      puppy: {
        getStatus: () => Promise<PuppyStatus>;
        ensureServer: (workspace: string) => Promise<PuppyStatus>;
        listAgents: () => Promise<unknown>;
        listModels: () => Promise<unknown>;
        getActiveModel: () => Promise<unknown>;
        listSessions: () => Promise<unknown>;
        getActiveSession: () => Promise<unknown>;
        getCost: () => Promise<unknown>;
        sendPrompt: (prompt: string) => Promise<unknown>;
      };
      workflow: {
        get: () => Promise<WorkflowTelemetry>;
        subscribe: (listener: (snapshot: WorkflowTelemetry) => void) => () => void;
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

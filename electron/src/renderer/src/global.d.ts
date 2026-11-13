import type { OmegaRun } from '@shared/types';
import type { CodePuppySnapshot } from '@shared/code-puppy-acp';
import type { WorkflowTelemetry } from '@shared/workflow-events';

declare global {
  interface Window {
    omega: {
      acp: {
        get: () => Promise<CodePuppySnapshot>;
        start: (projectDir: string) => Promise<CodePuppySnapshot>;
        prompt: (text: string) => Promise<CodePuppySnapshot>;
        cancel: () => Promise<void>;
        stop: () => Promise<void>;
        subscribe: (listener: (snapshot: CodePuppySnapshot) => void) => () => void;
      };
      workflow: {
        get: () => Promise<WorkflowTelemetry>;
        connect: () => Promise<WorkflowTelemetry>;
        disconnect: () => Promise<WorkflowTelemetry>;
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

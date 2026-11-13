import { contextBridge, ipcRenderer } from 'electron';
import type { OmegaRun } from '@shared/types';
import type { CodePuppySnapshot } from '@shared/code-puppy-acp';
import type { WorkflowTelemetry } from '@shared/workflow-events';

type Unsub = () => void;
const api = {
  acp: {
    get: (): Promise<CodePuppySnapshot> => ipcRenderer.invoke('acp:get'),
    start: (projectDir: string): Promise<CodePuppySnapshot> => ipcRenderer.invoke('acp:start', projectDir),
    prompt: (text: string): Promise<CodePuppySnapshot> => ipcRenderer.invoke('acp:prompt', text),
    cancel: (): Promise<void> => ipcRenderer.invoke('acp:cancel'),
    stop: (): Promise<void> => ipcRenderer.invoke('acp:stop'),
    subscribe: (listener: (snapshot: CodePuppySnapshot) => void): Unsub => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: CodePuppySnapshot) => listener(snapshot);
      ipcRenderer.on('acp:changed', handler);
      return () => ipcRenderer.removeListener('acp:changed', handler);
    }
  },
  workflow: {
    get: (): Promise<WorkflowTelemetry> => ipcRenderer.invoke('workflow:get'),
    connect: (): Promise<WorkflowTelemetry> => ipcRenderer.invoke('workflow:connect'),
    disconnect: (): Promise<WorkflowTelemetry> => ipcRenderer.invoke('workflow:disconnect'),
    subscribe: (listener: (snapshot: WorkflowTelemetry) => void): Unsub => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: WorkflowTelemetry) => listener(snapshot);
      ipcRenderer.on('workflow:changed', handler);
      return () => ipcRenderer.removeListener('workflow:changed', handler);
    }
  },
  runs: {
    list: (): Promise<OmegaRun[]> => ipcRenderer.invoke('runs:list'),
    save: (run: OmegaRun): Promise<OmegaRun> => ipcRenderer.invoke('runs:save', run)
  },
  app: {
    pickProject: (): Promise<string | null> => ipcRenderer.invoke('app:pickProject'),
    readDocs: (projectDir: string): Promise<Record<string, string | null>> =>
      ipcRenderer.invoke('docs:read', projectDir)
  }
};
contextBridge.exposeInMainWorld('omega', api);
export type OmegaApi = typeof api;

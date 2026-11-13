// preload.ts
// Puppy Omega One — safe renderer API via contextBridge.
// Mirrors ant3869/electron-react-dark-starter src/preload/index.ts:
// invoke for requests, on+unsubscribe for pushed updates, typed surface.

import { contextBridge, ipcRenderer } from 'electron';
import type { OmegaRun, PuppyStatus } from '@shared/types';
import type { WorkflowTelemetry } from '@shared/workflow-events';
import type { GuiDiagnostics } from '@shared/gui-diagnostics';

type Unsub = () => void;

const api = {
  puppy: {
    getStatus: (): Promise<PuppyStatus> => ipcRenderer.invoke('puppy:getStatus'),
    ensureServer: (workspace: string): Promise<PuppyStatus> => ipcRenderer.invoke('puppy:ensureServer', workspace),
    listAgents: (): Promise<unknown> => ipcRenderer.invoke('puppy:listAgents'),
    listModels: (): Promise<unknown> => ipcRenderer.invoke('puppy:listModels'),
    getActiveModel: (): Promise<unknown> => ipcRenderer.invoke('puppy:getActiveModel'),
    listSessions: (): Promise<unknown> => ipcRenderer.invoke('puppy:listSessions'),
    getActiveSession: (): Promise<unknown> => ipcRenderer.invoke('puppy:getActiveSession'),
    getCost: (): Promise<unknown> => ipcRenderer.invoke('puppy:getCost'),
    diagnostics: (): Promise<GuiDiagnostics> => ipcRenderer.invoke('puppy:diagnostics'),
    // TODO: not wired — throws until the chat-send endpoint is verified.
    sendPrompt: (prompt: string): Promise<unknown> => ipcRenderer.invoke('puppy:sendPrompt', prompt)
  },
  workflow: {
    get: (): Promise<WorkflowTelemetry> => ipcRenderer.invoke('workflow:get'),
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

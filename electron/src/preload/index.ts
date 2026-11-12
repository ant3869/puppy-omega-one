// preload.ts
// Puppy Omega One — safe renderer API via contextBridge.
// Mirrors ant3869/electron-react-dark-starter src/preload/index.ts:
// invoke for requests, on+unsubscribe for pushed updates, typed surface.

import { contextBridge, ipcRenderer } from 'electron';
import type { OmegaRun, PuppyStatus } from '@shared/types';

type Unsub = () => void;

const api = {
  puppy: {
    getStatus: (): Promise<PuppyStatus> => ipcRenderer.invoke('puppy:getStatus'),
    ensureServer: (): Promise<PuppyStatus> => ipcRenderer.invoke('puppy:ensureServer'),
    listAgents: (): Promise<unknown> => ipcRenderer.invoke('puppy:listAgents'),
    listModels: (): Promise<unknown> => ipcRenderer.invoke('puppy:listModels'),
    getActiveModel: (): Promise<unknown> => ipcRenderer.invoke('puppy:getActiveModel'),
    listSessions: (): Promise<unknown> => ipcRenderer.invoke('puppy:listSessions'),
    getActiveSession: (): Promise<unknown> => ipcRenderer.invoke('puppy:getActiveSession'),
    getCost: (): Promise<unknown> => ipcRenderer.invoke('puppy:getCost'),
    // TODO: not wired — throws until the chat-send endpoint is verified.
    sendPrompt: (prompt: string): Promise<unknown> => ipcRenderer.invoke('puppy:sendPrompt', prompt)
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

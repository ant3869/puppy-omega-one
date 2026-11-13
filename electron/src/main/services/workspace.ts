import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { OmegaRun } from '../../shared/types';
import type { CodePuppySnapshot } from '../../shared/code-puppy-acp';
import { initialWorkflow, reduceWorkflowEvent, changeWorkflowConnection } from '../../shared/workflow-events';
import type { WorkflowTelemetry } from '../../shared/workflow-events';
import { assertProjectWorkspace } from './project-safety';
import { assertDraftRun, assertStoredRuns } from './draft-validation';
import { CodePuppyAcpClient } from './code-puppy-acp';

const acp = new CodePuppyAcpClient();
let writes: Promise<void> = Promise.resolve();
let workflow: WorkflowTelemetry = initialWorkflow();
let previousConnection: CodePuppySnapshot['connection'] = 'offline';
let previousSession: string | null = null;
let previousEventId = 0;
let workflowWindow: (() => BrowserWindow | null) | null = null;

function notifyWorkflow() {
  const window = workflowWindow?.();
  if (window && !window.isDestroyed()) window.webContents.send('workflow:changed', workflow);
}

function reflectAcp(snapshot: CodePuppySnapshot) {
  if (snapshot.sessionId !== previousSession) {
    workflow = initialWorkflow();
    previousEventId = 0;
    previousConnection = 'offline';
    previousSession = snapshot.sessionId;
  }
  const active = snapshot.connection === 'ready' || snapshot.connection === 'working';
  workflow = changeWorkflowConnection(workflow, workflow.monitoring && active ? 'connected' : 'disconnected');
  if (workflow.monitoring && active) {
    if (snapshot.connection === 'working' && previousConnection !== 'working') {
      workflow = reduceWorkflowEvent(workflow, { type: 'turn_start', agent: 'Code Puppy ACP' }, Date.now());
    }
    for (const ev of snapshot.events) {
      if (ev.id <= previousEventId) continue;
      if (ev.kind === 'tool' || ev.kind === 'error') {
        const at = Date.now();
        const label = ev.kind === 'tool' ? 'ACP tool activity: ' + ev.text.slice(0, 95) : 'ACP error reported';
        workflow = {
          ...workflow, activity: label, lastEventAt: at,
          events: [...workflow.events, { id: (workflow.events.at(-1)?.id ?? 0) + 1, timestamp: at,
            label, lane: null, tone: (ev.kind === 'error' ? 'error' : 'neutral') as 'error' | 'neutral' }].slice(-30)
        };
      }
    }
    if (snapshot.connection === 'ready' && previousConnection === 'working') {
      workflow = reduceWorkflowEvent(workflow, { type: 'turn_end', agent: 'Code Puppy ACP' }, Date.now());
    }
  }
  previousEventId = snapshot.events.at(-1)?.id ?? previousEventId;
  previousConnection = snapshot.connection;
  notifyWorkflow();
}

async function validateProject(value: string): Promise<string> {
  return assertProjectWorkspace(value, { configHome: process.env.XDG_CONFIG_HOME });
}

function runsFile(): string {
  return join(app.getPath('userData'), 'runs.json');
}

async function loadRuns(): Promise<OmegaRun[]> {
  let raw: string;
  try {
    raw = await fs.readFile(runsFile(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  assertStoredRuns(parsed);
  return parsed;
}

async function saveRuns(runs: OmegaRun[]): Promise<void> {
  const target = runsFile();
  const temporary = target + '.' + process.pid + '.' + Date.now() + '.tmp';
  await fs.mkdir(dirname(target), { recursive: true });
  try {
    await fs.writeFile(temporary, JSON.stringify(runs, null, 2), 'utf8');
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

export function registerWorkspaceIpc(getWindow: () => BrowserWindow | null) {
  workflowWindow = getWindow;
  ipcMain.handle('workflow:get', () => workflow);
  ipcMain.handle('workflow:connect', () => {
    const snapshot = acp.getSnapshot();
    if (!snapshot.sessionId) throw new Error('Start a Code Puppy session before viewing live activity');
    workflow = { ...initialWorkflow('connected'), monitoring: true, agent: 'Code Puppy ACP', activity: 'Watching the selected ACP session' };
    previousConnection = snapshot.connection === 'working' ? 'ready' : snapshot.connection;
    reflectAcp(snapshot);
    return workflow;
  });
  ipcMain.handle('workflow:disconnect', () => {
    workflow = initialWorkflow();
    notifyWorkflow();
    return workflow;
  });
  acp.on('changed', (snapshot: CodePuppySnapshot) => {
    reflectAcp(snapshot);
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('acp:changed', snapshot);
  });

  ipcMain.handle('acp:get', () => acp.getSnapshot());
  ipcMain.handle('acp:start', async (_event, projectDir: string) => {
    const workspace = await validateProject(projectDir);
    return acp.start(workspace);
  });
  ipcMain.handle('acp:prompt', async (_event, text: string, expectedProjectDir: string) => {
    const workspace = await validateProject(expectedProjectDir);
    const active = acp.getSnapshot();
    if (active.projectDir !== workspace || !active.sessionId) {
      throw new Error('Selected project does not match the active Code Puppy session');
    }
    return acp.prompt(text);
  });
  ipcMain.handle('acp:cancel', () => acp.cancel());
  ipcMain.handle('acp:stop', () => acp.stop());

  ipcMain.handle('runs:list', () => loadRuns());
  ipcMain.handle('runs:save', (_event, run: OmegaRun) => {
    assertDraftRun(run);
    const task = writes.then(async () => {
      const validated = await validateProject(run.projectDir!);
      const next = { ...run, projectDir: validated };
      const records = await loadRuns();
      const index = records.findIndex((record) => record.id === next.id);
      if (index >= 0) records[index] = next;
      else records.unshift(next);
      await saveRuns(records);
      return next;
    });
    writes = task.then(() => undefined, () => undefined);
    return task;
  });

  ipcMain.handle('app:pickProject', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths[0]) return null;
    return validateProject(result.filePaths[0]);
  });
  ipcMain.handle('docs:read', async (_event, projectDir: string) => {
    const workspace = await validateProject(projectDir);
    const result: Record<string, string | null> = {};
    for (const name of ['progress.md', 'decisions.md', 'known-issues.md']) {
      try {
        result[name] = await fs.readFile(join(workspace, 'docs', name), 'utf8');
      } catch {
        result[name] = null;
      }
    }
    return result;
  });
}

export function stopCodePuppy() {
  acp.stop();
}

import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { OmegaRun } from '../../shared/types';
import { assertProjectWorkspace } from './project-safety';
import { assertDraftRun, assertStoredRuns } from './draft-validation';
import { CodePuppyAcpClient } from './code-puppy-acp';

const acp = new CodePuppyAcpClient();
let writes: Promise<void> = Promise.resolve();

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
  acp.on('changed', (snapshot) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('acp:changed', snapshot);
  });

  ipcMain.handle('acp:get', () => acp.getSnapshot());
  ipcMain.handle('acp:start', async (_event, projectDir: string) => {
    const workspace = await validateProject(projectDir);
    return acp.start(workspace);
  });
  ipcMain.handle('acp:prompt', (_event, text: string) => acp.prompt(text));
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

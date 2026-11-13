// services/puppy.ts
// Puppy Omega One — main-process service for the puppy_gui server.
// The Electron shell owns NO backend of its own: it spawns (or attaches to)
// the existing puppy_gui FastAPI server (launch_gui.py, Code Puppy venv python)
// and talks to it over HTTP on 127.0.0.1:8765.
//
// Why HTTP to puppy_gui, not a subprocess driving `code-puppy` directly:
// ant3869/ai-integration-reference (harnesses/code-puppy.md) warns that Code
// Puppy has no stable programmatic RPC/session protocol — "Do not assume a
// stable HTTP API, JSON-RPC server, or SDK" — and to treat raw CLI integration
// as interactive-only / experimental. puppy_gui is the stable surface Ant
// already built and maintains over the same runtime, so the shell goes through
// it. See docs/FRONTEND.md.

import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { OmegaRun, PuppyStatus } from '../../shared/types';
import { assertProjectWorkspace } from './project-safety';
import { guiLaunchSpec } from './gui-launch';

const PORT = Number(process.env.PUPPY_GUI_PORT ?? 8765);
const BASE = `http://127.0.0.1:${PORT}`;

let child: ChildProcessWithoutNullStreams | null = null;
let spawnedByUs = false;
let launchedWorkspace: string | null = null;

function currentStatus(running: boolean, error?: string): PuppyStatus {
  return {
    running, spawnedByUs, port: PORT, url: BASE,
    launchWorkspace: spawnedByUs ? launchedWorkspace : null,
    ...(error ? { error } : {})
  };
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

function resolvePython(): string {
  if (process.env.CODE_PUPPY_PYTHON) return process.env.CODE_PUPPY_PYTHON;
  const venv = join(homedir(), '.code-puppy-venv');
  return process.platform === 'win32'
    ? join(venv, 'Scripts', 'python.exe')
    : join(venv, 'bin', 'python');
}

async function resolveLaunchGui(): Promise<string | null> {
  if (process.env.PUPPY_GUI_LAUNCH) return process.env.PUPPY_GUI_LAUNCH;
  const dir = process.env.PUPPY_GUI_DIR;
  if (dir) return join(dir, 'launch_gui.py');
  // Common checkouts — first one that exists wins; otherwise null with a
  // clear error (set PUPPY_GUI_LAUNCH to the full path to launch_gui.py).
  const candidates = [
    join(homedir(), 'puppy_gui', 'launch_gui.py'),
    join(homedir(), 'projects', 'puppy_gui', 'launch_gui.py'),
    join(homedir(), '.code_puppy', 'launch_gui.py')
  ];
  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }
  return null;
}

async function validateProject(project: string): Promise<string> {
  const resolvedGui = await resolveLaunchGui();
  return assertProjectWorkspace(project, {
    configHome: process.env.XDG_CONFIG_HOME,
    python: resolvePython(),
    guiDir: process.env.PUPPY_GUI_DIR,
    guiLaunch: resolvedGui ?? process.env.PUPPY_GUI_LAUNCH
  });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function healthOk(timeoutMs = 2000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: ctrl.signal });
      return res.ok;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return false;
  }
}

export async function ensureServer(requestedProject: string): Promise<PuppyStatus> {
  const workspace = await validateProject(requestedProject);
  if (await healthOk()) {
    return launchedWorkspace === workspace && spawnedByUs
      ? currentStatus(true)
      : currentStatus(true, 'A GUI server is already running; its working directory cannot be verified or changed from Omega. Confirm the project in the existing GUI before making edits.');
  }
  if (child) return currentStatus(false, 'A GUI server is already starting; wait or use its existing workspace.');

  const launch = await resolveLaunchGui();
  if (!launch) {
    return {
      running: false,
      spawnedByUs: false,
      port: PORT,
      url: BASE,
      error:
        'launch_gui.py not found. Set PUPPY_GUI_LAUNCH to the full path to launch_gui.py (or PUPPY_GUI_DIR to its folder).'
    };
  }
  if (!(await fileExists(launch))) {
    return { running: false, spawnedByUs: false, port: PORT, url: BASE, error: `launch_gui.py not found at ${launch}` };
  }

  const python = resolvePython();
  const spec = guiLaunchSpec(launch, workspace, PORT);
  const proc = spawn(python, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    windowsHide: true
  });
  child = proc;
  spawnedByUs = true;
  launchedWorkspace = workspace;
  let spawnError: string | null = null;
  proc.stdout.on('data', (d) => console.log('[puppy-gui]', String(d).trim()));
  proc.stderr.on('data', (d) => console.warn('[puppy-gui]', String(d).trim()));
  proc.on('error', (error) => {
    spawnError = error.message;
    console.warn('[puppy] could not start server:', spawnError);
    if (child === proc) {
      child = null;
      spawnedByUs = false;
      launchedWorkspace = null;
    }
  });
  proc.on('exit', (code) => {
    console.warn('[puppy] server exited', code);
    if (child === proc) {
      child = null;
      spawnedByUs = false;
      launchedWorkspace = null;
    }
  });

  // Fail immediately if the executable is missing or the child exits.
  for (let i = 0; i < 60; i++) {
    if (await healthOk()) return currentStatus(true);
    if (spawnError || child !== proc) {
      return {
        running: false, spawnedByUs: false, port: PORT, url: BASE,
        error: spawnError ?? 'puppy_gui exited before becoming healthy'
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return currentStatus(false, 'server did not answer /api/health in 30s');
}

export function stopServer() {
  if (child && spawnedByUs) {
    child.kill();
    child = null;
    spawnedByUs = false;
    launchedWorkspace = null;
  }
}

// ---------------------------------------------------------------------------
// /api passthrough (verified puppy_gui endpoints — see docs/FRONTEND.md)
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`puppy_gui ${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Run records — persisted to runs.json in userData, NOT renderer state.
// (ai-integration-reference, architecture/session-and-events.md: keep a
// canonical store with atomic-ish status updates; never trust UI state.)
// ---------------------------------------------------------------------------

function runsFile(): string {
  return join(app.getPath('userData'), 'runs.json');
}

async function loadRuns(): Promise<OmegaRun[]> {
  let raw: string;
  try {
    raw = await fs.readFile(runsFile(), 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('runs.json is invalid: expected an array');
  return parsed as OmegaRun[];
}

async function saveRuns(runs: OmegaRun[]): Promise<void> {
  const path = runsFile();
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(dirname(path), { recursive: true });
  try {
    await fs.writeFile(temp, JSON.stringify(runs, null, 2), 'utf-8');
    await fs.rename(temp, path);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => undefined);
  }
}

// Serialize read-modify-write operations so rapid saves do not drop runs.
let runWrites: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// IPC registration (mirrors the starter's registerXxxIpc pattern)
// ---------------------------------------------------------------------------

export function registerPuppyIpc(getWindow: () => BrowserWindow | null) {
  void getWindow; // reserved: live event forwarding will push to this window

  ipcMain.handle('puppy:getStatus', async () => {
    return currentStatus(await healthOk());
  });

  ipcMain.handle('puppy:ensureServer', (_e, workspace: string) => ensureServer(workspace));

  ipcMain.handle('puppy:listAgents', () => apiGet('/api/agents'));
  ipcMain.handle('puppy:listModels', () => apiGet('/api/models'));
  ipcMain.handle('puppy:getActiveModel', () => apiGet('/api/models/active'));
  ipcMain.handle('puppy:listSessions', () => apiGet('/api/sessions'));
  ipcMain.handle('puppy:getActiveSession', () => apiGet('/api/sessions/active'));
  ipcMain.handle('puppy:getCost', () => apiGet('/api/cost/active'));
  ipcMain.handle('puppy:getHealth', () => apiGet('/api/health'));

  // Native prompt send stays disabled: client-side GUI WebSocket commands
  // exist, but the server route and project/session binding are unverified.
  // Use the embedded real Puppy GUI for interactive chat and approvals.
  // The separate read-only event observer does not send prompts.
  ipcMain.handle('puppy:sendPrompt', () => {
    throw new Error(
      'puppy:sendPrompt is not wired yet — verify the chat-send endpoint in puppy_gui routes_chat / static/js/chat.js first (see docs/FRONTEND.md).'
    );
  });

  ipcMain.handle('runs:list', () => loadRuns());
  ipcMain.handle('runs:save', async (_e, run: OmegaRun) => {
    if (!run || typeof run.id !== 'string' || !run.id || !Array.isArray(run.briefs)) {
      throw new Error('Invalid run record');
    }
    if (run.projectDir !== null) await validateProject(run.projectDir);
    const write = runWrites.then(async () => {
      const runs = await loadRuns();
      const idx = runs.findIndex((r) => r.id === run.id);
      if (idx >= 0) runs[idx] = run;
      else runs.unshift(run);
      await saveRuns(runs);
      return run;
    });
    runWrites = write.then(() => undefined, () => undefined);
    return write;
  });

  ipcMain.handle('app:pickProject', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (res.canceled) return null;
    const selected = res.filePaths[0];
    if (!selected) return null;
    return validateProject(selected);
  });

  ipcMain.handle('docs:read', async (_e, projectDir: string) => {
    const workspace = await validateProject(projectDir);
    const out: Record<string, string | null> = {};
    for (const name of ['progress.md', 'decisions.md', 'known-issues.md']) {
      try {
        out[name] = await fs.readFile(join(workspace, 'docs', name), 'utf-8');
      } catch {
        out[name] = null;
      }
    }
    return out;
  });
}

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
import { dirname, join, resolve } from 'node:path';
import type { OmegaRun, PuppyStatus } from '../../shared/types';

const PORT = Number(process.env.PUPPY_GUI_PORT ?? 8765);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PUPPY_GUI_PORT must be an integer between 1 and 65535');
}
export const PUPPY_ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = PUPPY_ORIGIN;

let child: ChildProcessWithoutNullStreams | null = null;
let spawnedByUs = false;
let launchError: string | null = null;

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

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function healthOk(timeoutMs = 2000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureServer(): Promise<PuppyStatus> {
  if (await healthOk()) {
    return { running: true, spawnedByUs, port: PORT, url: BASE };
  }
  if (child) return { running: false, spawnedByUs, port: PORT, url: BASE, error: 'server starting' };

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
  launchError = null;
  child = spawn(python, [launch], {
    cwd: dirname(launch),
    env: { ...process.env, PUPPY_GUI_PORT: String(PORT) },
    windowsHide: true
  });
  spawnedByUs = true;
  child.stdout.on('data', (d) => console.log('[puppy-gui]', String(d).trim()));
  child.stderr.on('data', (d) => console.warn('[puppy-gui]', String(d).trim()));
  child.on('error', (error) => {
    launchError = `Cannot start puppy_gui with ${python}: ${error.message}`;
    console.error('[puppy]', launchError);
    child = null;
    spawnedByUs = false;
  });
  child.on('exit', (code) => {
    if (!launchError) launchError = `puppy_gui exited with code ${code}`;
    console.warn('[puppy] server exited', code);
    child = null;
    spawnedByUs = false;
  });

  // Poll /api/health for up to 30s.
  for (let i = 0; i < 60; i++) {
    if (await healthOk()) return { running: true, spawnedByUs: true, port: PORT, url: BASE };
    if (launchError) return { running: false, spawnedByUs: false, port: PORT, url: BASE, error: launchError };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { running: false, spawnedByUs: true, port: PORT, url: BASE, error: 'server did not answer /api/health in 30s' };
}

export function stopServer() {
  if (child && spawnedByUs) {
    child.kill();
    child = null;
    spawnedByUs = false;
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
  try {
    const raw = await fs.readFile(runsFile(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('runs.json must contain an array');
    return parsed as OmegaRun[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function saveRuns(runs: OmegaRun[]): Promise<void> {
  await fs.mkdir(dirname(runsFile()), { recursive: true });
  const target = runsFile();
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(runs, null, 2), 'utf-8');
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// IPC registration (mirrors the starter's registerXxxIpc pattern)
// Serialize writes so rapid saves cannot clobber each other.
// ---------------------------------------------------------------------------

let runsWriteQueue: Promise<void> = Promise.resolve();

export function registerPuppyIpc(getWindow: () => BrowserWindow | null) {
  void getWindow; // reserved: live event forwarding will push to this window

  ipcMain.handle('puppy:getStatus', async () => {
    if (await healthOk()) return { running: true, spawnedByUs, port: PORT, url: BASE } satisfies PuppyStatus;
    return { running: false, spawnedByUs, port: PORT, url: BASE } satisfies PuppyStatus;
  });

  ipcMain.handle('puppy:ensureServer', () => ensureServer());

  ipcMain.handle('puppy:listAgents', () => apiGet('/api/agents'));
  ipcMain.handle('puppy:listModels', () => apiGet('/api/models'));
  ipcMain.handle('puppy:getActiveModel', () => apiGet('/api/models/active'));
  ipcMain.handle('puppy:listSessions', () => apiGet('/api/sessions'));
  ipcMain.handle('puppy:getActiveSession', () => apiGet('/api/sessions/active'));
  ipcMain.handle('puppy:getCost', () => apiGet('/api/cost/active'));
  ipcMain.handle('puppy:getHealth', () => apiGet('/api/health'));

  // TODO (not wired): sending a prompt + streaming live run events.
  // The chat-send/stream endpoint was NOT verified against routes_chat +
  // static/js/chat.js in puppy_gui. Do not guess it — see docs/FRONTEND.md.
  // Until it is wired, the Run page composes the brief and copies it for
  // pasting into the Puppy GUI chat view.
  ipcMain.handle('puppy:sendPrompt', () => {
    throw new Error(
      'puppy:sendPrompt is not wired yet — verify the chat-send endpoint in puppy_gui routes_chat / static/js/chat.js first (see docs/FRONTEND.md).'
    );
  });

  ipcMain.handle('runs:list', () => loadRuns());
  ipcMain.handle('runs:save', async (_e, run: OmegaRun) => {
    if (!run || typeof run.id !== 'string' || !run.id || typeof run.goal !== 'string') {
      throw new Error('Invalid run record');
    }
    const operation = runsWriteQueue.then(async () => {
      const runs = await loadRuns();
      const idx = runs.findIndex((r) => r.id === run.id);
      if (idx >= 0) runs[idx] = run;
      else runs.unshift(run);
      await saveRuns(runs);
    });
    runsWriteQueue = operation.catch(() => undefined);
    await operation;
    return run;
  });

  ipcMain.handle('app:pickProject', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (res.canceled) return null;
    return res.filePaths[0] ?? null;
  });

  ipcMain.handle('docs:read', async (_e, projectDir: string) => {
    const out: Record<string, string | null> = {};
    for (const name of ['progress.md', 'decisions.md', 'known-issues.md']) {
      try {
        out[name] = await fs.readFile(join(resolve(projectDir), 'docs', name), 'utf-8');
      } catch {
        out[name] = null;
      }
    }
    return out;
  });
}

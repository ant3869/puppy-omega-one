// main.ts
// Puppy Omega One — Electron main process: window + puppy_gui server lifecycle + IPC
// Based on ant3869/electron-react-dark-starter src/main/main.ts:
// same window shape (1280x800, dark bg, contextIsolation, no nodeIntegration,
// sandboxed renderer), same per-service IPC registration pattern.

import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registerPuppyIpc, ensureServer, stopServer } from './services/puppy';
import { registerWorkflowIpc, startWorkflowEvents, stopWorkflowEvents } from './services/workflow';

const preloadPath = fileURLToPath(new URL('../preload/index.mjs', import.meta.url));
const rendererIndexHtml = fileURLToPath(new URL('../renderer/index.html', import.meta.url));

// App icon: assets/icon.png (the minimal neon-Omega puppy mark).
// Dev: the scaffold's assets/ dir, one level up from the electron/ app root.
// Packaged: electron-builder copies ../assets into resources/assets
// (see "extraResources" in package.json).
function resolveIcon(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'assets', 'icon.png');
  return join(app.getAppPath(), '..', 'assets', 'icon.png');
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0b0e11',
    title: 'Puppy Omega One',
    icon: resolveIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true, // Puppy GUI view embeds http://127.0.0.1:8765 in a <webview>
      preload: preloadPath
    }
  });

  // Only browser-safe links can leave the app; never pass file:, javascript:, etc.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(url);
    } catch {
      // Malformed links are denied.
    }
    return { action: 'deny' };
  });

  // An embedded view may load only our localhost puppy_gui service.
  mainWindow.webContents.on('will-attach-webview', (event, preferences, params) => {
    const port = Number(process.env.PUPPY_GUI_PORT ?? 8765);
    try {
      if (new URL(params.src).origin !== `http://127.0.0.1:${port}`) {
        event.preventDefault();
        return;
      }
    } catch {
      event.preventDefault();
      return;
    }
    delete preferences.preload;
    preferences.nodeIntegration = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
  });

  const url = process.env.ELECTRON_RENDERER_URL;
  if (url) {
    void mainWindow.loadURL(url);
  } else {
    void mainWindow.loadFile(rendererIndexHtml);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  registerPuppyIpc(() => mainWindow);
  registerWorkflowIpc(() => mainWindow);
  startWorkflowEvents();

  // Start (or attach to) the puppy_gui server in the background.
  // The renderer polls puppy:getStatus and shows "starting server…" until it is up.
  void ensureServer().then((status) => {
    if (!status.running) {
      console.warn('[puppy] server not running:', status.error ?? 'unknown error');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopWorkflowEvents();
  stopServer(); // kills the child we spawned; never touches a server we attached to
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

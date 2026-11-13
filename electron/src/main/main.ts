// main.ts
// Puppy Omega One — Electron main process: window + puppy_gui server lifecycle + IPC
// Based on ant3869/electron-react-dark-starter src/main/main.ts:
// same window shape (1280x800, dark bg, contextIsolation, no nodeIntegration,
// sandboxed renderer), same per-service IPC registration pattern.

import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registerPuppyIpc, stopServer } from './services/puppy';
import { registerWorkflowIpc, startWorkflowEvents, stopWorkflowEvents } from './services/workflow';
import { allowedExternalUrl, isTrustedGuiUrl } from './services/webview-policy';

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
    if (allowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // An embedded view may load only our localhost puppy_gui service.
  mainWindow.webContents.on('will-attach-webview', (event, preferences, params) => {
    const port = Number(process.env.PUPPY_GUI_PORT ?? 8765);
    if (!isTrustedGuiUrl(params.src, port)) {
      event.preventDefault();
      return;
    }
    delete preferences.preload;
    preferences.nodeIntegration = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
  });

  // An attached webview cannot follow redirects to file:, external domains,
  // privileged app schemes, or arbitrary local services.
  mainWindow.webContents.on('did-attach-webview', (_event, guest) => {
    const port = Number(process.env.PUPPY_GUI_PORT ?? 8765);
    guest.setWindowOpenHandler(({ url }) => {
      if (allowedExternalUrl(url) && !isTrustedGuiUrl(url, port)) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });
    const restrict = (event: Electron.Event, navigation: unknown) => {
      const target = typeof navigation === 'string'
        ? navigation
        : navigation && typeof navigation === 'object' && 'url' in navigation
          ? String(navigation.url)
          : '';
      if (!isTrustedGuiUrl(target, port)) {
        event.preventDefault();
        if (allowedExternalUrl(target)) void shell.openExternal(target);
      }
    };
    guest.on('will-navigate', restrict);
    guest.on('will-redirect', restrict);
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

  // Startup is observational: never implicitly launch Code Puppy or Puppy GUI.
  // Users may explicitly start the GUI from the app's connection controls.

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

import { app, BrowserWindow, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registerWorkspaceIpc, stopCodePuppy } from './services/workspace';
import { allowedExternalUrl } from './services/webview-policy';

const preloadPath = fileURLToPath(new URL('../preload/index.js', import.meta.url));
const rendererIndexHtml = fileURLToPath(new URL('../renderer/index.html', import.meta.url));

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
      webviewTag: false,
      preload: preloadPath
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (allowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  const url = process.env.ELECTRON_RENDERER_URL;
  if (url) void mainWindow.loadURL(url);
  else void mainWindow.loadFile(rendererIndexHtml);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  registerWorkspaceIpc(() => mainWindow);
  // Code Puppy is not launched until the user selects a safe project and clicks Start.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => stopCodePuppy());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

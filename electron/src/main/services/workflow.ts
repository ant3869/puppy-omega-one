import { ipcMain, type BrowserWindow } from 'electron';
import WebSocket from 'ws';
import {
  changeWorkflowConnection,
  initialWorkflow,
  reduceWorkflowEvent,
  type WorkflowTelemetry
} from '../../shared/workflow-events';

const port = Number(process.env.PUPPY_GUI_PORT ?? 8765);
const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
const endpoint = validPort ? `ws://127.0.0.1:${port}/ws/chat` : null;
const RECONNECT_MS = 2500;

let state: WorkflowTelemetry = initialWorkflow();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = true;
let getWindow: (() => BrowserWindow | null) | null = null;

function broadcast(): void {
  const window = getWindow?.();
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send('workflow:changed', state);
  }
}

function setConnection(connection: 'connecting' | 'connected' | 'disconnected'): void {
  const next = changeWorkflowConnection(state, connection);
  if (next !== state) {
    state = next;
    broadcast();
  }
}

function scheduleReconnect(): void {
  if (stopped || !endpoint || reconnectTimer !== null) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_MS);
  reconnectTimer.unref();
}

function connect(): void {
  if (stopped || !endpoint || socket) return;
  setConnection('connecting');

  const current = new WebSocket(endpoint, {
    handshakeTimeout: 4000,
    maxPayload: 128 * 1024,
    perMessageDeflate: false,
    origin: `http://127.0.0.1:${port}`
  });
  socket = current;

  current.on('open', () => {
    if (socket !== current || stopped) return;
    setConnection('connected');
  });

  current.on('message', (bytes, isBinary) => {
    if (stopped || socket !== current || isBinary) return;
    try {
      const event: unknown = JSON.parse(bytes.toString('utf8'));
      const next = reduceWorkflowEvent(state, event, Date.now());
      if (next !== state) {
        state = next;
        broadcast();
      }
    } catch {
      // Malformed data never propagates to the renderer or crashes Electron.
    }
  });

  current.on('error', () => {
    // Connection failures are followed by 'close'; never loop on an error event.
  });

  current.on('close', () => {
    if (socket !== current) return;
    socket = null;
    setConnection('disconnected');
    scheduleReconnect();
  });
}

export function registerWorkflowIpc(windowProvider: () => BrowserWindow | null): void {
  getWindow = windowProvider;
  ipcMain.handle('workflow:get', (): WorkflowTelemetry => state);
}

export function startWorkflowEvents(): void {
  if (!stopped) return;
  stopped = false;
  if (!endpoint) {
    setConnection('disconnected');
    return;
  }
  connect();
}

export function stopWorkflowEvents(): void {
  stopped = true;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const current = socket;
  socket = null;
  if (current) {
    current.removeAllListeners();
    current.terminate();
  }
  setConnection('disconnected');
}

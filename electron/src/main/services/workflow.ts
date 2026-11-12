import { ipcMain, type BrowserWindow } from 'electron';
import { initialWorkflow, type WorkflowTelemetry } from '../../shared/workflow-events';
import { WorkflowTransport } from './workflow-transport';

const port = Number(process.env.PUPPY_GUI_PORT ?? 8765);
const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
const transport = validPort ? new WorkflowTransport(`ws://127.0.0.1:${port}/ws/chat`) : null;
let unsubscribe: (() => void) | null = null;

export function registerWorkflowIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('workflow:get', (): WorkflowTelemetry => transport?.getState() ?? initialWorkflow());
  unsubscribe?.();
  unsubscribe = transport?.subscribe((snapshot) => {
    const window = getWindow();
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('workflow:changed', snapshot);
    }
  }) ?? null;
}

export function startWorkflowEvents(): void {
  transport?.start();
}

export function stopWorkflowEvents(): void {
  transport?.stop();
  unsubscribe?.();
  unsubscribe = null;
}

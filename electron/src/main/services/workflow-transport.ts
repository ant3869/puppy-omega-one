import WebSocket from 'ws';
import {
  changeWorkflowConnection,
  initialWorkflow,
  reduceWorkflowEvent,
  type WorkflowTelemetry
} from '../../shared/workflow-events';

type Listener = (snapshot: WorkflowTelemetry) => void;

export class WorkflowTransport {
  private snapshot: WorkflowTelemetry = initialWorkflow();
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private listeners = new Set<Listener>();

  constructor(private readonly endpoint: string, private readonly reconnectMs = 2500) {
    const url = new URL(endpoint);
    if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || url.pathname !== '/ws/chat' || url.search || url.hash) {
      throw new Error('Workflow transport must use the loopback /ws/chat endpoint');
    }
  }

  getState(): WorkflowTelemetry {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(next: WorkflowTelemetry): void {
    if (next === this.snapshot) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener(next);
  }

  private status(state: 'connecting' | 'connected' | 'disconnected'): void {
    this.publish(changeWorkflowConnection(this.snapshot, state));
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.publish({ ...this.snapshot, monitoring: true });
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const previous = this.socket;
    this.socket = null;
    if (previous) {
      // Keep the socket error listener until termination finishes; late errors
      // cannot become unhandled Node events, and stale callbacks are guarded.
      previous.terminate();
    }
    this.publish({
      ...changeWorkflowConnection(this.snapshot, 'disconnected'),
      monitoring: false,
      activity: 'Live observation stopped; no event connection'
    });
  }

  private reconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectMs);
    this.reconnectTimer.unref();
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    this.status('connecting');

    const socket = new WebSocket(this.endpoint, {
      handshakeTimeout: 4000,
      maxPayload: 128 * 1024,
      perMessageDeflate: false,
      origin: this.endpoint.replace(/^ws:/, 'http:').replace(/\/ws\/chat$/, '')
    });
    this.socket = socket;

    socket.on('open', () => {
      if (this.socket === socket && !this.stopped) this.status('connected');
    });

    socket.on('message', (bytes, isBinary) => {
      if (this.socket !== socket || this.stopped || isBinary) return;
      try {
        this.publish(reduceWorkflowEvent(this.snapshot, JSON.parse(bytes.toString('utf8')), Date.now()));
      } catch {
        // Malformed events are skipped; nothing raw reaches the renderer.
      }
    });

    socket.on('error', () => {
      // Socket errors result in a close event, which schedules the retry.
    });

    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.status('disconnected');
      this.reconnect();
    });
  }
}

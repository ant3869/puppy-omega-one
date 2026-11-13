import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { CodePuppyChatEvent, CodePuppySnapshot } from '../../shared/code-puppy-acp';
import { unavailableCodePuppy } from '../../shared/code-puppy-acp';

type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout | null };
const MAX_FRAME = 512 * 1024;
const MAX_EVENTS = 100;
const MAX_PROMPT = 20000;

function message(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function safeString(value: unknown, max = 4000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
}

/**
 * ACP v1 JSON-RPC over the installed `code-puppy --acp` stdio process.
 * No GUI, local HTTP, WebSocket or configuration writes from this client.
 * Client capabilities deliberately advertise no fs/terminal delegation;
 * permissions fail closed pending a reviewed approval UI.
 */
export class CodePuppyAcpClient extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private nextRequest = 1;
  private eventId = 0;
  private inbound = '';
  private snapshot: CodePuppySnapshot = unavailableCodePuppy();
  private generation = 0;

  getSnapshot(): CodePuppySnapshot {
    return { ...this.snapshot, events: [...this.snapshot.events] };
  }

  private publish() {
    this.emit('changed', this.getSnapshot());
  }

  private add(kind: CodePuppyChatEvent['kind'], text: string) {
    const cleaned = safeString(text, kind === 'user' ? MAX_PROMPT : 4000);
    if (!cleaned) return;
    const last = this.snapshot.events.at(-1);
    if (last && kind === 'text' && last.kind === kind && last.text.length + cleaned.length < 12000) {
      last.text += cleaned;
    } else {
      this.snapshot.events.push({ id: ++this.eventId, kind, text: cleaned });
    }
    this.snapshot.events = this.snapshot.events.slice(-MAX_EVENTS);
    this.publish();
  }

  private write(frame: unknown) {
    if (!this.process || !this.process.stdin.writable) throw new Error('Code Puppy is not connected');
    this.process.stdin.write(JSON.stringify(frame) + '\n');
  }

  private rpc(method: string, params: unknown, timeoutMs = 0): Promise<unknown> {
    const id = this.nextRequest++;
    return new Promise((resolve, reject) => {
      const timer = timeoutMs ? setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(method + ' timed out'));
      }, timeoutMs) : null;
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.write({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        this.pending.delete(id);
        if (timer) clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('Failed to send ACP request'));
      }
    });
  }

  private receiveLine(line: string) {
    let frame: Record<string, unknown> | null = null;
    try {
      frame = message(JSON.parse(line));
    } catch {
      return;
    }
    if (!frame || frame.jsonrpc !== '2.0') return;
    if (typeof frame.method !== 'string' && typeof frame.id === 'number' && this.pending.has(frame.id) && (Object.hasOwn(frame, 'result') || Object.hasOwn(frame, 'error'))) {
      const pending = this.pending.get(frame.id)!;
      this.pending.delete(frame.id);
      if (pending.timer) clearTimeout(pending.timer);
      const error = message(frame.error);
      if (error) pending.reject(new Error('Code Puppy ACP request failed (' + (Number(error.code) || 'unknown') + ')'));
      else pending.resolve(frame.result);
      return;
    }
    if (typeof frame.method !== 'string') return;
    if (frame.id !== undefined) {
      // ACP can ask for approvals. Until a native consent UI is built, deny.
      if (frame.method === 'session/request_permission') {
        this.write({ jsonrpc: '2.0', id: frame.id, result: { outcome: { outcome: 'cancelled' } } });
      } else {
        this.write({ jsonrpc: '2.0', id: frame.id, error: { code: -32601, message: 'Client capability not available' } });
      }
      return;
    }
    if (frame.method !== 'session/update') return;
    const params = message(frame.params);
    if (!params || params.sessionId !== this.snapshot.sessionId) return;
    const update = message(params.update);
    if (!update) return;
    const kind = update.sessionUpdate;
    const content = message(update.content);
    if (kind === 'agent_message_chunk' && typeof content?.text === 'string') {
      // Preserve the complete chunk across bounded UI events rather than cutting it at 4,000.
      const text = content.text;
      for (let offset = 0; offset < text.length; offset += 4000) {
        this.add('text', text.slice(offset, offset + 4000));
      }
    }
    if (kind === 'agent_thought_chunk') this.add('thinking', safeString(content?.text, 600));
    if (kind === 'tool_call' || kind === 'tool_call_update') {
      this.add('tool', safeString(update.title, 180) || 'Agent tool activity');
    }
  }

  private consume(chunk: Buffer | string) {
    this.inbound += String(chunk);
    if (this.inbound.length > MAX_FRAME) {
      this.fail('Code Puppy sent an oversized ACP message');
      return;
    }
    let index;
    while ((index = this.inbound.indexOf('\n')) >= 0) {
      const line = this.inbound.slice(0, index).trim();
      this.inbound = this.inbound.slice(index + 1);
      if (line.length > MAX_FRAME) {
        this.fail('Code Puppy sent an oversized ACP message');
        return;
      }
      if (line) {
        try {
          this.receiveLine(line);
        } catch {
          this.fail('Unable to handle Code Puppy ACP reply');
          return;
        }
      }
    }
  }

  private fail(reason: string) {
    const child = this.process;
    this.process = null;
    this.generation++;
    this.inbound = '';
    this.snapshot.connection = 'error';
    this.snapshot.error = reason;
    this.snapshot.sessionId = null;
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
    if (child) child.kill();
    this.publish();
  }

  async start(projectDir: string, executable = process.env.CODE_PUPPY_EXECUTABLE || 'code-puppy', args: string[] = ['--acp']) {
    this.stop();
    this.snapshot = { connection: 'connecting', projectDir, sessionId: null, events: [], error: null };
    this.eventId = 0;
    this.publish();
    const generation = ++this.generation;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(executable, args, {
        cwd: projectDir,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NO_VERSION_UPDATE: '1' }
      });
    } catch {
      this.fail('Could not launch Code Puppy executable');
      throw new Error('Could not launch Code Puppy executable');
    }
    this.process = child;
    child.stdin.on('error', () => {
      if (generation === this.generation) this.fail('Code Puppy ACP input pipe closed unexpectedly');
    });
    child.stdout.on('error', () => {
      if (generation === this.generation) this.fail('Code Puppy ACP output pipe failed');
    });
    child.stderr.on('error', () => {
      // The diagnostic stream isn't part of the protocol; ignore its errors.
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (part: string) => { if (generation === this.generation) this.consume(part); });
    // Do not forward stderr: provider logs can contain credentials or prompt contents.
    child.stderr.on('data', () => undefined);
    child.on('error', () => {
      if (generation === this.generation) this.fail('Code Puppy executable could not start');
    });
    child.on('exit', (code) => {
      if (generation === this.generation) this.fail('Code Puppy ACP process exited (code ' + String(code) + ')');
    });

    try {
      const initialized = message(await this.rpc('initialize', {
        protocolVersion: 1, clientCapabilities: {}
      }, 10000));
      if (!initialized || typeof initialized.protocolVersion !== 'number' || !message(initialized.agentCapabilities)) {
        throw new Error('Installed Code Puppy did not negotiate ACP v1');
      }
      if (generation !== this.generation) throw new Error('Connection replaced');
      const session = message(await this.rpc('session/new', { cwd: projectDir, mcpServers: [] }, 15000));
      if (!session || typeof session.sessionId !== 'string' || !session.sessionId || session.sessionId.length > 256) {
        throw new Error('Code Puppy did not provide a valid session ID');
      }
      if (generation !== this.generation) throw new Error('Connection replaced');
      this.snapshot.sessionId = session.sessionId;
      this.snapshot.connection = 'ready';
      this.publish();
      return this.getSnapshot();
    } catch (error) {
      if (generation === this.generation) this.fail(error instanceof Error ? error.message : 'ACP negotiation failed');
      throw error;
    }
  }

  async prompt(input: string, timeoutMs = 120000) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
      throw new Error('Prompt timeout must be between 100 and 120000ms');
    }
    const text = input.trim();
    if (!text || text.length > MAX_PROMPT) throw new Error('Prompt must contain 1 to 20000 characters');
    if (this.snapshot.connection !== 'ready' || !this.snapshot.sessionId) throw new Error('Start Code Puppy before sending a prompt');
    this.snapshot.connection = 'working';
    this.add('user', text);
    const sessionId = this.snapshot.sessionId;
    try {
      const result = message(await this.rpc('session/prompt', {
        sessionId,
        prompt: [{ type: 'text', text }]
      }, timeoutMs));
      if (this.snapshot.sessionId === sessionId) {
        this.snapshot.connection = 'ready';
        this.add('status', 'Turn ended: ' + (safeString(result?.stopReason, 60) || 'unknown'));
      }
      return this.getSnapshot();
    } catch (error) {
      if (this.snapshot.sessionId === sessionId) {
        const reason = error instanceof Error ? error.message : 'unknown transport error';
        this.fail('Code Puppy prompt did not complete: ' + safeString(reason, 180));
      }
      throw new Error('Code Puppy prompt failed; runtime state is unknown, reconnect before retrying');
    }
  }

  cancel() {
    if (this.snapshot.connection !== 'working' || !this.snapshot.sessionId) return;
    this.write({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.snapshot.sessionId } });
    this.add('status', 'Cancellation requested; waiting for agent confirmation');
  }

  stop() {
    const child = this.process;
    this.process = null;
    this.generation++;
    this.inbound = '';
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new Error('Code Puppy connection stopped'));
    }
    this.pending.clear();
    if (child) child.kill();
    this.snapshot = unavailableCodePuppy();
    this.publish();
  }
}

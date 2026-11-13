/**
 * Small, deliberately conservative projection of puppy_gui ChatBridge events.
 * A worker response is NOT a passing verification check.
 */
export const WORKER_KEYS = [
  'omega-researcher',
  'omega-builder',
  'omega-tester',
  'omega-reviewer'
] as const;

export type WorkerKey = (typeof WORKER_KEYS)[number];
export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
export type WorkflowPhase = 'idle' | 'planning' | 'delegating' | 'attention' | 'finished' | 'cancelled';
export type WorkerPhase = 'idle' | 'running' | 'responded' | 'failed' | 'unknown' | 'cancelled';

export interface WorkerSignal {
  phase: WorkerPhase;
  detail: string;
  model: string | null;
  updatedAt: number | null;
}

export interface WorkflowActivity {
  id: number;
  timestamp: number;
  label: string;
  lane: WorkerKey | null;
  tone: 'neutral' | 'active' | 'success' | 'warning' | 'error';
}

export interface WorkflowTelemetry {
  /** True only after the user explicitly enables monitoring. */
  monitoring: boolean;
  connection: ConnectionState;
  phase: WorkflowPhase;
  agent: string | null;
  activity: string;
  workers: Record<WorkerKey, WorkerSignal>;
  attention: { kind: 'error' | 'request'; message: string } | null;
  lastEventAt: number | null;
  turnCount: number;
  events: WorkflowActivity[];
}

const EMPTY_WORKER: WorkerSignal = { phase: 'idle', detail: 'No worker activity observed', model: null, updatedAt: null };

function freshWorkers(): Record<WorkerKey, WorkerSignal> {
  return Object.fromEntries(WORKER_KEYS.map((key) => [key, { ...EMPTY_WORKER }])) as Record<WorkerKey, WorkerSignal>;
}

export function initialWorkflow(connection: ConnectionState = 'disconnected'): WorkflowTelemetry {
  return {
    monitoring: false,
    connection,
    phase: 'idle',
    agent: null,
    activity: 'Waiting for runtime events',
    workers: freshWorkers(),
    attention: null,
    lastEventAt: null,
    turnCount: 0,
    events: []
  };
}

function finishRunningWorkers(
  workers: Record<WorkerKey, WorkerSignal>,
  status: 'unknown' | 'cancelled',
  message: string
): Record<WorkerKey, WorkerSignal> {
  return Object.fromEntries(WORKER_KEYS.map((key) => [
    key,
    workers[key].phase === 'running'
      ? { ...workers[key], phase: status, detail: message }
      : workers[key]
  ])) as Record<WorkerKey, WorkerSignal>;
}

export function changeWorkflowConnection(previous: WorkflowTelemetry, connection: ConnectionState): WorkflowTelemetry {
  if (previous.connection === connection) return previous;
  const lost = connection === 'disconnected';
  return {
    ...previous,
    connection,
    phase: lost && (previous.phase === 'planning' || previous.phase === 'delegating')
      ? 'idle'
      : previous.phase,
    workers: lost
      ? finishRunningWorkers(previous.workers, 'unknown', 'Connection lost before completion; outcome unknown')
      : previous.workers,
    activity: connection === 'disconnected'
      ? 'Event connection lost; last observations may be stale'
      : connection === 'connecting'
        ? 'Connecting to the local event stream'
        : previous.lastEventAt === null
          ? 'Connected; waiting for runtime events'
          : previous.activity
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, max = 104): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1) + '…';
}

function laneName(value: unknown): WorkerKey | null {
  const name = clean(value, 100).toLowerCase().replace(/[\s_]+/g, '-');
  const normalized = name.startsWith('omega-') ? name : 'omega-' + name;
  return (WORKER_KEYS as readonly string[]).includes(normalized) ? normalized as WorkerKey : null;
}

function addActivity(
  previous: WorkflowTelemetry,
  now: number,
  label: string,
  lane: WorkerKey | null,
  tone: WorkflowActivity['tone']
): WorkflowTelemetry {
  const id = (previous.events.at(-1)?.id ?? 0) + 1;
  return {
    ...previous,
    activity: label,
    lastEventAt: now,
    events: [...previous.events, { id, timestamp: now, label, lane, tone }].slice(-30)
  };
}

function updateWorker(
  previous: WorkflowTelemetry,
  lane: WorkerKey,
  phase: WorkerPhase,
  detail: string,
  model: string | null,
  now: number
): WorkflowTelemetry {
  const previousWorker = previous.workers[lane];
  return {
    ...previous,
    workers: {
      ...previous.workers,
      [lane]: { phase, detail, model: model || previousWorker.model, updatedAt: now }
    }
  };
}

/**
 * Only recognized lifecycle and delegation events change the workflow.
 * Unstructured messages are not interpreted as verification outcomes.
 */
export function reduceWorkflowEvent(previous: WorkflowTelemetry, raw: unknown, now: number): WorkflowTelemetry {
  const event = record(raw);
  if (!event) return previous;
  const type = event.type;
  if (typeof type !== 'string') return previous;

  if (type === 'turn_start') {
    const agent = clean(event.agent, 64) || 'Code Puppy';
    return addActivity({
      ...previous,
      phase: 'planning',
      agent,
      attention: null,
      workers: freshWorkers(),
      turnCount: previous.turnCount + 1
    }, now, 'Agent turn started: ' + agent, null, 'active');
  }

  if (type === 'turn_end') {
    const failed = previous.attention?.kind === 'error';
    return addActivity({
      ...previous,
      phase: failed ? 'attention' : 'finished',
      workers: finishRunningWorkers(previous.workers, 'unknown', 'Turn ended without a worker completion event')
    }, now, failed ? 'Turn ended after an error; inspect chat' : 'Turn ended; verification not confirmed', null, failed ? 'error' : 'neutral');
  }

  if (type === 'turn_cancelled' || type === 'cancelling') {
    const cancelled = type === 'turn_cancelled';
    return addActivity({
      ...previous,
      phase: cancelled ? 'cancelled' : 'attention',
      workers: cancelled
        ? finishRunningWorkers(previous.workers, 'cancelled', 'Turn cancelled before worker completion')
        : previous.workers
    }, now, cancelled ? 'Agent turn cancelled' : 'Cancellation requested', null, 'warning');
  }

  if (type === 'error') {
    const message = clean(event.text, 155) || 'Runtime reported an error';
    return addActivity({
      ...previous,
      phase: 'attention',
      attention: { kind: 'error', message }
    }, now, 'Runtime error: ' + message, null, 'error');
  }

  if (type === 'request') {
    const data = record(event.data) ?? {};
    const kind = clean(event.kind, 60) || 'Request';
    const message = kind === 'ConfirmationRequest'
      ? clean(data.title ?? data.description, 120) || 'Action requires confirmation'
      : kind === 'UserInputRequest'
        ? 'Input requested in harness chat'
        : kind === 'SelectionRequest'
          ? 'Selection requested in harness chat'
          : 'Review the request in harness chat';
    return addActivity({
      ...previous,
      phase: 'attention',
      attention: { kind: 'request', message }
    }, now, message + ' · open harness chat', null, 'warning');
  }

  if (type !== 'message') return previous;
  const kind = event.kind;
  const data = record(event.data) ?? {};
  const lane = laneName(data.agent_name);
  if (!lane) return previous;
  const model = clean(data.model_name, 64) || null;

  if (kind === 'SubAgentInvocationMessage') {
    const detail = clean(data.prompt, 105) || 'Delegated a task';
    const next = updateWorker({ ...previous, phase: 'delegating' }, lane, 'running', detail, model, now);
    return addActivity(next, now, lane + ': task delegated · ' + detail, lane, 'active');
  }

  if (kind === 'SubAgentStatusMessage') {
    const state = clean(data.status, 60).toLowerCase();
    const failed = ['error', 'failed', 'failure'].includes(state);
    const responded = ['completed', 'done', 'success'].includes(state);
    const phase: WorkerPhase = failed ? 'failed' : responded ? 'responded' : 'running';
    const detail = failed
      ? clean(data.error_message, 110) || 'Worker reported failure'
      : clean(data.current_tool, 90) || ('Worker reported ' + (state || 'running'));
    const next = updateWorker({ ...previous, phase: failed ? 'attention' : 'delegating' }, lane, phase, detail, model, now);
    const withAttention = failed ? { ...next, attention: { kind: 'error' as const, message: lane + ': ' + detail } } : next;
    return addActivity(withAttention, now, lane + ': ' + detail, lane, failed ? 'error' : responded ? 'success' : 'active');
  }

  if (kind === 'SubAgentResponseMessage') {
    const detail = clean(data.response, 115) || 'Worker returned a response';
    const next = updateWorker({ ...previous, phase: 'delegating' }, lane, 'responded', detail, model, now);
    return addActivity(next, now, lane + ': response received (not yet verified)', lane, 'success');
  }

  return previous;
}

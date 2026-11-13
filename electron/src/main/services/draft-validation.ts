import type { OmegaRun, RunStatus } from '../../shared/types';

const WORKERS = new Set(['omega-builder', 'omega-reviewer', 'omega-tester', 'omega-researcher']);

function validString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validId(value: unknown): value is string {
  return validString(value, 100) && /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * The Electron renderer only creates draft records. It cannot assert that
 * an agent ran, a check passed, or approval was granted by writing runs.json.
 */
export function assertDraftRun(value: unknown): asserts value is OmegaRun & { projectDir: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid draft record.');
  }
  const record = value as Partial<OmegaRun>;
  if (!validId(record.id) ||
      !validString(record.goal, 5000) ||
      !validString(record.doneWhen, 2000) ||
      !validString(record.projectDir, 4096) ||
      record.status !== 'draft' ||
      !validString(record.startedAt, 100) ||
      !validString(record.updatedAt, 100) ||
      !Number.isFinite(Date.parse(record.startedAt)) ||
      !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new Error('Draft is missing required project, goal, status or timestamps.');
  }
  if (!Array.isArray(record.briefs) || record.briefs.length < 1 || record.briefs.length > 4) {
    throw new Error('Draft must include one to four worker briefs.');
  }
  const agents = new Set<string>();
  const ids = new Set<string>();
  for (const worker of record.briefs) {
    if (!worker || !validId(worker.id) ||
        worker.parentRunId !== record.id ||
        !validString(worker.childAgent, 50) ||
        !WORKERS.has(worker.childAgent) ||
        !validString(worker.model, 120) ||
        !validString(worker.objective, 5000) ||
        !validString(worker.brief, 30000) ||
        worker.status !== 'draft' ||
        worker.checkResult !== null ||
        worker.checkCommand !== null ||
        worker.resultSummary !== null ||
        worker.error !== null ||
        agents.has(worker.childAgent) || ids.has(worker.id)) {
      throw new Error('Invalid worker draft or unverified execution claim.');
    }
    agents.add(worker.childAgent);
    ids.add(worker.id);
  }
}

const RUN_STATUSES = new Set<RunStatus>([
  'draft', 'queued', 'running', 'requires_approval', 'completed',
  'incomplete', 'failed', 'canceled', 'unknown'
]);

/**
 * History is read-only evidence from Omega's own file, not live telemetry.
 * Fail explicitly on corrupted records rather than silently wiping them.
 * Historical status fields are allowed for compatibility, but not writable
 * through the draft-only IPC.
 */
export function assertStoredRuns(value: unknown): asserts value is OmegaRun[] {
  if (!Array.isArray(value) || value.length > 2000) {
    throw new Error('Saved history must be an array of at most 2000 records.');
  }
  for (const run of value) {
    if (!run || typeof run !== 'object' || Array.isArray(run) ||
        !validId(run.id) ||
        !validString(run.goal, 5000) ||
        !validString(run.doneWhen, 2000) ||
        !RUN_STATUSES.has(run.status) ||
        (run.projectDir !== null && !validString(run.projectDir, 4096)) ||
        !validString(run.startedAt, 100) ||
        !Number.isFinite(Date.parse(run.startedAt)) ||
        !validString(run.updatedAt, 100) ||
        !Number.isFinite(Date.parse(run.updatedAt)) ||
        !Array.isArray(run.briefs) || run.briefs.length > 4) {
      throw new Error('Saved history contains a malformed run.');
    }
    for (const worker of run.briefs) {
      if (!worker || !validId(worker.id) || worker.parentRunId !== run.id ||
          !validString(worker.childAgent, 50) ||
          !validString(worker.model, 120) ||
          !validString(worker.objective, 5000) ||
          typeof worker.brief !== 'string' || worker.brief.length > 30000 ||
          !RUN_STATUSES.has(worker.status) ||
          (worker.checkResult !== null && worker.checkResult !== 'pass' && worker.checkResult !== 'fail') ||
          (worker.checkCommand !== null && typeof worker.checkCommand !== 'string') ||
          (worker.resultSummary !== null && typeof worker.resultSummary !== 'string') ||
          (worker.error !== null && typeof worker.error !== 'string')) {
        throw new Error('Saved history contains a malformed worker record.');
      }
    }
  }
}

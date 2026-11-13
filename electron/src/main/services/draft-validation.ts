import type { OmegaRun } from '../../shared/types';

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

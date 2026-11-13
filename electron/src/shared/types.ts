// shared/types.ts
// Puppy Omega One — run / delegation record types.
// Shape follows ant3869/ai-integration-reference,
// architecture/session-and-events.md: a run has stable app-generated IDs,
// a delegation record per worker (parent run, child agent, objective,
// status, artifact/result summary), and a terminal status set —
// completed | incomplete | failed | canceled | unknown. Never treat
// admission (a worker was briefed) as completion.

export type RunStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'requires_approval'
  | 'completed'
  | 'incomplete'
  | 'failed'
  | 'canceled'
  | 'unknown';

export interface DelegationRecord {
  id: string;
  parentRunId: string;
  childAgent: string; // e.g. 'omega-builder'
  model: string; // placeholder alias, e.g. 'claude-sonnet-5-5'
  objective: string;
  brief: string;
  status: RunStatus;
  checkCommand: string | null;
  checkResult: 'pass' | 'fail' | null;
  resultSummary: string | null;
  error: string | null;
}

export interface OmegaRun {
  id: string;
  goal: string;
  doneWhen: string;
  status: RunStatus;
  briefs: DelegationRecord[];
  projectDir: string | null;
  startedAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}


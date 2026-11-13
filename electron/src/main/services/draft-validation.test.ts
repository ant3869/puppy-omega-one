import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OmegaRun } from '../../shared/types';
import { assertDraftRun, assertStoredRuns } from './draft-validation';

function makeDraft(): OmegaRun {
  const now = '2026-11-12T20:00:00.000Z';
  return {
    id: 'draft-001',
    goal: 'Create a project report',
    doneWhen: 'npm test passes',
    status: 'draft',
    projectDir: '/home/user/projects/omega-test',
    startedAt: now,
    updatedAt: now,
    briefs: [{
      id: 'worker-001',
      parentRunId: 'draft-001',
      childAgent: 'omega-builder',
      model: 'configured-by-user',
      objective: 'Create a project report',
      brief: 'Goal: Create a project report\nDone when: npm test passes',
      status: 'draft',
      checkCommand: null,
      checkResult: null,
      resultSummary: null,
      error: null
    }]
  };
}

test('accepts only complete, bounded draft records', () => {
  assert.doesNotThrow(() => assertDraftRun(makeDraft()));
});

test('rejects fabricated completed runs, worker results, and check passes', () => {
  for (const mutate of [
    (record: OmegaRun) => { record.status = 'completed'; },
    (record: OmegaRun) => { record.briefs[0].status = 'running'; },
    (record: OmegaRun) => { record.briefs[0].checkResult = 'pass'; },
    (record: OmegaRun) => { record.briefs[0].resultSummary = 'Verified by Code Puppy'; }
  ]) {
    const record = makeDraft();
    mutate(record);
    assert.throws(() => assertDraftRun(record), /Draft|draft|worker/);
  }
});

test('rejects missing project, invalid IDs, duplicates and oversized payloads', () => {
  const mutations = [
    (record: OmegaRun) => { record.projectDir = null; },
    (record: OmegaRun) => { record.projectDir = ''; },
    (record: OmegaRun) => { record.id = 'bad/id'; },
    (record: OmegaRun) => { record.goal = 'x'.repeat(5001); },
    (record: OmegaRun) => { record.briefs[0].brief = 'a'.repeat(30001); },
    (record: OmegaRun) => { record.briefs[0].parentRunId = 'different-run'; },
    (record: OmegaRun) => { record.briefs[0].childAgent = 'omega-orchestrator'; },
    (record: OmegaRun) => { record.briefs.push({ ...record.briefs[0], id: 'worker-002' }); },
    (record: OmegaRun) => { record.briefs = []; }
  ];
  for (const mutate of mutations) {
    const record = makeDraft();
    mutate(record);
    assert.throws(() => assertDraftRun(record));
  }
});

test('rejects malformed records and impossible timestamps', () => {
  assert.throws(() => assertDraftRun(null));
  assert.throws(() => assertDraftRun([]));
  const record = makeDraft();
  record.startedAt = 'not-a-date';
  assert.throws(() => assertDraftRun(record), /timestamps/);
});

test('accepts different known workers with unique IDs', () => {
  const record = makeDraft();
  record.briefs.push({
    ...record.briefs[0], id: 'worker-002', childAgent: 'omega-tester', model: 'local-model'
  });
  assert.doesNotThrow(() => assertDraftRun(record));
});

test('reads historical records without claiming they are verified live activity', () => {
  const record = makeDraft();
  record.status = 'completed';
  record.briefs[0].status = 'completed';
  record.briefs[0].checkResult = 'pass';
  assert.doesNotThrow(() => assertStoredRuns([record]));
  assert.throws(() => assertDraftRun(record), /Draft|draft/);
});

test('rejects malformed saved arrays and nested worker objects', () => {
  assert.throws(() => assertStoredRuns({ runs: [] }), /Saved history/);
  const record = makeDraft();
  (record.briefs[0] as unknown as Record<string, unknown>).childAgent = null;
  assert.throws(() => assertStoredRuns([record]), /worker record/);
  assert.doesNotThrow(() => assertStoredRuns(new Array(2001).fill(makeDraft())));
});

test('accepts empty history while leaving the user data untouched', () => {
  assert.doesNotThrow(() => assertStoredRuns([]));
});

test('legacy text above new draft limits remains readable without migration', () => {
  const record = makeDraft();
  record.goal = 'G'.repeat(7000);
  record.doneWhen = 'D'.repeat(3000);
  record.briefs[0].objective = record.goal;
  record.briefs[0].brief = 'B'.repeat(40000);
  assert.doesNotThrow(() => assertStoredRuns([record]));
  assert.throws(() => assertDraftRun(record), /Draft|draft/);
});

test('existing history can grow beyond 2000 entries without being hidden', () => {
  const history = Array.from({ length: 2001 }, (_, i) => ({
    ...makeDraft(), id: 'draft-' + i,
    briefs: [{ ...makeDraft().briefs[0], parentRunId: 'draft-' + i }]
  }));
  assert.doesNotThrow(() => assertStoredRuns(history));
});

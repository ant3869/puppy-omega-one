import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkflowActivity } from './workflow-events';
import { filterEventLog } from './event-log';

const make = (id: number, label: string, tone: WorkflowActivity['tone'] = 'neutral', lane: WorkflowActivity['lane'] = null): WorkflowActivity =>
  ({ id, timestamp: id * 1000, label, tone, lane });

test('newest-first events without mutating the input list', () => {
  const entries = [make(1, 'started'), make(2, 'builder delegated', 'active', 'omega-builder')];
  const result = filterEventLog(entries, { query: '', tone: 'all', lane: 'all' });
  assert.deepEqual(result.map((e) => e.id), [2, 1]);
  assert.deepEqual(entries.map((e) => e.id), [1, 2]);
});

test('filters by severity, worker, and case-insensitive summary text', () => {
  const events = [
    make(1, 'Worker BUILDER invoked', 'active', 'omega-builder'),
    make(2, 'Check ERROR', 'error', 'omega-tester'),
    make(3, 'Tool approval requested', 'warning', null)
  ];
  assert.deepEqual(
    filterEventLog(events, { query: 'error', tone: 'error', lane: 'omega-tester' }).map((e) => e.id),
    [2]
  );
  assert.deepEqual(
    filterEventLog(events, { query: 'BUILDER', tone: 'all', lane: 'all' }).map((e) => e.id),
    [1]
  );
  assert.equal(filterEventLog(events, { query: '', tone: 'error', lane: 'omega-builder' }).length, 0);
});

test('does not surface events outside the bounded 30-item monitor history', () => {
  const events = Array.from({ length: 40 }, (_, i) => make(i + 1, 'event ' + (i + 1)));
  const result = filterEventLog(events, { query: '', tone: 'all', lane: 'all' });
  assert.equal(result.length, 30);
  assert.equal(result[0].id, 40);
  assert.equal(result.at(-1)?.id, 11);
  assert.deepEqual(filterEventLog(events, { query: 'event 1', tone: 'all', lane: 'all' }).map(e => e.id), [
    19, 18, 17, 16, 15, 14, 13, 12, 11
  ]);
});

test('blank search and empty input stay safe and deterministic', () => {
  assert.deepEqual(filterEventLog([], { query: '  ', tone: 'all', lane: 'all' }), []);
});

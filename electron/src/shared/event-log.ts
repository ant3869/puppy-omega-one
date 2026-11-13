import type { WorkflowActivity, WorkerKey } from './workflow-events';

export type EventTone = WorkflowActivity['tone'];
export type ToneFilter = 'all' | EventTone;
export type LaneFilter = 'all' | WorkerKey;

export interface EventFilter {
  query: string;
  tone: ToneFilter;
  lane: LaneFilter;
}

const MAX_VISIBLE = 30;

/** Search only bounded, already-sanitized projected event summaries. */
export function filterEventLog(events: readonly WorkflowActivity[], filter: EventFilter): WorkflowActivity[] {
  const q = filter.query.trim().toLocaleLowerCase();
  const bounded = events.slice(-MAX_VISIBLE);
  return bounded.filter((event) => (
    (filter.tone === 'all' || event.tone === filter.tone) &&
    (filter.lane === 'all' || event.lane === filter.lane) &&
    (!q || event.label.toLocaleLowerCase().includes(q) ||
      (event.lane ?? '').toLocaleLowerCase().includes(q))
  )).reverse();
}

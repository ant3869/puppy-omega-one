import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock3, Radio, ScrollText, Search, ShieldAlert } from 'lucide-react';
import { filterEventLog, type LaneFilter, type ToneFilter } from '@shared/event-log';
import { WORKER_KEYS, type WorkflowTelemetry } from '@shared/workflow-events';

const TONES: Array<{ value: ToneFilter; label: string }> = [
  { value: 'all', label: 'All activity' },
  { value: 'error', label: 'Errors' },
  { value: 'warning', label: 'Warnings / approvals' },
  { value: 'active', label: 'Active' },
  { value: 'success', label: 'Worker responses' },
  { value: 'neutral', label: 'Informational' }
];

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleTimeString();
}

export default function EventLogPage() {
  const [telemetry, setTelemetry] = useState<WorkflowTelemetry | null>(null);
  const [query, setQuery] = useState('');
  const [tone, setTone] = useState<ToneFilter>('all');
  const [lane, setLane] = useState<LaneFilter>('all');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let receivedPush = false;
    const unsub = window.omega.workflow.subscribe((value) => {
      receivedPush = true;
      if (alive) setTelemetry(value);
    });
    void window.omega.workflow.get().then((value) => {
      if (alive && !receivedPush) setTelemetry(value);
    }).catch((cause) => {
      if (alive && !receivedPush) setError(cause instanceof Error ? cause.message : 'Could not read local event status.');
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const monitoring = telemetry?.monitoring === true;
  const online = telemetry?.connection === 'connected';
  const displayed = useMemo(
    () => filterEventLog(telemetry?.events ?? [], { query, tone, lane }),
    [telemetry?.events, query, tone, lane]
  );

  async function toggleMonitor() {
    setPending(true);
    setError(null);
    try {
      if (monitoring) await window.omega.workflow.disconnect();
      else await window.omega.workflow.connect();
      // The pushed snapshot is authoritative; an IPC reply can be older.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Monitor connection could not be changed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="omega-log">
      <header className="omega-log-header">
        <div>
          <div className="omega-eyebrow"><ScrollText size={14} /> OBSERVATION / IN-MEMORY ONLY</div>
          <h2>Event log</h2>
          <p>Read-only summaries of observed ChatBridge events. No raw transcripts, persisted logs, prompt sending, or automatic session actions.</p>
        </div>
        <button
          type="button"
          className="omega-monitor-toggle"
          aria-pressed={monitoring}
          disabled={pending}
          onClick={() => void toggleMonitor()}
        >
          <Radio size={14} />
          {pending ? 'Updating…' : monitoring ? 'Stop monitor' : 'Connect monitor'}
        </button>
      </header>

      <div className="omega-log-status" aria-live="polite">
        <span className={'omega-log-light ' + (monitoring && online ? 'is-connected' : '')} />
        <strong>{!monitoring ? 'MONITOR OFF' : online ? 'OBSERVING · SESSION UNVERIFIED' : telemetry?.connection === 'connecting' ? 'CONNECTING…' : 'STREAM DISCONNECTED'}</strong>
        <span>Up to 30 sanitized summaries · not execution proof</span>
      </div>

      <div className="omega-log-controls">
        <label className="omega-log-search">
          <Search size={15} />
          <span className="sr-only">Search event summaries</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search event summaries…" />
        </label>
        <label>
          <span className="sr-only">Filter event severity</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as ToneFilter)}>
            {TONES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter worker lane</span>
          <select value={lane} onChange={(e) => setLane(e.target.value as LaneFilter)}>
            <option value="all">All workers</option>
            {WORKER_KEYS.map(worker => <option key={worker} value={worker}>{worker.replace('omega-', '')}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="omega-log-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      <div className="omega-log-board">
        <div className="omega-log-board-head">
          <span>RECENT EVENTS / NEWEST FIRST</span>
          <span>{displayed.length} SHOWN · {telemetry?.events.length ?? 0} HELD</span>
        </div>
        {displayed.length ? (
          <ol className="omega-log-list" aria-label="Observed event summaries">
            {displayed.map(event => (
              <li key={event.id} className={'omega-log-entry is-' + event.tone}>
                <span className="omega-log-entry-time"><Clock3 size={12} /> <time dateTime={new Date(event.timestamp).toISOString()}>{formatTime(event.timestamp)}</time></span>
                <span className={'omega-log-severity is-' + event.tone}>{event.tone.toUpperCase()}</span>
                <span className="omega-log-entry-body">
                  <strong>{event.lane ? event.lane.replace('omega-', '').toUpperCase() : 'ORCHESTRATION'}</strong>
                  <span>{event.label}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="omega-log-empty">
            {telemetry?.events.length
              ? 'No retained events match these filters.'
              : monitoring
                ? 'No events observed yet. Connection alone does not prove a live task or correct session.'
                : 'The monitor is off. Connect only when you intend to observe the local GUI.'}
          </div>
        )}
      </div>
      <p className="omega-log-disclaimer"><ShieldAlert size={15} /> Stream event/session association with your installed Puppy GUI has not been verified. A worker response or local draft is not a passing check. This page does not start tasks or approve tools.</p>
    </section>
  );
}

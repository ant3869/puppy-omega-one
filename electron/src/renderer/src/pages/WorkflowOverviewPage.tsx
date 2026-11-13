import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, CircleAlert, GitBranch, Pause, Play, Radio, RotateCcw, ShieldCheck, Zap } from 'lucide-react';
import type { OmegaRun, PuppyStatus, RunStatus } from '@shared/types';
import type { WorkerKey, WorkflowTelemetry } from '@shared/workflow-events';
import { tokens } from '../lib/tokens';

type LaneKey = WorkerKey;
type Phase = 'goal' | 'orchestrate' | 'dispatch' | 'check' | 'verify' | 'complete';
type Lane = { key: LaneKey; label: string; specialty: string; x: number; cx: number };

const LANES: Lane[] = [
  { key: 'omega-researcher', label: 'RESEARCH', specialty: 'Explore context', x: 56, cx: 165 },
  { key: 'omega-builder', label: 'BUILD', specialty: 'Implement changes', x: 346, cx: 455 },
  { key: 'omega-tester', label: 'TEST', specialty: 'Execute checks', x: 636, cx: 745 },
  { key: 'omega-reviewer', label: 'REVIEW', specialty: 'Inspect quality', x: 926, cx: 1035 }
];

const PHASES: Phase[] = ['goal', 'orchestrate', 'dispatch', 'check', 'verify', 'complete'];
const EXAMPLES: Record<Phase, string> = {
  goal: 'Goal accepted · defining success criteria',
  orchestrate: 'Orchestrator planning and preparing briefs',
  dispatch: 'Delegating scoped tasks to specialist workers',
  check: 'Checking worker results against acceptance criteria',
  verify: 'Orchestrator independently verifying results',
  complete: 'Example cycle complete · ready for the next goal'
};

function statusColor(status: RunStatus): string {
  if (status === 'completed') return tokens.status.pass;
  if (status === 'failed' || status === 'unknown') return tokens.status.fail;
  if (status === 'running') return tokens.accent.primary;
  if (status === 'requires_approval' || status === 'incomplete') return '#f2b968';
  return tokens.text.tertiary;
}

function statusLabel(status: RunStatus): string {
  return status.replace(/_/g, ' ').toUpperCase();
}

function trimText(text: string | null | undefined, max = 72): string {
  if (!text) return 'No activity details recorded';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export default function WorkflowOverviewPage({
  server,
  reduceMotion,
  preferLive,
  onCompose,
  onChat,
  onRuns
}: {
  server: PuppyStatus | null;
  reduceMotion: boolean;
  preferLive: boolean;
  onCompose: () => void;
  onChat: () => void;
  onRuns: () => void;
}) {
  const [mode, setMode] = useState<'demo' | 'records' | 'live'>('demo');
  const [telemetry, setTelemetry] = useState<WorkflowTelemetry | null>(null);
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const [runs, setRuns] = useState<OmegaRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LaneKey>('omega-builder');

  useEffect(() => {
    if (preferLive) setMode('live');
  }, [preferLive]);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const records = await window.omega.runs.list();
        if (alive) {
          setRuns(records);
          setLoadError(null);
        }
      } catch (error) {
        if (alive) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setRuns([]);
        }
      }
    };
    void refresh();
    const handle = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const unsubscribe = window.omega.workflow.subscribe((snapshot) => {
      if (alive) setTelemetry(snapshot);
    });
    void window.omega.workflow.get().then((snapshot) => {
      if (alive) {
        setTelemetry((previous) => previous && (previous.lastEventAt ?? 0) > (snapshot.lastEventAt ?? 0) ? previous : snapshot);
      }
    }).catch(() => { if (alive) setTelemetry(null); });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'demo' || !playing || reduceMotion) return;
    const handle = setInterval(() => setTick((previous) => previous + 1), 1800);
    return () => clearInterval(handle);
  }, [mode, playing, reduceMotion]);

  const phase = PHASES[tick % PHASES.length];
  const latest = runs[0] ?? null;
  const demo = mode === 'demo';
  const live = mode === 'live';
  const connected = telemetry?.connection === 'connected';
  const liveWorker = telemetry?.workers[selected] ?? null;
  const liveAttention = telemetry?.attention ?? null;
  const currentLane = LANES.find((lane) => lane.key === selected) ?? LANES[1];
  const record = latest?.briefs.find((brief) => brief.childAgent === selected) ?? null;
  const hasFailure = live
    ? connected && Boolean(liveAttention?.kind === 'error' || Object.values(telemetry?.workers ?? {}).some((worker) => worker.phase === 'failed'))
    : !demo && Boolean(latest?.status === 'failed' || latest?.briefs.some((brief) => brief.status === 'failed' || brief.checkResult === 'fail'));
  const isOrchestrating = demo ? phase === 'orchestrate' : live
    ? connected && (telemetry?.phase === 'planning' || telemetry?.phase === 'delegating')
    : latest?.status === 'running';
  const isDispatching = demo ? phase === 'dispatch' : live
    ? connected && telemetry?.phase === 'delegating' && Object.values(telemetry.workers).some((worker) => worker.phase === 'running')
    : latest?.status === 'running';
  const isChecking = demo ? phase === 'check' : live
    ? false
    : Boolean(latest?.briefs.some((brief) => brief.checkResult !== null));
  const isVerifying = demo ? phase === 'verify' || phase === 'complete' : live
    ? false
    : latest?.status === 'completed';
  const goalActive = demo ? phase === 'goal' : live
    ? connected && telemetry?.phase === 'planning'
    : latest?.status === 'running';

  const checks = useMemo(
    () => LANES.map((lane) => {
      const item = latest?.briefs.find((brief) => brief.childAgent === lane.key);
      const liveSignal = telemetry?.workers[lane.key];
      return { lane, item, color: demo
        ? (phase === 'check' || phase === 'verify' || phase === 'complete' ? tokens.status.pass : tokens.text.tertiary)
        : live
          ? (connected && liveSignal?.phase === 'failed' ? tokens.status.fail : tokens.text.tertiary)
          : item
            ? (item.checkResult === 'pass' ? tokens.status.pass : item.checkResult === 'fail' ? tokens.status.fail : tokens.text.tertiary)
            : tokens.text.tertiary };
    }),
    [latest, demo, live, phase, connected, telemetry]
  );

  const activity = demo
    ? EXAMPLES[phase]
    : live
      ? telemetry?.connection === 'connected'
        ? telemetry.activity
        : telemetry?.activity ?? 'Connecting to local ChatBridge event stream'
      : latest
        ? latest.status === 'draft'
          ? 'Draft composed · not submitted to the harness'
          : trimText(record?.resultSummary ?? record?.error ?? ('Saved run status: ' + latest.status), 115)
        : 'No saved runs · compose a brief or try the demo';

  return (
    <div className="omega-home">
      <section className="omega-home-heading">
        <div>
          <div className="omega-eyebrow"><span className="omega-eyebrow-dot" /> OMEGA / ORCHESTRATION SYSTEM</div>
          <h2>Watch the work <em>happen.</em></h2>
          <p>One goal. An orchestrator. Specialist agents. Every result checked.</p>
        </div>
        <div className="omega-home-actions">
          <button className="omega-button omega-button-secondary" onClick={onChat}>{preferLive ? 'Close chat panel' : 'Open chat beside flow'} <ArrowRight size={15} /></button>
          <button className="omega-button omega-button-primary" onClick={onCompose}><Zap size={15} /> Compose a run</button>
        </div>
      </section>

      <section className="omega-workflow-panel" aria-label="Omega orchestration workflow">
        <div className="omega-panel-toolbar">
          <div className="omega-panel-title"><GitBranch size={15} /> WORKFLOW MAP <span className="omega-panel-number">/ 01</span></div>
          <div className="omega-toolbar-right">
            <div className="omega-mode-picker" aria-label="Workflow data source">
              <button className={demo ? 'is-selected' : ''} aria-pressed={demo} onClick={() => setMode('demo')}>Demo</button>
              <button className={live ? 'is-selected' : ''} aria-pressed={live} onClick={() => setMode('live')}>Live</button>
              <button className={mode === 'records' ? 'is-selected' : ''} aria-pressed={mode === 'records'} onClick={() => setMode('records')}>Saved runs</button>
            </div>
            {demo && (
              <button className="omega-icon-button" onClick={() => setPlaying(!playing)} title={playing ? 'Pause animation' : 'Play animation'} aria-label={playing ? 'Pause demo' : 'Play demo'}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
            )}
            {demo && <button className="omega-icon-button" onClick={() => setTick(0)} title="Restart demo" aria-label="Restart demo"><RotateCcw size={15} /></button>}
            <span className={'omega-source-label ' + (demo ? 'is-demo' : '')}>{demo ? 'SIMULATED · NOT LIVE' : live ? (connected ? 'LIVE EVENTS · CHECKS UNVERIFIED' : 'EVENT STREAM OFFLINE') : 'LOCAL RECORDS · NOT TELEMETRY'}</span>
          </div>
        </div>
        <div className={'omega-diagram ' + (reduceMotion ? 'reduce-motion' : '')}>
          <svg viewBox="0 0 1200 722" aria-label="Goal flows to orchestrator, out to researcher, builder, tester, and reviewer, through checks, then back for final verification" role="img">
            <defs>
              <filter id="omega-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="omega-central" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#332719" /><stop offset="55%" stopColor="#151b22" /><stop offset="100%" stopColor="#10292b" />
              </linearGradient>
              <marker id="omega-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1 1 L7 4 L1 7" fill="none" stroke="#57c9d5" strokeWidth="1.5" />
              </marker>
            </defs>

            <g className="omega-grid-lines" aria-hidden="true">
              {Array.from({ length: 21 }, (_, i) => <line key={'v' + i} x1={i * 60} y1="0" x2={i * 60} y2="722" />)}
              {Array.from({ length: 13 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 60} x2="1200" y2={i * 60} />)}
            </g>

            <g className="omega-connections" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path className="omega-connection-base" d="M600 102 V153" />
              <path className={'omega-connection-energy ' + (goalActive || isOrchestrating ? 'is-lit' : '')} d="M600 102 V153" />
              <path className="omega-connection-base" d="M276 209 H374 M826 209 H924" />
              <path className={'omega-connection-energy ' + (isOrchestrating ? 'is-lit' : '')} d="M276 209 H374 M826 209 H924" />
              <path className="omega-connection-base" d="M600 267 V318 M165 318 H1035" />
              <path className={'omega-connection-energy ' + (isDispatching ? 'is-lit' : '')} d="M600 267 V318 M165 318 H1035" />
              {LANES.map((lane) => (
                <g key={lane.key}>
                  <path className="omega-connection-base" d={'M' + lane.cx + ' 318 V352'} />
                  <path className={'omega-connection-energy ' + (isDispatching ? 'is-lit' : '')} d={'M' + lane.cx + ' 318 V352'} />
                  <path className="omega-connection-base" d={'M' + lane.cx + ' 467 V502'} />
                  <path className={'omega-connection-energy ' + (isChecking ? 'is-lit' : '')} d={'M' + lane.cx + ' 467 V502'} />
                  <path className="omega-connection-base" d={'M' + lane.cx + ' 560 V610'} />
                  <path className={'omega-connection-energy ' + (isVerifying ? 'is-lit' : '')} d={'M' + lane.cx + ' 560 V610'} />
                  <path className={'omega-connection-fail ' + ((live ? connected && telemetry?.workers[lane.key]?.phase === 'failed' : !demo && checks.find((c) => c.lane.key === lane.key)?.item?.checkResult === 'fail') ? 'is-lit' : '')} d={'M' + (lane.cx - 62) + ' 532 H' + (lane.x - 14) + ' V403 H' + (lane.x - 1)} />
                </g>
              ))}
              <path className="omega-connection-base" d="M165 610 H1035 M600 610 V638" />
              <path className={'omega-connection-energy ' + (isVerifying ? 'is-lit' : '')} d="M165 610 H1035 M600 610 V638" />
            </g>

            <g className={'omega-node ' + (goalActive ? 'omega-node-lit' : '')}>
              <rect x="403" y="27" width="394" height="75" rx="10" />
              <text className="omega-svg-kicker" x="428" y="54">01 / INTENT</text>
              <text className="omega-svg-label" x="428" y="80">{demo ? 'Define the goal' : live ? 'Current agent turn' : trimText(latest?.goal ?? 'No saved goal', 37)}</text>
              <circle className="omega-port" cx="600" cy="102" r="4" />
            </g>

            <g className="omega-small-node">
              <rect x="50" y="164" width="226" height="90" rx="9" />
              <text className="omega-svg-kicker" x="72" y="189">CONTEXT / MEMORY</text>
              <text className="omega-svg-label-small" x="72" y="219">AGENTS.md + docs/</text>
              <text className="omega-svg-caption" x="72" y="240">Project knowledge</text>
            </g>
            <g className="omega-small-node">
              <rect x="924" y="164" width="226" height="90" rx="9" />
              <text className="omega-svg-kicker" x="946" y="189">RUNTIME / CONTEXT</text>
              <text className="omega-svg-label-small" x="946" y="219">Session + model</text>
              <text className="omega-svg-caption" x="946" y="240">No context % available</text>
            </g>

            <g className={'omega-orchestrator ' + (isOrchestrating ? 'is-active' : '')}>
              <rect x="374" y="150" width="452" height="117" rx="13" fill="url(#omega-central)" />
              <path d="M397 171 H429 M771 247 H803" className="omega-corner-detail" />
              <text className="omega-svg-kicker" x="600" y="178" textAnchor="middle">02 / ORCHESTRATOR</text>
              <text className="omega-orchestrator-label" x="600" y="217" textAnchor="middle">Ω  OMEGA</text>
              <text className="omega-orchestrator-caption" x="600" y="243" textAnchor="middle">PLAN  /  DELEGATE  /  VERIFY</text>
              <circle className="omega-port" cx="600" cy="267" r="4.5" />
            </g>

            <text className="omega-svg-kicker" x="45" y="302">03 / PARALLEL WORKERS</text>
            <text className="omega-svg-caption" x="1152" y="302" textAnchor="end">Select a lane for details</text>

            {LANES.map((lane, index) => {
              const item = checks[index].item;
              const signal = telemetry?.workers[lane.key];
              const active = demo ? phase === 'dispatch' || phase === 'check' : live ? connected && signal?.phase === 'running' : item?.status === 'running';
              const failed = live ? connected && signal?.phase === 'failed' : !demo && (item?.status === 'failed' || item?.checkResult === 'fail');
              const passed = demo ? phase === 'verify' || phase === 'complete' : live ? connected && signal?.phase === 'responded' : item?.checkResult === 'pass';
              const isSelected = selected === lane.key;
              const color = failed ? tokens.status.fail : passed ? (live ? '#57d3ea' : tokens.status.pass) : active ? '#57d3ea' : '#6e8995';
              return (
                <g
                  key={lane.key}
                  role="button"
                  tabIndex={0}
                  aria-label={'Select ' + lane.label + ' worker'}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(lane.key)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(lane.key); } }}
                  className={'omega-worker ' + (active ? 'is-active ' : '') + (isSelected ? 'is-selected ' : '') + (failed ? 'is-failed' : '')}
                >
                  <rect x={lane.x} y="352" width="218" height="115" rx="10" />
                  <rect className="omega-worker-strip" x={lane.x + 1} y="353" width="4" height="113" rx="2" style={{ fill: color }} />
                  <text className="omega-svg-kicker" x={lane.x + 19} y="378">0{index + 1} / AGENT</text>
                  <text className="omega-worker-label" x={lane.x + 19} y="412">{lane.label}</text>
                  <text className="omega-svg-caption" x={lane.x + 19} y="439">{lane.specialty}</text>
                  <circle cx={lane.x + 194} cy="375" r="5" fill={color} className={active ? 'omega-pulse-dot' : ''} />
                  <circle className="omega-port" cx={lane.cx} cy="467" r="3.5" />
                </g>
              );
            })}

            {checks.map(({ lane, item, color }) => (
              <g key={'check-' + lane.key} className="omega-check-node">
                <polygon points={(lane.cx) + ',499 ' + (lane.cx + 66) + ',531 ' + lane.cx + ',563 ' + (lane.cx - 66) + ',531'} style={{ stroke: color, filter: color === tokens.status.pass || color === tokens.status.fail ? 'url(#omega-glow)' : undefined }} />
                <text x={lane.cx} y="536" textAnchor="middle" style={{ fill: color }}>CHECK</text>
                {!demo && (live ? connected && telemetry?.workers[lane.key]?.phase === 'failed' : item?.checkResult === 'fail') && <text x={lane.cx + 83} y="530" className="omega-error-label">RETRY</text>}
              </g>
            ))}

            <g className={'omega-verifier ' + (isVerifying ? 'is-active' : '') + (hasFailure ? ' is-failed' : '')}>
              <rect x="351" y="637" width="498" height="54" rx="12" />
              <text x="600" y="670" textAnchor="middle">{hasFailure ? 'ATTENTION REQUIRED · CHECK FAILED' : '04 / INDEPENDENT VERIFICATION'}</text>
            </g>

            {isDispatching && LANES.map((lane) => <circle key={'junction-' + lane.key} className="omega-junction" cx={lane.cx} cy="318" r="5" />)}
          </svg>
        </div>
        <div className="omega-diagram-footer">
          <div className="omega-playback-activity">
            <span className={'omega-activity-light ' + (demo && playing && !reduceMotion ? 'is-animated' : '')} />
            <span className="omega-activity-prefix">{demo ? 'DEMO EVENT' : live ? 'RUNTIME EVENT' : 'SAVED STATUS'}</span>
            <span className="omega-activity-message">{activity}</span>
          </div>
          <span className="omega-graph-disclaimer">{demo ? 'Illustrative sequence only' : live ? connected ? 'ChatBridge observer · session association not verified' : 'Stream disconnected · no live claims' : 'Local records · not telemetry'}</span>
        </div>
      </section>

      <div className="omega-dashboard-bottom">
        <section className="omega-detail-panel">
          <div className="omega-card-heading"><span>INSPECTOR / {currentLane.label}</span><Activity size={15} /></div>
          <div className="omega-detail-main">
            <div>
              <span className="omega-detail-tag">{demo ? 'EXAMPLE AGENT' : live ? connected ? 'LIVE DELEGATION' : 'STREAM DISCONNECTED' : record ? 'SAVED DELEGATION' : 'NO RECORD'}</span>
              <h3>{currentLane.label.toLowerCase()}</h3>
              <p>{demo ? currentLane.specialty + ' · example activity playback' : live ? trimText(liveWorker?.detail ?? 'Waiting for this worker', 100) : trimText(record?.objective ?? 'No delegation saved for this worker.', 94)}</p>
            </div>
            <div className="omega-detail-status" style={{ color: live ? liveWorker?.phase === 'failed' ? tokens.status.fail : liveWorker?.phase === 'running' ? '#57d3ea' : tokens.text.tertiary : record && !demo ? statusColor(record.status) : tokens.text.tertiary }}>
              {demo ? (phase === 'dispatch' ? 'RUNNING · DEMO' : 'SIMULATED') : live ? (connected ? (liveWorker?.phase ?? 'idle').toUpperCase() : 'DISCONNECTED') : record ? statusLabel(record.status) : 'IDLE'}
            </div>
          </div>
          <div className="omega-inspector-foot">
            <span>MODEL: {demo ? 'Configured in harness' : live ? trimText(liveWorker?.model ?? 'not observed', 29) : trimText(record?.model ?? 'not recorded', 29)}</span>
            <span>{demo ? 'CHECK: DEMO' : live ? 'CHECK: NOT OBSERVED' : record?.checkResult === 'pass' ? 'CHECK: PASS' : record?.checkResult === 'fail' ? 'CHECK: FAILED' : 'CHECK: NOT RECORDED'}</span>
          </div>
          {!demo && !live && record?.error && <div className="omega-error-detail" role="alert"><CircleAlert size={15} /> {record.error}</div>}
        </section>

        <section className="omega-health-panel">
          <div className="omega-card-heading"><span>SYSTEM / STATE</span><Radio size={15} /></div>
          <div className="omega-health-row"><span><span className={'omega-small-light ' + (server?.running ? 'is-ok' : 'is-down')} /> Puppy GUI service</span><strong>{server?.running ? 'CONNECTED' : server ? 'OFFLINE' : 'CHECKING'}</strong></div>
          <div className="omega-health-row"><span><ShieldCheck size={14} /> Event telemetry</span><strong className={connected ? '' : 'omega-muted'}>{connected ? 'STREAM CONNECTED' : telemetry?.connection === 'connecting' ? 'CONNECTING' : 'DISCONNECTED'}</strong></div>
          <div className="omega-health-row"><span><CheckCircle2 size={14} /> Stored run briefs</span><strong>{loadError ? 'UNAVAILABLE' : runs.length + ' RECORDS'}</strong></div>
          {live && liveAttention && <p className="omega-health-error" role="alert">{liveAttention.message} · <button className="omega-text-button" onClick={onChat}>Open chat</button></p>}
          {loadError && <p className="omega-health-error" role="alert">{trimText(loadError, 94)}</p>}
          {server?.error && !server.running && <p className="omega-health-error" role="alert">{trimText(server.error, 94)}</p>}
          <button className="omega-text-button" onClick={onRuns}>Inspect run records <ArrowRight size={14} /></button>
        </section>
      </div>
      {live && (
        <section className="omega-event-trace" aria-label="Recent runtime event summaries">
          <div className="omega-card-heading"><span>RUNTIME TRACE / RECENT EVENTS</span><span>{telemetry?.events.length ?? 0} IN MEMORY</span></div>
          {telemetry?.events.length ? (
            <ol className="omega-trace-list">
              {telemetry.events.slice(-7).reverse().map((event) => (
                <li key={event.id} className={'omega-trace-item is-' + event.tone}>
                  <time dateTime={new Date(event.timestamp).toISOString()}>{new Date(event.timestamp).toLocaleTimeString()}</time>
                  <span>{event.label}</span>
                </li>
              ))}
            </ol>
          ) : <p className="omega-trace-empty">No events received. Start a turn in Harness Chat; the live monitor updates when a compatible event stream is available.</p>}
        </section>
      )}
    </div>
  );
}

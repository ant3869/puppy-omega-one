import React, { useState } from 'react';
import { Activity, ArrowRight, CircleHelp, RefreshCw, Settings2, ShieldCheck, ServerCog } from 'lucide-react';
import type { PuppyStatus } from '@shared/types';
import type { GuiDiagnostics, GuiProbeOutcome } from '@shared/gui-diagnostics';
import type { ConnectionState } from '@shared/workflow-events';

export default function SettingsPage({
  status,
  reduceMotion,
  onReduceMotionChange,
  onOpenChat
}: {
  status: PuppyStatus | null;
  reduceMotion: boolean;
  onReduceMotionChange: (value: boolean) => void;
  onOpenChat: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<GuiDiagnostics | null>(null);
  const [streamState, setStreamState] = useState<ConnectionState | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  async function reconnect() {
    setChecking(true);
    setResult(null);
    try {
      const next = await window.omega.puppy.getStatus();
      setResult(next.running ? 'Puppy GUI responded successfully.' : 'No local Puppy GUI is running. Open Harness Chat, choose a project, then launch explicitly.');
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  }

  async function checkDiagnostics() {
    setDiagnosing(true);
    setDiagnosticError(null);
    try {
      const [report, stream] = await Promise.all([
        window.omega.puppy.diagnostics(),
        window.omega.workflow.get()
      ]);
      setDiagnostics(report);
      setStreamState(stream.connection);
    } catch (error) {
      setDiagnostics(null);
      setStreamState(null);
      setDiagnosticError(error instanceof Error ? error.message : String(error));
    } finally {
      setDiagnosing(false);
    }
  }

  function outcomeLabel(outcome: GuiProbeOutcome): string {
    switch (outcome) {
      case 'responded': return 'JSON RESPONSE';
      case 'missing': return 'NOT FOUND';
      case 'restricted': return 'RESTRICTED';
      case 'unexpected': return 'UNEXPECTED';
      case 'unreachable': return 'UNREACHABLE';
    }
  }

  return (
    <div className="omega-settings">
      <div>
        <div className="omega-eyebrow"><Settings2 size={13} /> PREFERENCES / INTEGRATIONS</div>
        <h2>Settings</h2>
        <p>Visual preferences and connection diagnostics. Runtime configuration is handled by Code Puppy and Puppy GUI.</p>
      </div>
      <section className="omega-settings-panel">
        <h3>Display</h3>
        <label className="omega-setting-row">
          <span>
            <strong>Reduce animations</strong>
            <p>Stops traveling flow highlights and automatic demo playback. Also respects your system reduced-motion preference.</p>
          </span>
          <input type="checkbox" checked={reduceMotion} onChange={(event) => onReduceMotionChange(event.target.checked)} />
        </label>
      </section>
      <section className="omega-settings-panel">
        <h3>Harness connection</h3>
        <div className="omega-setting-row">
          <span>
            <strong>Local Puppy GUI server</strong>
            <p>{status?.running ? 'Server connection is available.' : 'The local service is not currently responding.'} The Overview separates simulated playback, saved run records, and a read-only live event subscription. Native chat-send is not yet wired.</p>
          </span>
          <span className="omega-code-tag">{status?.port ? '127.0.0.1:' + status.port : 'not detected'}</span>
        </div>
        <div className="omega-setting-row">
          <span>
            <strong>Check the existing GUI connection</strong>
            <p>Omega does not launch Code Puppy on startup. Use Harness Chat to choose a safe project workspace before an explicit GUI launch. Checking the connection here is read-only.</p>
          </span>
          <button className="omega-button omega-button-secondary" onClick={() => void reconnect()} disabled={checking}>
            <RefreshCw size={14} /> {checking ? 'Checking…' : 'Check status'}
          </button>
        </div>
        {result && <p className="omega-health-error" role="status">{result}</p>}
      </section>
      <section className="omega-settings-panel">
        <h3><ServerCog size={14} style={{ display: 'inline', marginRight: 8 }} /> Read-only runtime diagnostics</h3>
        <p className="omega-settings-note">Checks four allowlisted GET endpoints on your local GUI plus the existing event-stream connection. No chat messages, approvals, model changes or runtime setup are sent.</p>
        <button className="omega-button omega-button-secondary" onClick={() => void checkDiagnostics()} disabled={diagnosing}>
          <RefreshCw size={14} /> {diagnosing ? 'Checking endpoints…' : 'Run connection checks'}
        </button>
        {diagnosticError && <p className="omega-health-error" role="alert">{diagnosticError}</p>}
        {diagnostics && (
          <div className="omega-diagnostics-list" aria-live="polite">
            <p>Checked {new Date(diagnostics.checkedAt).toLocaleString()} · {diagnostics.host}</p>
            {diagnostics.results.map((item) => (
              <div className="omega-diagnostics-item" key={item.key}>
                <span><strong>{item.label}</strong><small>{item.path}</small></span>
                <span className={'omega-diagnostics-status is-' + item.outcome}>
                  {outcomeLabel(item.outcome)}{item.status !== null ? ' · ' + item.status : ''}
                </span>
              </div>
            ))}
            <div className="omega-diagnostics-item">
              <span><strong>Event stream</strong><small>Read-only local WebSocket observer</small></span>
              <span className={'omega-diagnostics-status ' + (streamState === 'connected' ? 'is-responded' : 'is-unreachable')}>
                {(streamState ?? 'unknown').toUpperCase()}
              </span>
            </div>
            <div className="omega-diagnostics-item">
              <span><strong>Project binding</strong><small>Actual runtime working directory is not independently attested</small></span>
              <span className="omega-diagnostics-status is-unexpected">
                {status?.spawnedByUs && status.launchWorkspace ? 'LAUNCHED BY OMEGA' : 'UNVERIFIED'}
              </span>
            </div>
            <p>These results confirm endpoint responses only, not a compatible chat-send contract or verified running session. Automatic dispatch remains disabled.</p>
          </div>
        )}
      </section>
      <section className="omega-settings-panel">
        <h3>Core protection</h3>
        <div className="omega-setting-row">
          <span>
            <strong>Project-scoped changes only</strong>
            <p>The Omega installer writes templates to a chosen project, never to the Code Puppy installation, virtual environment or global configuration. Existing project files are skipped unless an explicit force option is used.</p>
          </span>
          <span className="omega-code-tag">DEFAULT</span>
        </div>
        <div className="omega-setting-row">
          <span>
            <strong>Runtime is not sandboxed</strong>
            <p>When you use harness chat, agents may run tools with your OS account permissions. Core isolation instructions are added to Omega agent briefs, but unrestricted tools require your review.</p>
          </span>
          <span className="omega-code-tag">REVIEW</span>
        </div>
      </section>
      <section className="omega-settings-panel">
        <h3>Advanced</h3>
        <div className="omega-setting-row">
          <span>
            <strong><ShieldCheck size={14} style={{ display: 'inline', marginRight: 7 }} />Model and agent configuration</strong>
            <p>Use the real Puppy GUI to manage models, agents, sessions, and tooling. The Omega shell does not silently overwrite these settings.</p>
          </span>
          <button className="omega-button omega-button-secondary" onClick={onOpenChat}>Open GUI <ArrowRight size={14} /></button>
        </div>
        <div className="omega-setting-row">
          <span>
            <strong><Activity size={14} style={{ display: 'inline', marginRight: 7 }} />Workflow visualization</strong>
            <p>Demo mode is illustrative; Saved runs mode only displays local records. A local ChatBridge WebSocket listener provides worker activity when connected. Only explicitly reported worker events illuminate the Live graph; a response is not considered a passed check.</p>
          </span>
          <span className="omega-code-tag">PREVIEW</span>
        </div>
        <div className="omega-setting-row">
          <span>
            <strong><CircleHelp size={14} style={{ display: 'inline', marginRight: 7 }} />Setup and troubleshooting</strong>
            <p>See docs/FRONTEND.md for supported endpoints, server paths, and current integration limits.</p>
          </span>
        </div>
      </section>
    </div>
  );
}

import React, { useState } from 'react';
import { Activity, ArrowRight, CircleHelp, RefreshCw, Settings2, ShieldCheck } from 'lucide-react';
import type { PuppyStatus } from '@shared/types';

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

  async function reconnect() {
    setChecking(true);
    setResult(null);
    try {
      const next = await window.omega.puppy.ensureServer();
      setResult(next.running ? 'Puppy GUI responded successfully.' : next.error ?? 'Puppy GUI is still offline.');
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
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
            <strong>Reconnect / launch</strong>
            <p>Attach to a running local Puppy GUI server, or attempt to launch a configured installation.</p>
          </span>
          <button className="omega-button omega-button-secondary" onClick={() => void reconnect()} disabled={checking}>
            <RefreshCw size={14} /> {checking ? 'Connecting…' : 'Reconnect'}
          </button>
        </div>
        {result && <p className="omega-health-error" role="status">{result}</p>}
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

import React from 'react';
import { ArrowRight, Settings2, ShieldCheck } from 'lucide-react';
import type { CodePuppySnapshot } from '@shared/code-puppy-acp';

export default function SettingsPage({
  snapshot, reduceMotion, onReduceMotionChange, onOpenChat
}: {
  snapshot: CodePuppySnapshot;
  reduceMotion: boolean;
  onReduceMotionChange: (value: boolean) => void;
  onOpenChat: () => void;
}) {
  return (
    <div className="omega-settings">
      <div>
        <div className="omega-eyebrow"><Settings2 size={13}/> PREFERENCES / DIRECT CODE PUPPY</div>
        <h2>Settings</h2>
        <p>Puppy Omega One talks directly to Code Puppy using ACP. No GUI server or embedded webview is required.</p>
      </div>
      <section className="omega-settings-panel">
        <h3>Display</h3>
        <label className="omega-setting-row">
          <span>
            <strong>Reduce animations</strong>
            <p>Stops traveling flow highlights and Demo autoplay. Also respects system reduced-motion preferences.</p>
          </span>
          <input type="checkbox" checked={reduceMotion} onChange={(event) => onReduceMotionChange(event.target.checked)}/>
        </label>
      </section>
      <section className="omega-settings-panel">
        <h3>Direct Code Puppy connection</h3>
        <div className="omega-setting-row">
          <span>
            <strong>Agent Client Protocol (ACP)</strong>
            <p>Use your installed <code>code-puppy --acp</code> executable. A session starts only after selecting a safe project and pressing Start. Each workspace owns its own session in this app.</p>
            <p>Set <code>CODE_PUPPY_EXECUTABLE</code> to an executable path if Code Puppy is not on PATH.</p>
          </span>
          <span className="omega-code-tag">{snapshot.connection.toUpperCase()}</span>
        </div>
        <div className="omega-setting-row">
          <span>
            <strong>Selected workspace</strong>
            <p>{snapshot.projectDir ?? 'Not started'}</p>
            <p>{snapshot.sessionId ? 'An ACP session was created; runtime writes to Code Puppy session storage may occur.' : 'No ACP session is active.'}</p>
          </span>
          <button className="omega-button omega-button-secondary" onClick={onOpenChat}>Open chat <ArrowRight size={14}/></button>
        </div>
      </section>
      <section className="omega-settings-panel">
        <h3>Execution safety</h3>
        <div className="omega-setting-row">
          <span>
            <strong>Permissions default to deny</strong>
            <p>Native approval dialogs are not implemented yet. ACP requests to approve file and shell operations are automatically rejected; the client advertises no delegated filesystem or terminal capabilities.</p>
          </span>
          <span className="omega-code-tag">DENY</span>
        </div>
        <div className="omega-setting-row">
          <span>
            <strong><ShieldCheck size={14} style={{ display: 'inline', marginRight: 7 }}/> Code Puppy core remains external</strong>
            <p>Puppy Omega One does not patch or install Code Puppy. The agent process uses your OS account and may access available resources. Test first in a disposable project.</p>
          </span>
          <span className="omega-code-tag">PROJECT SCOPED</span>
        </div>
      </section>
    </div>
  );
}

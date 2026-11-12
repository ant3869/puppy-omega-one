import React, { useState } from 'react';
import { AlertTriangle, FolderOpen, PlayCircle } from 'lucide-react';
import { tokens } from '../lib/tokens';
import type { PuppyStatus } from '@shared/types';

export default function PuppyGuiPage({
  status,
  projectDir,
  onProjectChange
}: {
  status: PuppyStatus | null;
  projectDir: string | null;
  onProjectChange: (value: string | null) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function chooseProject() {
    setError(null);
    setChoosing(true);
    try {
      const selected = await window.omega.app.pickProject();
      if (selected) {
        onProjectChange(selected);
        setNotice(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setChoosing(false);
    }
  }

  async function start() {
    if (!projectDir) {
      setError('Choose a project folder before launching Code Puppy GUI.');
      return;
    }
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await window.omega.puppy.ensureServer(projectDir);
      if (!result.running) setError(result.error ?? 'The local GUI did not start.');
      else if (result.error) setNotice(result.error);
      else setNotice('GUI started from your selected project folder.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  }

  const mismatched = Boolean(status?.running && (!projectDir || status.launchWorkspace !== projectDir));

  if (!status?.running) {
    return (
      <div className="omega-gui-launch">
        <div className="omega-eyebrow"><FolderOpen size={14} /> HARNESS / WORKSPACE</div>
        <h2>Connect the harness</h2>
        <p>Choose an existing project before starting the installed Puppy GUI. Omega starts the GUI in that project directory so local Omega agents can be discovered. No Code Puppy package files are installed or patched by this action.</p>
        <div className="omega-gui-project">
          <span className="omega-detail-tag">SELECTED PROJECT</span>
          <div className="omega-gui-project-value">{projectDir ?? 'No project selected'}</div>
          <button className="omega-button omega-button-secondary" onClick={() => void chooseProject()} disabled={choosing}>
            <FolderOpen size={14} /> {choosing ? 'Choosing…' : projectDir ? 'Change folder' : 'Choose project folder'}
          </button>
        </div>
        <button className="omega-button omega-button-primary" onClick={() => void start()} disabled={!projectDir || starting}>
          <PlayCircle size={16} /> {starting ? 'Starting local GUI…' : 'Start GUI in this project'}
        </button>
        {error && <p role="alert" className="omega-gui-message is-error">{error}</p>}
        {notice && <p role="status" className="omega-gui-message">{notice}</p>}
        <p className="omega-gui-footnote">Requires a previously installed Puppy GUI and Code Puppy runtime. Starting that runtime may perform its normal initialization; Omega itself does not edit its installed files. Agent tools are not OS-sandboxed.</p>
      </div>
    );
  }

  return (
    <div className="omega-embedded-gui">
      {mismatched && (
        <div className="omega-gui-warning" role="alert">
          <AlertTriangle size={16} />
          <span>The existing GUI's working directory is {status.launchWorkspace ? 'a different project' : 'not verified'}.
            Confirm the intended project in Code Puppy before allowing write-capable tasks. Omega will not automatically restart or switch an existing server.</span>
        </div>
      )}
      {notice && <p role="status" className="omega-gui-message">{notice}</p>}
      {error && <p role="alert" className="omega-gui-message is-error">{error}</p>}
      <div className="omega-gui-frame">
        {React.createElement('webview', {
          src: status.url,
          style: { width: '100%', height: '100%', border: 'none', background: tokens.bg.base }
        })}
      </div>
    </div>
  );
}

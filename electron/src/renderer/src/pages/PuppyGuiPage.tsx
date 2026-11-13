import React, { useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen, PlayCircle, ShieldAlert } from 'lucide-react';
import { tokens } from '../lib/tokens';
import type { PuppyStatus } from '@shared/types';
import { chatAccess } from '@shared/chat-access';

export default function PuppyGuiPage({
  status,
  projectDir,
  onProjectChange,
  onStatusChange,
  compact = false
}: {
  status: PuppyStatus | null;
  projectDir: string | null;
  onProjectChange: (value: string | null) => void;
  onStatusChange: (value: PuppyStatus) => void;
  compact?: boolean;
}) {
  const [starting, setStarting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptedKey, setAcceptedKey] = useState<string | null>(null);
  const access = chatAccess(status, projectDir);
  const consentKey = [status?.running, status?.spawnedByUs, status?.launchWorkspace ?? '?', projectDir ?? '?'].join('|');

  useEffect(() => {
    setAcceptedKey(null);
  }, [consentKey]);

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
      setError('Choose a project folder before starting the local coding agent.');
      return;
    }
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await window.omega.puppy.ensureServer(projectDir);
      onStatusChange(result);
      if (!result.running) setError(result.error ?? 'The local GUI did not start.');
      else if (result.error) setNotice(result.error);
      else setNotice('Puppy GUI launched for the selected folder; confirm the runtime project before edits.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  }

  const projectButton = (
    <button className="omega-button omega-button-secondary" onClick={() => void chooseProject()} disabled={choosing}>
      <FolderOpen size={14} /> {choosing ? 'Choosing…' : projectDir ? 'Change project' : 'Choose project'}
    </button>
  );

  if (access === 'offline' || access === 'choose-project') {
    return (
      <div className={'omega-gui-launch ' + (compact ? 'is-compact' : '')}>
        <div className="omega-eyebrow"><FolderOpen size={14} /> CODING AGENT / WORKSPACE</div>
        <h2>{access === 'choose-project' ? 'Choose a workspace' : 'Start your coding workspace'}</h2>
        <p>{access === 'choose-project'
          ? 'A local GUI is already running, but its project is not verified. Choose a project to review access safely.'
          : 'Select an existing project before starting the installed Puppy GUI. Omega does not install or change Code Puppy packages.'}</p>
        <div className="omega-gui-project">
          <span className="omega-detail-tag">SELECTED PROJECT</span>
          <div className="omega-gui-project-value">{projectDir ?? 'No project selected'}</div>
          {projectButton}
        </div>
        {access === 'offline' && (
          <button className="omega-button omega-button-primary" onClick={() => void start()} disabled={!projectDir || starting}>
            <PlayCircle size={16} /> {starting ? 'Starting…' : 'Start Code Puppy in this project'}
          </button>
        )}
        {error && <p role="alert" className="omega-gui-message is-error">{error}</p>}
        {notice && <p role="status" className="omega-gui-message">{notice}</p>}
        <p className="omega-gui-footnote">The GUI runs with your account permissions. Agent shell tools are not sandboxed, and normal runtime initialization may write to its own state.</p>
      </div>
    );
  }

  if (access === 'unverified-server' && acceptedKey !== consentKey) {
    return (
      <div className={'omega-gui-launch omega-gui-consent ' + (compact ? 'is-compact' : '')}>
        <div className="omega-eyebrow"><ShieldAlert size={14} /> WORKSPACE VERIFICATION</div>
        <h2>Existing GUI session</h2>
        <p>This GUI is already running. Omega cannot confirm that its current working directory matches your selected project. Opening it could allow Code Puppy to work elsewhere, including outside your project.</p>
        <div className="omega-gui-project">
          <span className="omega-detail-tag">YOUR SELECTED PROJECT</span>
          <div className="omega-gui-project-value">{projectDir}</div>
          <div className="omega-gui-project-value">{status?.launchWorkspace
            ? 'GUI was launched for: ' + status.launchWorkspace
            : 'GUI working directory: unknown'}</div>
          {projectButton}
        </div>
        <p className="omega-gui-message is-error"><AlertTriangle size={15} /> Confirm the running GUI's actual workspace before using write-capable tools. This check is not an OS sandbox.</p>
        <button className="omega-button omega-button-secondary" onClick={() => setAcceptedKey(consentKey)}>
          I understand — open existing GUI
        </button>
        {error && <p role="alert" className="omega-gui-message is-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="omega-embedded-gui">
      {access === 'unverified-server' && (
        <div className="omega-gui-warning" role="status">
          <AlertTriangle size={16} />
          <span>External or mismatched GUI workspace — unverified. Verify the current project before granting file-writing requests.</span>
          <button className="omega-gui-lock-button" onClick={() => setAcceptedKey(null)}>Lock</button>
        </div>
      )}
      {notice && <p role="status" className="omega-gui-message">{notice}</p>}
      {error && <p role="alert" className="omega-gui-message is-error">{error}</p>}
      <div className="omega-gui-frame">
        {React.createElement('webview', {
          src: status?.url,
          style: { width: '100%', height: '100%', border: 'none', background: tokens.bg.base }
        })}
      </div>
    </div>
  );
}

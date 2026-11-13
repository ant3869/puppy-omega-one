import React, { useState } from 'react';
import { FolderOpen, Play, Send, Square, StopCircle } from 'lucide-react';
import type { CodePuppySnapshot } from '@shared/code-puppy-acp';

export default function CodePuppyChatPage({
  snapshot, projectDir, onProjectChange
}: {
  snapshot: CodePuppySnapshot;
  projectDir: string | null;
  onProjectChange: (dir: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = snapshot.connection === 'ready' || snapshot.connection === 'working';

  async function chooseProject() {
    setError(null);
    try {
      const path = await window.omega.app.pickProject();
      if (path) {
        if (connected) await window.omega.acp.stop();
        onProjectChange(path);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not choose project');
    }
  }

  async function start() {
    if (!projectDir || busy) return;
    setBusy(true);
    setError(null);
    try {
      await window.omega.acp.start(projectDir);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Code Puppy could not start');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const prompt = text.trim();
    if (!prompt || snapshot.connection !== 'ready' || busy) return;
    setText('');
    setError(null);
    try {
      // The request stays in progress while ACP streams updates to the UI.
      await window.omega.acp.prompt(prompt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Code Puppy did not complete the prompt');
    }
  }

  async function cancel() {
    try {
      await window.omega.acp.cancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request cancellation');
    }
  }

  async function stop() {
    setError(null);
    try {
      await window.omega.acp.stop();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not stop Code Puppy');
    }
  }

  return (
    <div className="omega-native-chat">
      <div className="omega-native-chat-top">
        <div className="omega-native-project">
          <span className="omega-eyebrow">SELECTED PROJECT</span>
          <strong title={projectDir ?? ''}>{projectDir ?? 'Choose a project before starting Code Puppy'}</strong>
        </div>
        <button type="button" className="omega-button omega-button-secondary" onClick={() => void chooseProject()} disabled={busy || snapshot.connection === 'working' || snapshot.connection === 'connecting'}>
          <FolderOpen size={14}/> {projectDir ? 'Change' : 'Choose project'}
        </button>
        {connected ? (
          <button type="button" className="omega-button omega-button-secondary" onClick={() => void stop()}>
            <StopCircle size={14}/> Stop
          </button>
        ) : (
          <button type="button" className="omega-button omega-button-primary" onClick={() => void start()} disabled={!projectDir || busy || snapshot.connection === 'connecting'}>
            <Play size={14}/> {snapshot.connection === 'connecting' ? 'Connecting…' : 'Start Code Puppy'}
          </button>
        )}
      </div>
      <div className="omega-native-chat-messages" role="log" aria-label="Code Puppy conversation" aria-live="polite">
        {snapshot.events.length === 0 && (
          <div className="omega-native-chat-empty">
            <h3>Code Puppy · direct ACP</h3>
            <p>Select a project, start your installed Code Puppy, then send a message. No separate GUI or server is involved.</p>
          </div>
        )}
        {snapshot.events.map((event) => (
          <div key={event.id} className={'omega-native-message is-' + event.kind}>
            <span className="omega-eyebrow">{event.kind === 'user' ? 'YOU' : event.kind === 'text' ? 'CODE PUPPY' : event.kind.toUpperCase()}</span>
            <pre>{event.text}</pre>
          </div>
        ))}
      </div>
      <div className="omega-native-chat-composer">
        {error && <p role="alert" className="omega-gui-message is-error">{error}</p>}
        {snapshot.error && <p role="alert" className="omega-gui-message is-error">{snapshot.error}</p>}
        <div className="omega-native-chat-input">
          <textarea
            rows={3}
            aria-label="Message to Code Puppy"
            placeholder={connected ? 'Ask Code Puppy…' : 'Start a Code Puppy session to begin…'}
            value={text}
            disabled={!connected || snapshot.connection === 'working'}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          {snapshot.connection === 'working' ? (
            <button type="button" className="omega-button omega-button-secondary" onClick={() => void cancel()}>
              <Square size={14}/> Cancel
            </button>
          ) : (
            <button type="button" className="omega-button omega-button-primary" disabled={snapshot.connection !== 'ready' || !text.trim()} onClick={() => void send()}>
              <Send size={14}/> Send
            </button>
          )}
        </div>
        <p className="omega-native-chat-hint">Permissions are denied by default until the approval UI is implemented. Code Puppy still runs with your OS account permissions; choose a disposable project for initial testing.</p>
      </div>
    </div>
  );
}

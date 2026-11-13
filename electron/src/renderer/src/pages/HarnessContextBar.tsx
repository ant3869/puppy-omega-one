import React, { useEffect, useRef, useState } from 'react';
import { Bot, Cpu, MessagesSquare, RefreshCw } from 'lucide-react';
import type { PuppyStatus } from '@shared/types';
import type { ContextField, HarnessContext } from '@shared/harness-context';

function display(field: ContextField | undefined): string {
  if (!field) return 'Not checked';
  if (field.state === 'error') return 'Unavailable (read failed)';
  if (field.state === 'unavailable') return 'Not reported';
  return field.value ?? 'Not reported';
}

export default function HarnessContextBar({ status }: { status: PuppyStatus | null }) {
  const [snapshot, setSnapshot] = useState<HarnessContext | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const available = status?.running === true;

  useEffect(() => {
    if (available) return;
    requestId.current += 1;
    setSnapshot(null);
    setPending(false);
    setError(null);
  }, [available]);

  async function refresh() {
    if (!available || pending) return;
    const token = ++requestId.current;
    setPending(true);
    setError(null);
    try {
      const result = await window.omega.puppy.readContext();
      if (requestId.current === token) setSnapshot(result);
    } catch {
      if (requestId.current === token) {
        setSnapshot(null);
        setError('Could not read the GUI context.');
      }
    } finally {
      if (requestId.current === token) setPending(false);
    }
  }

  return (
    <div className="agent-context-bar" aria-label="Read-only local harness context">
      <div className="agent-context-item">
        <Bot size={14} />
        <span>Agent</span>
        <strong title={display(snapshot?.agent)}>{display(snapshot?.agent)}</strong>
      </div>
      <div className="agent-context-item">
        <Cpu size={14} />
        <span>Model</span>
        <strong title={display(snapshot?.model)}>{display(snapshot?.model)}</strong>
      </div>
      <div className="agent-context-item">
        <MessagesSquare size={14} />
        <span>Saved session</span>
        <strong title={display(snapshot?.session)}>{display(snapshot?.session)}</strong>
      </div>
      <button
        className="agent-context-refresh"
        type="button"
        onClick={() => void refresh()}
        disabled={!available || pending}
        aria-label={pending ? 'Reading local GUI context' : 'Refresh local GUI context'}
        title="Read-only GET requests; does not switch agents, models or sessions"
      >
        <RefreshCw size={13} />
        {pending ? 'Reading…' : 'Refresh context'}
      </button>
      <span className="agent-context-note">
        {error ?? (snapshot ? 'GUI reported · not session-attested' : available ? 'Manual read · not session-attested' : 'Start the GUI first')}
      </span>
    </div>
  );
}

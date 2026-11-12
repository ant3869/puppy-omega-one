// pages/PuppyGuiPage.tsx
// Puppy Omega One — the real puppy_gui web UI embedded in a <webview>.
// This is where chat, agents, models, sessions, and cost live — the shell
// does not re-implement any of it. The main process spawns the server;
// this view just points at http://127.0.0.1:8765.

import React, { useState } from 'react';
import { tokens } from '../lib/tokens';
import type { PuppyStatus } from '@shared/types';

export default function PuppyGuiPage({ status }: { status: PuppyStatus | null }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const s = await window.omega.puppy.ensureServer();
      if (!s.running) setError(s.error ?? 'server did not start');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  if (!status?.running) {
    return (
      <div className="max-w-xl flex flex-col gap-3">
        <p className="text-sm" style={{ color: tokens.text.secondary }}>
          The puppy_gui server is not running. It serves the chat, agents,
          models, sessions, and cost views this app embeds.
        </p>
        {error && (
          <p className="text-sm" style={{ color: tokens.status.fail }}>{error}</p>
        )}
        <div>
          <button
            onClick={() => void start()}
            disabled={starting}
            className="px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: tokens.accent.primary, color: '#000', borderRadius: tokens.radius }}
          >
            {starting ? 'Starting…' : 'Start puppy_gui server'}
          </button>
        </div>
        <p className="text-xs" style={{ color: tokens.text.tertiary }}>
          Looks for launch_gui.py (PUPPY_GUI_LAUNCH / PUPPY_GUI_DIR env, or a
          puppy_gui checkout under your home folder) and runs it with the Code
          Puppy venv python (CODE_PUPPY_PYTHON).
        </p>
      </div>
    );
  }

  // React has no <webview> intrinsic — create it directly.
  return React.createElement('webview', {
    src: status.url,
    style: { width: '100%', height: '100%', border: 'none', background: tokens.bg.base }
  });
}

// pages/LivePage.tsx
// Puppy Omega One — live run view: one card per worker delegation record.
// Status comes from the saved run records (runs.json) plus a raw poll of the
// active puppy_gui session. Runtime event telemetry appears on Overview → Live;
// these local saved-run cards are not equivalent to runtime events.

import React, { useEffect, useState } from 'react';
import { tokens } from '../lib/tokens';
import type { OmegaRun, RunStatus } from '@shared/types';

const STATUS_COLOR: Record<RunStatus, string> = {
  draft: tokens.status.idle,
  queued: tokens.status.idle,
  running: tokens.status.running,
  requires_approval: tokens.accent.primary,
  completed: tokens.status.pass,
  incomplete: tokens.accent.primary,
  failed: tokens.status.fail,
  canceled: tokens.status.idle,
  unknown: tokens.status.fail
};

export default function LivePage() {
  const [runs, setRuns] = useState<OmegaRun[]>([]);
  const [session, setSession] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await window.omega.runs.list();
        if (alive) setRuns(r);
      } catch {
        // Local run history may be unavailable or corrupt.
      }
      try {
        const s = await window.omega.puppy.getActiveSession();
        if (alive) setSession(s);
      } catch {
        if (alive) setSession(null);
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const run = runs[0] ?? null;

  if (!run) {
    return (
      <p className="text-sm" style={{ color: tokens.text.secondary }}>
        No runs yet. Start one from the Run page.
      </p>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium" style={{ color: tokens.text.primary }}>{run.goal}</h2>
        <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
          Done when: {run.doneWhen} · status: {run.status} · composed{' '}
          {new Date(run.startedAt).toLocaleString()}
        </p>
      </div>

      {run.status === 'draft' && (
        <p className="text-xs" style={{ color: tokens.text.secondary }}>
          Draft only — this brief has not been sent to Code Puppy. Copy it from Run and paste into the GUI.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {run.briefs.map((b) => (
          <div
            key={b.id}
            className="px-4 py-3 border"
            style={{ background: tokens.bg.surface1, borderColor: tokens.border.subtle, borderRadius: tokens.radius }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>{b.childAgent}</span>
              <span
                className="text-xs px-2 py-0.5"
                style={{ background: tokens.bg.surface3, color: STATUS_COLOR[b.status], borderRadius: 4 }}
              >
                {b.status}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: tokens.text.secondary }}>{b.model}</p>
            <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
              Check: {b.checkResult === null ? 'not run' : b.checkResult === 'pass' ? '✓ pass' : '✗ fail'}
            </p>
            {b.resultSummary && (
              <p className="text-xs mt-1" style={{ color: tokens.text.primary }}>{b.resultSummary}</p>
            )}
            {b.error && (
              <p className="text-xs mt-1" style={{ color: tokens.status.fail }}>{b.error}</p>
            )}
          </div>
        ))}
      </div>

      <details>
        <summary className="text-xs cursor-pointer" style={{ color: tokens.text.tertiary }}>
          Active puppy_gui session (raw · saved record view)
        </summary>
        <pre
          className="mt-2 px-3 py-2 text-xs whitespace-pre-wrap border overflow-auto"
          style={{ background: tokens.bg.surface1, borderColor: tokens.border.subtle, color: tokens.text.secondary, borderRadius: tokens.radius }}
        >
          {JSON.stringify(session, null, 2)}
        </pre>
      </details>
    </div>
  );
}

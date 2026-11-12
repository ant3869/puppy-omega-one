// pages/BriefsPage.tsx
// Puppy Omega One — briefs + check results across all saved runs.
// Each delegation record is one brief: worker, model, objective, check
// result. Admission is not completion — a record only counts as done when
// its check result is 'pass' (see docs/FRONTEND.md).

import React, { useEffect, useState } from 'react';
import { tokens } from '../lib/tokens';
import type { OmegaRun } from '@shared/types';

export default function BriefsPage() {
  const [runs, setRuns] = useState<OmegaRun[]>([]);

  useEffect(() => {
    void window.omega.runs.list().then(setRuns).catch(() => setRuns([]));
  }, []);

  const records = runs.flatMap((r) =>
    r.briefs.map((b) => ({ run: r, brief: b }))
  );

  if (records.length === 0) {
    return (
      <p className="text-sm" style={{ color: tokens.text.secondary }}>
        No briefs yet. Compose one from the Run page.
      </p>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-3">
      {records.map(({ run, brief }) => (
        <details
          key={brief.id}
          className="px-4 py-3 border"
          style={{ background: tokens.bg.surface1, borderColor: tokens.border.subtle, borderRadius: tokens.radius }}
        >
          <summary className="cursor-pointer flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
              {brief.childAgent}
            </span>
            <span className="text-xs" style={{ color: tokens.text.tertiary }}>{brief.model}</span>
            <span
              className="ml-auto text-xs px-2 py-0.5"
              style={{
                background: tokens.bg.surface3,
                color:
                  brief.checkResult === 'pass'
                    ? tokens.status.pass
                    : brief.checkResult === 'fail'
                      ? tokens.status.fail
                      : tokens.text.secondary,
                borderRadius: 4
              }}
            >
              {brief.checkResult === null ? 'check not run' : brief.checkResult === 'pass' ? '✓ pass' : '✗ fail'}
            </span>
          </summary>
          <p className="text-xs mt-2" style={{ color: tokens.text.secondary }}>
            Run: {run.goal} · {new Date(run.startedAt).toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
            Objective: {brief.objective}
          </p>
          {brief.checkCommand && (
            <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
              Check: <code>{brief.checkCommand}</code>
            </p>
          )}
          {brief.brief && (
            <pre
              className="mt-2 px-3 py-2 text-xs whitespace-pre-wrap overflow-auto"
              style={{ background: tokens.bg.surface2, color: tokens.text.primary, borderRadius: tokens.radius }}
            >
              {brief.brief}
            </pre>
          )}
        </details>
      ))}
    </div>
  );
}

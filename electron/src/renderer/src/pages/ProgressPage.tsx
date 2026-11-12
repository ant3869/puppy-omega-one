// pages/ProgressPage.tsx
// Puppy Omega One — docs/progress.md (plus decisions.md, known-issues.md)
// for the picked project dir, read through the main process.
// Plain <pre> rendering for now — no markdown renderer dependency yet.

import React, { useState } from 'react';
import { tokens } from '../lib/tokens';

const DOCS = ['progress.md', 'decisions.md', 'known-issues.md'] as const;

export default function ProgressPage() {
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, string | null> | null>(null);

  async function pick() {
    const dir = await window.omega.app.pickProject();
    if (!dir) return;
    setProjectDir(dir);
    setDocs(await window.omega.app.readDocs(dir));
  }

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => void pick()}
          className="px-4 py-2 text-sm font-medium"
          style={{ background: tokens.accent.primary, color: '#000', borderRadius: tokens.radius }}
        >
          Pick project folder
        </button>
        {projectDir && (
          <span className="text-xs" style={{ color: tokens.text.secondary }}>{projectDir}</span>
        )}
      </div>

      {!docs && (
        <p className="text-sm" style={{ color: tokens.text.secondary }}>
          Pick a project folder to read its docs/progress.md, decisions.md,
          and known-issues.md.
        </p>
      )}

      {docs &&
        DOCS.map((name) => (
          <div key={name}>
            <h3 className="text-sm font-medium mb-1" style={{ color: tokens.text.primary }}>
              docs/{name}
            </h3>
            {docs[name] === null ? (
              <p className="text-xs" style={{ color: tokens.text.tertiary }}>Not found in this project.</p>
            ) : (
              <pre
                className="px-3 py-2 text-xs whitespace-pre-wrap border overflow-auto"
                style={{ background: tokens.bg.surface1, borderColor: tokens.border.subtle, color: tokens.text.primary, borderRadius: tokens.radius }}
              >
                {docs[name]}
              </pre>
            )}
          </div>
        ))}
    </div>
  );
}

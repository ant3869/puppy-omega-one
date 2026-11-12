// pages/RunPage.tsx
// Puppy Omega One — goal input / run trigger.
// Composes a brief in the /omega-brief format and saves the run record.
// Sending the brief into a live session is NOT wired yet (the chat-send
// endpoint in puppy_gui is unverified — see docs/FRONTEND.md), so the page
// copies the brief for pasting into the Puppy GUI chat instead of
// pretending to start the run. That is the honest interim trigger.

import React, { useState } from 'react';
import { tokens } from '../lib/tokens';
import type { DelegationRecord, OmegaRun } from '@shared/types';

const WORKERS = [
  { agent: 'omega-builder', label: 'Builder', model: 'claude-sonnet-5-5', note: 'Sonnet — writes the code' },
  { agent: 'omega-reviewer', label: 'Reviewer', model: 'claude-sonnet-5-5', note: 'Sonnet — reviews + verify' },
  { agent: 'omega-tester', label: 'Tester', model: 'claude-haiku-5-5', note: 'Haiku — runs checks' },
  { agent: 'omega-researcher', label: 'Researcher', model: 'claude-haiku-5-5', note: 'Haiku — reads code/docs' }
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function RunPage({ onOpenPuppy }: { onOpenPuppy: () => void }) {
  const [goal, setGoal] = useState('');
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [pickingProject, setPickingProject] = useState(false);
  const [doneWhen, setDoneWhen] = useState('');
  const [selected, setSelected] = useState<string[]>(['omega-builder', 'omega-reviewer', 'omega-tester']);
  const [brief, setBrief] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    background: tokens.bg.surface2,
    borderColor: tokens.border.subtle,
    color: tokens.text.primary,
    borderRadius: tokens.radius
  };

  function toggle(agent: string) {
    setSelected((prev) => (prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]));
    setBrief(null);
    setCopied(false);
  }

  async function composeBrief() {
    if (!projectDir) {
      setError('Select a project workspace before composing a brief. Core and global Code Puppy folders cannot be selected.');
      return;
    }
    if (!goal.trim() || !doneWhen.trim() || selected.length === 0) return;
    setError(null);
    const runId = uid();
    const now = new Date().toISOString();
    const records: DelegationRecord[] = WORKERS.filter((w) => selected.includes(w.agent)).map((w) => ({
      id: uid(),
      parentRunId: runId,
      childAgent: w.agent,
      model: w.model,
      objective: goal.trim(),
      brief: '',
      status: 'draft',
      checkCommand: null,
      checkResult: null,
      resultSummary: null,
      error: null
    }));
    const text = [
      `Goal: ${goal.trim()}`,
      `Project workspace: ${projectDir}`,
      'Isolation: Work only inside the project workspace. Never edit, install, or configure Code Puppy core, its Python environment, user-global agent/config files, or the Puppy GUI source.',
      'If a task requires those protected locations, stop and report it instead.',
      '',
      'Workers:',
      ...records.map((r) => `- ${r.childAgent} (${r.model})`),
      '',
      `Done when: ${doneWhen.trim()}`,
      '',
      'Rules: briefs are self-contained (AGENTS.md is not injected into subagents).',
      'Verify before accepting — re-run the check, never take a worker\'s word for it.'
    ].join('\n');
    records.forEach((r) => {
      r.brief = text;
    });
    const run: OmegaRun = {
      id: runId,
      goal: goal.trim(),
      doneWhen: doneWhen.trim(),
      status: 'draft',
      briefs: records,
      projectDir,
      startedAt: now,
      updatedAt: now
    };
    try {
      await window.omega.runs.save(run);
      setBrief(text);
      setCopied(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function pickProject() {
    setPickingProject(true);
    setError(null);
    try {
      const chosen = await window.omega.app.pickProject();
      if (chosen) {
        setProjectDir(chosen);
        setBrief(null);
        setCopied(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPickingProject(false);
    }
  }

  async function copyBrief() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <p className="text-sm" style={{ color: tokens.text.secondary }}>
        Describe the goal and the check that proves it done. The orchestrator
        (Opus, <code>claude-opus-5-5</code> placeholder) fans the brief out to
        the workers below. Model aliases are placeholders — verify with{' '}
        <code>/model</code> in your Code Puppy environment.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Project workspace (required)</span>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void pickProject()} disabled={pickingProject} className="omega-button omega-button-secondary disabled:opacity-40">
            {pickingProject ? 'Choosing…' : projectDir ? 'Change project' : 'Choose project folder'}
          </button>
          <span className="text-xs break-all" style={{ color: projectDir ? tokens.text.primary : tokens.text.tertiary }}>
            {projectDir ?? 'No project selected. Global Code Puppy directories are blocked.'}
          </span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Goal</span>
        <textarea
          value={goal}
          onChange={(e) => { setGoal(e.target.value); setBrief(null); setCopied(false); }}
          rows={3}
          placeholder="e.g. Add a CSV export to the report page"
          className="w-full px-3 py-2 text-sm border focus:outline-none"
          style={inputStyle}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
          Done when: (runnable check)
        </span>
        <input
          value={doneWhen}
          onChange={(e) => { setDoneWhen(e.target.value); setBrief(null); setCopied(false); }}
          placeholder="e.g. npm test passes and the CSV downloads with all rows"
          className="w-full px-3 py-2 text-sm border focus:outline-none"
          style={inputStyle}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium" style={{ color: tokens.text.secondary }}>Workers</span>
        {WORKERS.map((w) => (
          <label
            key={w.agent}
            className="flex items-center gap-3 px-3 py-2 border cursor-pointer"
            style={{ background: tokens.bg.surface1, borderColor: tokens.border.subtle, borderRadius: tokens.radius }}
          >
            <input type="checkbox" checked={selected.includes(w.agent)} onChange={() => toggle(w.agent)} />
            <span className="text-sm" style={{ color: tokens.text.primary }}>{w.label}</span>
            <span className="text-xs" style={{ color: tokens.text.tertiary }}>
              {w.agent} · {w.model}
            </span>
            <span className="ml-auto text-xs" style={{ color: tokens.text.secondary }}>{w.note}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void composeBrief()}
          disabled={!projectDir || !goal.trim() || !doneWhen.trim() || selected.length === 0}
          className="px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: tokens.accent.primary, color: '#000', borderRadius: tokens.radius }}
        >
          Compose brief
        </button>
        {brief && (
          <>
            <button
              onClick={() => void copyBrief()}
              className="px-4 py-2 text-sm border"
              style={{ background: tokens.bg.surface2, borderColor: tokens.border.default, color: tokens.text.primary, borderRadius: tokens.radius }}
            >
              {copied ? 'Copied' : 'Copy brief'}
            </button>
            <button
              onClick={onOpenPuppy}
              className="px-4 py-2 text-sm border"
              style={{ background: tokens.bg.surface2, borderColor: tokens.border.default, color: tokens.text.primary, borderRadius: tokens.radius }}
            >
              Open Puppy GUI
            </button>
          </>
        )}
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: tokens.status.fail }}>{error}</p>}

      {brief && (
        <div>
          <p className="text-xs mb-2" style={{ color: tokens.text.secondary }}>
            Send is not wired yet — paste this brief into the Puppy GUI chat
            with the <code>omega-orchestrator</code> agent. It will fan out the
            workers and verify each check.
          </p>
          <pre
            className="px-3 py-2 text-xs whitespace-pre-wrap border overflow-auto"
            style={{ background: tokens.bg.surface1, borderColor: tokens.border.subtle, color: tokens.text.primary, borderRadius: tokens.radius }}
          >
            {brief}
          </pre>
        </div>
      )}
    </div>
  );
}

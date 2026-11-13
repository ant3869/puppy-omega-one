import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Clock3, FileText, FolderOpen, MessageSquare, RefreshCw, Search } from 'lucide-react';
import type { OmegaRun, RunStatus } from '@shared/types';

const STATUS_LABEL: Record<RunStatus, string> = {
  draft: 'Draft', queued: 'Queued (recorded)', running: 'Running (recorded)',
  requires_approval: 'Approval (recorded)', completed: 'Completed (recorded)',
  incomplete: 'Incomplete (recorded)', failed: 'Failed (recorded)',
  canceled: 'Canceled (recorded)', unknown: 'Unknown'
};

function formatTime(value: string): string {
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? 'Unknown date' : time.toLocaleString();
}

function briefText(run: OmegaRun): string | null {
  const text = run.briefs.find((record) => record.brief?.trim())?.brief;
  return text?.trim() ? text : null;
}

export default function LivePage({ onOpenChat }: { onOpenChat: () => void }) {
  const [runs, setRuns] = useState<OmegaRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void window.omega.runs.list().then((records) => {
      if (active) {
        setRuns(records);
        setError(null);
      }
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Saved history is unavailable.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const records = await window.omega.runs.list();
      setRuns(records);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Saved history is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? runs.filter((run) => [run.goal, run.doneWhen, run.projectDir ?? '', run.id]
          .some((value) => value.toLowerCase().includes(needle)))
      : runs;
  }, [runs, query]);

  const selected = filtered.find((run) => run.id === selectedId) ?? filtered[0] ?? null;
  const selectedBrief = selected ? briefText(selected) : null;

  async function copyBrief() {
    if (!selectedBrief) return;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(selectedBrief);
      setCopied(true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not copy the brief.');
    }
  }

  return (
    <section className="omega-history">
      <header className="omega-history-header">
        <div>
          <div className="omega-eyebrow"><Clock3 size={13} /> LOCAL RECORDS / NOT TELEMETRY</div>
          <h2>Saved activity</h2>
          <p>Browse briefs saved by Omega. A draft is not a dispatched run, and saved statuses are not independently verified against Code Puppy.</p>
        </div>
        <button type="button" className="omega-button omega-button-secondary" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw size={14} /> {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>
      <label className="omega-history-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search saved activity</span>
        <input
          type="search"
          placeholder="Search goal, project, or acceptance criteria…"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setCopied(false); }}
        />
        <span>{filtered.length} / {runs.length}</span>
      </label>
      {error && <p className="omega-history-error" role="alert">{error}</p>}
      {loading && <p className="omega-history-empty" role="status">Loading saved records…</p>}
      {!loading && filtered.length === 0 && (
        <p className="omega-history-empty">
          {runs.length ? 'No saved records match that search.' : 'No saved briefs yet. Compose one from the Run page.'}
        </p>
      )}
      {filtered.length > 0 && (
        <div className="omega-history-layout">
          <div className="omega-history-list" role="group" aria-label="Saved records">
            {filtered.map((run) => (
              <button
                type="button"
                key={run.id}
                className={'omega-history-entry ' + (selected?.id === run.id ? 'is-selected' : '')}
                aria-pressed={selected?.id === run.id}
                onClick={() => { setSelectedId(run.id); setCopied(false); }}
              >
                <span className="omega-history-entry-top">
                  <span className="omega-history-entry-date">{formatTime(run.startedAt)}</span>
                  <span className="omega-history-chip">{STATUS_LABEL[run.status] ?? 'Saved record'}</span>
                </span>
                <strong>{run.goal}</strong>
                <span className="omega-history-entry-meta">
                  <FolderOpen size={12} /> {run.projectDir ?? 'Project not recorded'}
                </span>
                <span className="omega-history-entry-meta">{run.briefs.length} worker brief{run.briefs.length === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
          {selected && (
            <article className="omega-history-detail" aria-label="Selected saved record">
              <div className="omega-history-detail-heading">
                <div>
                  <span className="omega-history-detail-kicker">RECORD DETAILS / {STATUS_LABEL[selected.status] ?? selected.status}</span>
                  <h3>{selected.goal}</h3>
                  <p>{formatTime(selected.startedAt)} · ID: {selected.id}</p>
                </div>
                <div className="omega-history-actions">
                  <button className="omega-button omega-button-secondary" onClick={() => void copyBrief()} disabled={!selectedBrief}>
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? 'Copied' : 'Copy brief'}
                  </button>
                  <button className="omega-button omega-button-secondary" onClick={onOpenChat}>
                    <MessageSquare size={15} /> Open chat
                  </button>
                </div>
              </div>
              <div className="omega-history-field">
                <span>PROJECT WORKSPACE</span>
                <p>{selected.projectDir ?? 'Not recorded'}</p>
              </div>
              <div className="omega-history-field">
                <span>DONE WHEN</span>
                <p>{selected.doneWhen}</p>
              </div>
              <div className="omega-history-field">
                <span>WORKER RECORDS</span>
                <div className="omega-history-workers">
                  {selected.briefs.map((worker) => (
                    <div key={worker.id} className="omega-history-worker">
                      <FileText size={14} />
                      <div><strong>{worker.childAgent}</strong><small>{worker.model || 'Model not recorded'}</small></div>
                      <span>{worker.checkResult === 'pass' ? 'Pass (saved)' : worker.checkResult === 'fail' ? 'Fail (saved)' : STATUS_LABEL[worker.status] ?? worker.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="omega-history-field">
                <span>SAVED BRIEF</span>
                {selectedBrief
                  ? <pre className="omega-history-brief">{selectedBrief}</pre>
                  : <p>No brief text stored for this record.</p>}
              </div>
              <p className="omega-history-footnote">Copy this brief into the embedded Puppy GUI to submit it yourself. Omega has not sent it or verified any saved execution claims.</p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

import React from 'react';
import { Bot, FolderOpen, GitBranch, MessageSquare, Plus, ShieldAlert } from 'lucide-react';
import type { PuppyStatus } from '@shared/types';
import PuppyGuiPage from './PuppyGuiPage';
import WorkflowOverviewPage from './WorkflowOverviewPage';
import HarnessContextBar from './HarnessContextBar';

export type WorkspaceMode = 'chat' | 'omega';

interface Props {
  mode: WorkspaceMode;
  status: PuppyStatus | null;
  projectDir: string | null;
  reduceMotion: boolean;
  onModeChange: (mode: WorkspaceMode) => void;
  onProjectChange: (path: string | null) => void;
  onStatusChange: (value: PuppyStatus) => void;
  onCompose: () => void;
  onSavedActivity: () => void;
}

export default function AgentWorkspacePage({
  mode, status, projectDir, reduceMotion, onModeChange,
  onProjectChange, onStatusChange, onCompose, onSavedActivity
}: Props) {
  const omega = mode === 'omega';
  return (
    <section className="agent-workspace" aria-label="Puppy Omega coding workspace">
      <header className="agent-workspace-toolbar">
        <div className="agent-workspace-identity">
          <div className="omega-eyebrow"><Bot size={13} /> CODING AGENT WORKSPACE</div>
          <h1>{omega ? 'Omega orchestration' : 'Chat with Code Puppy'}</h1>
          <p>{omega
            ? 'The same conversation, with the Omega delegation loop alongside it.'
            : 'Your everyday agent conversation. Switch on Omega when a task needs planning and specialist workers.'}</p>
        </div>
        <div className="agent-workspace-actions">
          <div className="agent-mode-switch" role="group" aria-label="Conversation mode">
            <button type="button" aria-pressed={!omega} className={!omega ? 'is-active' : ''}
              onClick={() => onModeChange('chat')}><MessageSquare size={14} /> Chat</button>
            <button type="button" aria-pressed={omega} className={omega ? 'is-active' : ''}
              onClick={() => onModeChange('omega')}><GitBranch size={14} /> Omega loop</button>
          </div>
          <button type="button" className="agent-prepare-button" onClick={onCompose}>
            <Plus size={15} /> Draft Omega job
          </button>
        </div>
      </header>

      <HarnessContextBar status={status} />

      <div className={'agent-workspace-layout ' + (omega ? 'with-omega' : '')}>
        <section className="agent-chat-surface" aria-label="Agent chat">
          <div className="agent-surface-bar">
            <span><MessageSquare size={14} /> AGENT CONVERSATION</span>
            <span className="agent-runtime-label">
              <i className={status?.running ? 'is-online' : ''} />
              {status?.running ? 'LOCAL GUI RESPONDING' : 'GUI OFFLINE'}
            </span>
          </div>
          <div className="agent-chat-body">
            <PuppyGuiPage
              status={status}
              projectDir={projectDir}
              onProjectChange={onProjectChange}
              onStatusChange={onStatusChange}
              compact
            />
          </div>
          <div className="agent-chat-foot">
            <FolderOpen size={12} />
            <span title={projectDir ?? undefined}>{projectDir ?? 'Choose a project to begin'}</span>
            <span className="agent-chat-bridge-label">Existing GUI connection</span>
          </div>
        </section>
        {omega && (
          <section className="agent-loop-surface" aria-label="Omega orchestration loop">
            <div className="agent-surface-bar">
              <span><GitBranch size={14} /> OMEGA / WORKFLOW</span>
              <span>DEMO · SAVED · OPT-IN LIVE</span>
            </div>
            <div className="agent-loop-body">
              <WorkflowOverviewPage
                server={status}
                reduceMotion={reduceMotion}
                preferLive={false}
                onCompose={onCompose}
                onChat={() => onModeChange('chat')}
                onRuns={onSavedActivity}
              />
            </div>
          </section>
        )}
      </div>
      <div className="agent-workspace-boundary">
        <ShieldAlert size={13} />
        <span>Chat currently uses your installed Puppy GUI. Omega visualizes the workflow, but native session-linked dispatch is not verified; drafts are submitted manually.</span>
      </div>
    </section>
  );
}

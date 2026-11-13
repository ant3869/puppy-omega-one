import React from 'react';
import { Bot, FolderOpen, GitBranch, MessageSquare, Plus, ShieldAlert } from 'lucide-react';
import type { CodePuppySnapshot } from '@shared/code-puppy-acp';
import CodePuppyChatPage from './CodePuppyChatPage';
import WorkflowOverviewPage from './WorkflowOverviewPage';

export type WorkspaceMode = 'chat' | 'omega';

interface Props {
  mode: WorkspaceMode;
  snapshot: CodePuppySnapshot;
  projectDir: string | null;
  reduceMotion: boolean;
  onModeChange: (mode: WorkspaceMode) => void;
  onProjectChange: (path: string | null) => void;
  onCompose: () => void;
  onSavedActivity: () => void;
}

export default function AgentWorkspacePage({
  mode, snapshot, projectDir, reduceMotion, onModeChange,
  onProjectChange, onCompose, onSavedActivity
}: Props) {
  const omega = mode === 'omega';
  const connected = snapshot.connection === 'ready' || snapshot.connection === 'working';
  return (
    <section className="agent-workspace" aria-label="Puppy Omega coding workspace">
      <header className="agent-workspace-toolbar">
        <div className="agent-workspace-identity">
          <div className="omega-eyebrow"><Bot size={13}/> CODING AGENT WORKSPACE</div>
          <h1>{omega ? 'Omega orchestration' : 'Chat with Code Puppy'}</h1>
          <p>{omega
            ? 'The direct Code Puppy conversation, with the Omega worker loop alongside it.'
            : 'One direct Code Puppy session. Switch to Omega when a task needs specialist workers.'}</p>
        </div>
        <div className="agent-workspace-actions">
          <div className="agent-mode-switch" role="group" aria-label="Conversation mode">
            <button type="button" aria-pressed={!omega} className={!omega ? 'is-active' : ''}
              onClick={() => onModeChange('chat')}><MessageSquare size={14}/> Chat</button>
            <button type="button" aria-pressed={omega} className={omega ? 'is-active' : ''}
              onClick={() => onModeChange('omega')}><GitBranch size={14}/> Omega loop</button>
          </div>
          <button type="button" className="agent-prepare-button" onClick={onCompose}>
            <Plus size={15}/> Draft Omega job
          </button>
        </div>
      </header>
      <div className={'agent-workspace-layout ' + (omega ? 'with-omega' : '')}>
        <section className="agent-chat-surface" aria-label="Agent chat">
          <div className="agent-surface-bar">
            <span><MessageSquare size={14}/> AGENT CONVERSATION</span>
            <span className="agent-runtime-label">
              <i className={connected ? 'is-online' : ''}/>
              {snapshot.connection.toUpperCase()} · ACP
            </span>
          </div>
          <div className="agent-chat-body">
            <CodePuppyChatPage
              snapshot={snapshot}
              projectDir={projectDir}
              onProjectChange={onProjectChange}
            />
          </div>
          <div className="agent-chat-foot">
            <FolderOpen size={12}/>
            <span title={projectDir ?? undefined}>{projectDir ?? 'Choose a project to begin'}</span>
            <span className="agent-chat-bridge-label">Direct Code Puppy ACP</span>
          </div>
        </section>
        {omega && (
          <section className="agent-loop-surface" aria-label="Omega orchestration loop">
            <div className="agent-surface-bar">
              <span><GitBranch size={14}/> OMEGA / WORKFLOW</span>
              <span>DEMO · SAVED · ACP LIVE</span>
            </div>
            <div className="agent-loop-body">
              <WorkflowOverviewPage
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
        <ShieldAlert size={13}/>
        <span>Chat uses Code Puppy's native ACP session. Omega Demo is simulated; live activity shares that ACP session but worker attribution and automated delegation are still being implemented. Tool permissions default to deny.</span>
      </div>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookOpen, FileText, GitBranch, MessageSquare,
  Settings, PawPrint, X, ScrollText
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PuppyStatus } from '@shared/types';
import AgentWorkspacePage, { type WorkspaceMode } from './pages/AgentWorkspacePage';
import RunPage from './pages/RunPage';
import LivePage from './pages/LivePage';
import EventLogPage from './pages/EventLogPage';
import BriefsPage from './pages/BriefsPage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';

type ModuleId = 'chat' | 'omega' | 'live' | 'log' | 'briefs' | 'progress' | 'settings';
type NavItem = { id: ModuleId; label: string; icon: LucideIcon };

const modules: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'omega', label: 'Omega loop', icon: GitBranch },
  { id: 'live', label: 'Saved activity', icon: Activity },
  { id: 'log', label: 'Event log', icon: ScrollText },
  { id: 'briefs', label: 'Worker briefs', icon: FileText },
  { id: 'progress', label: 'Project documents', icon: BookOpen }
];

function isWorkspace(id: ModuleId): boolean {
  return id === 'chat' || id === 'omega';
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('chat');
  const [status, setStatus] = useState<PuppyStatus | null>(null);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      const previous = localStorage.getItem('omega:reduce-motion');
      if (previous !== null) return previous === 'true';
    } catch {
      // Storage may be disabled; system preference still applies.
    }
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const next = await window.omega.puppy.getStatus();
        if (alive) setStatus(next);
      } catch {
        if (alive) setStatus(null);
      }
    };
    void poll();
    const timer = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!composerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setComposerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [composerOpen]);

  const currentModule = useMemo(
    () => [...modules, { id: 'settings' as ModuleId, label: 'Settings', icon: Settings }]
      .find((item) => item.id === activeModule),
    [activeModule]
  );

  function changeMotion(value: boolean) {
    setReduceMotion(value);
    try {
      localStorage.setItem('omega:reduce-motion', String(value));
    } catch {
      // Preference remains active for this session.
    }
  }

  function navigate(next: ModuleId) {
    setActiveModule(next);
    setComposerOpen(false);
  }

  function renderAuxiliaryPage() {
    switch (activeModule) {
      case 'live':
        return <LivePage onOpenChat={() => navigate('chat')} />;
      case 'log':
        return <EventLogPage />;
      case 'briefs':
        return <BriefsPage />;
      case 'progress':
        return <ProgressPage />;
      case 'settings':
        return (
          <SettingsPage
            status={status}
            reduceMotion={reduceMotion}
            onReduceMotionChange={changeMotion}
            onOpenChat={() => navigate('chat')}
          />
        );
      default:
        return null;
    }
  }

  const workspaceVisible = isWorkspace(activeModule);

  return (
    <div className="omega-shell">
      <aside className="omega-sidebar" aria-label="Application navigation">
        <div className="omega-sidebar-logo" title="Puppy Omega One"><PawPrint size={24} strokeWidth={1.9} /></div>
        <nav aria-label="Main sections">
          {modules.map((module) => (
            <button
              key={module.id}
              className={'omega-nav-button ' + (activeModule === module.id ? 'is-active' : '')}
              title={module.label}
              aria-label={module.label}
              aria-current={activeModule === module.id ? 'page' : undefined}
              onClick={() => navigate(module.id)}
            >
              <module.icon size={20} strokeWidth={1.7} />
            </button>
          ))}
        </nav>
        <div className="omega-sidebar-spacer" />
        <div className="omega-sidebar-bottom">
          <div className="omega-sidebar-divider" />
          <button
            className={'omega-nav-button ' + (activeModule === 'settings' ? 'is-active' : '')}
            title="Settings"
            aria-label="Settings"
            aria-current={activeModule === 'settings' ? 'page' : undefined}
            onClick={() => navigate('settings')}
          >
            <Settings size={20} strokeWidth={1.7} />
          </button>
        </div>
      </aside>
      <div className="omega-shell-main">
        <header className="omega-shell-header">
          <div className="omega-shell-location">
            <strong>PUPPY OMEGA ONE</strong>
            <span className="omega-slash">/</span>
            <span>{currentModule?.label ?? 'Chat'}</span>
          </div>
          <div className="omega-shell-meta">
            <span>CODING AGENT WORKSPACE</span>
            <span className="omega-shell-status"><i className={status?.running ? 'is-online' : ''} />
              {status === null ? 'CHECKING LOCAL GUI' : status.running ? 'LOCAL GUI RESPONDING' : 'LOCAL GUI OFFLINE'}
            </span>
          </div>
        </header>
        <main className={'omega-shell-content ' + (workspaceVisible ? 'is-full' : '')}>
          <div className={'agent-workspace-mount ' + (!workspaceVisible ? 'is-hidden' : '')}>
            <AgentWorkspacePage
              mode={activeModule === 'omega' ? 'omega' : 'chat'}
              status={status}
              projectDir={projectDir}
              reduceMotion={reduceMotion}
              onModeChange={(mode: WorkspaceMode) => navigate(mode)}
              onProjectChange={setProjectDir}
              onStatusChange={setStatus}
              onCompose={() => setComposerOpen(true)}
              onSavedActivity={() => navigate('live')}
            />
          </div>
          {!workspaceVisible && renderAuxiliaryPage()}
        </main>
      </div>

      {composerOpen && (
        <div className="agent-composer-overlay">
          <button className="agent-composer-shade" type="button" aria-label="Close Omega job composer" onClick={() => setComposerOpen(false)} />
          <aside className="agent-composer-panel" role="dialog" aria-modal="true" aria-label="Draft an Omega job">
            <div className="agent-composer-header">
              <div>
                <span className="omega-eyebrow">OMEGA / JOB PREPARATION</span>
                <strong>Draft a specialist run</strong>
              </div>
              <button className="omega-icon-button" aria-label="Close composer" onClick={() => setComposerOpen(false)}><X size={17}/></button>
            </div>
            <div className="agent-composer-body">
              <RunPage
                onOpenPuppy={() => navigate('chat')}
                projectDir={projectDir}
                onProjectChange={setProjectDir}
              />
            </div>
            <p className="agent-composer-foot">Draft only. Paste into your verified Code Puppy chat to run it; nothing is dispatched automatically.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

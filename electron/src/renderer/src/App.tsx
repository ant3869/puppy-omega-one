import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookOpen, FileText, LayoutDashboard, MessageSquare,
  Play, Settings, PawPrint
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PuppyStatus } from '@shared/types';
import WorkflowOverviewPage from './pages/WorkflowOverviewPage';
import RunPage from './pages/RunPage';
import LivePage from './pages/LivePage';
import BriefsPage from './pages/BriefsPage';
import ProgressPage from './pages/ProgressPage';
import PuppyGuiPage from './pages/PuppyGuiPage';
import SettingsPage from './pages/SettingsPage';

type ModuleId = 'overview' | 'run' | 'puppy' | 'live' | 'briefs' | 'progress' | 'settings';
type NavItem = { id: ModuleId; label: string; icon: LucideIcon };

const modules: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'run', label: 'Compose run', icon: Play },
  { id: 'puppy', label: 'Harness chat', icon: MessageSquare },
  { id: 'live', label: 'Saved activity', icon: Activity },
  { id: 'briefs', label: 'Worker briefs', icon: FileText },
  { id: 'progress', label: 'Project documents', icon: BookOpen }
];

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [status, setStatus] = useState<PuppyStatus | null>(null);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      const previous = localStorage.getItem('omega:reduce-motion');
      if (previous !== null) return previous === 'true';
    } catch {
      // Storage may be disabled; system preference still applies.
    }
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  const currentModule = useMemo(
    () => [...modules, { id: 'settings' as ModuleId, label: 'Settings', icon: Settings }].find((item) => item.id === activeModule),
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

  const navigate = (next: ModuleId) => setActiveModule(next);

  function renderPage() {
    switch (activeModule) {
      case 'overview':
        return (
          <WorkflowOverviewPage
            server={status}
            reduceMotion={reduceMotion}
            onCompose={() => navigate('run')}
            onChat={() => navigate('puppy')}
            onRuns={() => navigate('live')}
          />
        );
      case 'run':
        return <RunPage onOpenPuppy={() => navigate('puppy')} projectDir={projectDir} onProjectChange={setProjectDir} />;
      case 'puppy':
        return <PuppyGuiPage status={status} projectDir={projectDir} onProjectChange={setProjectDir} />;
      case 'live':
        return <LivePage />;
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
            onOpenChat={() => navigate('puppy')}
          />
        );
    }
  }

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
            <strong>OMEGA ONE</strong>
            <span className="omega-slash">/</span>
            <span>{currentModule?.label ?? 'Overview'}</span>
          </div>
          <div className="omega-shell-meta">
            <span>ORCHESTRATION CONSOLE</span>
            <span className="omega-shell-status"><i className={status?.running ? 'is-online' : ''} /> {status === null ? 'SERVER CHECKING' : status.running ? 'HARNESS CONNECTED' : 'HARNESS OFFLINE'}</span>
          </div>
        </header>
        <main className={'omega-shell-content ' + (activeModule === 'puppy' ? 'is-full' : '')}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

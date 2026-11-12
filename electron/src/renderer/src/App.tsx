// App.tsx
// Puppy Omega One — app shell (icon sidebar + header + page routing).
// Mirrors ant3869/electron-react-dark-starter src/renderer/src/App.tsx:
// same w-16 icon sidebar, header with module name, useState page routing,
// tokens-driven styling. Adds a server-status pill in the header.

import React, { useEffect, useMemo, useState } from 'react';
import { Play, Activity, FileText, BookOpen, MessageSquare, PawPrint } from 'lucide-react';
import { tokens } from './lib/tokens';
import type { PuppyStatus } from '@shared/types';

import RunPage from './pages/RunPage';
import LivePage from './pages/LivePage';
import BriefsPage from './pages/BriefsPage';
import ProgressPage from './pages/ProgressPage';
import PuppyGuiPage from './pages/PuppyGuiPage';

type ModuleId = 'run' | 'live' | 'briefs' | 'progress' | 'puppy';

const modules: { id: ModuleId; name: string; icon: any }[] = [
  { id: 'run', name: 'Run a job', icon: Play },
  { id: 'live', name: 'Live run', icon: Activity },
  { id: 'briefs', name: 'Briefs', icon: FileText },
  { id: 'progress', name: 'Progress', icon: BookOpen },
  { id: 'puppy', name: 'Puppy GUI', icon: MessageSquare }
];

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('run');
  const [status, setStatus] = useState<PuppyStatus | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await window.omega.puppy.getStatus();
        if (alive) setStatus(s);
      } catch {
        if (alive) setStatus(null);
      }
    };
    void poll();
    const t = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const currentModule = useMemo(() => modules.find((m) => m.id === activeModule), [activeModule]);

  const render = () => {
    switch (activeModule) {
      case 'run':
        return <RunPage onOpenPuppy={() => setActiveModule('puppy')} />;
      case 'live':
        return <LivePage />;
      case 'briefs':
        return <BriefsPage />;
      case 'progress':
        return <ProgressPage />;
      case 'puppy':
        return <PuppyGuiPage status={status} />;
      default:
        return <RunPage onOpenPuppy={() => setActiveModule('puppy')} />;
    }
  };

  const serverLabel = status === null ? 'server: unknown' : status.running ? 'server: up' : 'server: down';
  const serverColor = status?.running ? tokens.status.pass : tokens.status.fail;

  return (
    <div className="min-h-screen" style={{ background: tokens.bg.base }}>
      <div className="relative flex h-screen">
        {/* Sidebar */}
        <div
          className="w-16 flex flex-col items-center py-5 border-r"
          style={{ background: tokens.bg.surface1, borderColor: tokens.border.default }}
        >
          <div
            className="w-9 h-9 flex items-center justify-center mb-6"
            style={{ background: tokens.accent.primary, borderRadius: tokens.radius }}
            title="Puppy Omega One"
          >
            <PawPrint className="w-5 h-5 text-black" />
          </div>

          <nav className="flex-1 flex flex-col gap-1 w-full px-2">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className="relative flex items-center justify-center w-full aspect-square transition-all"
                style={{
                  background: activeModule === module.id ? tokens.bg.surface3 : 'transparent',
                  borderRadius: tokens.radius
                }}
                title={module.name}
              >
                {activeModule === module.id && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5"
                    style={{ background: tokens.accent.primary, borderRadius: 2 }}
                  />
                )}
                <module.icon
                  className="w-[18px] h-[18px]"
                  style={{ color: activeModule === module.id ? tokens.text.primary : tokens.text.tertiary }}
                />
              </button>
            ))}
          </nav>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 flex items-center justify-between px-5 border-b"
            style={{ background: tokens.bg.surface1, borderColor: tokens.border.default }}
          >
            <h1 className="text-sm font-medium" style={{ color: tokens.text.primary }}>
              {currentModule?.name}
            </h1>
            <div className="flex items-center gap-2 text-xs" style={{ color: tokens.text.secondary }}>
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: serverColor }}
                title={serverLabel}
              />
              {serverLabel}
              {status?.spawnedByUs ? ' (spawned by this app)' : ''}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-5">{render()}</main>
        </div>
      </div>
    </div>
  );
}

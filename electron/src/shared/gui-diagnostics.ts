export type GuiProbeKey = 'health' | 'agents' | 'models' | 'activeSession';
export type GuiProbeOutcome = 'responded' | 'missing' | 'restricted' | 'unexpected' | 'unreachable';

export interface GuiProbeResult {
  key: GuiProbeKey;
  label: string;
  path: string;
  outcome: GuiProbeOutcome;
  status: number | null;
  durationMs: number;
}

export interface GuiDiagnostics {
  checkedAt: number;
  host: string;
  results: GuiProbeResult[];
}

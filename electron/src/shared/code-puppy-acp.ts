export type CodePuppyConnection = 'offline' | 'connecting' | 'ready' | 'working' | 'stopping' | 'error';
export interface CodePuppyChatEvent {
  id: number;
  kind: 'text' | 'thinking' | 'tool' | 'status' | 'user' | 'error';
  text: string;
}
export interface CodePuppySnapshot {
  connection: CodePuppyConnection;
  projectDir: string | null;
  sessionId: string | null;
  events: CodePuppyChatEvent[];
  error: string | null;
}

export function unavailableCodePuppy(): CodePuppySnapshot {
  return { connection: 'offline', projectDir: null, sessionId: null, events: [], error: null };
}

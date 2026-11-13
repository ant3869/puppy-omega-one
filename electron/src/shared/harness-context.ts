export type ContextReadState = 'available' | 'unavailable' | 'error';

export interface ContextField {
  state: ContextReadState;
  value: string | null;
}

export interface HarnessContext {
  /** Names reported by the local GUI; not an attested session binding. */
  agent: ContextField;
  model: ContextField;
  session: ContextField;
  observedAt: number;
}

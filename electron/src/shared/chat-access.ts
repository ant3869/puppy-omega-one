import type { PuppyStatus } from './types';

export type ChatAccess = 'offline' | 'choose-project' | 'owned-project' | 'unverified-server';

/**
 * The launch workspace only describes the cwd passed by Omega when it
 * spawned the server. It does not attest to the runtime's current cwd.
 */
export function chatAccess(status: PuppyStatus | null, projectDir: string | null): ChatAccess {
  if (!status?.running) return 'offline';
  if (!projectDir) return 'choose-project';
  if (status.spawnedByUs && status.launchWorkspace === projectDir) return 'owned-project';
  return 'unverified-server';
}

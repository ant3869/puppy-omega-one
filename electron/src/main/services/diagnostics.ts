import type { GuiDiagnostics, GuiProbeKey, GuiProbeOutcome, GuiProbeResult } from '../../shared/gui-diagnostics';

const READ_ONLY_PROBES: ReadonlyArray<{ key: GuiProbeKey; label: string; path: string }> = [
  { key: 'health', label: 'Health endpoint', path: '/api/health' },
  { key: 'agents', label: 'Agent catalog', path: '/api/agents' },
  { key: 'models', label: 'Model catalog', path: '/api/models' },
  { key: 'activeSession', label: 'Active session', path: '/api/sessions/active' }
];

/**
 * GET-only loopback status checks. Does not read response bodies, send prompts,
 * create sessions, change model settings, or modify Code Puppy installations.
 */
export async function probeGui(
  port: number,
  fetcher: typeof fetch = fetch,
  timeoutMs = 1800
): Promise<GuiDiagnostics> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('A valid loopback Puppy GUI port is required.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
    throw new Error('Invalid diagnostics timeout.');
  }
  const host = 'http://127.0.0.1:' + port;
  const checkedAt = Date.now();

  const results: GuiProbeResult[] = await Promise.all(READ_ONLY_PROBES.map(async (probe) => {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(host + probe.path, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store'
      });
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      let outcome: GuiProbeOutcome;
      if (response.ok && contentType.includes('json')) outcome = 'responded';
      else if (response.status === 404) outcome = 'missing';
      else if (response.status === 401 || response.status === 403) outcome = 'restricted';
      else outcome = 'unexpected';
      await response.body?.cancel().catch(() => undefined);
      return {
        ...probe,
        outcome,
        status: response.status,
        durationMs: Date.now() - start
      };
    } catch {
      return {
        ...probe,
        outcome: 'unreachable' as GuiProbeOutcome,
        status: null,
        durationMs: Date.now() - start
      };
    } finally {
      clearTimeout(timeout);
    }
  }));

  return { checkedAt, host, results };
}

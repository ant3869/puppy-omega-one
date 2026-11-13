import type { ContextField, HarnessContext } from '../../shared/harness-context';

type LocalFetch = (url: string, init: RequestInit) => Promise<Response>;

const MAX_BODY_BYTES = 131_072;
const MAX_NAME = 96;

function safeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return normalized && normalized.length <= MAX_NAME ? normalized : null;
}

function nameFrom(body: unknown, key: 'agent' | 'model' | 'session'): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const obj = body as Record<string, unknown>;
  if (key === 'agent') return safeName(obj.name);
  if (key === 'model') return safeName(obj.name);
  return safeName(obj.current);
}

async function smallJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Empty response body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw new Error('Response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.length;
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function validGuiPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Explicitly requested, read-only active context. Never expose raw GUI
 * endpoint bodies: agent data may contain tools, session lists can contain
 * private names, and model data can include provider configuration.
 */
export async function readHarnessContext(
  port: number,
  fetcher: LocalFetch = fetch
): Promise<HarnessContext> {
  if (!validGuiPort(port)) throw new Error('Invalid loopback GUI port.');
  const origin = `http://127.0.0.1:${port}`;
  const endpoints = [
    ['agent', '/api/agents/active'],
    ['model', '/api/models/active'],
    ['session', '/api/sessions']
  ] as const;

  async function read(key: 'agent' | 'model' | 'session', path: string): Promise<ContextField> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2200);
    try {
      const response = await fetcher(origin + path, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json' }
      });
      if (response.status === 404 || response.status === 405) return { state: 'unavailable', value: null };
      if (!response.ok || response.redirected || response.status >= 300) return { state: 'error', value: null };
      const name = nameFrom(await smallJson(response), key);
      return name
        ? { state: 'available', value: name }
        : { state: 'unavailable', value: null };
    } catch {
      return { state: 'error', value: null };
    } finally {
      clearTimeout(timer);
    }
  }

  const [agent, model, session] = await Promise.all(
    endpoints.map(([key, path]) => read(key, path))
  );

  return { agent, model, session, observedAt: Date.now() };
}

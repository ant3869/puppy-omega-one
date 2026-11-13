import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readHarnessContext, validGuiPort } from './harness-context';

test('only three GET requests to literal loopback endpoints and a tiny allowlisted snapshot', async () => {
  const paths: string[] = [];
  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    paths.push(url);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'manual');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.referrerPolicy, 'no-referrer');
    if (url.endsWith('/api/agents/active')) return Response.json({
      name: 'omega-builder', tools: ['shell', 'edit_file'], system_prompt: 'TOP SECRET'
    });
    if (url.endsWith('/api/models/active')) return Response.json({
      name: 'example-model', settings: { key: 'not-in-snapshot' },
      api_key: 'DO_NOT_EXPOSE'
    });
    return Response.json({
      current: 'work-session', sessions: [{ name: 'private-customer', messages: ['secret'] }]
    });
  };
  const result = await readHarnessContext(8765, fetcher);
  assert.deepEqual(paths, [
    'http://127.0.0.1:8765/api/agents/active',
    'http://127.0.0.1:8765/api/models/active',
    'http://127.0.0.1:8765/api/sessions'
  ]);
  assert.deepEqual(result.agent, { state: 'available', value: 'omega-builder' });
  assert.deepEqual(result.model, { state: 'available', value: 'example-model' });
  assert.deepEqual(result.session, { state: 'available', value: 'work-session' });
  const text = JSON.stringify(result);
  for (const secret of ['TOP SECRET', 'DO_NOT_EXPOSE', 'private-customer', 'shell', 'not-in-snapshot']) {
    assert.equal(text.includes(secret), false);
  }
});

test('a missing route is displayed as unavailable, not a made-up value', async () => {
  const response = await readHarnessContext(8765, async () => new Response(null, { status: 404 }));
  for (const field of [response.agent, response.model, response.session]) {
    assert.deepEqual(field, { state: 'unavailable', value: null });
  }
});

test('redirect, failure, malformed and oversized responses are not surfaced to renderer', async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => new Response(null, { status: 302, headers: { Location: 'https://example.com/secret' } }),
    async () => { throw new Error('Bearer secret123'); },
    async () => new Response('{invalid-json'),
    async () => Response.json({ name: 'A'.repeat(97), current: 'A'.repeat(97) }),
    async () => Response.json({ name: 'A', current: 'A', messages: 'x'.repeat(150000) })
  ];
  for (const response of cases) {
    const result = await readHarnessContext(8765, response);
    assert.equal(result.agent.value, null);
    assert.equal(result.model.value, null);
    assert.equal(result.session.value, null);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
});

test('non-loopback or invalid ports cannot start requests', async () => {
  for (const port of [-1, 0, 65536, 1.5, NaN, Infinity]) {
    assert.equal(validGuiPort(port), false);
    await assert.rejects(readHarnessContext(port, async () => {
      throw new Error('must not be called');
    }), /Invalid loopback GUI port/);
  }
  assert.equal(validGuiPort(8765), true);
});

test('control characters in reported labels are rendered as single-line names', async () => {
  const result = await readHarnessContext(8765, async () => Response.json({
    name: 'omega-builder\nInjected status', current: 'session\rmessage'
  }));
  assert.equal(result.agent.value, 'omega-builder Injected status');
  assert.equal(result.session.value, 'session message');
});

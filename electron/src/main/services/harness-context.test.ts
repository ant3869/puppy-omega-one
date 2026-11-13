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
    if (url.endsWith('/api/agents')) return Response.json({
      agents: [{ name: 'omega-builder', active: true, tools: ['shell'], system_prompt: 'TOP SECRET' },
               { name: 'private-worker', active: false }]
    });
    if (url.endsWith('/api/models')) return Response.json({
      active: { name: 'example-model', settings: { key: 'not-in-snapshot' } },
      models: [{ name: 'example-model', api_key: 'DO_NOT_EXPOSE' }]
    });
    return Response.json({
      current: 'work-session', sessions: [{ name: 'private-customer', messages: ['secret'] }]
    });
  };
  const result = await readHarnessContext(8765, fetcher);
  assert.deepEqual(paths, [
    'http://127.0.0.1:8765/api/agents',
    'http://127.0.0.1:8765/api/models',
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
    async () => Response.json({ agents: [{ name: 'A'.repeat(97), active: true }], active: { name: 'A'.repeat(97) }, current: 'A'.repeat(97) }),
    async () => Response.json({ agents: [{ name: 'A', active: true }], active: { name: 'A' }, current: 'A', messages: 'x'.repeat(150000) })
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
    agents: [{ name: 'omega-builder\nInjected status', active: true }],
    active: { name: 'example-model' },
    current: 'session\rmessage'
  }));
  assert.equal(result.agent.value, 'omega-builder Injected status');
  assert.equal(result.session.value, 'session message');
});

test('conflicting active agent flags are not guessed', async () => {
  const result = await readHarnessContext(8765, async (url) => Response.json(
    url.endsWith('/api/agents')
      ? { agents: [{ name: 'one', active: true }, { name: 'two', active: true }] }
      : { active: { name: 'model' }, current: 'saved' }
  ));
  assert.deepEqual(result.agent, { state: 'unavailable', value: null });
});

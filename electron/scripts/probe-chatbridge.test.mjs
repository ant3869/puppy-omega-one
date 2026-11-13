import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import WebSocket, { WebSocketServer } from 'ws';
import { parseArguments, probeChatBridge, validatedWebSocketUrl } from './probe-chatbridge.mjs';

async function mockServer(onConnection) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, path: '/ws/chat' });
  await once(server, 'listening');
  if (onConnection) server.on('connection', onConnection);
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    async close() {
      for (const client of server.clients) client.terminate();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

test('unacknowledged probe opens no WebSocket and sends nothing', async () => {
  let connections = 0;
  const server = await mockServer(() => { connections++; });
  try {
    const result = await probeChatBridge({ origin: server.origin });
    assert.equal(result.attempted, false);
    assert.equal(result.result, 'explicit_acknowledgement_required');
    assert.equal(result.session_identity, 'not_verified');
    assert.equal(connections, 0);
  } finally {
    await server.close();
  }
});

test('acknowledged probe sends only one fixed ping and redacts unrelated frames', async () => {
  const sent = [];
  const server = await mockServer((socket) => {
    socket.send(JSON.stringify({ type: 'message', data: { content: 'SECRET TRANSCRIPT' } }));
    socket.on('message', (payload) => {
      sent.push(payload.toString());
      socket.send(JSON.stringify({ type: 'pong', private_value: 'SECRET TOKEN' }));
    });
  });
  try {
    const result = await probeChatBridge({ origin: server.origin, acknowledged: true });
    assert.equal(result.attempted, true);
    assert.equal(result.websocket_opened, true);
    assert.equal(result.pong_observed, true);
    assert.equal(result.ignored_frame_count, 1);
    assert.equal(result.session_identity, 'not_verified');
    assert.equal(result.project_identity, 'not_verified');
    assert.equal(result.server_side_connection_effects, 'unknown');
    assert.deepEqual(sent, ['{"action":"ping"}']);
    assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  } finally {
    await server.close();
  }
});

test('silence results in bounded timeout, not a false success', async () => {
  const messages = [];
  const server = await mockServer((socket) => {
    socket.on('message', (payload) => messages.push(payload.toString()));
  });
  try {
    const result = await probeChatBridge({
      origin: server.origin,
      acknowledged: true,
      timeoutMs: 120
    });
    assert.equal(result.pong_observed, false);
    assert.match(result.result, /timed_out|connection_error/);
    assert.deepEqual(messages, ['{"action":"ping"}']);
  } finally {
    await server.close();
  }
});

test('non-WebSocket HTTP response cannot be treated as a pong or followed', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(302, { Location: 'ws://example.com/ws/chat' });
    response.end('redirect refused');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const result = await probeChatBridge({ origin, acknowledged: true, timeoutMs: 600 });
    assert.equal(result.pong_observed, false);
    assert.equal(result.websocket_opened, false);
    assert.equal(result.result, 'connection_error');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('only exact loopback origins are accepted, with no credentials or paths', () => {
  assert.equal(validatedWebSocketUrl('http://127.0.0.1:8765'), 'ws://127.0.0.1:8765/ws/chat');
  for (const value of [
    'http://localhost:8765', 'http://127.0.0.1', 'http://127.0.0.1:0',
    'http://127.0.0.1:65536', 'http://127.0.0.1:08765',
    'http://127.0.0.1:8765/', 'http://127.0.0.1:8765?token=x',
    'http://user:pass@127.0.0.1:8765', 'https://127.0.0.1:8765',
    'http://127.0.0.2:8765', 'http://127.0.0.1:8765@remote.example'
  ]) {
    assert.throws(() => validatedWebSocketUrl(value), /exact http:/);
  }
  for (const args of [
    ['--origin'], ['--origin', 'http://127.0.0.1:8765', '--origin', 'http://127.0.0.1:9000'],
    ['--acknowledge-session-side-effects', '--acknowledge-session-side-effects'],
    ['--unknown']
  ]) {
    assert.throws(() => parseArguments(args));
  }
  assert.equal(parseArguments([]).acknowledged, false);
  assert.equal(parseArguments(['--acknowledge-session-side-effects']).acknowledged, true);
});

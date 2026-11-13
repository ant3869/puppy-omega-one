import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import WebSocket, { WebSocketServer } from 'ws';
import { WorkflowTransport } from './workflow-transport';

async function listen(port = 0): Promise<WebSocketServer> {
  const server = new WebSocketServer({ host: '127.0.0.1', port });
  await once(server, 'listening');
  return server;
}

async function waitUntil(predicate: () => boolean, timeout = 3000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error('Timed out waiting for WebSocket state');
}

async function closeServer(server: WebSocketServer): Promise<void> {
  for (const connection of server.clients) connection.terminate();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test('read-only connection projects real worker messages and ignores invalid frames', async () => {
  const server = await listen();
  const port = (server.address() as AddressInfo).port;
  const clients: WebSocket[] = [];
  const outgoing: string[] = [];
  server.on('connection', (client) => {
    clients.push(client);
    client.on('message', (payload) => outgoing.push(payload.toString()));
  });

  const transport = new WorkflowTransport(`ws://127.0.0.1:${port}/ws/chat`, 50);
  try {
    transport.start();
    transport.start();
    await waitUntil(() => clients.length === 1 && transport.getState().connection === 'connected');

    clients[0].send('{invalid json');
    clients[0].send(JSON.stringify({ type: 'turn_start', agent: 'omega-orchestrator' }));
    clients[0].send(JSON.stringify({
      type: 'message',
      kind: 'SubAgentInvocationMessage',
      data: { agent_name: 'omega-builder', prompt: 'Implement settings' }
    }));
    await waitUntil(() => transport.getState().workers['omega-builder'].phase === 'running');
    assert.equal(transport.getState().turnCount, 1);

    clients[0].send(JSON.stringify({
      type: 'message',
      kind: 'SubAgentResponseMessage',
      data: { agent_name: 'omega-builder', response: 'Code changes done' }
    }));
    clients[0].send(JSON.stringify({ type: 'turn_end', agent: 'omega-orchestrator' }));
    await waitUntil(() => transport.getState().phase === 'finished');
    assert.equal(transport.getState().workers['omega-builder'].phase, 'responded');
    assert.match(transport.getState().activity, /verification not confirmed/);
    assert.deepEqual(outgoing, [], 'Observer must not send prompts or approval responses');
  } finally {
    transport.stop();
    await closeServer(server);
  }
});

test('transport disconnects visibly, then reconnects without inventing fresh activity', async () => {
  const first = await listen();
  const port = (first.address() as AddressInfo).port;
  const transport = new WorkflowTransport(`ws://127.0.0.1:${port}/ws/chat`, 80);
  try {
    transport.start();
    await waitUntil(() => transport.getState().connection === 'connected');
    await closeServer(first);
    await waitUntil(() => transport.getState().connection !== 'connected');
    assert.match(transport.getState().activity, /stale|Connecting/);

    const second = await listen(port);
    try {
      await waitUntil(() => transport.getState().connection === 'connected');
      assert.equal(transport.getState().turnCount, 0);
    } finally {
      transport.stop();
      await closeServer(second);
    }
    assert.equal(transport.getState().connection, 'disconnected');
  } finally {
    transport.stop();
  }
});

test('transport rejects non-loopback endpoints', () => {
  assert.throws(() => new WorkflowTransport('wss://example.com/ws/chat'), /loopback/);
  assert.throws(() => new WorkflowTransport('ws://localhost:8765/ws/chat'), /loopback/);
  assert.throws(() => new WorkflowTransport('ws://127.0.0.1:8765/not-chat'), /loopback/);
});

test('opening Omega does not create an unrequested chat WebSocket', async () => {
  const server = await listen();
  const port = (server.address() as AddressInfo).port;
  let connections = 0;
  server.on('connection', () => { connections++; });
  const transport = new WorkflowTransport(`ws://127.0.0.1:${port}/ws/chat`, 50);
  try {
    assert.equal(transport.getState().monitoring, false);
    await new Promise((resolve) => setTimeout(resolve, 65));
    assert.equal(connections, 0, 'No transport connection until explicit start');
    transport.start();
    await waitUntil(() => transport.getState().connection === 'connected');
    assert.equal(transport.getState().monitoring, true);
    assert.equal(connections, 1);
    transport.stop();
    await waitUntil(() => transport.getState().connection === 'disconnected');
    assert.equal(transport.getState().monitoring, false);
    assert.match(transport.getState().activity, /stopped/);
  } finally {
    transport.stop();
    await closeServer(server);
  }
});

test('explicit disconnect prevents background reconnect to a returning server', async () => {
  const first = await listen();
  const port = (first.address() as AddressInfo).port;
  const transport = new WorkflowTransport(`ws://127.0.0.1:${port}/ws/chat`, 75);
  try {
    transport.start();
    await waitUntil(() => transport.getState().connection === 'connected');
    await closeServer(first);
    await waitUntil(() => transport.getState().connection === 'disconnected');
    assert.equal(transport.getState().monitoring, true);
    transport.stop();
    assert.equal(transport.getState().monitoring, false);

    const second = await listen(port);
    let count = 0;
    second.on('connection', () => { count++; });
    try {
      await new Promise((resolve) => setTimeout(resolve, 190));
      assert.equal(count, 0, 'No retry should run after explicit stop');
      assert.equal(transport.getState().connection, 'disconnected');
    } finally {
      await closeServer(second);
    }
  } finally {
    transport.stop();
  }
});

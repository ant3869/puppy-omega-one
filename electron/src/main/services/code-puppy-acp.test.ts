import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodePuppyAcpClient } from './code-puppy-acp';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '../../../scripts/mock-acp-agent.mjs');

function withProject(action: (dir: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'omega-acp-'));
  return action(root).finally(() => rmSync(root, { recursive: true, force: true }));
}

test('direct ACP process negotiates session for selected cwd and streams text', async () => {
  await withProject(async (dir) => {
    const client = new CodePuppyAcpClient();
    try {
      assert.equal(client.getSnapshot().connection, 'offline');
      const ready = await client.start(dir, process.execPath, [fixture]);
      assert.equal(ready.connection, 'ready');
      assert.equal(ready.sessionId, 'fixture-session-1');
      assert.equal(ready.projectDir, dir);

      await client.prompt('hello');
      const result = client.getSnapshot();
      assert.equal(result.connection, 'ready');
      assert.ok(result.events.some((ev) => ev.kind === 'user' && ev.text === 'hello'));
      assert.ok(result.events.some((ev) => ev.kind === 'text' && ev.text.includes('Direct ACP works')));
      assert.ok(result.events.some((ev) => ev.kind === 'status' && ev.text.includes('end_turn')));
      assert.equal(result.error, null);
    } finally {
      client.stop();
    }
    assert.equal(client.getSnapshot().connection, 'offline');
  });
});

test('sending before an ACP session is refused without launching a child', async () => {
  const client = new CodePuppyAcpClient();
  await assert.rejects(client.prompt('hello'), /Start Code Puppy/);
  await assert.rejects(client.prompt('   '), /1 to 20000/);
  assert.equal(client.getSnapshot().connection, 'offline');
  client.stop();
});

test('unavailable CLI fails visibly instead of suggesting a GUI fallback', async () => {
  await withProject(async (dir) => {
    const client = new CodePuppyAcpClient();
    try {
      await assert.rejects(client.start(dir, '/unlikely-nonexistent-code-puppy-omega'), /start|launch|stopped|exited/i);
      assert.equal(client.getSnapshot().connection, 'error');
      assert.match(client.getSnapshot().error || '', /executable|process|launch/i);
    } finally {
      client.stop();
    }
  });
});

test('long ACP stream chunks retain every character without silent 4k clipping', async () => {
  await withProject(async (dir) => {
    const client = new CodePuppyAcpClient();
    try {
      await client.start(dir, process.execPath, [fixture]);
      await client.prompt('long text');
      const text = client.getSnapshot().events.filter((ev) => ev.kind === 'text').map((ev) => ev.text).join('');
      assert.equal(text.length, 5013);
      assert.equal(text, 'X'.repeat(5013));
      assert.equal(client.getSnapshot().connection, 'ready');
    } finally {
      client.stop();
    }
  });
});

test('agent closing stdin fails closed on EPIPE or bounded prompt timeout', { timeout: 5000 }, async () => {
  await withProject(async (dir) => {
    const client = new CodePuppyAcpClient();
    try {
      const started = await client.start(dir, process.execPath, [fixture, '--close-stdin']);
      assert.equal(started.connection, 'ready');
      // Allow the fixture to close its read end while keeping the process alive.
      await new Promise((resolve) => setTimeout(resolve, 150));
      await assert.rejects(client.prompt('hello after stdin closes', 700), /Code Puppy|connection|prompt/i);
      assert.equal(client.getSnapshot().connection, 'error');
      assert.match(client.getSnapshot().error || '', /input pipe|process|timed out/i);
    } finally {
      client.stop();
    }
  });
});

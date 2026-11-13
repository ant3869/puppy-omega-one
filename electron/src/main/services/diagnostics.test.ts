import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { probeGui } from './diagnostics';

test('diagnostics perform only four allowlisted GET requests on loopback', async () => {
  const calls: Array<{ method: string | undefined; path: string | undefined }> = [];
  const server = createServer((req, res) => {
    calls.push({ method: req.method, path: req.url });
    if (req.url === '/api/models') {
      res.writeHead(404);
      res.end();
    } else if (req.url === '/api/sessions/active') {
      res.writeHead(403);
      res.end();
    } else {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ secret: 'do-not-copy-response-bodies' }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = (server.address() as AddressInfo).port;
    const report = await probeGui(port);
    assert.equal(report.host, 'http://127.0.0.1:' + port);
    assert.deepEqual(report.results.map((item) => [item.key, item.outcome]), [
      ['health', 'responded'], ['agents', 'responded'], ['models', 'missing'], ['activeSession', 'restricted']
    ]);
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.map((item) => item.path).sort(), [
      '/api/agents', '/api/health', '/api/models', '/api/sessions/active'
    ]);
    assert.ok(calls.every((item) => item.method === 'GET'));
    assert.doesNotMatch(JSON.stringify(report), /do-not-copy-response-bodies/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('diagnostics do not follow redirects or send credentials', async () => {
  const observed: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (request, init) => {
    observed.push({ url: String(request), init: init ?? {} });
    return new Response('<html>unexpected</html>', {
      status: 200, headers: { 'content-type': 'text/html' }
    });
  };
  const report = await probeGui(8765, fakeFetch);
  assert.ok(report.results.every((item) => item.outcome === 'unexpected'));
  assert.equal(observed.length, 4);
  for (const { url, init } of observed) {
    assert.match(url, /^http:\/\/127\.0\.0\.1:8765\/api\//);
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
  }
});

test('offline endpoints report unreachable without exposing raw exception messages', async () => {
  const fail: typeof fetch = async () => { throw new Error('secret token in exception'); };
  const report = await probeGui(8765, fail);
  assert.ok(report.results.every((item) => item.outcome === 'unreachable' && item.status === null));
  assert.doesNotMatch(JSON.stringify(report), /secret token/);
});

test('invalid ports and timeouts fail before any request', async () => {
  let calls = 0;
  const fake: typeof fetch = async () => { calls++; throw new Error('unavailable'); };
  await assert.rejects(() => probeGui(0, fake), /valid loopback/);
  await assert.rejects(() => probeGui(65536, fake), /valid loopback/);
  await assert.rejects(() => probeGui(8765, fake, 0), /Invalid diagnostics timeout/);
  assert.equal(calls, 0);
});

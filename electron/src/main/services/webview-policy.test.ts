import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedExternalUrl, isTrustedGuiUrl } from './webview-policy';

test('GUI frame accepts only the configured IPv4 loopback HTTP origin', () => {
  assert.equal(isTrustedGuiUrl('http://127.0.0.1:8765/', 8765), true);
  assert.equal(isTrustedGuiUrl('http://127.0.0.1:8765/?view=chat', 8765), true);
  for (const link of [
    'https://127.0.0.1:8765/',
    'http://localhost:8765/',
    'http://127.0.0.1:8766/',
    'http://127.0.0.1.evil.example:8765/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://user:password@127.0.0.1:8765/',
    'about:blank',
    'not a URL'
  ]) assert.equal(isTrustedGuiUrl(link, 8765), false, link);
});

test('GUI origin validation rejects invalid port settings', () => {
  for (const port of [0, -1, 99999, NaN, 8765.5]) {
    assert.equal(isTrustedGuiUrl('http://127.0.0.1:8765', port), false);
  }
});

test('external links permit browser-safe HTTP(S) only', () => {
  assert.equal(allowedExternalUrl('https://example.org/guide'), true);
  assert.equal(allowedExternalUrl('http://example.org'), true);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,test', 'mailto:someone@example.org', 'http://user:pass@example.org']) {
    assert.equal(allowedExternalUrl(url), false);
  }
});

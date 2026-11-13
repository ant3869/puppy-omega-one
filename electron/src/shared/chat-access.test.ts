import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatAccess } from './chat-access';
import type { PuppyStatus } from './types';

const base: PuppyStatus = {
  running: true,
  spawnedByUs: true,
  port: 8765,
  url: 'http://127.0.0.1:8765',
  launchWorkspace: '/projects/one'
};

test('chat stays locked until a project is selected', () => {
  assert.equal(chatAccess(base, null), 'choose-project');
  assert.equal(chatAccess({ ...base, running: false }, '/projects/one'), 'offline');
  assert.equal(chatAccess(null, '/projects/one'), 'offline');
});

test('only the GUI Omega launched for the same project is an owned session', () => {
  assert.equal(chatAccess(base, '/projects/one'), 'owned-project');
  assert.equal(chatAccess(base, '/projects/two'), 'unverified-server');
  assert.equal(chatAccess({ ...base, spawnedByUs: false }, '/projects/one'), 'unverified-server');
  assert.equal(chatAccess({ ...base, launchWorkspace: null }, '/projects/one'), 'unverified-server');
});

test('external servers cannot spoof project ownership with a workspace label alone', () => {
  const external: PuppyStatus = { ...base, spawnedByUs: false, launchWorkspace: '/projects/one' };
  assert.equal(chatAccess(external, '/projects/one'), 'unverified-server');
});

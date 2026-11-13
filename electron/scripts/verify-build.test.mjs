import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyBuild } from './verify-build.mjs';

function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'omega-build-entry-test-'));
  try {
    mkdirSync(join(root, 'src', 'main'), { recursive: true });
    mkdirSync(join(root, 'out', 'main'), { recursive: true });
    mkdirSync(join(root, 'out', 'preload'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ main: 'out/main/index.js' }));
    writeFileSync(join(root, 'out', 'main', 'index.js'), 'export {};\n');
    writeFileSync(join(root, 'out', 'preload', 'index.js'),
      '"use strict";\nconst electron = require("electron");\n');
    writeFileSync(join(root, 'src', 'main', 'main.ts'),
      "const preloadPath = new URL('../preload/index.js', import.meta.url);\n" +
      'const preferences = { sandbox: true, contextIsolation: true, nodeIntegration: false };\n');
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts matching main entry, CommonJS preload and secure window settings', () => {
  withFixture((root) => assert.ok(verifyBuild(root).preloadPath.endsWith('index.js')));
});

test('rejects the old nonexistent Electron main entry', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ main: 'out/main/main.js' }));
    assert.throws(() => verifyBuild(root), /Rollup entry/);
  });
});

test('rejects ESM preload syntax in a sandboxed BrowserWindow', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'out', 'preload', 'index.js'),
      'import { contextBridge } from "electron";\n');
    assert.throws(() => verifyBuild(root), /CommonJS/);
  });
});

test('rejects an application still pointing at index.mjs', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'src', 'main', 'main.ts'),
      "const preloadPath = new URL('../preload/index.mjs', import.meta.url);\n" +
      'const preferences = { sandbox: true, contextIsolation: true, nodeIntegration: false };\n');
    assert.throws(() => verifyBuild(root), /index\.js/);
  });
});

test('rejects removal of Electron security preferences', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'src', 'main', 'main.ts'),
      "const preloadPath = new URL('../preload/index.js', import.meta.url);\n" +
      'const preferences = { sandbox: false, contextIsolation: true, nodeIntegration: false };\n');
    assert.throws(() => verifyBuild(root), /sandbox/);
  });
});

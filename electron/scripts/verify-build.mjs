import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyBuild(electronRoot) {
  const manifest = JSON.parse(readFileSync(join(electronRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.main, 'out/main/index.js', 'Electron package.main must match its Rollup entry.');

  const mainPath = join(electronRoot, manifest.main);
  const preloadPath = join(electronRoot, 'out', 'preload', 'index.js');
  assert.ok(existsSync(mainPath), 'Expected built main entry: out/main/index.js');
  assert.ok(existsSync(preloadPath), 'Expected built CommonJS preload: out/preload/index.js');

  const preload = readFileSync(preloadPath, 'utf8');
  assert.match(preload, /^\s*['"]use strict['"];?/, 'Sandboxed preload must start as CommonJS.');
  assert.match(preload, /\brequire\(['"]electron['"]\)/, 'Preload must use CommonJS require("electron").');
  assert.doesNotMatch(preload, /^\s*import\s+(?:[\w{*'"])/m, 'Sandboxed preload cannot use ESM imports.');

  const windowSource = readFileSync(join(electronRoot, 'src', 'main', 'main.ts'), 'utf8');
  assert.match(windowSource, /new URL\(['"]\.\.\/preload\/index\.js['"], import\.meta\.url\)/);
  assert.doesNotMatch(windowSource, /preload\/index\.mjs/);
  assert.match(windowSource, /sandbox\s*:\s*true\b/, 'Do not disable the Electron sandbox.');
  assert.match(windowSource, /contextIsolation\s*:\s*true\b/, 'Context isolation must remain enabled.');
  assert.match(windowSource, /nodeIntegration\s*:\s*false\b/, 'Renderer Node integration must stay disabled.');
  return { mainPath, preloadPath };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { mainPath, preloadPath } = verifyBuild(root);
  console.log('Verified built Electron main:', mainPath);
  console.log('Verified sandboxed CommonJS preload:', preloadPath);
  console.log('Verified contextIsolation=true, nodeIntegration=false, sandbox=true');
}

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assertProjectWorkspace } from './project-safety';

test('allows ordinary project inside home without touching global directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-safe-workspace-'));
  try {
    const home = join(root, 'home');
    const project = join(home, 'projects', 'my-project');
    mkdirSync(project, { recursive: true });
    assert.equal(assertProjectWorkspace(project, { home }), realpathSync.native(project));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rejects home, global config, venv and their ancestors', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-blocked-workspace-'));
  try {
    const home = join(root, 'home');
    const core = join(home, '.code_puppy', 'agents');
    const env = join(home, '.code-puppy-venv', 'Scripts');
    const config = join(home, '.config', 'code_puppy');
    mkdirSync(core, { recursive: true });
    mkdirSync(env, { recursive: true });
    mkdirSync(config, { recursive: true });
    for (const target of [root, home, core, join(home, '.code_puppy'), env, config]) {
      assert.throws(() => assertProjectWorkspace(target, { home }), /home|protected/);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('protects custom Python and Puppy GUI locations', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-other-workspace-'));
  try {
    const home = join(root, 'home');
    const projects = join(home, 'projects');
    const python = join(root, 'python-env', 'bin', 'python');
    const guiDir = join(root, 'puppy_gui');
    mkdirSync(projects, { recursive: true });
    mkdirSync(join(root, 'python-env', 'bin'), { recursive: true });
    mkdirSync(guiDir, { recursive: true });
    assert.throws(() => assertProjectWorkspace(guiDir, { home, python, guiDir }), /protected/);
    assert.throws(() => assertProjectWorkspace(join(root, 'python-env'), { home, python, guiDir }), /protected/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('blocks site-packages in a custom Python virtual environment', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-venv-site-packages-'));
  try {
    const home = join(root, 'home');
    const venv = join(root, 'custom-venv');
    const python = join(venv, 'bin', 'python');
    const packageSource = join(venv, 'lib', 'python3.13', 'site-packages', 'code_puppy');
    mkdirSync(packageSource, { recursive: true });
    mkdirSync(join(venv, 'bin'), { recursive: true });
    writeFileSync(join(venv, 'pyvenv.cfg'), 'home = /usr/bin\n');
    assert.throws(() => assertProjectWorkspace(packageSource, { home, python }), /protected/);
    assert.throws(() => assertProjectWorkspace(venv, { home, python }), /protected/);
    const regular = join(home, 'projects', 'my-code');
    mkdirSync(regular, { recursive: true });
    assert.equal(assertProjectWorkspace(regular, { home, python }), realpathSync.native(regular));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('system Python in /bin does not block unrelated project workspaces', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-system-python-'));
  try {
    const project = join(root, 'safe-project');
    mkdirSync(project, { recursive: true });
    assert.equal(assertProjectWorkspace(project, { home: join(root, 'home'), python: '/bin/python3' }), realpathSync.native(project));
    assert.equal(assertProjectWorkspace(project, { home: join(root, 'home'), python: '/usr/bin/python3' }), realpathSync.native(project));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('blocks both auto-discovered GUI checkouts without GUI env overrides', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-discovered-gui-'));
  try {
    const home = join(root, 'home');
    const local = join(home, 'puppy_gui');
    const nested = join(home, 'projects', 'puppy_gui');
    mkdirSync(local, { recursive: true });
    mkdirSync(nested, { recursive: true });
    for (const folder of [local, nested, join(nested, 'code_puppy_gui')]) {
      assert.throws(() => assertProjectWorkspace(folder, { home }), /protected/);
    }
    const future = join(nested, 'not-created', 'source');
    assert.equal(existsSync(future), false);
    assert.throws(() => assertProjectWorkspace(future, { home }), /protected/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rejects project symlink redirected to global core', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-symlink-workspace-'));
  try {
    const home = join(root, 'home');
    const core = join(home, '.code_puppy');
    const link = join(root, 'redirect');
    mkdirSync(core, { recursive: true });
    symlinkSync(core, link, 'dir');
    assert.throws(() => assertProjectWorkspace(link, { home }), /protected/);
    assert.throws(() => assertProjectWorkspace(join(link, 'future', 'child'), { home }), /protected/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

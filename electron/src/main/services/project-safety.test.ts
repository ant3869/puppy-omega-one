import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
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
    assert.equal(assertProjectWorkspace(project, { home }), project);
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

test('rejects project symlink redirected to global core', () => {
  const root = mkdtempSync(join(tmpdir(), 'omega-symlink-workspace-'));
  try {
    const home = join(root, 'home');
    const core = join(home, '.code_puppy');
    const link = join(root, 'redirect');
    mkdirSync(core, { recursive: true });
    symlinkSync(core, link, 'dir');
    assert.throws(() => assertProjectWorkspace(link, { home }), /protected/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export interface WorkspaceBoundaries {
  home?: string;
  configHome?: string;
  python?: string;
  guiDir?: string;
  guiLaunch?: string;
}

function canonical(path: string): string {
  const absolute = resolve(path);
  try {
    return realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

function protectedPythonEnvironment(python: string): string {
  const parent = dirname(python);
  const directory = basename(parent).toLowerCase();
  // Python venv executables reside in Scripts/ (Windows) or bin/ (POSIX).
  // Protect the WHOLE venv, including Lib/site-packages and global binaries.
  return directory === 'scripts' || directory === 'bin' ? dirname(parent) : parent;
}

function within(path: string, root: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

/**
 * The installer and Electron must reject home/global/core/venv workspaces.
 * This is defense-in-depth, not an OS-enforced sandbox against an agent
 * that has unrestricted shell access.
 */
export function assertProjectWorkspace(directory: string, limits: WorkspaceBoundaries = {}): string {
  if (typeof directory !== 'string' || !directory.trim()) throw new Error('Choose a project folder.');
  const target = canonical(directory);
  const home = canonical(limits.home ?? homedir());
  if (within(home, target)) {
    throw new Error('The home folder or one of its parents cannot be used as an Omega project.');
  }

  const roots = [
    join(home, '.code_puppy'),
    join(home, '.code-puppy-venv'),
    join(home, '.config', 'code_puppy'),
    join(home, '.config', 'code-puppy'),
    join(home, 'AppData', 'Roaming', 'code_puppy'),
    join(home, 'puppy_gui'),
    join(home, 'projects', 'puppy_gui'),
    limits.configHome ? join(limits.configHome, 'code_puppy') : '',
    limits.configHome ? join(limits.configHome, 'code-puppy') : '',
    limits.python && isAbsolute(limits.python) ? protectedPythonEnvironment(limits.python) : '',
    limits.guiDir ?? '',
    limits.guiLaunch && isAbsolute(limits.guiLaunch) ? dirname(limits.guiLaunch) : ''
  ].filter(Boolean);

  for (const root of roots) {
    const protectedPath = canonical(root);
    if (within(target, protectedPath) || within(protectedPath, target)) {
      throw new Error('This location overlaps a protected Code Puppy installation or configuration directory.');
    }
  }
  return target;
}

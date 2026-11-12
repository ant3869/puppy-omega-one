import assert from 'node:assert/strict';
import { test } from 'node:test';
import { guiLaunchSpec } from './gui-launch';

test('launches existing GUI from the selected project with explicit loopback flags', () => {
  const env = { SOME_KEY: 'present' };
  const spec = guiLaunchSpec('/opt/puppy_gui/launch_gui.py', '/home/user/projects/sample', 9876, env);
  assert.equal(spec.cwd, '/home/user/projects/sample');
  assert.deepEqual(spec.args, [
    '/opt/puppy_gui/launch_gui.py', '--host', '127.0.0.1', '--port', '9876', '--no-browser'
  ]);
  assert.equal(spec.env.CODE_PUPPY_GUI_NO_BROWSER, '1');
  assert.equal(spec.env.PUPPY_GUI_PORT, '9876');
  assert.deepEqual(env, { SOME_KEY: 'present' });
});

test('rejects invalid port and missing workspace', () => {
  assert.throws(() => guiLaunchSpec('/path/launch_gui.py', '/tmp/project', -1), /PUPPY_GUI_PORT/);
  assert.throws(() => guiLaunchSpec('/path/launch_gui.py', '/tmp/project', 99999), /PUPPY_GUI_PORT/);
  assert.throws(() => guiLaunchSpec('/path/launch_gui.py', '', 8765), /workspace/);
  assert.throws(() => guiLaunchSpec('', '/tmp/project', 8765), /launcher/);
});

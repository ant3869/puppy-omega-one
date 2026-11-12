export interface GuiLaunchSpec {
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/** The existing puppy_gui launcher supports these CLI flags. */
export function guiLaunchSpec(
  launchPath: string,
  workspace: string,
  port: number,
  environment: NodeJS.ProcessEnv = process.env
): GuiLaunchSpec {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PUPPY_GUI_PORT must be an integer from 1 to 65535.');
  }
  if (!launchPath || !workspace) throw new Error('An installed GUI launcher and explicit project workspace are required.');
  return {
    args: [launchPath, '--host', '127.0.0.1', '--port', String(port), '--no-browser'],
    cwd: workspace,
    env: {
      ...environment,
      PUPPY_GUI_PORT: String(port),
      CODE_PUPPY_GUI_NO_BROWSER: '1'
    }
  };
}

# Puppy Omega One architecture

## Active path

```text
Electron renderer (Chat + Omega graph)
          | typed contextBridge / IPC
          v
Electron main process (workspace.ts)
          | validates project cwd, owns child process
          v
code-puppy --acp (JSON-RPC v1 via stdio)
          | session/new, session/prompt, session/cancel, session/update
          v
Installed Code Puppy runtime, agent and tools
```

**No Puppy GUI, no webview and no ChatBridge HTTP/WebSocket transport.**

- `electron/src/main/services/code-puppy-acp.ts`: lifecycle, JSON-RPC
  framing, session ID, streamed event summaries, deny-by-default permissions.
- `electron/src/main/services/workspace.ts`: project-checked IPC, local
  run draft persistence, optional ACP-sourced workflow projection.
- `electron/src/shared/code-puppy-acp.ts`: typed public snapshot contract.
- `electron/src/renderer/src/pages/CodePuppyChatPage.tsx`: native chat.
- `electron/src/renderer/src/pages/WorkflowOverviewPage.tsx`: Demo,
  Saved and **same-session** Live worker graph.
- `templates/.code_puppy/agents/`: project-local Omega agent definitions.
- `install.ps1` / `install.sh`: guarded local template installers.

## Trust boundaries

Only main process can spawn an external runtime. Renderer-supplied paths
are checked for protected roots and links. The app does not enable
`nodeIntegration`, embedded webviews or implicit GUI startup.

ACP approval requests are currently denied; client FS/terminal delegation
is not advertised. A Code Puppy agent or plugin could still access the OS
user's permitted resources. Omega is not an OS-level sandbox.

A generic ACP tool event is **observed execution**, not independently
verified specialist completion. True Omega task delegation and check results
require explicit event/agent contracts and test fixtures. See
[implementation status](STATUS.md).

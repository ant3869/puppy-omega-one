# Puppy Omega One — native Electron client

The Electron application is a first-party **Code Puppy ACP client**:
`code-puppy --acp` over stdio. It has **no separate GUI dependency**,
HTTP GUI backend, embedded webview or ChatBridge WebSocket.

## Develop

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Choose a safe project, click Start Code Puppy, then send a prompt.
If the command isn't on PATH, supply the full executable path through
`CODE_PUPPY_EXECUTABLE`. Nothing starts automatically on app launch.

- `src/main/services/code-puppy-acp.ts`: ACP JSON-RPC client and owned
  process lifecycle, streamed activity and permission denial.
- `src/main/services/workspace.ts`: validated IPC, project documents,
  local drafts and same-session Omega event projection.
- `src/renderer/src/pages/CodePuppyChatPage.tsx`: native conversation UI.
- `src/renderer/src/pages/WorkflowOverviewPage.tsx`: Omega Demo/Saved/Live.
- `src/preload/index.ts`: typed, sandboxed contextBridge.
- `scripts/mock-acp-agent.mjs`: harmless ACP test double for CI.

The automated tests verify handshake, cwd, prompt and denied approvals
against the mock process. **Actual installed-runtime chat and desktop
packaging are still unverified.** Tool permissions default to deny; this
does not sandbox the external agent.

See [QA](../docs/LOCAL_QA.md) and
[architecture](../docs/ARCHITECTURE.md).

# Frontend — direct ACP conversation and Omega loop

The app opens in **Chat**. Switching to **Omega loop** keeps the same
`CodePuppyChatPage` mounted and adds the worker graph to its right.

- Native React transcript displays user text, streamed assistant text,
  reasoning summaries, tool activity and turn status.
- Project selection is explicit and checked by Electron main-process
  `assertProjectWorkspace`. **Start Code Puppy** launches one owned ACP
  child and creates a session. Send and Cancel are available after start.
- No `webview` or separate GUI server is used. External links are limited
  to HTTP(S) and opened outside the app. Renderer isolation and sandbox
  remain enabled.
- **Demo** animates deterministic illustrative data. **Saved** reads local
  draft records. **Live** displays bounded generic ACP events from the
  same chat session, with no asserted worker attribution or check pass.
- The optional live view does not open another connection. It shows only
  locally projected summaries, not raw secrets or provider configuration.
- The Omega job composer saves a draft for manual submission in direct chat;
  saved drafts do not dispatch Code Puppy.

Native chat currently uses raw preformatted text rather than rich Markdown.
Model/agent switching, interactive approvals, persistent ACP conversation
resume and true worker-driven Omega task states remain pending. See
[Status](STATUS.md) and [QA](LOCAL_QA.md).

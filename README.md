<img src="assets/logo.png" alt="Puppy Omega One" width="320">

# Puppy Omega One

**A coding-agent application with a signature Omega orchestration mode.**

The normal experience is **chatting with your coding agent** in one workspace.
For harder tasks, choose **Omega loop** to see the orchestrator, specialist
workers, checks and handoffs **beside the same conversation**. You don't need
to navigate to a separate harness app or dashboard to get back to chat.

**Current integration limit:** the conversation still uses your **existing
installed Puppy GUI as an embedded transport**. Native, session-bound
chat/send/approval support is **not complete**, and live event-to-chat-session
identity is unverified. We won't pretend an animated diagram is proof of
running agents. See [harness application plan](docs/HARNESS_APP.md) and
[status matrix](docs/STATUS.md) for the path to genuine first-party chat.

[Changelog](CHANGELOG.md) · [Harness design](docs/HARNESS_APP.md) ·
[Features/status](docs/STATUS.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Safe local QA](docs/LOCAL_QA.md) ·
[Progress tracker](https://github.com/ant3869/puppy-omega-one/issues/4)

## Run the application

```bash
cd electron
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

This opens the Electron app; it **does not** install or patch Code Puppy.
For real chat, you need a separately installed `puppy_gui` and Code Puppy
runtime. Set `PUPPY_GUI_LAUNCH` or `PUPPY_GUI_DIR` and
`CODE_PUPPY_PYTHON` if autodetection doesn't match your environment.
`PUPPY_GUI_PORT` defaults to `8765`.

### The everyday flow

1. **Chat opens first.** Pick a project workspace and explicitly start your
   existing Puppy GUI for that project, or acknowledge the unknown workspace
   of an already-running external GUI.
2. Chat normally using the embedded existing GUI: ask questions, work with
   files and tools, and manage messages/approvals there.
3. Switch to **Omega loop** in the same workspace. Your conversation remains
   mounted beside the animated orchestrator → workers → verification graph.
   The graph explicitly distinguishes **Demo**, **Saved** and opt-in **Live**
   data. Live session attribution is **not yet proven**.
4. Choose **Draft Omega job** to open the in-workspace composer. Provide a
   goal, runnable `Done when:` check and worker lanes. Saving a draft
   **does not dispatch a task**. Copy and submit it manually in chat
   after verifying the actual project/session.
5. Browse **Saved activity**, **Event log**, **Worker briefs** and
   **Project documents** without treating records as verified runtime results.

The chat header also has a **read-only runtime context bar**: click **Refresh
context** to see the active agent, active model and currently named saved
session as reported by your installed GUI. These are display-only values,
not a session picker or proof that the Omega event stream belongs to that
conversation. It never submits prompts or changes model/configuration.

Omega doesn't start the GUI or extra read-only ChatBridge event monitor at
app launch. Live monitoring requires explicitly choosing **Connect monitor**
and can be stopped. The installed GUI may perform its own initialization
or session writes once the user chooses to start/connect it.

## The Omega team

| Agent | Intended purpose |
| --- | --- |
| `omega-orchestrator` | Plan the goal, brief workers and rerun acceptance checks |
| `omega-builder` | Make scoped changes and report what was tested |
| `omega-reviewer` | Assess diffs, regressions and safety issues |
| `omega-tester` | Run and triage checks |
| `omega-researcher` | Read files, inspect context and summarize findings |

The project also ships **project-scoped templates** for these agents.
They define the intended policy; actual agent behavior depends on
your installed runtime and tool permissions. **This is not an OS sandbox.**

### Install the Omega templates into a project

Windows PowerShell:

```powershell
.\install.ps1 -Target C:\path\to\your-project
```

Linux/macOS:

```bash
./install.sh /path/to/your-project
```

The installers copy `templates/` into the **selected project**, skipping
existing files unless `-Force` / `--force` is used. They protect known
Code Puppy core/config, GUI source, Python environment and redirected
symlink/junction targets and do **not** change global `puppy.cfg`,
install a package or upgrade the runtime.

**Model strings are unverified examples:** `claude-opus-5-5`,
`claude-sonnet-5-5`, `claude-haiku-5-5`. Run `/model` in the
actual Code Puppy installation before using the agent JSON files,
then replace model aliases with the working provider-specific values.
They are not certified current public API IDs or pricing quotes.
See [models](docs/MODELS.md) and [cost planning](docs/COSTS.md).

## Read-only installed-backend inspection

Before replacing the embedded GUI with native chat, use the bundled
**non-mutating compatibility inspector** to check what a local GUI actually
exposes. It looks for source file presence and makes at most two **GET-only**
loopback requests (`/api/health` and `/openapi.json`); it never opens a
WebSocket, sends prompts, touches sessions or edits Code Puppy.

Windows (PowerShell), from the repo root:

```powershell
python .\tools\inspect_chatbridge.py --gui-root "C:\path\to\puppy_gui"
```

To inspect only source files without contacting a running server:

```powershell
python .\tools\inspect_chatbridge.py --gui-root "C:\path\to\puppy_gui" --offline
```

The JSON summary reports route presence **only**, never credentials,
transcripts or the full local checkout path. It **cannot verify the
WebSocket contract or runtime session/project ownership**; follow
[LOCAL_QA](docs/LOCAL_QA.md) for that separate test.

## Electron startup reliability

[PR #20](https://github.com/ant3869/puppy-omega-one/pull/20)
fixed the Electron main entry, sandboxed CommonJS preload and Windows
protected-path canonicalization. `npm run build` now includes a
`verify:build` check for actual emitted files, preload format and secure
BrowserWindow settings. This complements—not replaces—the Windows
visual smoke test. See [desktop setup](electron/README.md) and
[local QA](docs/LOCAL_QA.md).

## Safety and current limitations

- **Native automatic prompt dispatch is disabled.** No unknown chat
  protocol is used to send prompts or approve tools from Omega's UI.
- An external GUI's working directory cannot be attested by an HTTP
  health response. The app requires explicit acknowledgement before
  exposing its conversation.
- Starting a known GUI child with a chosen `cwd` does not prove the
  runtime kept that project context. Verify against a disposable project.
- Stored drafts and monitor events are **not passing test results**;
  the running Code Puppy agent may modify files wherever your OS account
  permits. Omega is **not** process-level sandboxing.
- CI covers Windows/Linux installer guards, Electron tests/typechecks,
  builds and docs. **Real installed-GUI, session binding, packaging
  and hands-on desktop UX still need manual checks.**

## Documentation

- [HARNESS_APP.md](docs/HARNESS_APP.md) — product direction, the
  verified-backend prerequisite and native chat integration phases.
- [STATUS.md](docs/STATUS.md) — exactly implemented vs unverified.
- [FRONTEND.md](docs/FRONTEND.md) and
  [electron/README.md](electron/README.md) — desktop IPC and setup.
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — orchestration policies and
  Code Puppy integration notes.
- [MODELS.md](docs/MODELS.md) and [COSTS.md](docs/COSTS.md) —
  historical model hypotheses and current estimation guidance.
- [LOCAL_QA.md](docs/LOCAL_QA.md) — safe test steps before native dispatch.
- [CHANGELOG.md](CHANGELOG.md) — merged changes and remaining boundaries.
- [Reference](reference/README.md) — archived original Omega inspiration.

For use on another machine, clone this public repository and install the
templates into your actual project there. Keep company/private code,
provider credentials and user-global configuration **out of this repo**.

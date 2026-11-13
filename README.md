<img src="assets/logo.png" alt="Puppy Omega One logo" width="320">

# Puppy Omega One

**Project-scoped orchestration templates for Code Puppy**, with an optional
Electron desktop console for drafting briefs, viewing a simulated or observed
workflow, browsing local history, and using the existing Puppy GUI chat.

**Project status:** The desktop UI and its tests are implemented, but **native
automatic dispatch and installed-GUI session verification are not complete**.
This is not a hardened agent sandbox or a verified production release.

[Current capabilities](docs/STATUS.md) · [Changelog](CHANGELOG.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Desktop details](docs/FRONTEND.md) ·
[Manual QA](docs/LOCAL_QA.md) ·
[Progress tracker](https://github.com/ant3869/puppy-omega-one/issues/4)

## Getting started

The repository includes five project-local agent definitions:

| Agent | Intended role |
| --- | --- |
| `omega-orchestrator` | Scope the task, brief specialists, independently verify checks |
| `omega-builder` | Implement bounded edits and report test results |
| `omega-reviewer` | Review diffs and risks without making edits |
| `omega-tester` | Run and triage checks |
| `omega-researcher` | Read and summarize context |

The manifest model values (`claude-opus-5-5`, `claude-sonnet-5-5`,
`claude-haiku-5-5`) are **unverified placeholders for this installation**.
They are **not validated current provider API IDs**. Check `/model` in your
actual Code Puppy runtime, then update the `model` fields in the installed
project's `.code_puppy/agents/omega-*.json` as needed. Models and prices
can change: see [models](docs/MODELS.md) and [cost notes](docs/COSTS.md).
Omega does not automatically update your user-global model configuration.

### Install the project templates

In PowerShell (Windows):

```powershell
.\install.ps1 -Target C:\path\to\your-project
```

In Bash (Linux/macOS):

```bash
./install.sh /path/to/your-project
```

The installers copy `templates/` into a **selected project** and skip
existing files unless `-Force` / `--force` is explicitly requested. They
refuse identified Code Puppy core/config, known GUI/Python environment paths,
home directory targets and redirecting symlinks/junctions. They do **not**
install or patch Code Puppy itself, write global `puppy.cfg`, or provide an
OS-level sandbox.

Launch your installed Code Puppy **from that project directory** so it can
discover the project-local agents. Select `omega-orchestrator`; verify the
actual model alias, then give it a goal and a runnable `Done when:` check.
The intended orchestration loop is specified in project `AGENTS.md` and
[architecture](docs/ARCHITECTURE.md); behavior depends on your actual
installed runtime and agent permissions.

### Optional desktop console

```bash
cd electron
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

The desktop app is **a console over an independently installed `puppy_gui`
server**, not a replacement agent backend. `npm run build` is not the
same as creating/test-running a platform installer; see
[Electron README](electron/README.md).

| Desktop view | What actually happens |
| --- | --- |
| **Overview** | Animated workflow; Demo is explicitly simulated |
| **Compose run** | Creates a **local draft** with a project workspace and acceptance check |
| **Saved activity** | Search, inspect, copy stored briefs, open chat |
| **Event log** | Filter/search up to 30 recent sanitized in-memory monitor summaries; never raw transcripts |
| **Worker briefs / Project docs** | Read local Omega records and project documents |
| **Harness chat** | Embeds the **real separately installed Puppy GUI**; sending is done inside its UI |
| **Settings** | Reduced motion, read-only local endpoint diagnostics and safety information |
| **Live** | **Opt-in** read-only WebSocket observer; actual chat/session association unverified |

**No automatic runtime side effects at startup:** Omega does not launch the
GUI or open the additional Live Monitor WebSocket just because the app opens.
Choose a safe project and explicitly start the existing GUI in Harness Chat.
To observe events, use Overview → Live → **Connect monitor**; **Stop monitor**
closes the observer and cancels retries. Those events are never treated as
verified check passes just because a worker responded.

When attaching to an already-running GUI, Omega **cannot attest its current
project directory** and displays a warning before granting access. Native
`puppy:sendPrompt` deliberately remains disabled until the installed
server's session/project contract is verified.

**Security boundary:** These are application and installer guardrails, not
process isolation. The embedded GUI and shell-enabled agents may write files
where your OS account has permission. Use a disposable project for testing;
follow [local QA](docs/LOCAL_QA.md) before enabling further automation.

## Working on another computer

```powershell
git clone https://github.com/ant3869/puppy-omega-one.git
cd puppy-omega-one
.\install.ps1 -Target C:\path\to\your-project
```

Keep work/private source code, tokens and provider configuration **out of
this public repository**. Repeat the `/model` check on each runtime because
provider aliases and installed environments can differ.

## Documentation and maintenance

- [Architecture](docs/ARCHITECTURE.md) — agent roles, delegation and safety.
- [Desktop frontend](docs/FRONTEND.md) — exact IPC, local data, WebSocket and
  embedded GUI integration status.
- [Current status](docs/STATUS.md) — implemented vs unverified features.
- [Local QA](docs/LOCAL_QA.md) — reproducible runtime/desktop verification.
- [Models](docs/MODELS.md) and [Costs](docs/COSTS.md) — historical model
  research and illustrative estimates; recheck provider documentation.
- [Changelog](CHANGELOG.md) — merged PRs, not assumed releases.
- [Reference](reference/README.md) — original inspiration and archival
  feasibility notes. Treat historical claims as historical.
- [Tracker #4](https://github.com/ant3869/puppy-omega-one/issues/4) — remaining
  milestones and evidence.

The GitHub Actions validation workflow covers Linux installer/harness smoke
tests, Windows installer safety tests, Electron typechecking, Node tests and
an Electron build. **It does not test against a live installed Code Puppy GUI**
or certify `npm run dist` installers.

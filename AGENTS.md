<!-- staged-by: workspace -->
# Working Agreement — AI-Enabled Workspace

This repository was seeded by the AI-Enabled Workspace. Both GitHub Copilot and
Claude Code follow this file.

**This file is canonical.** `CLAUDE.md` points here, and
`.github/copilot-instructions.md` covers Copilot-specific wiring and test-writing
detail while deferring to the sections below. Where any two disagree, this file
wins — say so rather than guessing.

---

## 1 · Session modes — ask first, every session

Every session starts in **TEST mode** (fail-safe default, hook-enforced where
available). First interaction: ask the developer DEV or TEST, then set it:

- macOS/Linux, or any shell with bash: `bash .workspace/bin/set-mode.sh DEV`
- **Windows** (Copilot Chat's terminal is PowerShell with no `bash` on PATH):
  `powershell -File .workspace/bin/set-mode.ps1 DEV`

Both write the same file; use whichever your shell can actually run. Use
`powershell`, not `pwsh` — stock Windows ships PowerShell 5.1 as `powershell.exe`
and the script is 5.1-compatible.

**DEV** — full development: features, bug fixes, source changes.
**TEST** — unit/integration tests ONLY. Source, configs, and package manifests
stay untouched; blockers get recorded in `.workspace/PROGRESS.md` rather than
fixed.

A DEV grant **expires after 8 hours** (`WORKSPACE_MODE_TTL_HOURS`). When it
lapses the session silently returns to TEST — the block message says so
explicitly when it happens. Re-run `set-mode` to continue source work.

**Never ask when nobody can answer.** Headless runs (`claude -p`, SDK, CI) and
any session started with `WORKSPACE_MODE` set already have their mode decided —
the session-start banner says so. Asking there just stalls the run: proceed, and
if the task truly needs source changes, stop and report that the run requires
`WORKSPACE_MODE=DEV`.

### 1.1 · What TEST mode allows you to write

This list is canonical; the hook enforces exactly it.

```
test/  tests/  __tests__/  __mocks__/      (at any depth)
*.test.*   *.spec.*   *Test.*   *Tests.*
conftest.py
.workspace/PROGRESS.md
.workspace/local/**
```

Everything else — source, build config, app config, package manifests — is
off-limits in TEST mode.

---

## 2 · Is enforcement actually on? Run the doctor

```
bash .workspace/bin/doctor.sh
powershell -File .workspace/bin/doctor.ps1     # Windows without bash
```

Guardrail hooks **fail open** on purpose: a broken hook must never brick a
working session. The cost of that choice is that a workspace whose hooks never
fire looks identical to one where nothing dangerous was ever attempted. `doctor`
is the difference between *protected* and *believed to be protected*. It checks
seeding, hook wiring for all four runtimes, line endings, the bash launcher on
Windows, current mode and TTL, secrets policy, graph freshness — and then fires
real hooks at known-bad input to prove the chain works end to end.

Run it when a block looks wrong, when you have just cloned, or when you are
about to trust the guardrails with something that matters.

---

## 3 · Using the GitHub Copilot CLI here

The Copilot CLI reads hooks **only** from `~/.copilot/hooks/`, so this repo's
guardrails do not reach it automatically. Inside this repo's Dev Container the
install is done for you when the container is created. In a host shell, once
per machine, per repo:

```
bash .workspace/bin/install-copilot-hooks.sh
bash .workspace/bin/install-copilot-hooks.sh --status   # verify
```

VS Code (Copilot Chat, Claude Code) and the Claude Code CLI need no setup.

Copilot Chat in VS Code additionally requires the agent-hooks Preview to be
enabled (`chat.tools.hooks.enabled`). The seeded Dev Container sets it at
container scope, but VS Code may not honor a Preview flag there, and `doctor`
cannot see it — if it is off, Copilot Chat runs with no hook enforcement and
this file is the only thing holding the line.

---

## 4 · Branch policy

Work on a **feature branch off the default branch**. Never commit directly to
`main`/`master`.

(`code-optimization` is the branch the workspace seeds onto. It exists only
until the lead merges it into the default branch; after that it is gone and is
not where your work belongs.)

---

## 5 · Environment: container-only

The Dev Container is the sandbox — and this repo ships its own (`.devcontainer/`,
staged by the workspace unless the repo already had one). Open the folder in
VS Code and choose **"Reopen in Container"**: graphify, jq, and the agent CLIs
are preinstalled there. Toolchain commands inside it (`npm`/`mvn`/`uv`/…) are
fine. **Never install anything on the host machine** — this is hook-enforced,
not advisory.

If a host install is genuinely required, a **human** authorizes that one command
by re-running it with `WORKSPACE_ALLOW_HOST_INSTALL=1` set. Every use is recorded
in the trace log. Do not set this on your own initiative.

Details: `.agents/skills/docker-only-execution/SKILL.md`.

---

## 6 · Navigation: grep first, graph only for what grep can't reach

**Read and grep the source by default** — for named symbols, "where is X", "what
does Y do", tracing through files you can name, and anything you are about to
change. In practice, defaulting to the graph makes these cost *more*, not less,
for the same answers.

Use the graph **only** for questions spanning modules you cannot yet name —
impact analysis ("what breaks if I change this"), dependency direction, or the
shape of a subsystem you have never opened:
`graphify query "<question>"`, `graphify path "<A>" "<B>"`,
`graphify affected "<X>"`, `.workspace/GRAPH_REPORT.md`,
`.workspace/OPTIMIZATION_REPORT.md`.

If session-start reports the graph **STALE**, run
`bash .workspace/bin/sync-graph.sh refresh` before load-bearing graph queries —
this repo's Dev Container has graphify preinstalled. Outside the container,
where graphify is missing, that is not a blocker: treat the committed graph as
a dated map — fine for orientation, confirm anything load-bearing against the
source.

---

## 7 · Session-end routine (whenever code changed)

1. Update `.workspace/PROGRESS.md` — module, test status, blockers, last updated
   by/date. This file is committed: it is how your progress reaches the next
   developer's agent (Copilot, Claude Code, or any other). One row per module;
   edit only rows you touched (distinct rows merge cleanly). On merge conflict:
   keep both sides' rows, newest date wins.
2. If `graphify` is available, run `bash .workspace/bin/sync-graph.sh refresh`
   ONCE so the committed graph matches the code — not after every edit.
3. Commit `.workspace/` changes together with the code.

---

## 8 · TDD flow for every feature or change

1. Check the request first. If it already states concrete acceptance criteria
   (expected inputs/outputs, fields, behaviors), record them as Decisions and
   SKIP the grill — ask at most 1–2 targeted questions about genuine gaps, or
   state your assumption and proceed. Run the full grill
   (`.agents/skills/grill-me/SKILL.md`) only when the request is vague or
   incomplete. If nobody can answer (headless or automated runs), state your
   assumptions explicitly in the output and proceed — never stall on questions.
2. Record Decisions + acceptance criteria.
3. Write failing tests first. Language-specific rules live in
   `.github/instructions/`; **those rules describe how to write tests, and do
   not restrict what you may edit — §1 governs that.**
4. Implement until green. Tests first, always.

---

## 9 · Secrets

Never read, print, or commit `.env*` (except `.env.example`), `secrets/`, keys,
keystores, or credentials. New config values go into `.env.example` as
placeholders.

**Exception:** `ENV_PROTECTION=false` in `.workspace/config` means the repo owner
declared the committed `.env` files to be non-sensitive configuration — they may
be read and edited until `bash .workspace/bin/env-protection.sh on` restores the
restriction. Toggling it requires **restarting the agent session**, because read
permissions are loaded at startup.

Private keys, `.ssh/`, `.aws/credentials`, `*.pem`, `*.key`, keystores: blocked
with **no override**. A human handles those directly.

---

## 10 · Dangerous operations — what is blocked, and what to do instead

These are hook-enforced. The block message names the rule and the way out; this
is the same list, so you can avoid the wall rather than hit it.

| Blocked | Do this instead |
|---|---|
| `rm -rf /`, `~`, `$HOME` (recursive delete of a root/home path) | Scope the delete inside the repo (`rm -rf ./build`) |
| `git push --force`, and `git push origin +branch` | `git push --force-with-lease` — allowed, and refuses if someone else pushed |
| `git reset --hard origin/…` or `HEAD~N` | `git revert <commit>`, or `git stash` |
| Package installs on the host (`npm i`, `pip install`, `brew`, `apt`, …) | Run inside the container, or wrap in `docker run` |
| `curl … \| sh`, `wget … \| bash` | Download to a file, read it, then run it |
| Hand-editing lockfiles (`package-lock.json`, `yarn.lock`, `poetry.lock`, `Cargo.lock`, `uv.lock`, `Gemfile.lock`, `pnpm-lock.yaml`, `composer.lock`) | Run the package manager so it regenerates them |
| Editing anything under `.git/` | Use git commands |
| `mkfs`, `dd of=/dev/…`, `chmod -R 777 /`, `sudo rm`, `shutdown`/`reboot` | Ask a human; none of these belong in an agent session |

Beyond this list: ask the human before anything destructive or irreversible —
bulk deletes, schema drops, data migrations.

---

## 11 · Token discipline

For analysis-heavy or long conversational sessions, caveman mode is recommended
(noticeably terser prose; code stays verbatim): say "use caveman mode".

---

## 12 · Skills

`graphify` · `grill-me` · `docker-only-execution` · `caveman` — each available at
`.agents/skills/<name>/` (Copilot and other agents) and `.claude/skills/<name>/`
(Claude Code). Both trees are staged into this repo; use whichever your runtime
reads.

<!-- staged-by: workspace -->
# Testing Guardrails — Read Before Writing Any Test
These rules override any AI suggestion. If a rule blocks progress, STOP and leave a `NOTE:` comment for the dev team — do not work around it.

**`AGENTS.md` is canonical.** It holds the working agreement — session modes, branch policy, secrets, dangerous operations, navigation. This file adds Copilot-specific wiring and the detail of how to write a good test. Where the two appear to disagree, `AGENTS.md` wins; say so rather than guessing.

## SESSION MODES — ASK FIRST, EVERY SESSION
*(canonical: `AGENTS.md` §1)*

Every session starts in **TEST mode** (fail-safe default, enforced by hooks where available). Your FIRST interaction: ask the developer which mode this session runs in, then run the matching command:
- **DEV** — full development: features, bug fixes, source changes.
- **TEST** — unit/integration tests ONLY; source, configs, and package manifests stay untouched. When something blocks a test (missing framework, untestable design), record it in `.workspace/PROGRESS.md` and move on — never fix source.

```
bash .workspace/bin/set-mode.sh DEV                    # macOS/Linux, or any shell with bash
powershell -File .workspace/bin/set-mode.ps1 DEV       # Windows — this terminal is PowerShell with no bash
```

Use `powershell`, not `pwsh`: stock Windows ships PowerShell 5.1 as `powershell.exe`, and the script is 5.1-compatible. A DEV grant expires after 8 hours and the session returns to TEST; the block message says so when it happens.

Enforcement is hook-based where your editor supports agent hooks and honor-system otherwise — the rules bind either way. To find out which applies right now, run `bash .workspace/bin/doctor.sh` (or `powershell -File .workspace/bin/doctor.ps1`). It reports what is wired, and fires real hooks at known-bad input to prove it.

**Never ask when nobody can answer:** in a headless/automated run (or when `WORKSPACE_MODE` is already set) the session-start banner states the mode — proceed with the work instead of asking, and if the task genuinely requires source changes, stop and report that the run needs `WORKSPACE_MODE=DEV`.

## PROGRESS & GRAPH SYNC — SESSION-END ROUTINE
*(canonical: `AGENTS.md` §7)*

`.workspace/PROGRESS.md` is the shared cross-agent, cross-developer state: after a pull, another developer's agent continues from it. Before ending any session in which code changed:
1. Update `.workspace/PROGRESS.md` (module, test status, blockers, last updated by/date).
2. Run `bash .workspace/bin/sync-graph.sh refresh` so the committed graph matches the code — this repo's Dev Container has graphify preinstalled. Outside the container it will be missing; that is not a blocker — note the staleness in `PROGRESS.md` and never install anything on the host.
3. Commit `.workspace/` changes together with your code changes.
If session-start reported the graph as STALE, refresh BEFORE starting work where you can.

## TEST-MODE HARD RULES
**These bind test-writing work — that is, any session in TEST mode, and the test-first step of a DEV-mode task. In DEV mode, editing source is the job: rules 1 and 2 below do not apply once failing tests exist.** The canonical list of what TEST mode permits is `AGENTS.md` §1.1, and the hook enforces exactly that list.

- Touch TEST CODE ONLY. Never modify production/source, build config, or app config to make a test pass.
- Do not refactor the code under test. If it's untestable, add `// NOTE: <what blocks the test and the smallest change that would fix it>` and move on.
- Create new files only in test scope: `test/`, `tests/`, `__tests__/`, `__mocks__/`, `*.test.*`, `*.spec.*`, `*Test.*`, `*Tests.*`, `src/test/**`, `conftest.py` — plus `.workspace/PROGRESS.md` and `.workspace/local/`.
- React components: CO-LOCATE — create `Component.test.tsx` in the same directory as `Component.tsx`, never in a central test dir. APIs/services/backend keep their central `test/` (or equivalent) directory.
- No secrets: no real credentials/tokens/API keys/production URLs. Use fakes/fixtures.
- Extend existing test config/setup files; never add a second conflicting config.
- Never install SDKs or packages on the host machine — all commands run inside the Dev Container.

## ISOLATION & DETERMINISM
- Mock everything external: network, DB, filesystem, time, randomness, third-party services. No real I/O in unit tests.
- No shared state; each test runs independently in any order via per-test setup hooks.
- Reset/restore all mocks, spies, and fixtures after each test.
- No sleeps or wall-clock waits — use fake timers or proper async utilities.
- Deterministic only — no reliance on order, locale, timezone, or live data.

## STRUCTURE & STYLE
- One logical concept per test.
- Arrange/Act/Assert, visually separated.
- Names: `method_condition_expectedResult`. No `test1`/`shouldWork`.
- Test behavior, not internals. Meaningful assertions only — no empty/always-pass tests.

## COVERAGE & CASES
- Happy path + edges: null/empty/missing input, not-found, boundary values, dependency-throws-error.
- Coverage is a guide, not a goal — no assertion-free tests to hit a percentage.
- Every new test must FAIL if the behavior it covers is broken. If mutating the asserted value/branch still passes, the test is worthless — fix it.
- Run the coverage command locally (in the container) before pushing. CI publishes coverage; the gate is not enforced yet.

## HYGIENE & DON'Ts
- No debug prints, no commented-out tests.
- No skipped/disabled tests without a generic reason comment — no bug/ticket references.
- Don't over-mock: never mock the unit under test or simple value objects.
- Assert on observable behavior/output, not on how many times a private helper was called.

## BEFORE YOU COMMIT
- Tests green locally WITH coverage.
- Diff shows test files only — no production/source/config edits.
- Names follow convention; every test has real assertions.
- No secrets, sleeps, shared state, or leftover debug output.
- Correct branch/pipeline confirmed so shared CI isn't broken.

## KEEP CONTEXT LEAN
Framework-specific rules live in `.github/instructions/*.instructions.md`. Reference files by path instead of pasting large code blocks into chat.

## graphify (grep first; the graph is for questions grep cannot answer)
**Default to reading and grepping the source.** That is cheaper and usually
better, and it is what you should do for: a named symbol, file or string; "where
is X"; "what does Y do"; tracing one request through files you can already
identify; and any change you are about to make. In practice, reaching for the
graph on questions like these costs more, not less, for the same answer.

Consult the graph **only** when the question spans modules you cannot yet name —
"what would break if I change this", "which parts depend on Y", "give me the
shape of a subsystem I've never opened". Then use `graphify query "<question>"`,
`graphify path "<A>" "<B>"`, `graphify affected "<X>"`, or read
`.workspace/GRAPH_REPORT.md`. The graph is committed at `.workspace/graph.json`.

If the graph is stale after a coding session, run
`bash .workspace/bin/sync-graph.sh refresh` once at the end — not after every edit.

## caveman (terse output)
When the user invokes `/caveman` or asks for token-efficient replies, follow the caveman skill at `.agents/skills/caveman/SKILL.md` (Claude Code reads the same skill from `.claude/skills/caveman/SKILL.md`): terse prose, zero filler — but code, diffs, commands, test names, and error messages stay verbatim.

## DANGEROUS COMMANDS — ASK FIRST
*(canonical: `AGENTS.md` §10, which lists each rule with the allowed alternative)*

A hook layer (`.github/hooks/guardrails.json`, VS Code agent hooks — Preview) blocks these when your editor supports it, but it fails open when unavailable — so treat the rules as absolute regardless. Never run, and never suggest running:
- **Destructive ops:** `rm -rf` outside the repo, `git reset --hard origin/…` or `HEAD~N`, `dd of=/dev/…`, `mkfs`, `chmod -R 777 /`, `sudo rm`, shutdown/reboot.
- **History rewrites:** `git push --force` and `git push origin +branch` are both blocked. `git push --force-with-lease` is allowed — it refuses if someone else has pushed since you fetched.
- **Piping web content into a shell:** `curl … | sh`, `wget … | bash`. Download, read, then run.
- **Package installs on the HOST.** You work inside the Dev Container, where toolchain commands (`npm install`, `mvn`, `uv`) are fine. If `which node` prints a `C:\...` path you are on the host — stop and ask the human. A human may authorize one specific install by re-running it with `WORKSPACE_ALLOW_HOST_INSTALL=1`; never set that yourself.
- **Hand-editing lockfiles** (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`, `Gemfile.lock`, `uv.lock`, `composer.lock`) or anything under `.git/`. Run the package manager, or use git commands.

If a command is destructive or irreversible, stop and ask the human first.

## SECRETS — NEVER READ, PRINT, OR COMMIT
- Never open, print, or paste: `.env` and variants (only `.env.example` is fair game), `secrets/` directories, `*.pem`/`*.key`, `id_rsa`/`id_ed25519`, keystores, `.aws/credentials`.
- Exception: if `.workspace/config` sets `ENV_PROTECTION=false`, the repo owner has declared the committed `.env` files non-sensitive configuration — reading and editing them is allowed until `bash .workspace/bin/env-protection.sh on` restores protection. Everything else in this section stays off-limits regardless.
- Never hardcode credentials, tokens, or production URLs anywhere — including tests and chat.
- Need a new config value? Add a placeholder to `.env.example` and tell the human.

## SKILLS & REPORTS
- Skills for a staged repo live in `.agents/skills/`: `graphify` (graph-first navigation), `caveman` (terse output), `grill-me` (feature alignment grill before any new feature), `docker-only-execution` (execution policy). Read the relevant SKILL.md before the related task.
- Shared data lives in `.workspace/` (committed): `graph.json` (query with `graphify query`), `GRAPH_REPORT.md` (architecture), `OPTIMIZATION_REPORT.md` (optimization findings — regenerate the full version with `/optimize-report`), `PROGRESS.md` (cross-agent progress), `config`. Per-developer files live in `.workspace/local/` (gitignored); the interactive `graphify-out/graph.html` map is regenerable and not committed.
- Branch policy: work on a feature branch off the default branch; never commit directly to `main`/`master`. (`code-optimization` is the seeding branch — it exists only until the lead merges it, and is not where your work belongs.) See `AGENTS.md` §4.
- Health check: `bash .workspace/bin/doctor.sh` — or `powershell -File .workspace/bin/doctor.ps1` on Windows — reports whether guardrails are actually active in this repo, and proves it by firing real hooks at known-bad input. See `AGENTS.md` §2.

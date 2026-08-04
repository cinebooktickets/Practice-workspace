<!-- staged-by: workspace -->
# Progress — shared across developers and agents

The contract: **every session that changes code updates this file before it
ends.** It is committed to git on purpose — developer A's progress (made with
GitHub Copilot, Claude Code, or any other agent) reaches developer B on the
next pull, and B's agent continues from here instead of rediscovering state.

- **Exactly one row per module/component** — never reformat or reorder other
  rows; edit only the rows your session touched. Distinct rows merge cleanly
  in git; this discipline is what makes parallel developers conflict-free.
- On a merge conflict here: keep BOTH sides' rows; where the same row differs,
  the newest date wins.
- Blockers say **why** (missing test framework, untestable design, flaky dependency, …).
  In TEST mode, agents record blockers here instead of fixing source.
- Seed the first rows from the module list in `.workspace/GRAPH_REPORT.md`.

| Module/Component | Test status | Blockers | Last updated (by, date) |
|---|---|---|---|
| `src/lib/api.ts` | ✅ green (10 tests) | — | Copilot, 2026-08-04 |
| `src/context/auth.tsx` | ✅ green (6 tests) | — | Copilot, 2026-08-04 |
| `src/components/protected-route.tsx` | ✅ green (5 tests) | — | Copilot, 2026-08-04 |
| `src/app/dashboard/live-support/page.tsx` | ✅ green (25 tests) | — | Copilot, 2026-08-04 |
| `src/test/setup.ts` | recreated | deleted then restored this session | Copilot, 2026-08-04 |
| _(seed from GRAPH_REPORT.md)_ | todo | — | — |
| frontend/src/context/auth.tsx (`useAuth()` / `AuthProvider`) | 3 unit tests added (auth.test.tsx): throws outside provider, unauthenticated defaults, backend-profile bootstrap merge — all passing | none | Claude, 2026-08-04 |

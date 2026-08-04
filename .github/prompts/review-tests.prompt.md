---
agent: agent
description: Review tests against the guardrails BEFORE-YOU-COMMIT checklist
---
<!-- staged-by: workspace -->
Re-read the guardrails, especially BEFORE YOU COMMIT. Review the tests in ${input:target:path} against
the full checklist: test files only in the diff; correct names; real meaningful assertions;
no secrets/sleeps/shared state/debug output; mocks reset; no over-mocking; snapshots small or replaced
by explicit assertions (React); coverage thresholds (JaCoCo / Jest / Vitest / pytest `fail_under`) not weakened.
For each violation, propose the minimal fix (test code only) and list anything that needs a `NOTE:` for the dev team.

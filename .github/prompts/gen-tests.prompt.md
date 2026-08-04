---
agent: agent
description: Generate guardrail-compliant unit tests for one file/class/component
---
<!-- staged-by: workspace -->
Re-read the guardrails files. Generate unit tests ONLY for: ${input:target:path/to/file}.
Follow every HARD RULE: touch test code only; no changes to the file under test.
Cover happy path + edges (null/empty/missing, not-found, boundary, dependency-throws-error).
Use AAA with visual separation and method_condition_expectedResult names.
Java: JUnit 5 + Mockito. React: Jest + RTL, query by role/text. Python: pytest + fixtures.
Node: the repo's existing runner (Jest/Vitest/node:test); supertest for HTTP handlers.
Placement: React components — co-locate the test file in the component's own
directory (`Component.test.tsx` beside `Component.tsx`); APIs/services/backend —
the repo's central test directory. Add a `NOTE:` comment for anything that can't be tested
without changing production code. Run the tests in the container and show the result.

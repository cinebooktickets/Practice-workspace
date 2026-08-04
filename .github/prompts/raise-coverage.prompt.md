---
agent: agent
description: Raise a module's coverage toward 70% with meaningful tests
---
<!-- staged-by: workspace -->
Re-read the guardrails and the latest coverage report. Raise coverage of ${input:target:module/dir} toward 70%.
Prioritize uncovered branches and error paths with meaningful behavior tests — not assertion-free tests
to pad the number. For each new test, confirm it FAILS if the covered behavior is broken.
Run the coverage command in the Dev Container and report before/after % for the module.

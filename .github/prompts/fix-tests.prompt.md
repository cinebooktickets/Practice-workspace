---
agent: agent
description: Fix failing tests without touching production code
---
<!-- staged-by: workspace -->
Re-read the guardrails. Tests in ${input:target:path} are failing. Diagnose and fix the TESTS only.
You may NOT modify production/source, build, or app config. If a test can only pass by changing
production code, leave it failing/skipped with a generic reason comment and add a `NOTE:` explaining
the smallest production change that would fix it.
Show me the diff — it must contain test files only.

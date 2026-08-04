---
agent: agent
description: Add only the missing edge-case tests to an existing test file
---
<!-- staged-by: workspace -->
Re-read the guardrails. For the existing tests of ${input:target:unit}, add only the MISSING edge cases:
null/empty/missing input, not-found, boundary values, and dependency-throws-error.
One concept per test, real assertions, no assertion-free filler.
Extend the existing test file; don't create a conflicting second config.

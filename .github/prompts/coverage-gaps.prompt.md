---
agent: agent
description: Find the lowest-covered files and the gap to 70%
---
<!-- staged-by: workspace -->
Re-read .github/copilot-instructions.md and the applicable .github/instructions/*.instructions.md.
Run the coverage command in the Dev Container terminal (Java: `mvn test`; React/Node: `npm test -- --coverage`;
Python: `pytest --cov`), then analyze the report (Java: target/site/jacoco/jacoco.xml;
React/Node: coverage/coverage-summary.json; Python: coverage.xml or the terminal summary).
List the 10 lowest-covered files/classes/components with current % and the specific uncovered branches/functions.
Do not write tests yet — output a prioritized table: file, current %, gap to 70%, risk.

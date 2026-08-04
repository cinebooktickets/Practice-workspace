---
agent: agent
description: Generate the full code-optimization report from the code graph
---
<!-- staged-by: workspace -->
Goal: produce the complete optimization report for this repository and replace
everything below the "<!-- ai-enrichment-below -->" marker in
.workspace/OPTIMIZATION_REPORT.md with it (print the report instead if you
cannot write files).

Method — use the graph, do not crawl the codebase:
1. Read .workspace/GRAPH_REPORT.md and the seed sections of .workspace/OPTIMIZATION_REPORT.md.
2. Run `graphify god-nodes`; for each of the top ~10 hubs run `graphify explain "<node>"`.
3. Use `graphify query` / `graphify path "<A>" "<B>"` to confirm suspected coupling before recommending changes.

Write these sections (markdown):
- Executive summary — 5 bullets max, plain language a non-developer can follow.
- Architecture overview — the main modules/communities and how they relate.
- Hotspots — for each god node: what it does, why it concentrates risk, the smallest safe refactor, test-coverage priority.
- Quick wins — improvements achievable in under a day each.
- Deeper refactors — each with motivation, approach, effort (S/M/L), and risk.
- Test-coverage plan — where new tests pay off most, per the Testing Guardrails.

Rules: every recommendation must cite graph evidence (node names, connection
counts, or paths) plus concrete file paths. Do NOT modify any source code.
Do not invent metrics you did not measure.

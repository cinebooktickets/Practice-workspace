# Optimization Report — Practice-workspace

_Branch `code-optimization` · staged-by: workspace_

## Hotspots — most-connected code (refactor & test-coverage priorities)
```
God nodes (most connected):
  1. useAuth() - 68 edges
  2. react - 55 edges
  3. cn() - 34 edges
  4. Button - 27 edges
  5. allow - 24 edges
  6. ApiException - 24 edges
  7. Badge() - 20 edges
  8. Skeleton() - 20 edges
  9. deny - 18 edges
  10. Card - 17 edges
```
These "god nodes" concentrate risk: a change here touches the most code.
Start optimization and test-coverage work at the top of this list.

## Where to look next
- `.workspace/GRAPH_REPORT.md` — full architecture report (modules, communities, stats)
- `.workspace/PROGRESS.md` — shared test-progress checklist (update it every session)
- `graphify-out/graph.html` — interactive visual code map (regenerable, not committed)

## Get the full recommendations
Ask your AI agent in plain language:
- GitHub Copilot Chat: type `/optimize-report`
- Claude Code: say "Generate the full optimization report for this repo."

<!-- ai-enrichment-below -->

---
agent: agent
description: Summarize all NOTE: flags as dev-team action items
---
<!-- staged-by: workspace -->
Scan the test directories for `NOTE:` comments. Summarize each as a short dev-team action item:
file, what blocked the test, and the smallest production change that would make the unit testable.
Output a checklist grouped by file — do not modify any code.

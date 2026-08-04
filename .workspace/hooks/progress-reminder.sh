#!/usr/bin/env bash
# Stop (Claude Code only — VS Code agent hooks have no Stop event; Copilot
# relies on the same instruction in .github/copilot-instructions.md).
# If the session changed code but never touched .workspace/PROGRESS.md, block
# the stop ONCE with a reminder: update progress + refresh the graph so the
# next developer/agent picks up where this session left off.

. "$(dirname "$0")/lib/common.sh"
read_input || true
TRACE_HOOK="progress-reminder"
trace "$TRACE_HOOK" invoked ""

workspace_active || exit 0
[ "$(jget '.stop_hook_active')" = "true" ] && exit 0   # loop guard

cd "$PROJECT_ROOT" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# uncommitted or staged paths, excluding the seeded config trees
changed="$(git status --porcelain 2>/dev/null | cut -c4- \
  | grep -vE '^(\.claude/|\.github/|\.agents/)' || true)"
[ -z "$changed" ] && exit 0

printf '%s\n' "$changed" | grep -q '^\.workspace/PROGRESS\.md$' && exit 0
code_changed="$(printf '%s\n' "$changed" | grep -vE '^\.workspace/' || true)"
[ -z "$code_changed" ] && exit 0

# Only prescribe the graph refresh where it can actually run. Seeded repos
# ship their own dev container with graphify preinstalled; outside it, point
# at the container rather than at a command that fails.
GRAPH_STEP=""
if command -v graphify >/dev/null 2>&1; then
  GRAPH_STEP=" Then run 'bash .workspace/bin/sync-graph.sh refresh' so the committed graph matches the code you just changed."
elif [ -d .devcontainer ]; then
  GRAPH_STEP=" The committed graph is now stale; refresh it from this repo's dev container (Reopen in Container, then 'bash .workspace/bin/sync-graph.sh refresh'), or note the staleness in PROGRESS.md."
fi

block "Session held once — this is the only time you will be stopped for this. Code changed in this session but .workspace/PROGRESS.md did not. Update it (module, test status, blockers, last updated by/date) so the next developer or agent can pick up where this session left off.${GRAPH_STEP}"

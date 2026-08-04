#!/usr/bin/env bash
# staged-by: workspace
# Set this session's working mode. DEV = full development; TEST = write
# unit/integration tests only, source stays untouched (enforced by hooks).
# Writes .workspace/local/mode (gitignored, per developer). The session= line
# is stamped by the session-start hook and preserved here so the DEV grant
# stays scoped to the current session.
set -euo pipefail
cd "$(dirname "$0")/../.."

mode="$(printf '%s' "${1:?usage: set-mode.sh DEV|TEST}" | tr '[:lower:]' '[:upper:]')"
case "$mode" in
  DEV|TEST) ;;
  *) echo "usage: set-mode.sh DEV|TEST"; exit 1 ;;
esac

f=".workspace/local/mode"
mkdir -p .workspace/local
session=""
if [ -f "$f" ]; then
  session="$(sed -n 's/^session=//p' "$f" | head -n 1)"
fi
printf 'mode=%s\nsession=%s\nts=%s\n' "$mode" "$session" "$(date +%s)" > "$f"

echo "Session mode: $mode"
if [ "$mode" = "TEST" ]; then
  echo "TEST: only test-scope files may be created/edited; record blockers in .workspace/PROGRESS.md instead of touching source."
else
  echo "DEV: full development. Secrets and dangerous-command guardrails remain active."
fi

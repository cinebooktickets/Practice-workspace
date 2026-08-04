#!/usr/bin/env bash
# staged-by: workspace
# Install this repo's guardrails for the GitHub Copilot CLI.
#
# WHY THIS EXISTS: verified against Copilot CLI v1.0.77 — the CLI loads hooks
# ONLY from the user-level directory (~/.copilot/hooks/). It does NOT read the
# repo's .github/hooks/, unlike VS Code. So guardrails cannot travel with the
# repo for CLI users; each developer runs this once per machine.
#
#   bash .workspace/bin/install-copilot-hooks.sh          # install
#   bash .workspace/bin/install-copilot-hooks.sh --status # show what's active
#   bash .workspace/bin/install-copilot-hooks.sh --remove # uninstall
#
# The installed config points at THIS repo's .workspace/hooks scripts by absolute
# path, so it keeps working regardless of the directory Copilot is launched in.
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO="$(pwd)"
DEST="${COPILOT_HOME:-$HOME/.copilot}/hooks"

# One file PER REPO. This used to be a single workspace-guardrails.json holding
# absolute paths into whichever repo installed last — so working in two seeded
# repos meant repo A's hook scripts silently governed repo B, and deleting repo
# A broke Copilot CLI enforcement everywhere with no message.
SLUG="$(printf '%s' "$REPO" | tr -c 'A-Za-z0-9' '-' | sed 's/--*/-/g; s/^-//; s/-$//' | tr 'A-Z' 'a-z')"
SLUG="$(printf '%s' "$SLUG" | tail -c 60)"
FILE="$DEST/workspace-guardrails-$SLUG.json"
LEGACY="$DEST/workspace-guardrails.json"

usage() {
  echo "usage: bash .workspace/bin/install-copilot-hooks.sh [--status | --remove]"
  echo "  (no argument)  install this repo's guardrails for the Copilot CLI"
  echo "  --status       show what is currently active for this repo"
  echo "  --remove       uninstall this repo's guardrails"
}

case "${1:-install}" in
  --status)
    if [ -f "$FILE" ]; then
      echo "Copilot CLI guardrails: INSTALLED for this repo ($FILE)"
      # Verify the referenced scripts still EXIST. Reporting "installed" while
      # pointing at deleted or moved scripts is worse than reporting nothing:
      # the CLI then runs with no enforcement and --status says it is fine.
      missing=0
      while IFS= read -r s; do
        [ -z "$s" ] && continue
        if [ -f "$s" ]; then
          echo "  - ${s##*/}"
        else
          echo "  - ${s##*/}   *** MISSING: $s"
          missing=$((missing + 1))
        fi
      done < <(grep -o '/[^"]*\.workspace/hooks/[a-z-]*\.sh' "$FILE" | sort -u)
      if [ "$missing" -gt 0 ]; then
        echo
        echo "$missing referenced script(s) do not exist — guardrails are NOT working."
        echo "Re-run: bash .workspace/bin/install-copilot-hooks.sh"
        exit 1
      fi
    else
      echo "Copilot CLI guardrails: not installed for this repo."
      echo "Run: bash .workspace/bin/install-copilot-hooks.sh"
    fi
    exit 0 ;;
  --remove)
    rm -f "$FILE"; rmdir "$DEST" 2>/dev/null || true
    echo "removed $FILE"; exit 0 ;;
  -h|--help)
    usage; exit 0 ;;
  install) ;;
  # Anything else used to fall through to a silent install, so a typo'd flag
  # performed the very action the developer was trying to inspect or undo.
  *)
    echo "error: unknown option '$1'"
    echo
    usage
    exit 1 ;;
esac

[ -d "$REPO/.workspace/hooks" ] || { echo "error: no .workspace/hooks in $REPO — is this repo seeded?"; exit 1; }
mkdir -p "$DEST"

# No jq here on purpose: this runs on a developer's HOST, where jq is usually
# absent on Windows, and a setup step that fails on the default machine is a
# setup step nobody completes. Every value below is ours except $REPO, which is
# JSON-escaped explicitly.
esc() { local s="${1//\\/\\\\}"; printf '%s' "${s//\"/\\\"}"; }
R="$(esc "$REPO")"
# A command must not begin with a quoted path — PowerShell reads that as a
# string literal, not an invocation. The 8.3 short path parses in cmd and
# PowerShell alike.
WINBASH='C:\\PROGRA~1\\Git\\bin\\bash.exe'

entry() { # entry <script> <timeoutSec>
  printf '      {
        "type": "command",
        "bash": "bash \\"%s/.workspace/hooks/%s\\"",
        "powershell": "%s \\"%s/.workspace/hooks/%s\\"",
        "env": { "GUARDRAILS_DIALECT": "vscode", "WORKSPACE_STAGED_BY": "staged-by: workspace" },
        "timeoutSec": %s
      }' "$R" "$1" "$WINBASH" "$R" "$1" "$2"
}

{
  printf '{\n  "version": 1,\n  "hooks": {\n    "sessionStart": [\n'
  entry session-start.sh 30
  printf '\n    ],\n    "preToolUse": [\n'
  entry block-dangerous-bash.sh 10;   printf ',\n'
  entry protect-sensitive-files.sh 10; printf ',\n'
  entry enforce-test-mode.sh 10
  printf '\n    ]\n  }\n}\n'
} > "$FILE"

# A file from the old single-name scheme would still be loaded by the CLI
# alongside this one, pointing at whatever repo installed it last.
if [ -f "$LEGACY" ]; then
  echo "note: removing $LEGACY (superseded by per-repo config files)"
  rm -f "$LEGACY"
fi

echo "installed: $FILE"
echo "  guardrails now apply to Copilot CLI sessions on this machine,"
echo "  pointing at $REPO/.workspace/hooks"
echo "  verify with: bash .workspace/bin/install-copilot-hooks.sh --status"
echo "  full health check: bash .workspace/bin/doctor.sh"

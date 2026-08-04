#!/usr/bin/env bash
# SessionStart — print the guardrails banner (stdout is injected into the
# model's context) and sweep MSYS ";C" artifact dirs on Windows.

. "$(dirname "$0")/lib/common.sh"

read_input || true
TRACE_HOOK="session-start"
trace "$TRACE_HOOK" invoked "source=$(jget '.source') sid=$(jget '.session_id')"

branch=""
if (cd "$PROJECT_ROOT" 2>/dev/null && git rev-parse --git-dir >/dev/null 2>&1); then
  branch=$(cd "$PROJECT_ROOT" && git symbolic-ref --short HEAD 2>/dev/null || echo "(detached HEAD)")
else
  branch="(not a git repo)"
fi

# Defensive sweep: MSYS / Git Bash on Windows can produce paths with a
# trailing ";C" when an arg containing a drive-letter colon is forwarded
# to docker or other tools. Artifacts are always empty directories; rmdir
# refuses non-empty dirs, so real work is never destroyed.
if [ "$HOOKS_OS" = "windows" ] && [ -d "$PROJECT_ROOT" ]; then
  removed=0
  while IFS= read -r d; do
    [ -z "$d" ] && continue
    if rmdir "$d" 2>/dev/null; then
      removed=$((removed + 1))
    fi
  done < <(find "$PROJECT_ROOT" -type d -name '*;C' \
            -not -path "*/.git/*" -not -path "*/node_modules/*" \
            2>/dev/null)
  if [ "$removed" -gt 0 ]; then
    log_info session-start "removed $removed MSYS \";C\" artifact dirs"
  fi
fi

banner="Workspace guardrails active (OS: ${HOOKS_OS} | root: ${PROJECT_ROOT} | branch: ${branch})"

if workspace_active; then
  # Offer the invocation that actually works on this platform (see setmode_hint
  # in lib/common.sh — every block message routes through the same helper, so
  # the advice cannot drift between one hook and another).
  SETMODE_HINT="$(setmode_hint DEV) — use TEST in place of DEV to switch back"
  DOCTOR_HINT="$(doctor_hint)"
  # --- session mode bootstrap ------------------------------------------------
  # Every session starts in TEST (fail-safe) and the developer is asked to pick
  # a mode. A mode file whose session= matches this payload's session id is a
  # resume/compact of the same session — keep it, don't re-prompt.
  sid="$(jget '.session_id')"
  mode_file="$PROJECT_ROOT/.workspace/local/mode"
  cur_mode="" cur_session=""
  if [ -f "$mode_file" ]; then
    # tr -d '\r': set-mode.ps1 writes this file from PowerShell; a CR left on
    # session= would never match the incoming session id, silently re-stamping
    # the mode to TEST on every single session.
    cur_mode="$(sed -n 's/^mode=//p' "$mode_file" | head -n 1 | tr -d '\r')"
    cur_session="$(sed -n 's/^session=//p' "$mode_file" | head -n 1 | tr -d '\r')"
  fi
  if [ -n "${WORKSPACE_MODE:-}" ]; then
    # Explicit override (headless runs, CI): the mode is already decided.
    # Validate it — any non-empty value used to count as "deliberately chosen",
    # so WORKSPACE_MODE=DEVELOPMENT silently resolved to TEST while the banner
    # told the agent the mode had been picked on purpose. A typo that quietly
    # inverts your intent is worse than no override at all.
    case "${WORKSPACE_MODE}" in
      [Dd][Ee][Vv]|[Tt][Ee][Ss][Tt])
        banner="$banner
Session mode: $(workspace_mode) — set by the WORKSPACE_MODE environment variable for this run. Do not ask; proceed." ;;
      *)
        banner="$banner
Session mode: TEST. WARNING: WORKSPACE_MODE='${WORKSPACE_MODE}' is not a valid mode — the only accepted values are DEV and TEST, so this run fell back to TEST. If DEV was intended, stop and set WORKSPACE_MODE=DEV." ;;
    esac
    session_interactive || banner="$banner
This session is NON-INTERACTIVE: do not stop to ask clarifying or grill questions either. Where a request is ambiguous, state your assumptions explicitly in the output and continue — a run that ends in a question has delivered nothing."
  elif [ -n "$sid" ] && [ -n "$cur_session" ] && [ "$sid" = "$cur_session" ]; then
    banner="$banner
Session mode: ${cur_mode:-TEST} (already chosen this session)."
  else
    mkdir -p "$PROJECT_ROOT/.workspace/local"
    printf 'mode=TEST\nsession=%s\nts=%s\n' "$sid" "$(date +%s)" > "$mode_file"
    if session_interactive; then
      banner="$banner
SESSION MODE: TEST (default, enforced by hooks). Before any other work, ask the developer which mode this session runs in — DEV (full development: features, bug fixes) or TEST (unit/integration tests only; source code stays untouched; record repo state and blockers in .workspace/PROGRESS.md) — then set it with: ${SETMODE_HINT}"
    else
      # Nobody can answer here. Asking would stall the run and do no work —
      # measured: headless sessions returned only the question.
      banner="$banner
SESSION MODE: TEST (default, enforced by hooks). This session is NON-INTERACTIVE — nobody can answer a question, so do NOT ask any: not the mode question, and not clarifying/grill questions either. Proceed within TEST mode (test-scope files only; record blockers in .workspace/PROGRESS.md). Where a request is ambiguous, state your assumptions explicitly in the output and continue — a run that ends in a question has delivered nothing. If the task genuinely requires source changes, stop and report that the run needs WORKSPACE_MODE=DEV."
    fi
  fi

  banner="$banner
Guardrail health check, if anything here looks wrong or a block seems mistaken: ${DOCTOR_HINT}"

  # --- graph presence + freshness --------------------------------------------
  # The stamp records the HEAD the committed graph was built from. Compare with
  # a cheap 'git diff --name-only' (never build the graph here — hook timeout).
  # Guardrail/doc-only commits don't stale the graph.
  if [ -f "$PROJECT_ROOT/.workspace/graph.json" ]; then
    banner="$banner
Code graph available in .workspace/ for cross-module questions you cannot answer by reading — impact analysis, dependency direction, unfamiliar subsystems ('graphify query \"<question>\"'). For named symbols and files, grep and read directly; that is cheaper and usually better."
    stale=""
    stamp="$(cat "$PROJECT_ROOT/.workspace/graph-stamp" 2>/dev/null || true)"
    if [ -z "$stamp" ]; then
      stale="stamp missing"
    elif [ "$branch" != "(not a git repo)" ]; then
      changed="$(cd "$PROJECT_ROOT" && git diff --name-only "$stamp"..HEAD -- 2>/dev/null \
        | grep -vE '^(\.workspace/|\.claude/|\.github/|\.agents/)' \
        | grep -vE '\.md$' || true)"
      if ! (cd "$PROJECT_ROOT" && git cat-file -e "$stamp" 2>/dev/null); then
        stale="stamp commit unknown"
      elif [ -n "$changed" ]; then
        stale="code changed since the graph was built"
      fi
    fi
    if [ -z "$stale" ] && [ ! -f "$PROJECT_ROOT/graphify-out/graph.json" ]; then
      stale="fresh clone — local graph working dir not materialized"
    fi
    if [ -n "$stale" ]; then
      # Only prescribe the refresh where it can actually run. Seeded repos ship
      # their own dev container with graphify preinstalled — so outside the
      # container the right move is to reopen in it, and only a repo with no
      # container at all (seeded before containers were added, or stripped
      # since) gets the honest "cannot rebuild here" banner.
      if command -v graphify >/dev/null 2>&1; then
        banner="$banner
Code graph is STALE ($stale). Before starting work, run: bash .workspace/bin/sync-graph.sh refresh  (incremental; falls back to a full rebuild)."
      elif [ -d "$PROJECT_ROOT/.devcontainer" ]; then
        banner="$banner
Code graph is STALE ($stale). 'graphify' is not installed in this environment, but this repo ships a dev container where it is preinstalled — Reopen in Container (VS Code: 'Dev Containers: Reopen in Container'), then run: bash .workspace/bin/sync-graph.sh refresh."
      else
        banner="$banner
Code graph is STALE ($stale) and cannot be rebuilt in this environment — 'graphify' is not installed here and this repo carries no dev container. Treat the graph as a dated map: fine for orientation, but confirm anything load-bearing against the current source. Ask the lead to re-run initiate.sh from the workspace, which now stages a dev container."
      fi
    fi
  fi
elif [ -f "$PROJECT_ROOT/graphify-out/graph.json" ]; then
  banner="$banner
Code graph present — navigate with 'graphify query \"<question>\"'; reports in graphify-out/."
fi

printf '%s\n' "$banner" >&2

# Claude Code injects raw stdout into context; VS Code agent hooks instead
# parse stdout as JSON and inject hookSpecificOutput.additionalContext.
if [ "$(hook_dialect)" = "vscode" ]; then
  if [ -n "$JQ" ]; then
    printf '%s' "$banner" | "$JQ" -Rs '{continue: true, hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: .}}'
  else
    esc="${banner//\\/\\\\}"
    esc="${esc//\"/\\\"}"
    esc="${esc//$'\n'/\\n}"
    esc="${esc//$'\t'/\\t}"
    printf '{"continue":true,"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc"
  fi
else
  printf '%s\n' "$banner"
fi
exit 0

#!/usr/bin/env bash
# PreToolUse[Bash|Edit|Write|MultiEdit|NotebookEdit] — the TEST-mode fence.
# In TEST mode a session may only create/edit test-scope files; source stays
# untouched and blockers get recorded in .workspace/PROGRESS.md instead of
# fixed. DEV mode (or a repo without .workspace/config) disables this hook.
#
# The Bash branch is BEST-EFFORT: it catches redirects, tee, sed -i, mv/cp,
# but `python -c`, npm scripts, and nested `bash -c` can write files it never
# sees. TEST mode is an anti-footgun for agents, not a security boundary —
# .github/copilot-instructions.md and AGENTS.md remain the backstop.

. "$(dirname "$0")/lib/common.sh"
read_input
TRACE_HOOK="enforce-test-mode"
trace "$TRACE_HOOK" invoked ""

workspace_active || exit 0
[ "$(workspace_mode)" = "TEST" ] || exit 0

# The remedy has to be runnable on the platform the developer is actually on.
# This message used to hardcode `bash .workspace/bin/set-mode.sh DEV`, which is
# precisely the command Copilot Chat's Windows terminal cannot run — so the one
# instruction a blocked Windows developer received was a dead end.
WHY_TEST=""
if dev_grant_expired; then
  WHY_TEST="Your DEV grant has EXPIRED (it lasts ${WORKSPACE_MODE_TTL_HOURS:-8}h), so this session is back in TEST — re-run set-mode to continue source work. "
fi
BLOCK_MSG="${WHY_TEST}TEST mode: this session may only create/edit test-scope files (test/, tests/, __tests__/, __mocks__/, *.test.*, *.spec.*, *Test.*, *Tests.*, conftest.py, .workspace/PROGRESS.md, .workspace/local/). Source, configs, and package manifests are off-limits — record the blocker in .workspace/PROGRESS.md instead. To do source work, ask the developer to run: $(setmode_hint DEV) . Not sure whether the guardrails are set up correctly? Run: $(doctor_hint)"

# Case-insensitive on purpose: Windows paths ignore case, and a permissive
# allowlist match never blocks work — it only ever lets a test file through.
is_test_scope() {
  local p="$1" g rc=1
  local allow=(
    'test/*'      '*/test/*'
    'tests/*'     '*/tests/*'
    '__tests__/*' '*/__tests__/*'
    '__mocks__/*' '*/__mocks__/*'
    '*.test.*' '*.spec.*' '*Test.*' '*Tests.*'
    'conftest.py' '*/conftest.py'
    # both spellings: repo-relative (normalized) and absolute (when the root
    # prefix could not be reconciled — belt and braces)
    '.workspace/PROGRESS.md' '*/.workspace/PROGRESS.md'
    '.workspace/local/*'     '*/.workspace/local/*'
  )
  shopt -s nocasematch 2>/dev/null || true
  for g in "${allow[@]}"; do
    # shellcheck disable=SC2053
    if [[ "$p" == $g ]]; then rc=0; break; fi
  done
  shopt -u nocasematch 2>/dev/null || true
  return $rc
}

check_target() {
  local t="$1"
  t="${t%\"}"; t="${t#\"}"; t="${t%\'}"; t="${t#\'}"
  [ -z "$t" ] && return 0
  # unresolvable (variables, substitutions) or throwaway targets: let through —
  # crashing or guessing here would block legitimate test runs (fail open)
  case "$t" in
    \$*|\`*|*'$('*)                          return 0 ;;
    /dev/*|/tmp/*|/proc/*)                   return 0 ;;
    graphify-out/*|*/graphify-out/*)         return 0 ;;
  esac
  is_test_scope "$(normalize_path "$t")" \
    || block "blocked by enforce-test-mode: the shell command would write '$t'. $BLOCK_MSG"
}

if tool_matches "$TOOLS_FILE"; then
  path="$(jget '.tool_input.file_path')"
  [ -z "$path" ] && path="$(jget '.tool_input.notebook_path')"
  if [ -z "$path" ]; then
    log_warn test-mode "could not read the target path from this tool call (jq missing?) — the TEST-mode fence was SKIPPED for it. Run '$(doctor_hint)' to check this workspace."
    exit 0
  fi
  is_test_scope "$(normalize_path "$path")" \
    || block "blocked by enforce-test-mode: '$path' is not in test scope. $BLOCK_MSG"

elif tool_matches "$TOOLS_SHELL"; then
  cmd="$(jget '.tool_input.command')"
  if [ -z "$cmd" ]; then
    log_warn test-mode "could not read the command from this tool call (jq missing?) — the TEST-mode fence was SKIPPED for it. Run '$(doctor_hint)' to check this workspace."
    exit 0
  fi
  # examine each simple command between ; | && || separately
  while IFS= read -r seg; do
    [ -z "$seg" ] && continue
    # redirect targets: > file, >> file (fd dups like 2>&1 self-exclude via &)
    while IFS= read -r t; do
      check_target "$t"
    done < <(printf '%s\n' "$seg" | grep -oE '>{1,2}[[:space:]]*[^[:space:]<>|&;]+' | sed -E 's/^>{1,2}[[:space:]]*//')
    # tee targets (skip flags)
    if printf '%s' "$seg" | grep -qE '(^|[[:space:]])tee([[:space:]]|$)'; then
      for t in $(printf '%s' "$seg" | sed -E 's/^.*(^|[[:space:]])tee[[:space:]]+//'); do
        case "$t" in -*) continue ;; esac
        check_target "$t"
      done
    fi
    # in-place edit / move / copy: best-effort, last token is the target
    if printf '%s' "$seg" | grep -qE '(^|[[:space:]])sed[[:space:]]+[^|]*-i' \
       || printf '%s' "$seg" | grep -qE '(^|[[:space:]])(mv|cp)[[:space:]]'; then
      check_target "$(printf '%s' "$seg" | awk '{print $NF}')"
    fi
    # PowerShell writes — Copilot CLI's shell tool on Windows is PowerShell, so
    # a bash-only guard misses every edit it makes. Only inspect targets when a
    # WRITE cmdlet is present: -Path also belongs to read cmdlets like
    # Get-Content, and blocking reads would break legitimate work.
    if printf '%s' "$seg" | grep -qiE '(^|[[:space:]])(Add-Content|Set-Content|Out-File|New-Item|Copy-Item|Move-Item|Rename-Item|Tee-Object|Export-Csv|Export-Clixml|Set-ItemProperty)([[:space:]]|$)'; then
      while IFS= read -r t; do
        check_target "$t"
      done < <(printf '%s\n' "$seg" \
        | grep -oiE '\-(LiteralPath|FilePath|Destination|Path)[[:space:]]+[^[:space:];|]+' \
        | sed -E 's/^-[A-Za-z]+[[:space:]]+//')
    fi
  done < <(printf '%s\n' "$cmd" | sed -E 's/\|\||&&|;|\|/\n/g')
fi

exit 0

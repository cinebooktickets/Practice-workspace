#!/usr/bin/env bash
# Shared substrate for guardrail hooks. Sourced, not executed.
# Detects OS, locates jq, and provides JSON helpers with a pure-bash fallback
# for the fields hooks read when jq isn't available. Understands both hook
# payload dialects: Claude Code and VS Code agent hooks (Copilot).

set -euo pipefail

# VS Code agent hooks treat ANY non-zero exit as a deny (fail-closed), unlike
# Claude Code where only exit 2 blocks. An unexpected crash must never deny —
# fail open instead. Only the deliberate deny (exit 2, see block()) passes
# through; every other exit code is normalized to 0. EXIT trap rather than ERR:
# ERR is not inherited by functions/subshells without errtrace.
trap 'rc=$?; if [ "$rc" -eq 2 ]; then exit 2; else exit 0; fi' EXIT

# --- OS detection -----------------------------------------------------------
detect_os() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    Linux*)               echo "linux"   ;;
    Darwin*)              echo "darwin"  ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)                    echo "unknown" ;;
  esac
}
HOOKS_OS="$(detect_os)"
export HOOKS_OS

# --- Project root -----------------------------------------------------------
# PWD walk-up first; then the script's own location (this file lives at
# <root>/.workspace/hooks/lib/common.sh). The fallback matters because a host
# agent may launch hooks with an unrelated working directory — without it,
# PROJECT_ROOT would silently point outside the repo and every gate that
# depends on it (.workspace/config, mode file, path normalization) misfires.
project_root() {
  local d="${PWD}"
  while [ "$d" != "/" ] && [ -n "$d" ]; do
    if [ -d "$d/.claude" ] || [ -d "$d/.workspace" ]; then echo "$d"; return 0; fi
    d="$(dirname "$d")"
  done
  d="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." 2>/dev/null && pwd)" || d=""
  if [ -n "$d" ] && { [ -d "$d/.claude" ] || [ -d "$d/.workspace" ]; }; then
    echo "$d"; return 0
  fi
  echo "${PWD}"
}
PROJECT_ROOT="$(project_root)"
export PROJECT_ROOT

# --- Workspace state ---------------------------------------------------------
# A repo seeded by initiate.sh gets a generated .workspace/config. The workspace
# source repo itself never has one, so mode/graph behaviors stay inert there.
workspace_active() { [ -f "$PROJECT_ROOT/.workspace/config" ]; }

# ENV_PROTECTION=false in .workspace/config declares the repo's committed .env
# files to be non-sensitive config the agents may touch. Default: protected.
env_protection_on() {
  local cfg="$PROJECT_ROOT/.workspace/config"
  [ -f "$cfg" ] || return 0
  ! grep -qiE '^[[:space:]]*ENV_PROTECTION[[:space:]]*=[[:space:]]*(false|off|0)[[:space:]]*$' "$cfg" 2>/dev/null
}

# workspace_mode -> DEV | TEST. Resolution: WORKSPACE_MODE env (headless
# override) -> .workspace/local/mode file -> TEST.
#
# The DEV grant ALWAYS expires, after WORKSPACE_MODE_TTL_HOURS (default 8).
# It used to be treated as permanent whenever the file carried a session= line,
# which was a real hole: nothing ever compared that id to the current session,
# so any stale mode file granted DEV forever in any runtime where SessionStart
# never fired (Copilot CLI without the hooks installed, or a hook that failed to
# launch). session= is still recorded, for provenance and so set-mode can
# preserve it — it just no longer extends the grant.
#
# Anything unreadable or malformed resolves to TEST — the POLICY is fail-safe
# even though hook CRASHES stay fail-open (see the EXIT trap above): a broken
# mode file must not grant DEV, but a broken hook must not brick the session.
#
# Sets WORKSPACE_MODE_SOURCE so callers can explain the result to a human:
#   env | file | file-expired | default
# NOTE it is set in the CALLER's shell, so it only survives a direct call —
#   workspace_mode >/dev/null; echo "$WORKSPACE_MODE_SOURCE"
# not `m="$(workspace_mode)"`, which forks. Hooks that only need the "developer
# thinks they are in DEV" case should use dev_grant_expired() below.
workspace_mode() {
  WORKSPACE_MODE_SOURCE="default"
  case "${WORKSPACE_MODE:-}" in
    [Dd][Ee][Vv])     WORKSPACE_MODE_SOURCE="env"; echo "DEV";  return 0 ;;
    [Tt][Ee][Ss][Tt]) WORKSPACE_MODE_SOURCE="env"; echo "TEST"; return 0 ;;
  esac
  local f="$PROJECT_ROOT/.workspace/local/mode" mode="" ts=""
  if [ -f "$f" ]; then
    # tr -d '\r': set-mode.ps1 writes this file from PowerShell. MSYS sed strips
    # the CR on Windows, but the GNU sed inside a container reading the same
    # bind-mounted checkout does not — without this, "mode=DEV\r" != "DEV" and
    # the developer is pinned in TEST while being told they are in DEV.
    mode="$(sed -n 's/^mode=//p' "$f" 2>/dev/null | head -n 1 | tr -d '\r' | tr '[:lower:]' '[:upper:]')"
    ts="$(sed -n 's/^ts=//p'     "$f" 2>/dev/null | head -n 1 | tr -d '\r')"
  fi
  if [ "$mode" = "DEV" ]; then
    case "$ts" in ''|*[!0-9]*) ts="" ;; esac
    if [ -n "$ts" ]; then
      local now ttl ttlh
      now="$(date +%s 2>/dev/null || echo 0)"
      # A non-numeric TTL would otherwise evaluate to 0 inside $(( )) — or, with
      # arithmetic metacharacters in it, abort the hook entirely.
      ttlh="${WORKSPACE_MODE_TTL_HOURS:-8}"
      case "$ttlh" in ''|*[!0-9]*) ttlh=8 ;; esac
      ttl=$(( ttlh * 3600 ))
      if [ "$now" -gt 0 ] && [ $(( now - ts )) -le "$ttl" ]; then
        WORKSPACE_MODE_SOURCE="file"; echo "DEV"; return 0
      fi
    fi
    WORKSPACE_MODE_SOURCE="file-expired"
  fi
  echo "TEST"
}

# True when the mode file asks for DEV but the grant has expired, i.e. the one
# situation where a developer is being blocked by the TEST fence while sincerely
# believing they are in DEV. Worth calling out by name: "you are in TEST" is
# baffling advice to someone who ran set-mode DEV this morning.
dev_grant_expired() {
  [ "$(workspace_mode)" = "TEST" ] || return 1
  local f="$PROJECT_ROOT/.workspace/local/mode" m=""
  [ -f "$f" ] || return 1
  m="$(sed -n 's/^mode=//p' "$f" 2>/dev/null | head -n 1 | tr -d '\r' | tr '[:lower:]' '[:upper:]')"
  [ "$m" = "DEV" ]
}

# --- Platform-correct remedies ----------------------------------------------
# A guardrail whose escape hatch cannot be reached on the platform the developer
# is standing on is a guardrail that gets torn out. Copilot Chat's Windows
# terminal is PowerShell with NO bash on PATH — verified live, it tried
# `bash .workspace/bin/set-mode.sh TEST`, reported "bash is not available in the
# current Windows shell", and could not switch modes at all. Stock Windows also
# ships powershell.exe 5.1 rather than pwsh, so that is what we name.
# Every block message and banner routes through these, so the advice can never
# again drift apart between one hook and another.
setmode_hint() {
  local mode="${1:-DEV}"
  if [ "$HOOKS_OS" = "windows" ]; then
    printf 'powershell -File .workspace/bin/set-mode.ps1 %s   (or, if your shell has bash: bash .workspace/bin/set-mode.sh %s)' "$mode" "$mode"
  else
    printf 'bash .workspace/bin/set-mode.sh %s' "$mode"
  fi
}

doctor_hint() {
  if [ "$HOOKS_OS" = "windows" ]; then
    printf 'powershell -File .workspace/bin/doctor.ps1'
  else
    printf 'bash .workspace/bin/doctor.sh'
  fi
}

# "D:/x" -> "/d/x" so drive-letter (tool payloads) and MSYS (Git Bash $PWD)
# spellings of the same path compare equal. Length-preserving on purpose —
# normalize_path strips by the ORIGINAL root's length after comparing.
_drive_to_msys() {
  local s="$1" d
  case "$s" in
    [A-Za-z]:/*)
      d="$(printf '%s' "${s%%:*}" | tr '[:upper:]' '[:lower:]')"
      printf '/%s%s' "$d" "${s#?:}"
      ;;
    *) printf '%s' "$s" ;;
  esac
}

# Can a human answer a question in this session? Claude Code exports
# CLAUDE_CODE_ENTRYPOINT=cli for an interactive terminal and sdk-* for headless
# `-p`/SDK runs; CI is the generic convention. ONLY known-headless values count
# as non-interactive — an unknown or absent value (Copilot, IDE panes, future
# entrypoints) is treated as interactive, because asking a human who is there
# is recoverable while silently proceeding past them is not.
session_interactive() {
  case "${CLAUDE_CODE_ENTRYPOINT:-}" in
    sdk-cli|sdk-py|sdk-ts|sdk|github-action|github-actions) return 1 ;;
  esac
  case "${CI:-}" in
    1|true|TRUE|True|yes) return 1 ;;
  esac
  return 0
}

# normalize_path <p> -> forward slashes; repo-relative when under PROJECT_ROOT.
# Compares case-insensitively and across drive-letter vs MSYS forms: Claude
# Code sends 'D:\repo\src\a.ts' while the hook's $PWD may be '/d/repo'.
normalize_path() {
  local p="${1//\\//}" root="${PROJECT_ROOT//\\//}" lp lr
  lp="$(_drive_to_msys "$p"    | tr '[:upper:]' '[:lower:]')"
  lr="$(_drive_to_msys "$root" | tr '[:upper:]' '[:lower:]')"
  case "$lp" in
    "$lr"/*) p="${p:$(( ${#root} + 1 ))}" ;;
  esac
  printf '%s' "$p"
}

# --- jq (system, if present; the Dev Container guarantees it) ---------------
# GUARDRAILS_NO_JQ=1 forces the pure-bash fallback (used by tests/hooks-test.sh).
JQ=""
if [ -z "${GUARDRAILS_NO_JQ:-}" ] && command -v jq >/dev/null 2>&1; then JQ="$(command -v jq)"; fi
export JQ

# --- JSON helpers -----------------------------------------------------------
# read_input    -> reads stdin into CC_INPUT
# jget '.path'  -> extracts value; jq if available, else a targeted fallback
#                  for the only fields hooks read. Payloads come in two
#                  dialects: Claude Code (snake_case: file_path, tool_name)
#                  and VS Code agent hooks (camelCase: filePath, toolName);
#                  jget accepts both.

read_input() { CC_INPUT="$(cat)"; export CC_INPUT; }

# Escape-aware single-field extractor: tolerates '}' and \" inside values
# (a brace-matcher does not — shell commands contain both constantly).
# Not a general JSON parser: \uXXXX sequences are left as-is.
_pb_get_field() {
  local json="$1" key="$2" raw
  raw="$(printf '%s' "$json" | tr '\n' ' ' \
    | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"((\\\\.|[^\"\\\\])*)\".*/\\1/p" \
    | head -n 1)" || true
  raw="${raw//\\\"/\"}"
  printf '%b' "$raw"
}

# First non-empty value among several fallback keys.
_pb_first_field() {
  local key val
  for key in "$@"; do
    val="$(_pb_get_field "$CC_INPUT" "$key")"
    if [ -n "$val" ]; then printf '%s' "$val"; return 0; fi
  done
}

# Copilot CLI command hooks nest the tool arguments inside toolArgs as a
# JSON-ENCODED STRING: {"toolName":"bash","toolArgs":"{\"command\":\"ls\"}"}.
# _pb_get_field unescapes \" while reading a string value, so decoding is just
# "read toolArgs, then read the wanted key out of the result". When toolArgs is
# a plain object instead, the ordinary whole-payload search already found it.
_pb_nested_arg() {
  local inner key val
  inner="$(_pb_get_field "$CC_INPUT" "toolArgs")"
  [ -z "$inner" ] && return 0
  for key in "$@"; do
    val="$(_pb_get_field "$inner" "$key")"
    if [ -n "$val" ]; then printf '%s' "$val"; return 0; fi
  done
}

# Unquoted JSON scalars (true/false/numbers) — _pb_get_field only sees strings.
_pb_bare_field() {
  local key val
  for key in "$@"; do
    val="$(printf '%s' "$CC_INPUT" | tr '\n' ' ' \
      | sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*(true|false|[0-9]+).*/\\1/p" \
      | head -n 1)" || true
    if [ -n "$val" ]; then printf '%s' "$val"; return 0; fi
  done
}

jget() {
  local path="$1"
  if [ -n "$JQ" ]; then
    case "$path" in
      .tool_input.command)
        # Copilot CLI carries arguments in toolArgs, which is an object in the
        # SDK but a JSON-encoded STRING for command hooks — accept both.
        printf '%s' "$CC_INPUT" | "$JQ" -r '
          .tool_input.command //
          ((.toolArgs // empty | if type=="string" then (fromjson? // {}) else . end) | .command) //
          empty' 2>/dev/null ;;
      .tool_input.file_path)
        printf '%s' "$CC_INPUT" | "$JQ" -r '
          .tool_input.file_path // .tool_input.filePath //
          ((.toolArgs // empty | if type=="string" then (fromjson? // {}) else . end)
            | (.filePath // .file_path // .path)) //
          empty' 2>/dev/null ;;
      .tool_name)
        printf '%s' "$CC_INPUT" | "$JQ" -r '.tool_name // .toolName // empty' 2>/dev/null ;;
      .session_id)
        printf '%s' "$CC_INPUT" | "$JQ" -r '.session_id // .sessionId // empty' 2>/dev/null ;;
      .stop_hook_active)
        printf '%s' "$CC_INPUT" | "$JQ" -r '.stop_hook_active // .stopHookActive // empty' 2>/dev/null ;;
      *)
        printf '%s' "$CC_INPUT" | "$JQ" -r "$path // empty" 2>/dev/null ;;
    esac
    return
  fi
  local v
  case "$path" in
    .tool_input.command)
      v="$(_pb_get_field "$CC_INPUT" "command")"
      [ -z "$v" ] && v="$(_pb_nested_arg "command")"
      printf '%s' "$v" ;;
    .tool_input.file_path)
      v="$(_pb_first_field "file_path" "filePath" "path")"
      [ -z "$v" ] && v="$(_pb_nested_arg "filePath" "file_path" "path")"
      printf '%s' "$v" ;;
    .tool_name)            _pb_first_field "tool_name" "toolName"       ;;
    .session_id)           _pb_first_field "session_id" "sessionId"     ;;
    .stop_hook_active)     _pb_bare_field "stop_hook_active" "stopHookActive" ;;
    *)                     _pb_get_field "$CC_INPUT" "${path##*.}"      ;;
  esac
}

# --- Dialect & tool self-filtering ------------------------------------------
# The .github/hooks/guardrails.json entries set GUARDRAILS_DIALECT=vscode.
# VS Code parses hook matchers but ignores them — every hook fires for every
# tool — so PreToolUse scripts must self-filter on the tool name.
hook_dialect() {
  if [ "${GUARDRAILS_DIALECT:-}" = "vscode" ]; then echo "vscode"; else echo "claude"; fi
}

# tool_matches '<ere>' -> 0 when this hook's checks apply to the current tool.
# Empty/unreadable tool name: under Claude Code the settings.json matcher
# already filtered, so run the checks; under VS Code we cannot attribute the
# call, so skip (fail open — terminal approval remains the backstop).
# Matching is case-INSENSITIVE: the same capability is spelled differently per
# runtime (Claude "Bash", VS Code "run_in_terminal", Copilot CLI "bash"), and
# the patterns are fully anchored, so folding case cannot widen them.
tool_matches() {
  local tn
  tn="$(jget '.tool_name')" || tn=""
  if [ -z "$tn" ]; then
    if [ "$(hook_dialect)" = "claude" ]; then return 0; else return 1; fi
  fi
  printf '%s' "$tn" | grep -Eqi "$1"
}

# One place to name the shell/file tool families across every runtime. Adding a
# runtime means editing these two strings, not four scripts.
# 'powershell' is what GitHub Copilot CLI actually calls its shell tool on
# Windows (verified from a live payload) — guessing this list is how a guardrail
# silently stops guarding.
TOOLS_SHELL='^(Bash|shell|powershell|pwsh|cmd|sh|run_in_terminal|runInTerminal|run_command_in_terminal|run_command|terminal|execute_command)$'
TOOLS_FILE='^(Edit|Write|MultiEdit|NotebookEdit|create_file|replace_string_in_file|insert_edit_into_file|edit_file|apply_patch|str_replace_editor|str_replace|write_file|create|edit)$'
export TOOLS_SHELL TOOLS_FILE

# --- Logging ----------------------------------------------------------------
log_info() { printf '[guardrails:%s] %s\n' "$1" "$2" >&2; }
log_warn() { printf '[guardrails:%s] WARN: %s\n' "$1" "$2" >&2; }

# --- Trace (enforcement monitoring) ------------------------------------------
# Opt-in evidence trail: WORKSPACE_TRACE=1 env, or TRACE=on in .workspace/config.
# One line per hook decision into .workspace/local/hook-trace.log; the FIRST
# sighting of each raw tool name also dumps the whole payload into
# payload-samples.log — this is how the real VS Code/Copilot tool names and
# field shapes are captured. Best-effort by design: any failure is swallowed
# so tracing can never affect an allow/block outcome.
trace_enabled() {
  [ "${WORKSPACE_TRACE:-}" = "1" ] && return 0
  grep -qiE '^[[:space:]]*TRACE[[:space:]]*=[[:space:]]*on[[:space:]]*$' \
    "$PROJECT_ROOT/.workspace/config" 2>/dev/null
}

# trace <hook-name> <decision> <detail>
trace() {
  trace_enabled || return 0
  {
    local dir="$PROJECT_ROOT/.workspace/local" tn detail
    mkdir -p "$dir"
    tn="$(jget '.tool_name')" || tn=""
    detail="$(printf '%.120s' "$3")"
    printf '%s | %s | %s | tool=%s | %s | %s\n' \
      "$(date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || echo '?')" \
      "$(hook_dialect)" "$1" "${tn:-<none>}" "$2" "$detail" >> "$dir/hook-trace.log"
    if [ -n "$tn" ] && ! grep -qF "\"seen:$tn\"" "$dir/payload-samples.log" 2>/dev/null; then
      printf '{"seen:%s"}\n%s\n---\n' "$tn" "${CC_INPUT:-}" >> "$dir/payload-samples.log"
    fi
  } 2>/dev/null || true
}

# --- Block helper -----------------------------------------------------------
# Deny is signalled TWO ways at once, because the runtimes disagree:
#   * exit 2  — honoured by Claude Code and Copilot CLI (both verified live).
#   * stdout JSON hookSpecificOutput.permissionDecision=deny — what VS Code
#     actually reads. Verified the hard way: with exit 2 alone, VS Code invoked
#     the hook, logged the deny, and ran the tool anyway — the edit landed.
# "Most restrictive wins" where both are understood, so emitting both is safe.
# Each hook sets TRACE_HOOK after sourcing this lib so blocks are attributed.
# Copilot CLI and VS Code both run with GUARDRAILS_DIALECT=vscode but are told
# apart by payload shape: the CLI sends camelCase toolName/toolArgs, VS Code
# sends snake_case tool_name/tool_input. They need OPPOSITE exit codes, so this
# distinction is load-bearing, not cosmetic.
is_copilot_cli() { printf '%s' "${CC_INPUT:-}" | grep -q '"toolArgs"'; }

block() {
  trace "${TRACE_HOOK:-hook}" BLOCK "$1"
  if [ "$(hook_dialect)" = "vscode" ]; then
    if [ -n "$JQ" ]; then
      printf '%s' "$1" | "$JQ" -Rs '{continue:false, stopReason:.,
        hookSpecificOutput:{hookEventName:"PreToolUse",
          permissionDecision:"deny", permissionDecisionReason:.}}'
    else
      esc="${1//\\/\\\\}"; esc="${esc//\"/\\\"}"
      esc="${esc//$'\n'/\\n}"; esc="${esc//$'\t'/\\t}"
      printf '{"continue":false,"stopReason":"%s","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$esc" "$esc"
    fi
  fi
  printf '%s\n' "$1" >&2
  # VS Code parses stdout as JSON ONLY when the hook exits 0; exiting 2 there
  # discards the decision and the tool runs regardless — measured twice, with
  # the edit landing both times. Claude Code and Copilot CLI need exit 2.
  if [ "$(hook_dialect)" = "vscode" ] && ! is_copilot_cli; then
    exit 0
  fi
  exit 2
}

#!/usr/bin/env bash
# staged-by: workspace
# doctor — answers the one question the guardrails could never answer before:
# "are they actually on, right now, in this repo?"
#
# WHY THIS EXISTS: every enforcement failure in this system is silent by design.
# Hooks fail OPEN (see the EXIT trap in .workspace/hooks/lib/common.sh) so that a
# broken guardrail can never brick a working session — the right trade, but it
# means a workspace whose hooks never fire looks exactly like one where nothing
# dangerous was ever attempted. A missing jq, an unmatched tool name, a Git
# installed somewhere unusual, a Preview flag left off: each of those turns
# enforcement off with no message anywhere. This command is the difference
# between "protected" and "believed to be protected".
#
#   bash .workspace/bin/doctor.sh
#
# Exits 0 when nothing is broken, 1 when at least one check FAILs.

# NOT set -e: doctor must report every check, not stop at the first problem.
set -uo pipefail

cd "$(dirname "$0")/../.." 2>/dev/null || { echo "doctor: cannot locate the repo root"; exit 1; }
REPO="$(pwd)"

OK=0; WARNS=0; BAD=0
ok()   { printf '  [ OK ]  %s\n' "$1"; OK=$((OK + 1)); }
warn() { printf '  [WARN]  %s\n          -> %s\n' "$1" "$2"; WARNS=$((WARNS + 1)); }
bad()  { printf '  [FAIL]  %s\n          -> %s\n' "$1" "$2"; BAD=$((BAD + 1)); }
note() { printf '          %s\n' "$1"; }
hdr()  { printf '\n%s\n' "$1"; }

case "$(uname -s 2>/dev/null || echo unknown)" in
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  Darwin*)              OS=darwin  ;;
  Linux*)               OS=linux   ;;
  *)                    OS=unknown ;;
esac

printf 'Workspace doctor\n'
printf '  repo:     %s\n' "$REPO"
printf '  platform: %s\n' "$OS"

# --- Seeding ----------------------------------------------------------------
hdr 'Seeding'
SEEDED=n
if [ -f .workspace/config ]; then
  SEEDED=y
  ok '.workspace/config present — this repo is seeded'
else
  bad '.workspace/config is missing — the TEST fence and mode system are INERT here' \
      'Either this repo was never seeded, or the file was deleted. Re-run initiate.sh from the workspace, or restore it: git checkout .workspace/config'
fi

# --- Hook scripts -----------------------------------------------------------
hdr 'Hook scripts'
missing=''
for h in session-start.sh block-dangerous-bash.sh protect-sensitive-files.sh \
         enforce-test-mode.sh progress-reminder.sh lib/common.sh; do
  [ -f ".workspace/hooks/$h" ] || missing="$missing $h"
done
if [ -n "$missing" ]; then
  bad "hook scripts missing:$missing" \
      'Re-run initiate.sh from the workspace to restore .workspace/hooks/, or: git checkout .workspace/hooks'
else
  ok 'all 6 hook scripts present'
fi

# CRLF is the quietest way to lose every guardrail at once: bash cannot execute
# a script whose shebang ends in \r, the hook process dies, and fail-open turns
# that into "allowed" with no message. A Windows clone without .gitattributes
# produces exactly this.
crlf=''
for f in .workspace/hooks/*.sh .workspace/hooks/lib/*.sh .workspace/bin/*.sh; do
  [ -f "$f" ] || continue
  if head -n 1 "$f" 2>/dev/null | LC_ALL=C grep -q $'\r'; then
    crlf="$crlf $(basename "$f")"
  fi
done
if [ -n "$crlf" ]; then
  bad "CRLF line endings in:$crlf — bash cannot run these, so every guardrail fails open silently" \
      'Repair with: git config core.autocrlf false && git rm --cached -r . && git reset --hard  (this repo ships a .gitattributes that prevents it on fresh clones)'
else
  ok 'hook scripts have Unix line endings'
fi

# --- Claude Code ------------------------------------------------------------
hdr 'Claude Code (CLI and VS Code extension)'
if [ -f .claude/settings.json ]; then
  if grep -q '"hooks"' .claude/settings.json; then
    ok '.claude/settings.json wires the hooks'
  else
    bad '.claude/settings.json has no "hooks" section — Claude Code enforces nothing here' \
        'Re-run initiate.sh from the workspace, or restore the file: git checkout .claude/settings.json'
  fi
else
  bad '.claude/settings.json missing — Claude Code enforces nothing here' \
      'Re-run initiate.sh from the workspace.'
fi

# --- Copilot Chat in VS Code ------------------------------------------------
hdr 'GitHub Copilot Chat (VS Code)'
if [ -f .github/hooks/guardrails.json ]; then
  ok '.github/hooks/guardrails.json present'
  if command -v jq >/dev/null 2>&1 && ! jq -e . .github/hooks/guardrails.json >/dev/null 2>&1; then
    bad '.github/hooks/guardrails.json is not valid JSON' \
        'VS Code ignores the whole file when it cannot parse it. Restore it from the workspace.'
  fi
else
  bad '.github/hooks/guardrails.json missing — Copilot Chat enforces nothing here' \
      'Re-run initiate.sh from the workspace.'
fi
note 'Not verifiable from here: VS Code agent hooks are a Preview feature behind the'
note 'chat.tools.hooks.enabled setting. The seeded dev container sets it at container'
note 'scope, but VS Code may not honor a Preview flag there — if hooks stay silent,'
note 'enable it in your User settings. When the switch is off, Copilot Chat runs with'
note 'NO hook enforcement and says nothing about it — the instruction files in'
note '.github/ are then the only thing holding the line.'

# --- Copilot CLI ------------------------------------------------------------
hdr 'GitHub Copilot CLI'
CDIR="${COPILOT_HOME:-$HOME/.copilot}/hooks"
found=''
if [ -d "$CDIR" ]; then
  for f in "$CDIR"/*.json; do
    [ -f "$f" ] || continue
    if grep -qF "$REPO" "$f" 2>/dev/null; then found="$f"; break; fi
  done
fi
if [ -n "$found" ]; then
  ok "guardrails installed for THIS repo ($found)"
  gone=''
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    [ -f "$s" ] || gone="$gone $s"
  done < <(grep -o '/[^"]*\.workspace/hooks/[a-z-]*\.sh' "$found" 2>/dev/null | sort -u)
  if [ -n "$gone" ]; then
    bad "the installed config points at hook scripts that do not exist:$gone" \
        'Re-run: bash .workspace/bin/install-copilot-hooks.sh'
  fi
elif command -v copilot >/dev/null 2>&1; then
  warn 'Copilot CLI is installed but has NO guardrails for this repo' \
       'The CLI reads hooks only from ~/.copilot/hooks, never from the repo, so this is a per-machine step. Run once: bash .workspace/bin/install-copilot-hooks.sh'
else
  ok 'Copilot CLI is not installed — nothing to wire'
fi

# --- Windows launcher -------------------------------------------------------
if [ "$OS" = windows ]; then
  hdr 'Windows: the bash that hook configs launch'
  if [ -x '/c/Program Files/Git/bin/bash.exe' ]; then
    ok 'C:\PROGRA~1\Git\bin\bash.exe exists (this is what .github/hooks/*.json invoke)'
  else
    bad 'Git bash is not at C:\Program Files\Git — every VS Code and Copilot CLI hook fails to launch, silently' \
        "Install Git for Windows to the default location, or point the \"windows\" command in .github/hooks/*.json and CLAUDE_CODE_GIT_BASH_PATH in .claude/settings.json at your own bash.exe (currently: $(command -v bash 2>/dev/null || echo 'not on PATH'))"
  fi
fi

# --- JSON parsing -----------------------------------------------------------
hdr 'JSON parsing'
if command -v jq >/dev/null 2>&1; then
  ok "jq present ($(jq --version 2>/dev/null || echo 'version unknown'))"
else
  warn 'jq not found — hooks fall back to a pure-bash parser' \
       'That parser is a regex approximation, not a JSON parser; unusual payloads can slip past a check. jq is preinstalled in the dev container; on a host it is optional but recommended.'
fi

# --- Session mode -----------------------------------------------------------
hdr 'Session mode'
ttlh="${WORKSPACE_MODE_TTL_HOURS:-8}"
case "$ttlh" in ''|*[!0-9]*) ttlh=8 ;; esac
mf='.workspace/local/mode'
if [ -n "${WORKSPACE_MODE:-}" ]; then
  case "$WORKSPACE_MODE" in
    [Dd][Ee][Vv])     ok 'DEV — set by the WORKSPACE_MODE environment variable' ;;
    [Tt][Ee][Ss][Tt]) ok 'TEST — set by the WORKSPACE_MODE environment variable' ;;
    *) bad "WORKSPACE_MODE='$WORKSPACE_MODE' is not a valid mode, so this session silently falls back to TEST" \
           'The only accepted values are DEV and TEST. Fix the variable, or unset it and use set-mode instead.' ;;
  esac
elif [ -f "$mf" ]; then
  m="$(sed -n 's/^mode=//p' "$mf" 2>/dev/null | head -n 1 | tr -d '\r' | tr '[:lower:]' '[:upper:]')"
  ts="$(sed -n 's/^ts=//p'   "$mf" 2>/dev/null | head -n 1 | tr -d '\r')"
  case "$ts" in ''|*[!0-9]*) ts='' ;; esac
  now="$(date +%s 2>/dev/null || echo 0)"
  if [ "$m" = DEV ] && [ -n "$ts" ] && [ "$now" -gt 0 ] && [ $(( now - ts )) -le $(( ttlh * 3600 )) ]; then
    ok "DEV — full development; expires in $(( (ttlh * 3600 - (now - ts)) / 60 )) min"
  elif [ "$m" = DEV ]; then
    warn "TEST — the mode file asks for DEV but the grant has EXPIRED (${ttlh}h limit)" \
         'This is why source edits are being blocked. Re-run set-mode DEV to continue.'
  else
    ok 'TEST — only test-scope files may be created or edited'
  fi
else
  ok 'TEST — the fail-safe default, until someone chooses a mode this session'
fi

# --- Secrets policy ---------------------------------------------------------
hdr 'Secrets policy'
if [ -f .workspace/config ] && \
   grep -qiE '^[[:space:]]*ENV_PROTECTION[[:space:]]*=[[:space:]]*(false|off|0)[[:space:]]*$' .workspace/config; then
  warn 'ENV_PROTECTION is OFF — agents may read and edit .env files in this repo' \
       'Deliberate for repos that commit .env as ordinary non-sensitive config. Re-enable with: bash .workspace/bin/env-protection.sh on  (then restart the agent session — read permissions load at startup)'
else
  ok 'ENV_PROTECTION on — .env files are neither readable nor editable by agents'
fi

# --- Code graph -------------------------------------------------------------
hdr 'Code graph'
if [ -f .workspace/graph.json ]; then
  stamp="$(cat .workspace/graph-stamp 2>/dev/null || true)"
  stale=''
  if [ -z "$stamp" ]; then
    stale='no build stamp'
  elif git rev-parse --git-dir >/dev/null 2>&1; then
    if ! git cat-file -e "$stamp" 2>/dev/null; then
      stale='the commit it was built from is not in this clone'
    elif [ -n "$(git diff --name-only "$stamp"..HEAD -- 2>/dev/null \
                 | grep -vE '^(\.workspace/|\.claude/|\.github/|\.agents/)' \
                 | grep -vE '\.md$')" ]; then
      stale='code has changed since it was built'
    fi
  fi
  if [ -z "$stale" ]; then
    ok 'present and current'
  elif command -v graphify >/dev/null 2>&1; then
    warn "stale ($stale)" 'Refresh with: bash .workspace/bin/sync-graph.sh refresh'
  elif [ -d .devcontainer ]; then
    warn "stale ($stale) — graphify is not installed in this environment" \
         'This repo ships a dev container with graphify preinstalled. Reopen in Container, then: bash .workspace/bin/sync-graph.sh refresh'
  else
    warn "stale ($stale), and it cannot be rebuilt here — graphify is not installed" \
         'This repo carries no dev container (seeded before containers were added). Ask the lead to re-run initiate.sh from the workspace, which now stages one. Meanwhile use the graph for orientation and confirm anything load-bearing against the source.'
  fi
else
  ok 'no code graph in this repo (optional)'
fi

# --- Live fire --------------------------------------------------------------
# Every check above inspects configuration. This one runs the actual hooks
# against known-bad input and looks at what they decide — the only check that
# can prove the chain works end to end rather than merely looking correct.
hdr 'Live fire — do the hooks actually deny?'
probe() { # probe <label> <script> <payload> [VAR=val ...]
  local label="$1" script="$2" payload="$3"; shift 3
  local rc=0
  [ -f ".workspace/hooks/$script" ] || { bad "$label — $script is missing" 'See the hook-scripts section above.'; return; }
  printf '%s' "$payload" | env "$@" bash ".workspace/hooks/$script" >/dev/null 2>&1 || rc=$?
  if [ "$rc" -eq 2 ]; then
    ok "$label — denied"
  else
    bad "$label — NOT denied (the hook exited $rc)" \
        'Enforcement is not working. Fix any [FAIL] above and re-run; if there are none, the hook itself is broken — restore .workspace/hooks from the workspace.'
  fi
}
probe 'dangerous command (rm -rf /)' block-dangerous-bash.sh \
  '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}'
probe 'private key write (keys/id_rsa)' protect-sensitive-files.sh \
  '{"tool_name":"Write","tool_input":{"file_path":"keys/id_rsa"}}'
if [ "$SEEDED" = y ]; then
  probe 'TEST-mode fence (source edit)' enforce-test-mode.sh \
    '{"tool_name":"Write","tool_input":{"file_path":"src/doctor-probe.js"}}' WORKSPACE_MODE=TEST
else
  note 'TEST-mode fence not probed: this repo is not seeded, so the fence is inert by design.'
fi

# --- Verdict ----------------------------------------------------------------
printf '\n%s\n' '--------------------------------------------------------------'
printf '%s OK · %s warning(s) · %s failure(s)\n' "$OK" "$WARNS" "$BAD"
if [ "$BAD" -gt 0 ]; then
  printf 'Guardrails are NOT fully working in this repo. Fix the [FAIL] items above.\n'
  exit 1
fi
if [ "$WARNS" -gt 0 ]; then
  printf 'Guardrails are working. The warnings are things to know about, not breakage.\n'
else
  printf 'Guardrails are fully wired.\n'
fi
exit 0

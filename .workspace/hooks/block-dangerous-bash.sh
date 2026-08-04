#!/usr/bin/env bash
# PreToolUse[Bash] — hard-deny destructive commands; block host package
# installs outside a container. POSIX character classes only: macOS BSD grep
# has no \s.
. "$(dirname "$0")/lib/common.sh"
read_input
TRACE_HOOK="block-dangerous-bash"
trace "$TRACE_HOOK" invoked ""

# Self-filter: VS Code fires every hook for every tool (matchers are ignored).
# Only terminal/shell tools carry a command to check.
tool_matches "$TOOLS_SHELL" || exit 0

cmd="$(jget '.tool_input.command')"

if [ -z "$cmd" ]; then
  log_warn dangerous-bash "could not read the command from this tool call (jq missing?) — dangerous-command checks were SKIPPED for it. Run '$(doctor_hint)' to check this workspace; the permission system and human approval remain the backstop."
  exit 0
fi

# --- Hard denials (host AND container) --------------------------------------
# deny_rule <plain-English rule name> <regex> <what to do instead>
#
# The NAME and the REMEDY are the parts a human reads. This hook used to print
# the raw ERE that matched — a developer facing
#   pattern 'rm[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*-[a-zA-Z]*[rR]...' matched
# learns neither which rule they hit nor how to get their work done, so the
# rational next move is to route around the guardrail. Passing the three fields
# as separate arguments (rather than packing them into one delimited string)
# keeps regex metacharacters from ever colliding with a field separator.
deny_rule() {
  printf '%s' "$cmd" | grep -Eq "$2" || return 0
  block "Blocked — $1. This is denied in every workspace session because the damage is not recoverable from an agent session. $3"
}

# recursive rm of root, home, or $HOME — any flag order (-rf, -fr, -r -f, -R)
deny_rule 'recursive delete of a root or home directory' \
  'rm[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+(/|~|\$HOME)([[:space:]]|/|\*|$)' \
  'Delete a specific path inside the repo instead, e.g. rm -rf ./build. Clearing a home or system path is a human-run operation.'

# fork bomb  :(){ :|:& };:
deny_rule 'fork bomb' \
  ':[[:space:]]*\([[:space:]]*\)[[:space:]]*\{.*:.*\|[[:space:]]*:' \
  'There is no safe variant of this. If you were testing shell quoting, write the string to a file rather than executing it.'

# filesystem / raw-device destruction
deny_rule 'filesystem format' \
  'mkfs\.' \
  'Never needed from an agent session. Ask a human if a volume genuinely has to be formatted.'
deny_rule 'raw write to a block device' \
  'dd[[:space:]]+[^|;]*of=/dev/(sd|hd|nvme|mmcblk|disk)' \
  'Write to a file path instead of a device node. Imaging a disk is a human-run operation.'
deny_rule 'raw write to a block device' \
  '>[[:space:]]*/dev/sd[a-z]' \
  'Redirect to a file path instead of a device node.'

# pipe web content into a shell
deny_rule 'piping downloaded content straight into a shell' \
  'curl[[:space:]]+[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash|zsh)([[:space:]]|$)' \
  'Download to a file, read it, then run it as a separate step — so the code is reviewable before it executes.'
deny_rule 'piping downloaded content straight into a shell' \
  'wget[[:space:]]+[^|]*\|[[:space:]]*(sudo[[:space:]]+)?(sh|bash|zsh)([[:space:]]|$)' \
  'Download to a file, read it, then run it as a separate step — so the code is reviewable before it executes.'

# history rewrites on shared branches (--force-with-lease stays allowed)
deny_rule 'force-push, which rewrites history other people have already pulled' \
  'git[[:space:]]+push([[:space:]]+[^[:space:]]+)*[[:space:]]+(--force|-f)([[:space:]]|$)' \
  'Use git push --force-with-lease, which IS allowed: it refuses the push if someone else has pushed since you last fetched. Plain --force overwrites their work silently.'
# same effect, different spelling: git push origin +main
deny_rule 'force-push via a + refspec, which rewrites history other people have already pulled' \
  'git[[:space:]]+push[[:space:]]+[^[:space:]]+[[:space:]]+\+[^[:space:]]+' \
  'Use git push --force-with-lease instead. A leading + on the refspec forces the update exactly as --force does.'
deny_rule 'hard reset onto a remote or an earlier commit' \
  'git[[:space:]]+reset[[:space:]]+--hard[[:space:]]+(origin|HEAD~[0-9]+)' \
  'Discarding commits this way is unrecoverable. Use git revert <commit> to undo a change while keeping history, or git stash to park work in progress.'

# permission bombs / privileged deletes / power state
deny_rule 'world-writable permissions on a system path' \
  'chmod[[:space:]]+-R[[:space:]]+777[[:space:]]+/' \
  'Scope the chmod to the specific file that needs it, and use the narrowest mode that works (644 for files, 755 for executables).'
deny_rule 'privileged delete' \
  'sudo[[:space:]]+rm[[:space:]]' \
  'Run the delete without sudo, scoped inside the repo. Anything that genuinely needs root is a human-run operation.'
deny_rule 'host power-state change' \
  '(^|;|&&|\|\|)[[:space:]]*(sudo[[:space:]]+)?(shutdown|reboot|poweroff|halt)([[:space:]]|$)' \
  'Restart the dev container or the specific service you meant, not the machine.'

# --- Host-install soft block ------------------------------------------------
# The Dev Container IS the sandbox: package installs inside a container are
# fine. Only on a bare host do we block installs that aren't docker-wrapped.
in_container() {
  [ -f /.dockerenv ] && return 0
  [ -f /run/.containerenv ] && return 0
  [ -n "${REMOTE_CONTAINERS:-}" ] && return 0
  [ -n "${CODESPACES:-}" ] && return 0
  [ -n "${DEVCONTAINER:-}" ] && return 0
  grep -qE '(docker|containerd|kubepods)' /proc/1/cgroup 2>/dev/null && return 0
  return 1
}

if ! in_container; then
  host_install=(
    '(^|[;&|([:space:]])(sudo[[:space:]]+)?(npm|pnpm|yarn|bun)[[:space:]]+(install|i|ci|add)([[:space:]]|$)'
    '(^|[;&|([:space:]])(sudo[[:space:]]+)?pip3?[[:space:]]+install([[:space:]]|$)'
    '(^|[;&|([:space:]])(sudo[[:space:]]+)?uv[[:space:]]+(pip[[:space:]]+install|add|sync|tool[[:space:]]+install)([[:space:]]|$)'
    '(^|[;&|([:space:]])(sudo[[:space:]]+)?pipx[[:space:]]+install([[:space:]]|$)'
    '(^|[;&|([:space:]])(sudo[[:space:]]+)?go[[:space:]]+install([[:space:]]|$)'
    '(^|[;&|([:space:]])(sudo[[:space:]]+)?(cargo|gem|brew|apt|apt-get|apk|dnf|yum|choco|winget)[[:space:]]+install([[:space:]]|$)'
  )
  docker_wrapped='(^|[;&|([:space:]])docker[[:space:]]+(compose[[:space:]]+)?(run|exec|build|create)([[:space:]]|$)'
  for p in "${host_install[@]}"; do
    if printf '%s' "$cmd" | grep -Eq "$p"; then
      if ! printf '%s' "$cmd" | grep -Eq "$docker_wrapped"; then
        # Deliberate, auditable escape hatch. Without one, the only way a human
        # can perform a legitimate host install is to delete this hook — and a
        # guardrail people route around protects nothing. The override must be
        # set by a person for a single command; it is never inferred, and every
        # use is recorded in the trace log.
        # Accepted two ways: an environment variable (session/CI level), or an
        # inline assignment prefixed to the command itself. The inline form is
        # the honest one for a single deliberate install — the authorization is
        # visible in the command text being approved, and it cannot be granted
        # by ambient environment the human never saw. Note a hook runs in its
        # OWN process before the command does, so an inline prefix never lands
        # in this script's environment; it has to be read out of the text.
        if [ "${WORKSPACE_ALLOW_HOST_INSTALL:-}" = "1" ] \
           || printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])WORKSPACE_ALLOW_HOST_INSTALL=1[[:space:]]'; then
          trace "${TRACE_HOOK:-block-dangerous-bash}" OVERRIDE "host install permitted by WORKSPACE_ALLOW_HOST_INSTALL: $cmd"
          log_warn dangerous-bash "host install allowed by explicit WORKSPACE_ALLOW_HOST_INSTALL=1 override"
        else
          block "blocked: this would install packages on the HOST. Policy is container-only execution. Reopen this repository in its Dev Container (everything is preinstalled there), or wrap the command: docker run --rm -v \"\$PWD:/work\" -w /work <image> <cmd>. If a human has deliberately authorized this one install, re-run it with WORKSPACE_ALLOW_HOST_INSTALL=1 set."
        fi
      fi
    fi
  done
fi
exit 0

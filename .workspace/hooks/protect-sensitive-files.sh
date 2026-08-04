#!/usr/bin/env bash
# PreToolUse[Edit|Write|MultiEdit] — refuse edits to secrets, VCS internals,
# and auto-generated lockfiles.
. "$(dirname "$0")/lib/common.sh"
read_input
TRACE_HOOK="protect-sensitive-files"
trace "$TRACE_HOOK" invoked ""

# Self-filter: VS Code fires every hook for every tool (matchers are ignored).
# Only file-mutating tools carry a path to check.
tool_matches "$TOOLS_FILE" || exit 0

path="$(jget '.tool_input.file_path')"
if [ -z "$path" ]; then
  log_warn sensitive-files "could not read the target path from this tool call (jq missing?) — the secrets/lockfile guard was SKIPPED for it. Run '$(doctor_hint)' to check this workspace."
  exit 0
fi

# Claude Code on Windows sends backslash paths (D:\repo\secrets\x); the deny
# globs below are slash-anchored. Normalize (and make repo-relative) first.
path="$(normalize_path "$path")"

base="${path##*/}"
case "$base" in
  .env.example|.env.*.example) exit 0 ;;
esac

deny_globs=()
# `.env` secrets — root or nested, plus variants like `.env.local`. Skipped
# when the repo owner set ENV_PROTECTION=false in .workspace/config (committed
# non-sensitive .env config files); everything below stays protected.
if env_protection_on; then
  deny_globs+=( '*/.env' '.env' '*/.env.*' '.env.*' )
fi
deny_globs+=(
  '*/.git/*' '*/.git' '.git/*'
  '*/secrets/*' 'secrets/*'
  '*/.ssh/*'
  '*.pem' '*.key' '*.pfx' '*.p12' '*.jks' '*.keystore' '*.ppk'
  '*/id_rsa' '*/id_ed25519' '*/id_ecdsa'
  '*/.aws/credentials'
  # auto-generated lockfiles — regenerate, never hand-edit
  '*/package-lock.json' 'package-lock.json'
  '*/yarn.lock' 'yarn.lock'
  '*/pnpm-lock.yaml' 'pnpm-lock.yaml'
  '*/poetry.lock' 'poetry.lock'
  '*/Cargo.lock' 'Cargo.lock'
  '*/Gemfile.lock' 'Gemfile.lock'
  '*/uv.lock' 'uv.lock'
  '*/composer.lock' 'composer.lock'
)
# Name the category and give the remedy that fits IT. The old message offered
# two remedies for six categories, so a developer blocked on an SSH key or a
# committed .env was told to "edit the .example file instead" — advice that does
# not apply and cannot be followed.
category_remedy() {
  case "$1" in
    */.env|.env|*/.env.*|.env.*)
      printf 'a .env file, treated as secret. Put the new key in .env.example (that IS editable) and set the real value by hand. If this repo commits .env files as ordinary non-sensitive config, the lead can lift the restriction for the whole repo: bash .workspace/bin/env-protection.sh off — then restart the agent session, because read permissions are loaded at startup.' ;;
    */.git/*|*/.git|.git/*)
      printf 'inside .git — the repository'"'"'s own database. Use git commands (git commit, git rebase, git config) instead of editing these files; hand-edits corrupt history.' ;;
    */.ssh/*|*/id_rsa|*/id_ed25519|*/id_ecdsa|*.pem|*.key|*.pfx|*.p12|*.jks|*.keystore|*.ppk|*/.aws/credentials)
      printf 'a private key or credential. These are never editable from an agent session, and there is no override — a human must handle them directly.' ;;
    */secrets/*|secrets/*)
      printf 'inside a secrets/ directory. Reference the value from configuration instead; a human manages the contents.' ;;
    *)
      printf 'an auto-generated lockfile. Run the package manager (inside the container) so it regenerates the file — e.g. npm install, poetry lock, cargo update. Hand-editing a lockfile produces a state no tool can reproduce.' ;;
  esac
}

for g in "${deny_globs[@]}"; do
  # shellcheck disable=SC2053
  if [[ "$path" == $g ]]; then
    block "Blocked — '$path' is $(category_remedy "$path")"
  fi
done
exit 0

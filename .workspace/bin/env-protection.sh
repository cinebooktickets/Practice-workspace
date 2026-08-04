#!/usr/bin/env bash
# staged-by: workspace
# Toggle the .env guardrail for this repo. 'off' declares the repo's committed
# .env files to be non-sensitive configuration: agents may read and edit them
# until 'on' restores protection. Rewrites ENV_PROTECTION in .workspace/config
# (the write-guard hook reads it live) AND the four Read() deny rules in
# .claude/settings.json (Claude Code loads permissions at startup — restart
# the agent session afterwards). Everything else (secrets/, keys, lockfiles)
# stays protected regardless.
set -euo pipefail
cd "$(dirname "$0")/../.."

state="${1:?usage: env-protection.sh on|off}"
case "$state" in on|off) ;; *) echo "usage: env-protection.sh on|off"; exit 1 ;; esac
command -v jq >/dev/null 2>&1 || { echo "error: jq required (present in the dev container)"; exit 1; }

cfg=".workspace/config"
[ -f "$cfg" ] || { echo "error: $cfg not found — is this repo seeded? (run initiate.sh)"; exit 1; }
val=true; [ "$state" = "off" ] && val=false
if grep -qE '^ENV_PROTECTION=' "$cfg"; then
  sed "s/^ENV_PROTECTION=.*/ENV_PROTECTION=$val/" "$cfg" > "$cfg.tmp" && mv "$cfg.tmp" "$cfg"
else
  printf 'ENV_PROTECTION=%s\n' "$val" >> "$cfg"
fi

s=".claude/settings.json"
DENIES='["Read(./**/.env)","Read(./**/.env.local)","Read(./**/.env.production)","Read(./**/.env.development)"]'
if [ -f .claude/.staged-by-workspace ] && [ -f "$s" ]; then
  if [ "$state" = "off" ]; then
    jq --argjson d "$DENIES" '.permissions.deny |= map(select(. as $x | $d | index($x) | not))' "$s" > "$s.tmp"
  else
    jq --argjson d "$DENIES" '.permissions.deny |= ((. + $d) | unique)' "$s" > "$s.tmp"
  fi
  mv "$s.tmp" "$s"
  echo "updated $s (.env read rules: $state)"
else
  echo "note: this repo keeps its own .claude/ — adjust its settings manually if wanted"
fi

echo "ENV_PROTECTION=$val — review, commit, and RESTART your agent session for the read rules to apply."

#!/usr/bin/env bash
# staged-by: workspace
# Runs once when this repo's Dev Container is created. Installs uv + the
# graphify CLI + jq + (best-effort) the agent CLIs, wires the Copilot CLI
# guardrails, restores the committed code graph, and runs the doctor health
# check — INSIDE the container only. The host machine is never touched.
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"

command -v uv >/dev/null 2>&1 \
  || pipx install uv \
  || python3 -m pip install --user --break-system-packages uv \
  || python3 -m pip install --user uv

# Official Graphify package on PyPI is 'graphifyy' (double-y); the CLI is 'graphify'.
uv tool install graphifyy \
  || pipx install graphifyy \
  || python3 -m pip install --user --break-system-packages graphifyy

# jq is required by the .claude guardrail hooks (JSON payload parsing).
if ! command -v jq >/dev/null 2>&1; then
  sudo apt-get update -y && sudo apt-get install -y jq
fi

# Yarn/pnpm come via Node's corepack — so `yarn start` etc. work out of the box.
command -v corepack >/dev/null 2>&1 && corepack enable 2>/dev/null || true

# Claude Code CLI (optional — the Copilot path works without it; never fail the build)
command -v claude >/dev/null 2>&1 \
  || npm install -g @anthropic-ai/claude-code \
  || curl -fsSL https://claude.ai/install.sh | bash \
  || echo "note: Claude Code CLI not installed (optional)"

# Copilot CLI reads hooks only from ~/.copilot/hooks — inside the container
# that is container-local, so wiring it here is safe and automatic. Guarded on
# our provenance marker: never auto-wire a repo's own hooks.
if [ -f .claude/.staged-by-workspace ] && [ -f .workspace/bin/install-copilot-hooks.sh ]; then
  bash .workspace/bin/install-copilot-hooks.sh || true
fi

# Seed the graphify working dir from the committed graph, so the graph tools
# work immediately on a fresh clone.
if [ -f .workspace/bin/sync-graph.sh ]; then
  bash .workspace/bin/sync-graph.sh restore || true
fi

echo "── toolchain (container only — host untouched) ──"
java -version 2>&1 | head -1
mvn -v 2>/dev/null | head -1
echo "node $(node -v) / npm $(npm -v)"
uv --version 2>/dev/null || true
jq --version 2>/dev/null || true
graphify --version 2>/dev/null || echo "graphify: open a NEW terminal if not found (PATH refresh)"
claude --version 2>/dev/null || echo "claude: not installed (optional — Copilot works without it)"

# Prove the guardrails are live before anyone trusts them — but never fail
# container creation over it.
echo
if [ -f .workspace/bin/doctor.sh ]; then
  bash .workspace/bin/doctor.sh || echo "note: doctor reported problems above — fix them before trusting the guardrails"
fi

echo
echo "Next steps:"
echo "  - create a feature branch off the default branch (never commit to main/master)"
echo "  - start an agent session (Copilot Chat or Claude Code) — you'll be asked DEV or TEST mode"
echo "      bash .workspace/bin/set-mode.sh DEV    (or TEST)"
echo "  - graph reported stale? refresh it here:  bash .workspace/bin/sync-graph.sh refresh"
exit 0

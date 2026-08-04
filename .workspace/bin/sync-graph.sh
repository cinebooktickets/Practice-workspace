#!/usr/bin/env bash
# staged-by: workspace
# Keep the committed graph artifacts (.workspace/) and the graphify CLI's
# working dir (graphify-out/, gitignored) in sync.
#   pull     copy fresh artifacts graphify-out/ -> .workspace/, stamp HEAD
#   restore  seed graphify-out/ from .workspace/ (fresh clone)
#   refresh  restore -> graphify update (falls back to full rebuild) -> pull
# The stamp records the HEAD the committed graph was built from; the
# session-start hook compares it to detect a stale graph.
set -euo pipefail
cd "$(dirname "$0")/../.."

cmd="${1:?usage: sync-graph.sh pull|restore|refresh}"

pull() {
  if [ -f graphify-out/graph.json ]; then
    cp graphify-out/graph.json .workspace/graph.json
  fi
  if [ -f graphify-out/GRAPH_REPORT.md ]; then
    cp graphify-out/GRAPH_REPORT.md .workspace/GRAPH_REPORT.md
  fi
  if git rev-parse --git-dir >/dev/null 2>&1; then
    git rev-parse HEAD > .workspace/graph-stamp 2>/dev/null || true
  fi
  echo "sync-graph: .workspace/ updated (stamp: $(cat .workspace/graph-stamp 2>/dev/null || echo none))"
}

restore() {
  if [ ! -f graphify-out/graph.json ] && [ -f .workspace/graph.json ]; then
    mkdir -p graphify-out
    cp .workspace/graph.json graphify-out/graph.json
    echo "sync-graph: restored graphify-out/graph.json from .workspace/"
  fi
}

refresh() {
  restore
  export PATH="$HOME/.local/bin:$PATH"
  # Be honest about where this can run. Seeded repos ship their own dev
  # container with graphify preinstalled, so the common fix is to reopen in
  # it. A repo with no container at all was seeded before containers were
  # added (or had it removed) — say so instead of pointing at a dead end.
  command -v graphify >/dev/null 2>&1 || {
    echo "sync-graph: cannot refresh here — 'graphify' is not installed in this environment."
    echo
    if [ -d .devcontainer ]; then
      echo "This repo ships a dev container where graphify is preinstalled."
      echo "Reopen in Container (VS Code: 'Dev Containers: Reopen in Container')"
      echo "and re-run this command. If this is the repo's own container rather"
      echo "than the seeded one, install graphify inside it first:"
      echo "  uv tool install graphifyy"
    else
      echo "This repo carries no dev container (seeded before containers were"
      echo "added, or removed since). Ask the lead to re-run initiate.sh from"
      echo "the workspace — it now stages one."
      echo
      echo "You can keep working. Treat the committed graph as a dated map — good"
      echo "for orientation, but confirm anything load-bearing against the source."
    fi
    exit 1
  }
  export GRAPHIFY_VIZ_NODE_LIMIT="${GRAPHIFY_VIZ_NODE_LIMIT:-3000}"
  # Same pipeline as initiate — NOT 'graphify update': update has no --code-only
  # and rebuilds a larger, differently-shaped graph (verified: 543 vs 288 nodes
  # on the same repo), which would silently bloat the committed graph.json.
  # Extraction is local AST, deterministic, no LLM.
  graphify . --code-only
  graphify cluster-only . --no-label
  pull
}

case "$cmd" in
  pull)    pull    ;;
  restore) restore ;;
  refresh) refresh ;;
  *) echo "usage: sync-graph.sh pull|restore|refresh"; exit 1 ;;
esac

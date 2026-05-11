#!/usr/bin/env bash
# Capture demo material for the README.
#
#   ./scripts/screenshot.sh
#
# Produces:
#   docs/screenshot-web-1.png   web dashboard (full window)
#   docs/screenshot-tui.png     TUI snapshot via screencapture
#   docs/demo-tui.gif           ← record manually with vhs / asciinema-agg
#
# macOS-only. For TUI gif generation we recommend `vhs` (https://github.com/charmbracelet/vhs).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS="$ROOT/docs"
mkdir -p "$DOCS"

# Ensure there's data to show
"$ROOT/dist/agentpulse" stats >/dev/null 2>&1 || "$ROOT/dist/agentpulse" seed

# Web screenshot via headless screencapture
"$ROOT/dist/agentpulse" web --port=4760 --no-open &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT
sleep 1

if command -v open >/dev/null 2>&1; then
  open -a "Google Chrome" "http://localhost:4760"
  sleep 3
  # Capture the active window (user must keep Chrome focused)
  screencapture -o -W "$DOCS/screenshot-web-1.png" || true
  echo "→ saved $DOCS/screenshot-web-1.png (capture mode: pick the Chrome window)"
fi

cat <<'NOTE'

---
TUI gif:
  brew install charmbracelet/tap/vhs
  vhs scripts/demo.tape   # outputs docs/demo-tui.gif

The .tape file is in scripts/demo.tape — edit timings as needed.
---
NOTE

#!/usr/bin/env bash
# agentpulse installer — fetches the latest release binary into ~/.local/bin
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/yf0522/agentpulse/main/scripts/install.sh | bash
set -euo pipefail

REPO="${AGENTPULSE_REPO:-yf0522/agentpulse}"
BIN_DIR="${AGENTPULSE_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$BIN_DIR"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS-$ARCH" in
  Darwin-arm64)   ASSET="agentpulse-aarch64-apple-darwin"   ;;
  Darwin-x86_64)  ASSET="agentpulse-x86_64-apple-darwin"    ;;
  Linux-x86_64)   ASSET="agentpulse-x86_64-unknown-linux"   ;;
  Linux-aarch64)  ASSET="agentpulse-aarch64-unknown-linux"  ;;
  *) echo "unsupported platform: $OS-$ARCH" >&2; exit 1 ;;
esac

URL="https://github.com/$REPO/releases/latest/download/$ASSET"
TMP="$(mktemp)"
echo "downloading $ASSET..."
curl -fsSL -o "$TMP" "$URL"

# Optional sha256 verification (only if .sha256 exists in the release)
if curl -fsSL -o "$TMP.sha256" "$URL.sha256" 2>/dev/null; then
  EXPECTED="$(cat "$TMP.sha256" | awk '{print $1}')"
  ACTUAL="$(shasum -a 256 "$TMP" | awk '{print $1}')"
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "sha256 mismatch! expected $EXPECTED got $ACTUAL" >&2
    exit 1
  fi
  echo "sha256 verified."
fi

chmod +x "$TMP"
mv "$TMP" "$BIN_DIR/agentpulse"
rm -f "$TMP.sha256"

echo ""
echo "✓ installed to $BIN_DIR/agentpulse"
echo ""
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "  add this to your shell rc:    export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac
echo ""
echo "next:"
echo "  agentpulse setup       # wire Claude Code statusline hook"
echo "  agentpulse web         # browser dashboard"
echo "  agentpulse tui         # terminal dashboard"

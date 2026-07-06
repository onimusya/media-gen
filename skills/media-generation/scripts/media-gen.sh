#!/usr/bin/env bash
# media-gen CLI runner (Linux/macOS/WSL)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/media-gen.mjs" "$@"

#!/usr/bin/env bash
# Install media-gen-cli
# Compatible with Linux, macOS, and Windows (Git Bash/WSL)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "Installing media-gen-cli from: $PROJECT_DIR"

cd "$PROJECT_DIR"

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required but not installed."
  echo "Install it from https://nodejs.org/ (v18+)"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js 18+ is required. Found: $(node -v)"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install --silent

# Build the CLI
echo "Building CLI..."
npm run build --silent

# Verify
if [ -f "$PROJECT_DIR/dist/media-gen.mjs" ]; then
  echo ""
  echo "✓ media-gen-cli installed successfully!"
  echo ""
  echo "Run with:"
  echo "  node $PROJECT_DIR/dist/media-gen.mjs --help"
  echo ""
  echo "Or link globally:"
  echo "  npm link"
  echo "  media-gen --help"
else
  echo "Error: Build failed. dist/media-gen.mjs not found."
  exit 1
fi

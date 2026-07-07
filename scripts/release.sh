#!/usr/bin/env bash
# Create a GitHub release with the skills folder as a zip attachment.
# Usage: ./scripts/release.sh v1.0.0 "Initial release"
# Requires: gh CLI (https://cli.github.com)
set -e

VERSION="${1:?Usage: release.sh <version> [title]}"
TITLE="${2:-media-gen-cli $VERSION}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Ensure clean build
echo "Building..."
npm run build

# Create zip of skills folder
ZIP_FILE="dist/media-gen-skill-${VERSION}.zip"
echo "Creating $ZIP_FILE..."
if command -v zip &> /dev/null; then
  zip -r "$ZIP_FILE" skills/
elif command -v 7z &> /dev/null; then
  7z a "$ZIP_FILE" skills/
else
  echo "Error: zip or 7z required"
  exit 1
fi

# Create git tag
echo "Tagging $VERSION..."
git tag -a "$VERSION" -m "$TITLE"
git push origin "$VERSION"

# Create GitHub release
echo "Creating GitHub release..."
gh release create "$VERSION" \
  --title "$TITLE" \
  --generate-notes \
  "$ZIP_FILE"

echo ""
echo "✓ Release $VERSION created!"
echo "  https://github.com/onimusya/media-gen/releases/tag/$VERSION"

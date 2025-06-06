#!/bin/bash

# Script to test npx functionality locally

set -e

echo "🔨 Building the CLI package..."
npm run build

echo "📦 Creating tarball with npm pack..."
npm pack

# Get the tarball name
TARBALL=$(ls -t gemini-code-cli-*.tgz | head -1)
echo "📦 Created: $TARBALL"

# Create a temporary directory for testing
TEMP_DIR=$(mktemp -d)
echo "📁 Testing in: $TEMP_DIR"

cd "$TEMP_DIR"

# Get absolute path to the tarball
TARBALL_PATH=$(realpath "$(dirname "$0")/$TARBALL")

echo "🚀 Running npx with local tarball..."
echo "📦 Using: $TARBALL_PATH"
# This simulates what happens with npx
npx "file:$TARBALL_PATH" --help

echo ""
echo "🎨 Testing with custom title..."
CLI_TITLE="TEST" npx "file:$TARBALL_PATH" --help

# Cleanup
cd -
rm -rf "$TEMP_DIR"
echo "✅ Test complete!"
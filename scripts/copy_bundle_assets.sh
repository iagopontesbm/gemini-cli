#!/bin/bash

# Define the target bundle directory relative to the CLI dist
TARGET_BUNDLE_DIR="packages/cli/dist/bundle"

# Create the target bundle directory if it doesn't exist
mkdir -p "$TARGET_BUNDLE_DIR"

# Copy specific shell files to the target bundle directory
cp "packages/server/src/tools/shell.md" "$TARGET_BUNDLE_DIR/shell.md"
cp "packages/server/src/tools/shell.json" "$TARGET_BUNDLE_DIR/shell.json"

# Find and copy all .sb files from packages to the target bundle directory
find packages -name '*.sb' -exec cp -f {} "$TARGET_BUNDLE_DIR/" \;

echo "Assets copied to $TARGET_BUNDLE_DIR/"

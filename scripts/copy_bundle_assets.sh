#!/bin/bash

# Define the main CLI dist directory
CLI_DIST_DIR="packages/cli/dist"

# Create the CLI dist directory if it doesn't exist (should be created by esbuild, but good practice)
mkdir -p "$CLI_DIST_DIR"

# Copy specific shell files directly to the CLI dist directory
cp "packages/server/src/tools/shell.md" "$CLI_DIST_DIR/shell.md"
cp "packages/server/src/tools/shell.json" "$CLI_DIST_DIR/shell.json"

# Find and copy all .sb files from packages to the CLI dist directory
find packages -name '*.sb' -exec cp -f {} "$CLI_DIST_DIR/" \;

echo "Assets copied to $CLI_DIST_DIR/"

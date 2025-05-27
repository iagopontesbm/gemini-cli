#!/bin/bash
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

# check build status, write warnings to file for app to display if needed
node ./scripts/check-build-status.js

# if debugging is enabled and sandboxing is disabled, use --inspect-brk flag
# note with sandboxing this flag is passed to the binary inside the sandbox
# inside sandbox SANDBOX should be set and sandbox_command.sh should fail
node_args=()
if [ -n "${DEBUG:-}" ] && ! scripts/sandbox_command.sh -q; then
    if [ -n "${SANDBOX:-}" ]; then
        port="${DEBUG_PORT:-9229}"
        node_args=("--inspect-brk=0.0.0.0:$port")
    else
        node_args=(--inspect-brk)
    fi
fi
node_args+=("./packages/cli" "$@")

# Determine Git information
GIT_COMMIT_INFO="N/A"
if command -v git &> /dev/null && git rev-parse --is-inside-work-tree &> /dev/null; then
    GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "")
    if [ -n "$GIT_HASH" ]; then
        GIT_COMMIT_INFO="$GIT_HASH"
        if [ -n "$(git status --porcelain)" ]; then
            GIT_COMMIT_INFO="$GIT_COMMIT_INFO (local modifications)"
        fi
    fi
fi

# DEV=true to enable React Dev Tools (https://github.com/vadimdemedes/ink?tab=readme-ov-file#using-react-devtools)
# CLI_VERSION to display in the app ui footer
# GIT_COMMIT_INFO to display in the about box
GIT_COMMIT_INFO="${GIT_COMMIT_INFO}" CLI_VERSION='development' DEV=true node "${node_args[@]}"

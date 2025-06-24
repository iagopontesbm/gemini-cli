# Sandboxing in Gemini CLI

## Prerequisites

Before using sandboxing, you need to install and set up Gemini CLI:

```bash
#install gemini-cli with npm
npm install -g @google/gemini-cli

# Verify installation
gemini --version
```

## Overview

Sandboxing isolates potentially dangerous operations (shell commands, file modifications) from your host system, providing a security barrier between AI operations and your environment.

## Why Use Sandboxing?

- **Security**: Prevents accidental system damage or data loss
- **Isolation**: Limits file system access to project directory
- **Consistency**: Ensures reproducible environments across different systems
- **Safety**: Ideal when working with untrusted code or experimental commands

## Sandboxing Methods

### 1. macOS Seatbelt (macOS only)

Lightweight, built-in sandboxing using `sandbox-exec`.

**Default profile**: `permissive-open` - restricts writes outside project directory but allows most other operations.

### 2. Container-based (Docker/Podman)

Cross-platform sandboxing with complete process isolation.

**Note**: Requires building the sandbox image locally or using a published image from your organization's registry.

## Quick Start

```bash
# Enable sandboxing with command flag
gemini -s -p "analyze the code structure"

# Use environment variable
export GEMINI_SANDBOX=true
gemini -p "run the test suite"

# Configure in settings.json
{
  "sandbox": "docker"
}
```

## Configuration

### Enable Sandboxing (in order of precedence)

1. **Command flag**: `-s` or `--sandbox`
2. **Environment variable**: `GEMINI_SANDBOX=true|docker|podman|sandbox-exec`
3. **Settings file**: `"sandbox": true` in `settings.json`

### macOS Seatbelt Profiles

Built-in profiles (set via `SEATBELT_PROFILE` env var):

- `permissive-open` (default) - Write restrictions, network allowed
- `permissive-closed` - Write restrictions, no network
- `permissive-proxied` - Write restrictions, network via proxy
- `restrictive-open` - Strict restrictions, network allowed
- `restrictive-closed` - Maximum restrictions

### Container-based Configuration

#### Building the Sandbox Image

First time setup:

```bash
# From gemini-cli repository
npm install
npm run build:sandbox

# Or with gemini installed globally
BUILD_SANDBOX=1 gemini -s
```

## Linux UID/GID Handling

The sandbox automatically handles user permissions on Linux. Override with:

```bash
export SANDBOX_SET_UID_GID=true   # Force host UID/GID
export SANDBOX_SET_UID_GID=false  # Disable UID/GID mapping
```

## Troubleshooting

### Common Issues

**"Operation not permitted"**

- Operation requires access outside sandbox
- Try more permissive profile or add mount points

**Missing commands**

- Add to custom Dockerfile
- Install via sandbox.bashrc

**Network issues**

- Check sandbox profile allows network
- Verify proxy configuration

### Debug Mode

```bash
DEBUG=1 gemini -s -p "debug command"
```

### Inspect Sandbox

```bash
# Check environment
gemini -s -p "run shell command: env | grep SANDBOX"

# List mounts
gemini -s -p "run shell command: mount | grep workspace"
```

## Security Notes

- Sandboxing reduces but doesn't eliminate all risks
- Use the most restrictive profile that allows your work
- Container overhead is minimal after first build
- GUI applications may not work in sandboxes

## Related Documentation

- [Configuration](./cli/configuration.md) - Full configuration options
- [Commands](./cli/commands.md) - Available commands
- [Troubleshooting](./troubleshooting.md) - General troubleshooting

# Troubleshooting Guide

This guide provides solutions to common issues and debugging tips.

## Authentication

- **Error: `Failed to login. Message: Request contains an invalid argument`**

  - Users with Google Workspace accounts, or users with Google Cloud accounts
    associated with their Gmail accounts may not be able to activate the free
    tier of the Google Code Assist plan.
  - For Google Cloud accounts, you can work around this by setting
    `GOOGLE_CLOUD_PROJECT` to your project ID.
  - You can also grab an API key from [AI
    Studio](http://aistudio.google.com/app/apikey), which also includes a
    separate free tier.

## Frequently asked questions (FAQs)

- **Q: How do I update Gemini CLI to the latest version?**

  - A: If installed globally via npm, update Gemini CLI using the command `npm install -g @google/gemini-cli@latest`. If run from source, pull the latest changes from the repository and rebuild using `npm run build`.

- **Q: Where are Gemini CLI configuration files stored?**

  - A: The CLI configuration is stored within two `settings.json` files: one in your home directory and one in your project's root directory. In both locations, `settings.json` is found in the `.gemini/` folder. Refer to [CLI Configuration](./cli/configuration.md) for more details.

- **Q: Why don't I see cached token counts in my stats output?**

  - A: Cached token information is only displayed when cached tokens are being used. This feature is available for API key users (Gemini API key or Vertex AI) but not for OAuth users (Google Personal/Enterprise accounts) at this time, as the Code Assist API does not support cached content creation. You can still view your total token usage with the `/stats` command.

## Common error messages and solutions

- **Error: `EADDRINUSE` (Address already in use) when starting an MCP server.**

  - **Cause:** Another process is already using the port the MCP server is trying to bind to.
  - **Solution:**
    Either stop the other process that is using the port or configure the MCP server to use a different port.

- **Error: Command not found (when attempting to run Gemini CLI).**

  - **Cause:** Gemini CLI is not correctly installed or not in your system's PATH.
  - **Solution:**
    1.  Ensure Gemini CLI installation was successful.
    2.  If installed globally, check that your npm global binary directory is in your PATH.
    3.  If running from source, ensure you are using the correct command to invoke it (e.g., `node packages/cli/dist/index.js ...`).

- **Error: `MODULE_NOT_FOUND` or import errors.**

  - **Cause:** Dependencies are not installed correctly, or the project hasn't been built.
  - **Solution:**
    1.  Run `npm install` to ensure all dependencies are present.
    2.  Run `npm run build` to compile the project.

- **Error: "Operation not permitted", "Permission denied", or similar.**

  - **Cause:** If sandboxing is enabled, then the application is likely attempting an operation restricted by your sandbox, such as writing outside the project directory or system temp directory.
  - **Solution:** See [Sandboxing](./cli/configuration.md#sandboxing) for more information, including how to customize your sandbox configuration.

## Development Environment and Build Issues

These issues are primarily relevant for developers contributing to or building the Gemini CLI from source.

- **Issue: Build failures related to `@modelcontextprotocol/sdk` (MCP SDK).**
  - **Symptoms:** Errors like `Cannot find module '@modelcontextprotocol/sdk/server/mcp'` or similar during `npm run build` or `npm install` (specifically its `prepare` script that runs `esbuild`).
  - **Cause:** The external `@modelcontextprotocol/sdk` package has had publishing issues. Several versions appear to be missing their compiled `dist` directories in the npm package, making them unusable out-of-the-box.
  - **Workaround/Status:**
    - The parts of the Gemini CLI codebase that directly import this SDK (primarily in `packages/core/src/tools/mcp-client.ts` and `packages/gemini-tools-mcp-server/src/server.ts`) have been temporarily modified to comment out the problematic imports and logic. This allows the rest of the project to build.
    - An override to version `0.4.0` of the SDK is in the root `package.json`, but this version also seems affected by the missing `dist` files.
    - **Impact:** MCP client and server functionality is currently disabled or non-functional.
    - **Developers:** If working on MCP features, you'll need to investigate SDK compatibility and potentially use local builds or forks of the SDK. Refer to `docs/tools/mcp-server.md` for more context on the intended MCP architecture and known issues with the SDK.

- **Issue: Sandbox build failure: `ERROR: could not detect sandbox container command`.**
  - **Symptoms:** Occurs when running `npm run build:all` or `npm run build:sandbox`.
  - **Cause:** Building the sandbox environment requires a container engine (like Docker or Podman) to be installed and available on your system.
  - **Solution:**
    1. Install Docker or Podman.
    2. Alternatively, if you don't need the sandbox container, you can build only the application packages using `npm run build`.

- **Issue: Integration tests (`npm run test:e2e`) fail due to missing authentication.**
  - **Symptoms:** Tests fail with messages like `Please set an Auth method in your .gemini/settings.json OR specify GEMINI_API_KEY env variable file before running`.
  - **Cause:** Most integration tests require live interaction with Gemini APIs and thus need valid authentication.
  - **Solution:** Set the `GEMINI_API_KEY` environment variable or configure another authentication method as detailed in the [authentication guide](./cli/authentication.md) and `CONTRIBUTING.md` ("Forking" section).

## Debugging Tips

- **CLI debugging:**

  - Use the `--verbose` flag (if available) with CLI commands for more detailed output.
  - Check the CLI logs, often found in a user-specific configuration or cache directory.

- **Core debugging:**

  - Check the server console output for error messages or stack traces.
  - Increase log verbosity if configurable.
  - Use Node.js debugging tools (e.g., `node --inspect`) if you need to step through server-side code.

- **Tool issues:**

  - If a specific tool is failing, try to isolate the issue by running the simplest possible version of the command or operation the tool performs.
  - For `run_shell_command`, check that the command works directly in your shell first.
  - For file system tools, double-check paths and permissions.

- **Pre-flight checks:**
  - Always run `npm run preflight` before committing code. This can catch many common issues related to formatting, linting, and type errors.

If you encounter an issue not covered here, consider searching the project's issue tracker on GitHub or reporting a new issue with detailed information.

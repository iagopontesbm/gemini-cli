# Development Guide

This guide is for contributors or anyone looking to build, modify, or understand the development setup of this project.

## Setting Up the Development Environment

*   **Prerequisites:**
    *   Node.js (ensure you have a version compatible with the project, check `package.json` or `nvmrc` if available).
    *   npm (usually comes with Node.js).
    *   Git.
*   **Cloning the Repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```
*   **Installing Dependencies:**
    ```bash
    npm install
    ```
    This command will install all necessary dependencies defined in `package.json` for both the server and CLI packages, as well as root dependencies.

## Build Process

To build the entire project (all packages):

```bash
npm run build
```

This command typically compiles TypeScript to JavaScript, bundles assets, and prepares the packages for execution. Refer to `scripts/build.sh` and `package.json` scripts for more details on what happens during the build.

## Running Tests

To execute the test suite for the project:

```bash
npm run test
```

This will run tests located in the `packages/server` and `packages/cli` directories. Ensure tests pass before submitting any changes.

## Type Checking

To perform static type checking using TypeScript:

```bash
npm run typecheck
```

This helps catch type-related errors early in the development process.

## Linting and Preflight Checks

To ensure code quality, formatting consistency, and run final checks before committing:

```bash
npm run preflight
```

This command usually runs ESLint, Prettier, and potentially other checks as defined in the project's `package.json`.

## Coding Conventions

*   Please adhere to the coding style, patterns, and conventions used throughout the existing codebase.
*   Refer to `CONTRIBUTING.md` for guidelines on contributions, pull requests, and the code review process.
*   Consult `GEMINI.md` for specific instructions related to AI-assisted development, including conventions for React, comments, and Git usage.
*   **Imports:** Pay special attention to import paths. The project uses `eslint-rules/no-relative-cross-package-imports.js` to enforce restrictions on relative imports between packages.

## Project Structure

*   `packages/`: Contains the individual sub-packages of the project.
    *   `cli/`: The command-line interface.
    *   `server/`: The backend server that the CLI interacts with.
*   `docs/`: Contains all project documentation.
*   `scripts/`: Utility scripts for building, testing, and development tasks.

For more detailed architecture, see `docs/architecture.md`.

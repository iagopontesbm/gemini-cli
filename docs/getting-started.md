# Getting Started with Gemini CLI

This guide will walk you through the essential steps to get the Gemini CLI up and running on your system.

## Prerequisites

Before you begin, ensure you have the following:

*   **Node.js and npm:** The Gemini CLI is a Node.js project. You'll need npm (Node Package Manager) to install dependencies and run scripts. If you don't have them, download and install from [nodejs.org](https://nodejs.org/).
*   **jq (optional but recommended for build):** The build toolchain uses `jq` for processing JSON files. You can install it using your system's package manager (e.g., `brew install jq` on macOS, `apt-get install jq` on Debian/Ubuntu).
    *   Alternatively, the `scripts/setup-dev.sh` script can help install prerequisites.
*   **Git (for cloning the repository):** You'll need Git to clone the project repository.

## 1. Obtain a Gemini API Key

To use the Gemini CLI, you need an API key for the Gemini API.

*   Go to Google AI Studio: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
*   Follow the instructions to create and obtain your API key.

## 2. Set Up Environment Variable

Once you have your API key, you must set it as an environment variable named `GEMINI_API_KEY`.

*   **Temporary (current shell session):**
    ```bash
    export GEMINI_API_KEY="YOUR_API_KEY"
    ```
*   **Persistent (recommended):** Add the export command to your shell's configuration file (e.g., `~/.bashrc`, `~/.zshrc`, `~/.profile`).
    ```bash
    echo 'export GEMINI_API_KEY="YOUR_API_KEY"' >> ~/.zshrc # Or your preferred shell config file
    source ~/.zshrc # Reload the configuration
    ```
    Replace `"YOUR_API_KEY"` with the actual key you obtained.

## 3. Clone the Repository

If you haven't already, clone the Gemini CLI repository to your local machine:

```bash
git clone https://github.com/google-gemini/gemini-cli.git # Or your fork's URL
cd gemini-cli
```

## 4. Install Dependencies and Build

From the root directory of the project (`gemini-cli`):

*   **Install all dependencies:**
    ```bash
    npm install
    ```
*   **Build the project:**
    *   For a full build, including the CLI and the Sandbox Container Image (if applicable):
        ```bash
        npm run build:all
        ```
    *   For a quicker build without the sandbox container:
        ```bash
        npm run build
        ```

## 5. Run the Gemini CLI

After a successful build, you can start the Gemini CLI from the root directory:

```bash
npm start
```

This will launch the interactive Gemini CLI in your terminal.

## Quick Start: Your First Interaction

Once the CLI is running, you can start interacting with Gemini. Try a simple query:

```
> What is the capital of France?
```

Or ask it to perform a task using its tools:

```
> List files in the current directory.
```

## Next Steps

Congratulations! You've successfully set up and run the Gemini CLI.

*   Explore the **[CLI Commands](./cli/commands.md)** to learn about all available functionalities.
*   Refer to the **[Architecture Overview](./architecture.md)** to understand how the system works.
*   If you encounter any issues, check the **[Troubleshooting Guide](./troubleshooting.md)**.

# Gemini CLI

[![Gemini CLI CI](https://github.com/google-gemini/gemini-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/google-gemini/gemini-cli/actions/workflows/ci.yml)

![Gemini CLI Screenshot](./docs/assets/gemini-screenshot.png)

This repository contains the Gemini CLI, a command-line AI workflow tool that connects to your
tools, understands your code and accelerates your workflows.

With the Gemini CLI you can:

- Query and edit large codebases in and beyond Gemini's 1M token context window.
- Generate new apps from PDFs or sketches, using Gemini's multimodal capabilities.
- Automate operational tasks, like querying pull requests or handling complex rebases.
- Use tools and MCP servers to connect new capabilities, including [media generation with Imagen,
  Veo or Lyria](https://github.com/GoogleCloudPlatform/vertex-ai-creative-studio/tree/main/experiments/mcp-genmedia)
- Ground your queries with the [Google Search](https://ai.google.dev/gemini-api/docs/grounding)
  tool, built in to Gemini.

## Quickstart

1. **Prerequisites:** Ensure you have [Node.js version 18](https://nodejs.org/en/download) or higher installed.
2. **Run the CLI:** Execute the following command in your terminal:

   ```bash
   npx https://github.com/google-gemini/gemini-cli
   ```

   Or install it with:

   ```bash
   npm install -g @google/gemini-cli
   gemini
   ```

3. **Pick a color theme**
4. **Authenticate:** When prompted, sign in with your personal Google account. This will grant you up to 60 model requests per minute and 1,000 model requests per day using Gemini.

You are now ready to use the Gemini CLI!

### For advanced use or increased limits:

If you need to use a specific model or require a higher request capacity, you can use an API key:

1. Generate a key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Set it as an environment variable in your terminal. Replace `YOUR_API_KEY` with your generated key.

   ```bash
   export GEMINI_API_KEY="YOUR_API_KEY"
   ```

For other authentication methods, including Google Workspace accounts, see the [authentication](./docs/cli/authentication.md) guide.

## Examples

Once the CLI is running, you can start interacting with Gemini from your shell.

You can start a project from a new directory:

```sh
cd new-project/
gemini
> Write me a Gemini Discord bot that answers questions using a FAQ.md file I will provide
```

Or work with an existing project:

```sh
git clone https://github.com/google-gemini/gemini-cli
cd gemini-cli
gemini
> Give me a summary of all of the changes that went in yesterday
```

## Project Planning and Management (New Feature)

Gemini CLI now includes experimental features inspired by agentic workflows to help you plan and manage software projects directly from your terminal. This allows for a more structured approach to code generation and task tracking.

The core workflow involves:
1.  Generating a project specification (`spec.md`) based on your initial idea (optionally including multimedia context).
2.  Reviewing and editing the `spec.md` file.
3.  Generating a list of epics and tasks (`tasks.json`) from the specification.
4.  Viewing your plan and tasks.

These features use AI to help break down your project and organize it.

### New Project Planning Commands

*   **`gemini spec <initial prompt> [--image /path/to/img.png] [--audio /path/to/audio.wav]`**
    *   Generates a project specification in Markdown (`spec.md`) based on your `<initial prompt>`.
    *   You can provide images (`--image` or `-i`) and audio files (`--audio` or `-a`) as additional context. Multiple flags can be used.
    *   Image content will be described using Gemini Vision, and audio content will be noted (placeholder for transcription).
    *   After generation, you'll be prompted to review and approve `spec.md`.
    *   Example: `gemini spec "Create a Python web server for a to-do list" --image ./mockup.png`

*   **`gemini tasks [--generate]`**
    *   Manages the `tasks.json` file, which contains epics and tasks derived from `spec.md`.
    *   If `tasks.json` exists and `--generate` is not provided, it displays the current tasks.
    *   If `tasks.json` does not exist, or if `--generate` is specified, it will:
        1.  Read `spec.md`.
        2.  Use AI to parse `spec.md` into a structured list of epics and tasks.
        3.  Save this list to `tasks.json`.
        4.  Display the generated tasks.
    *   Status for new tasks defaults to "pending".

*   **`gemini plan`**
    *   Displays the current project plan.
    *   Shows the content of `spec.md`.
    *   Shows the list of tasks from `tasks.json`.
    *   Provides guidance on how to edit `spec.md` and regenerate tasks if needed.

### Typical Project Workflow Example

1.  **Start a new project idea:**
    ```bash
    gemini spec "Develop a command-line tool to manage personal notes, written in Go. It should support adding, listing, and deleting notes. Notes should be stored in a local JSON file." --image ./notes_cli_mockup.jpg
    ```
    *(This generates `spec.md`. You'll be prompted to review and approve it.)*

2.  **Review and Edit (Manual Step):**
    Open `spec.md` in your favorite text editor and make any necessary changes or refinements.

3.  **Generate Tasks:**
    ```bash
    gemini tasks --generate
    ```
    *(This reads your (potentially edited) `spec.md`, creates `tasks.json`, and displays the tasks.)*

4.  **View Your Plan:**
    ```bash
    gemini plan
    ```
    *(This shows you the contents of `spec.md` and `tasks.json`.)*

*(Future development will focus on executing these tasks and providing more advanced agentic capabilities like automated debugging and error recovery.)*

### Next steps

- Learn how to [contribute to or build from the source](./CONTRIBUTING.md).
- Explore the available **[CLI Commands](./docs/cli/commands.md)**.
- If you encounter any issues, review the **[Troubleshooting guide](./docs/troubleshooting.md)**.
- For more comprehensive documentation, see the [full documentation](./docs/index.md).
- Take a look at some [popular tasks](#popular-tasks) for more inspiration.

### Troubleshooting

Head over to the [troubleshooting](docs/troubleshooting.md) guide if you're
having issues.

## Popular tasks

### Explore a new codebase

Start by `cd`ing into an existing or newly-cloned repository and running `gemini`.

```text
> Describe the main pieces of this system's architecture.
```

```text
> What security mechanisms are in place?
```

### Work with your existing code

```text
> Implement a first draft for GitHub issue #123.
```

```text
> Help me migrate this codebase to the latest version of Java. Start with a plan.
```

### Automate your workflows

Use MCP servers to integrate your local system tools with your enterprise collaboration suite.

```text
> Make me a slide deck showing the git history from the last 7 days, grouped by feature and team member.
```

```text
> Make a full-screen web app for a wall display to show our most interacted-with GitHub issues.
```

### Interact with your system

```text
> Convert all the images in this directory to png, and rename them to use dates from the exif data.
```

```text
> Organise my PDF invoices by month of expenditure.
```

## Terms of Service and Privacy Notice

For details on the terms of service and privacy notice applicable to your use of Gemini CLI, see the [Terms of Service and Privacy Notice](./docs/tos-privacy.md).

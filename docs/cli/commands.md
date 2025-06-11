# CLI Commands

The Gemini CLI supports several built-in commands to help you manage your session, customize the interface, and control its behavior. These commands are typically prefixed with a forward slash (`/`), an at symbol (`@`), or an exclamation mark (`!`).

## Slash Commands (`/`)

Slash commands provide meta-level control over the CLI itself. They can typically be executed by typing the command and pressing `Enter`.

- **`/editor`**

  - **Description:** Allows you to configure your external editor for actions such as modifying Gemini's proposed code change.
  - **Action:** Opens a dialog for selecting supported editors.

- **`/help`** (or **`/?`**)

  - **Description:** Displays help information about the Gemini CLI, including available commands and their usage.
  - **Action:** Opens a help dialog or section within the CLI.

- **`/mcp`** (Toggle descriptions: **Ctrl+T**)

  - **Description:** Lists configured Model Context Protocol (MCP) servers and their available tools.
  - **Action:** Displays a formatted list of MCP servers with connection status indicators, server details, and available tools.
  - **Sub-commands:**
    - **`desc`** or **`descriptions`**:
      - **Description:** Shows detailed descriptions for MCP servers and tools.
      - **Action:** Displays each tool's name with its full description, formatted for readability.
    - **`nodesc`** or **`nodescriptions`**:
      - **Description:** Hides tool descriptions, showing only the tool names.
      - **Action:** Displays a compact list with only tool names.
  - **Keyboard Shortcut:** Press **Ctrl+T** at any time to toggle between showing and hiding tool descriptions.

- **`/clear`** (Shortcut: **Ctrl+L**)

  - **Description:** Clears the entire terminal screen, including the visible session history and scrollback within the CLI.
  - **Action:** Wipes the terminal display. The underlying session data (for history recall) might be preserved depending on the exact implementation, but the visual display is cleared.

- [**`/theme`**](./themes.md)

  - **Description:** Allows you to change the visual theme of the Gemini CLI.
  - **Action:** Opens a dialog or prompt to select from available themes.

- **`/memory`**

  - **Description:** Manages the AI's instructional context (hierarchical memory loaded from `GEMINI.md` files) and allows for adding ad-hoc memory entries.
  - **Usage:** `/memory <sub_command> [text_for_add]`
  - **Sub-commands:**
    - **`show`**:
      - **Description:** Displays the full, concatenated content of the current hierarchical memory that has been loaded from all `GEMINI.md` files. This allows you to inspect the exact instructional context being provided to the Gemini model.
      - **Action:** Outputs the combined content of all loaded `GEMINI.md` files, including separators that indicate the origin and path of each part of the memory. This is useful for verifying the loading order and final context.
    - **`refresh`**:
      - **Description:** Reloads the hierarchical instructional context (memory) from all `GEMINI.md` files found in the configured locations (global, project/ancestors, and sub-directories). This command updates the AI's understanding based on the latest `GEMINI.md` content.
      - **Action:** The CLI re-scans for all relevant `GEMINI.md` files and rebuilds its instructional memory. The number of loaded files is typically indicated in the CLI footer.
    - **Note:** For more details on how `GEMINI.md` files contribute to hierarchical memory, see the [CLI Configuration documentation](./configuration.md#4-geminimd-files-hierarchical-instructional-context).

- **`/quit`** (or **`/exit`**)

  - **Description:** Exits the Gemini CLI application.
  - **Action:** Terminates the CLI process.

- **`/tools`**
  - **Description:** Displays a list of all the tools that are currently available to the model.
  - **Action:** Outputs a list of the available tools.

## At Commands (`@`)

At commands are used to quickly include the content of files or directories as part of your prompt to Gemini. These commands now feature git-aware filtering.

- **`@<path_to_file_or_directory>`**

  - **Description:** Injects the content of the specified file or files within a directory into your current prompt. This is useful for asking questions about specific code, text, or collections of files.
  - **Usage:**
    - `@path/to/your/file.txt Explain this text.`
    - `@src/my_project/ Summarize the code in this directory.`
    - `What is this file about? @README.md`
  - **Details:**
    - If a path to a single file is provided, the content of that file is read.
    - If a path to a directory is provided, the command attempts to read the content of files within that directory (often recursively, like `directory/**`).
    - Spaces in paths should be escaped with a backslash (e.g., `@My\ Documents/file.txt`).
    - The command uses the `read_many_files` tool internally. The content is fetched and then prepended or inserted into your query before being sent to the Gemini model.
    - The text before and after the `@<path>` part of your query is preserved and sent along with the file content.
    - **Git-Aware Filtering:** By default, git-ignored files (like `node_modules/`, `dist/`, `.env`, `.git/`) are automatically excluded. This behavior can be configured via the `fileFiltering` settings.
    - **File Types:** The command is intended for text-based files. While it might attempt to read any file, binary files or very large files might be skipped or truncated by the underlying `read_many_files` tool to ensure performance and relevance. The tool will typically indicate if files were skipped.
  - **Output:** The CLI will show a tool call message indicating that `read_many_files` was used, along with an improved display message detailing the status (e.g., number of files read, total size) and the path(s) that were processed.

- **`@` (Lone At Symbol)**
  - **Description:** If you type a lone `@` symbol without a path, the entire query (including the `@`) is passed directly to the Gemini model. This might be useful if you are specifically talking _about_ the `@` symbol itself in your prompt.

### Error Handling for `@` Commands

- If the path specified after `@` is not found or is invalid, an error message will be displayed, and the query might not be sent to the Gemini model, or it will be sent without the file content.
- If the `read_many_files` tool encounters an error (e.g., permission issues), this will also be reported.

## Shell Mode & Passthrough Commands (`!`)

The `!` prefix provides a powerful way to interact with your system's shell directly from within the Gemini CLI. It allows for both single command execution and a toggleable Shell Mode for a more persistent shell experience.

- **`!<shell_command>`**

  - **Description:** Executes the given `<shell_command>` in your system's default shell.
  - **Usage:**
    - `!ls -la` (executes `ls -la` and returns to normal CLI mode)
    - `!git status` (executes `git status` and returns to normal CLI mode)
  - **Action:** The command following the `!` is passed to the system shell for execution. Standard output and standard error are displayed in the CLI. After execution, the CLI typically returns to its standard conversational mode.

- **`!` (Toggle Shell Mode)**

  - **Description:** Typing `!` on its own (without an immediately following command) toggles Shell Mode.
  - **Action & Behavior:**
    - **Entering Shell Mode:**
      - The UI will update, often with different coloring and a "Shell Mode Indicator," to clearly show that Shell Mode is active.
      - Most slash commands (e.g., `/help`, `/theme`) and AI-powered suggestions are disabled to provide an uninterrupted shell experience.
      - Any text you type is interpreted directly as a shell command.
    - **Exiting Shell Mode:**
      - Typing `!` again while in Shell Mode will toggle it off.
      - The UI will revert to its standard appearance.
      - Slash commands and AI suggestions are re-enabled.
  - **Usage:**
    - Type `!` and press Enter to enter Shell Mode.
    - Type your shell commands (e.g., `cd my_project`, `npm run dev`, `cat file.txt`).
    - Type `!` and press Enter again to exit Shell Mode.

- **Caution for all `!` usage:** Be mindful of the commands you execute, as they have the same permissions and impact as if you ran them directly in your terminal. The Shell Mode feature does not inherently add extra sandboxing beyond what's already configured for the underlying `run_shell_command` tool.

This integrated shell capability allows for seamless switching between AI-assisted tasks and direct system interaction.

## User-Defined Commands (`/user-`)

The Gemini CLI supports custom user-defined commands that allow you to create personalized shortcuts and workflows. These commands are stored as markdown files in the `.gemini/user-tools/` directories and can be invoked using the `/user-` prefix.

### Creating User Tools

1. **Location:** User tools can be stored in two locations:

   - **Global tools:** `~/.gemini/user-tools/` - Available from any directory
   - **Workspace tools:** `.gemini/user-tools/` - Relative to your current working directory

   When both locations contain a tool with the same name, the workspace tool takes precedence.

2. **Format:** Each tool is a markdown file (`.md`) with YAML frontmatter.
3. **Naming:** The filename (without `.md` extension) becomes the tool name.

### User Tool File Structure

```markdown
---
description: Brief description of what this tool does
autoSubmit: false
---

Your prompt template here. This template will be sent to Gemini as-is,
along with any additional instructions the user provides when invoking the tool.
```

**Frontmatter Options:**

- `description`: A brief description shown in autocomplete
- `autoSubmit`: Set to `true` if the tool should auto-submit when selected from autocomplete (defaults to `false`)

### Example User Tools

**`.gemini/user-tools/git-log.md`**

```markdown
---
description: Show git commit history with customizable formatting
---

Please show the git commit history for this repository. Use `git log` with appropriate formatting options to display:

- Commit hash (abbreviated)
- Author name and date
- Commit message
- Files changed statistics

Make the output clear and easy to read. If the user provides additional instructions (like date ranges, author filters, or specific formatting), incorporate those into the git log command.
```

**`.gemini/user-tools/find-math-book.md`**

```markdown
---
description: Get a random math book recommendation
---

Please recommend a random mathematics book. Consider various branches of mathematics (algebra, calculus, geometry, topology, number theory, statistics, etc.) and difficulty levels (from popular math to advanced textbooks).

For your recommendation, please provide:

1. Book title and author(s)
2. What branch of mathematics it covers
3. The target audience/difficulty level
4. A brief description of what makes this book interesting or valuable
5. Why someone might want to read it

If the user provides any preferences or constraints in their additional instructions, take those into account when making your recommendation.
```

### Using User Tools

- **Invocation:** Use `/user-toolname` followed by any additional instructions or context.
- **Examples:**
  - `/user-git-log` - Shows full git history with default formatting
  - `/user-git-log --since="1 week ago" --author="John"` - Shows commits from last week by John
  - `/user-git-log last 4 days` - User can use free form text and Gemini will do the right thing and show git log for last four days
  - `/user-find-math-book` - Gets a random math book recommendation
  - `/user-find-math-book find me a good topology book` - Gets a recommendation for a topology book
- **Autocomplete:** Type `/user-` and press Tab to see available user tools.

### Managing User Tools

- **`/reload-user-tools`**
  - **Description:** Reloads all user tools from both global (`~/.gemini/user-tools/`) and workspace (`.gemini/user-tools/`) directories.
  - **Action:** Scans both directories and refreshes the available user tools list. Workspace tools take precedence over global tools with the same name.
  - **Usage:** Run this command after adding, modifying, or removing user tool files.

### How User Tools Work

When you invoke a user tool, the tool's template is sent to Gemini along with any additional instructions you provide. For example:

- `/user-git-log` sends the git-log template to Gemini
- `/user-git-log last 3 days` sends the template plus "At the time of invoking this tool, the user provided these additional instructions: last 3 days"

This approach allows Gemini to use its judgment to interpret your specific needs while following the general template of the tool.

### Best Practices

- Keep tool names descriptive and use hyphens for multi-word names (e.g., `git-summary`, `code-review`)
- Provide clear descriptions in the frontmatter for better autocomplete hints
- Test your tools after creation using the actual command syntax
- Write clear prompts that explain what the tool does and what information it needs
- Consider creating tools for repetitive tasks or complex multi-step workflows

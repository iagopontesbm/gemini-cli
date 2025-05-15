# Gemini CLI: UI Guide

This guide provides an overview of the Gemini CLI's user interface components and how to customize its appearance, particularly through themes.

## Interface Components

The Gemini CLI provides a rich interactive experience in your terminal. Key components you'll interact with include:

*   **Header (`Header.tsx`):**
    *   Typically displays the Gemini CLI title or version information at the top of the interface.

*   **Input Prompt (`InputPrompt.tsx`):**
    *   This is where you type your queries, commands, and responses to Gemini.
    *   **Enhanced Input:** Supports a **multiline editor** for composing longer prompts more easily.
    *   **Keybindings:** Features **readline-like keybindings** (e.g., Ctrl+A for start of line, Ctrl+E for end of line, Alt+Backspace to delete word, etc.) for efficient text manipulation.
    *   **Command History:** Accessible with arrow keys (Up/Down) to recall previous inputs.

*   **History Display (`HistoryItemDisplay.tsx`):**
    *   Shows the chronological log of your interactions with Gemini, including:
        *   Your prompts (`UserMessage.tsx`).
        *   Gemini's responses (`GeminiMessage.tsx`, `GeminiMessageContent.tsx`).
        *   Tool calls and results (`ToolMessage.tsx`, `ToolGroupMessage.tsx`, `ToolConfirmationMessage.tsx`).
        *   Error messages (`ErrorMessage.tsx`).
        *   Informational messages (`InfoMessage.tsx`).
    *   Utilizes components like `MarkdownRenderer.tsx` and `CodeColorizer.tsx` to format output for readability, including syntax highlighting for code snippets.

*   **Suggestions Display (`SuggestionsDisplay.tsx`):**
    *   Offers auto-completion and suggestions for slash commands (e.g., `/help`, `/theme`) as you type, improving discoverability and ease of use.

*   **Loading Indicator (`LoadingIndicator.tsx`):**
    *   Provides visual feedback (e.g., a spinner or message) when the CLI is processing your request or waiting for a response from Gemini.

*   **Footer (`Footer.tsx`):**
    *   Displays status information, tips (`Tips.tsx`), and context-sensitive help.
    *   **Memory Indicator:** Includes a UI indicator for the current memory/context status.
    *   **`GEMINI.md` Count:** Shows the number of loaded `GEMINI.md` files, providing visibility into the instructional context being used.
    *   **Sandbox Status:** May display a message indicating the current sandboxing status (e.g., active, inactive, profile in use).

*   **Help Screen (`Help.tsx`):**
    *   Accessible via the `/help` command, this screen provides information about available commands and features.

*   **Theme Dialog (`ThemeDialog.tsx`):**
    *   Allows you to select and apply different visual themes for the CLI, accessible via the `/theme` command.

## Themes

The Gemini CLI supports theming to customize its color scheme and appearance. Themes define colors for text, backgrounds, syntax highlighting, and other UI elements.

### Available Themes

The CLI comes with a selection of pre-defined themes. As seen in `theme-manager.ts`, these typically include:

*   **Dark Themes:**
    *   `AtomOneDark`
    *   `Dracula`
    *   `VS2015` (Default)
    *   `GitHub` (Dark variant usually)
*   **Light Themes:**
    *   `VS` (Visual Studio Light)
    *   `GoogleCode`
    *   `XCode` (Light variant usually)
*   **ANSI:**
    *   `ANSI`: A theme that primarily uses the terminal's native ANSI color capabilities.

*(The exact list and their appearance can be confirmed by running the `/theme` command within the CLI.)*

### Changing Themes

1.  Type the `/theme` command in the CLI.
2.  A dialog or selection prompt (`ThemeDialog.tsx`) will appear, listing the available themes.
3.  You can typically navigate (e.g., with arrow keys) and select a theme. Some interfaces might offer a live preview or highlight as you select.
4.  Confirm your selection (often with Enter) to apply the theme. You can usually cancel out of the selection (e.g., with Escape).

### Theme Persistence

Selected themes are usually saved in the CLI's configuration (see [CLI Configuration](./configuration.md)) so your preference is remembered across sessions.

### Theme Not Found Handling
If a theme specified in your configuration is not found (e.g., due to a typo or removal), the CLI will typically revert to a default theme and may display a notification, ensuring the interface remains usable.

### Theme Structure (`theme.ts`)

Each theme is defined by a structure (likely an object or class) that specifies various color properties for different UI components, such as:

*   General text and background colors.
*   Colors for different message types (user, Gemini, tool, error).
*   Syntax highlighting colors for various code token types (keywords, strings, comments, etc.), often based on common token categories found in code editors.

## Customization

Beyond themes, some UI aspects might be configurable through settings files. Refer to the [CLI Configuration](./configuration.md) for more details on what can be customized.

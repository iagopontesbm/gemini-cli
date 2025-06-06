# Refactoring Plan: Decoupling CLI and Core

## 1. Introduction

This document outlines a refactoring plan to improve the architecture of the Gemini CLI by decoupling the `packages/cli` and `packages/core` packages.

**Goal:** Achieve a clear separation of concerns, where the `core` package acts as a self-contained "chat server" managing all conversation state, and the `cli` package functions as a stateless "chat client."

This will improve modularity, testability, and prepare the codebase for future evolution, such as supporting different clients or a true client-server model.

## 2. Guiding Principles

- **State Management:** All conversation state (e.g., chat history, pending tool calls) will be managed exclusively within the `core` package.
- **Stateless Client:** The `cli` package will be responsible for UI, user input, and rendering, but will not hold any conversation state.
- **Incremental Changes:** The refactoring will proceed in small, logical steps.
- **Testability:** Each step will result in a fully buildable and testable codebase.
- **Behavioral Integrity:** We will add tests for existing functionality before refactoring to ensure that the behavior of the application remains unchanged.

## 3. Proposed Architecture

### `packages/core` - The "Chat Server"

- A new `ChatSession` class will serve as the primary public API for the `core` package.
- `ChatSession` will encapsulate `GeminiChat`, configuration, tool management, and the entire lifecycle of a conversation.
- It will expose high-level methods for the client, such as:
  - `constructor(config: CoreConfig)`
  - `sendMessage(prompt: string): AsyncGenerator<ChatEvent>`
- It will emit a series of structured `ChatEvent` objects (e.g., `{ type: 'text', content: '...' }`, `{ type: 'tool_call', details: {...} }`, `{ type: 'tool_confirmation_required', details: {...} }`) that the client can consume and render.

### `packages/cli` - The "Chat Client"

- The `cli` will instantiate the `ChatSession` from `core`.
- It will call `chatSession.sendMessage()` with user input.
- It will listen to the stream of `ChatEvent`s and render the appropriate UI for each event.
- It will handle user interactions (like tool execution approval) by calling methods on the `ChatSession` instance in response to specific events.

## 4. Incremental Refactoring Steps

### Step 0: Add Tests for Existing Behavior

Before any refactoring, we will write integration-style tests to capture the current end-to-end behavior. This provides a safety net to prevent regressions.

- **Target Files:** `packages/cli/src/nonInteractiveCli.ts` and `packages/cli/src/ui/App.tsx`.
- **Actions:**
    - Create `nonInteractiveCli.integration.test.ts`.
    - Write tests covering a simple prompt-response interaction.
    - Write tests covering a flow that involves tool usage and requires user confirmation.

### Step 1: Introduce `ChatSession` in `core`

Create the initial `ChatSession` class that will become the central orchestrator.

- **Actions:**
    - Create `packages/core/src/core/chatSession.ts` and `packages/core/src/core/chatSession.test.ts`.
    - Define the `ChatSession` class.
    - In its constructor, it will take the existing `Config` object and instantiate `GeminiChat`.
    - Create a `sendMessage` method that, for now, will be a thin wrapper around the existing logic, calling `geminiChat.sendMessageStream`.

### Step 2: Refactor Non-Interactive Mode to Use `ChatSession`

Refactor the simpler, non-interactive client first. This will be a proof-of-concept for the new architecture.

- **Target File:** `packages/cli/src/nonInteractiveCli.ts`.
- **Actions:**
    - Modify `runNonInteractive` to instantiate the new `ChatSession`.
    - Replace the existing logic with a call to `chatSession.sendMessage()`.
    - Adapt the output handling to process the events returned from `sendMessage`.
    - Move the logic for filtering tools in non-interactive mode into the `core` package, likely within the `ChatSession` or `Config` setup.
    - Run the tests created in Step 0 to validate the changes.

### Step 3: Refactor Interactive Mode to Use `ChatSession`

Refactor the interactive React-based UI.

- **Target Files:** `packages/cli/src/ui/App.tsx` and related components/hooks.
- **Actions:**
    - Create a custom React hook, `useChatSession`, to manage the `ChatSession` instance and its state within the React lifecycle.
    - The `App` component will use this hook.
    - User input submissions will call the `sendMessage` method via the hook.
    - The hook will expose the stream of `ChatEvent`s, which the UI components will render.
    - The state of the conversation (history, loading status) will be derived from the events emitted by `ChatSession`.
    - Run the tests created in Step 0 and add new tests for the interactive UI as needed.

### Step 4: Decouple Tool Execution Confirmation

Make the tool confirmation flow more robust and state-driven from the `core`.

- **Actions:**
    - `ChatSession.sendMessage` will identify when a tool requires confirmation and emit a specific event (e.g., `{ type: 'tool_confirmation_required', ... }`).
    - The `core` will then pause processing until the client responds.
    - The `cli` client will render the confirmation prompt upon receiving this event.
    - If the user approves, the `cli` will call a new method on the `ChatSession`, like `confirmToolExecution(toolCallId)`.
    - The `ChatSession` will then resume execution of the tool call.

### Step 5: Move Configuration Loading into `core`

To make the `core` package more self-contained, it should manage its own configuration.

- **Actions:**
    - Move the logic from `packages/cli/src/config/config.ts` into `packages/core/src/config/`.
    - The `core` package will expose a factory function, e.g., `createChatSession(options: { workspaceRoot: string })`, which handles loading all necessary configurations.
    - The `cli` package will now simply call this factory function, simplifying its own setup logic significantly.

### Step 6: Final Cleanup and Documentation Update

- **Actions:**
    - Review the boundary between `cli` and `core` and remove any remaining state or logic from the `cli` that belongs in the `core`.
    - Ensure the public API of the `core` package is clean, well-defined, and documented with TSDoc comments.
    - Update `docs/architecture.md` with the new, more precise architectural diagram and description.

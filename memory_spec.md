# Feature Specification: Hierarchical Memory for Gemini Application

## 1. Feature Overview

This feature introduces a "Hierarchical Memory" system for the Gemini CLI application. It allows users to provide persistent, contextual instructions to the Gemini model through special Markdown files named `GEMINI.md`. These files can be placed at different levels of the file system: a global user-level directory and various project-specific directories. The instructions from these files are aggregated and prepended to the model's system prompt, with more specific (deeper in the directory tree) instructions taking precedence or augmenting more general ones. This enables tailored model behavior for different projects, sub-projects, or even specific parts of a codebase.

## 2. Project Goals

- **Contextual Customization:** Allow users to define and persist custom instructions, rules, personas, or context relevant to specific coding projects or directories.
- **Hierarchical Application:** Implement a system where instructions are applied in a hierarchical manner, from a global user setting down to specific subdirectories.
- **Prioritized Merging:** Ensure that instructions from more specific `GEMINI.md` files (deeper in the directory tree) are prioritized or correctly appended to instructions from more general files.
- **Seamless Integration:** Integrate this memory system into the existing CLI configuration loading and model interaction workflow.
- **User-Friendly:** Make the feature intuitive for users to set up and manage their `GEMINI.md` instruction files.
- **Robustness:** Handle missing or unreadable `GEMINI.md` files gracefully without disrupting the application's core functionality.

---

## 3. Testable Implementation Steps

### Preamble: Key Definitions and Context for the Agent

- **`GEMINI.md` File:** The instruction file.
- **User Home Directory:** Determined by `os.homedir()`.
- **Global Memory File:** Located at `[User Home Directory]/.gemini/GEMINI.md`.
- **Current Working Directory (CWD):** The directory from which the CLI application is invoked or currently operating. This is the primary reference for finding local `GEMINI.md` files.
- **Project Root:**
  - If the CWD is within a version control system repository (e.g., contains a `.git` directory), the root of that repository is the "Project Root".
  - Otherwise, the CWD itself can be considered the top-level "project-like" directory for the purpose of searching upwards. Traversal for `GEMINI.md` files will go from CWD up to the user's home directory.
- **Target Directory for Memory Loading:** For functions like `loadHierarchicalGeminiMemory`, the `targetDir` argument should typically be the CWD.
- **Existing `loadGeminiMd` in `settings.ts`:** The new hierarchical memory loading logic specified herein (primarily in `packages/cli/src/config/config.ts`) will supersede the existing `loadGeminiMd` function in `packages/cli/src/config/settings.ts` for the purpose of populating the model's contextual instructions. If `loadGeminiMd` serves no other purpose, it can be considered for deprecation.

---

### Phase 1: Core File System Interaction and Content Retrieval

- **Step 1.1: Read Global `GEMINI.md`**

  - **Description:** Implement functionality to locate and read the content of the Global Memory File (`~/.gemini/GEMINI.md`).
  - **File(s) to Modify:** `packages/cli/src/config/config.ts` (likely a new or heavily modified function replacing/extending `readUserMemory`).
  - **Acceptance Criteria:**
    - Given Global Memory File exists and is readable, its content is returned as a string.
    - Given Global Memory File does not exist, the function returns `null` or an empty string without error.
    - Given `~/.gemini/` directory does not exist, the function returns `null` or an empty string without error.
    - Given Global Memory File exists but is unreadable (e.g., permissions), an appropriate warning is logged (see Step 6.1), and `null`/empty string is returned. The application should not crash.
  - **Test Cases:**
    - Create `~/.gemini/GEMINI.md` with "Global instruction." -> Verify "Global instruction." is read.
    - No `~/.gemini/GEMINI.md` -> Verify `null`/empty string.
    - `~/.gemini/` directory does not exist -> Verify `null`/empty string.

- **Step 1.2: Identify `GEMINI.md` Files in Directory Hierarchy**

  - **Description:** Implement a function that, given a `currentWorkingDirectory: string`, identifies all applicable `GEMINI.md` files. This includes:
    1.  The Global Memory File.
    2.  `GEMINI.md` files in directories from the `currentWorkingDirectory` upwards to the "Project Root".
    3.  If not in a defined "Project Root" (e.g., no `.git` directory found when traversing up), the search for local `GEMINI.md` files stops at the file system root or before the home directory (whichever comes first, ensuring no overlap with global if CWD is outside home's `.gemini` path).
  - **File(s) to Modify:** `packages/cli/src/config/config.ts` (new helper function).
  - **Input:** `currentWorkingDirectory: string`, `userHomePath: string`.
  - **Output:** An ordered array of absolute paths to found `GEMINI.md` files. The order MUST be from the most general to the most specific (e.g., Global, Project Root, CWD's parent, CWD).
  - **Acceptance Criteria:**
    - Correctly identifies and includes the path to `~/.gemini/GEMINI.md` (if it exists) as the first element.
    - Correctly identifies `GEMINI.md` files by traversing upwards from `currentWorkingDirectory` to the "Project Root" (or file system root if no VCS project root is found).
    - The order of paths in the output array is strictly from general to specific.
    - Handles cases where `GEMINI.md` files do not exist at certain levels.
  - **Test Cases:**
    - Setup:
      - `~/.gemini/GEMINI.md` (Global)
      - `/mock-project/.git/` (defines project root)
      - `/mock-project/GEMINI.md` (Project)
      - `/mock-project/src/feature/GEMINI.md` (Feature)
    - Call with CWD = `/mock-project/src/feature/file.ts`'s directory (`/mock-project/src/feature/`)
    - Expected output paths (example): `["/Users/testuser/.gemini/GEMINI.md", "/mock-project/GEMINI.md", "/mock-project/src/feature/GEMINI.md"]`.
    - Test with CWD outside any `.git` repository.
    - Test with missing files at various levels.

- **Step 1.3: Read Content of Multiple `GEMINI.md` Files**
  - **Description:** Implement a function that takes an array of `GEMINI.md` file paths (from Step 1.2) and returns an array of their contents.
  - **File(s) to Modify:** `packages/cli/src/config/config.ts` (new helper function).
  - **Input:** `geminiMdFilePaths: string[]`.
  - **Output:** `(string | null)[]` (contents of the files in the same order; `null` or an empty string for unreadable/missing files).
  - **Acceptance Criteria:**
    - Reads content correctly for each valid path.
    - Handles unreadable or missing files gracefully by returning `null` or an empty string for that entry, and logging a warning (see Step 6.1).
  - **Test Cases:**
    - Input: `["/path/to/file1.md", "/path/to/nonexistent.md", "/path/to/unreadable.md"]`
    - Expected: `["Content of file1", null, null]` (or empty strings for the latter two).

---

### Phase 2: Instruction Merging Logic

- **Step 2.1: Concatenate Instructions**
  - **Description:** Implement a function that takes an array of `GEMINI.md` file contents (strings, possibly with `null`/empty values from Step 1.3) and concatenates them in the received order.
  - **File(s) to Modify:** `packages/cli/src/config/config.ts` (new helper function or part of the main memory loading function).
  - **Input:** `instructionContents: (string | null)[]`.
  - **Output:** A single string representing the combined instructions.
  - **Acceptance Criteria:**
    - Contents are concatenated in the order they appear in the input array.
    - `null` or empty string entries are skipped and do not result in extra newlines.
    - Non-empty contents are separated by two newline characters (`\n\n`).
    - If all contents are `null` or empty, an empty string is returned.
  - **Test Cases:**
    - Input: `["Global instruction.", "Project instruction.", null, "Feature instruction."]` -> Expected: `"Global instruction.\n\nProject instruction.\n\nFeature instruction."`
    - Input: `[null, "Only instruction.", null]` -> Expected: `"Only instruction."`
    - Input: `["First.", "Second."]` -> Expected: `"First.\n\nSecond."`
    - Input: `[null, null]` -> Expected: `""`
    - Input: `["Instruction1", null, "Instruction3"]` -> Expected: `"Instruction1\n\nInstruction3"`

---

### Phase 3: Integration with CLI Configuration

- **Step 3.1: Main Hierarchical Memory Loading Function**

  - **Description:** Create the primary asynchronous function (e.g., `loadHierarchicalGeminiMemory(currentWorkingDirectory: string): Promise<string | undefined>`) in `packages/cli/src/config/config.ts`. This function will:
    1.  Get the user's home directory.
    2.  Determine the "Project Root" based on the `currentWorkingDirectory`.
    3.  Call the function from Step 1.2 to get the list of `GEMINI.md` file paths.
    4.  Call the function from Step 1.3 to read their contents.
    5.  Call the function from Step 2.1 to concatenate the contents.
    6.  Return the final merged string.
  - **File(s) to Modify:** `packages/cli/src/config/config.ts`.
  - **Acceptance Criteria:**
    - Given a CWD, correctly identifies and merges `GEMINI.md` files as per the defined hierarchy and merging strategy.
    - Returns the correctly concatenated string of instructions.
    - Returns `undefined` or an empty string if no `GEMINI.md` files are found or if all found files are empty/unreadable.
  - **Test Cases:**
    - Simulate a file structure:
      - `~/.gemini/GEMINI.md` ("Global")
      - `/test-project/.git/`
      - `/test-project/GEMINI.md` ("Project Root")
      - `/test-project/src/GEMINI.md` ("Source Level")
      - `/test-project/src/moduleA/GEMINI.md` ("Module A")
    - Call `loadHierarchicalGeminiMemory("/test-project/src/moduleA")` -> Verify output: `"Global\n\nProject Root\n\nSource Level\n\nModule A"`.
    - Call `loadHierarchicalGeminiMemory("/test-project/other")` (no `GEMINI.md` in `other`) -> Verify output: `"Global\n\nProject Root"`.
    - Call with a CWD outside any VCS project -> Verify "Global" (if exists) or `undefined`.

- **Step 3.2: Integrate with `loadCliConfig`**
  - **Description:** Modify `loadCliConfig` in `packages/cli/src/config/config.ts` to call the new `loadHierarchicalGeminiMemory` function, using `process.cwd()` as the `currentWorkingDirectory`. The result should be passed to `createServerConfig` to populate the `userMemory` field in the `Config` object.
  - **File(s) to Modify:** `packages/cli/src/config/config.ts`.
  - **Acceptance Criteria:**
    - `loadCliConfig` correctly calls `loadHierarchicalGeminiMemory` with `process.cwd()`.
    - The `Config` object created by `createServerConfig` has its `userMemory` property correctly populated.
  - **Test Cases:**
    - Run `loadCliConfig` while CWD is `/test-project/src/moduleA` (from Step 3.1 setup).
    - Inspect the returned `Config` object's `getUserMemory()` method; verify it holds `"Global\n\nProject Root\n\nSource Level\n\nModule A"`.

---

### Phase 4: Integration with Model Interaction (Server-Side)

- **Step 4.1: Ensure `userMemory` is Used in Prompt**
  - **Description:** Verify that the `userMemory` string from the `Config` object is correctly retrieved. The `getCoreSystemPrompt()` in `packages/server/src/core/prompts.ts` should be modified to accept this `userMemory` string as an optional argument and prepend it (if it exists and is non-empty) to the main system prompt, separated by a few newlines for clarity.
  - **File(s) to Modify/Verify:**
    - `packages/server/src/core/prompts.ts` (Modify `getCoreSystemPrompt` to accept and prepend `userMemory`).
    - `packages/server/src/core/client.ts` (Ensure `startChat` calls `getCoreSystemPrompt` with `this.config.getUserMemory()`).
  - **Acceptance Criteria:**
    - If `Config.getUserMemory()` returns a non-empty string, this string is prepended to the system prompt used by the Gemini model.
    - If `userMemory` is empty or undefined, the system prompt is generated without these additional instructions.
  - **Test Cases:**
    - Create a `Config` object with a defined `userMemory` string.
    - Call `GeminiClient.startChat()` (or the part of it that assembles the system prompt).
    - Mock `this.client.chats.create` and verify that the `systemInstruction` passed to it contains the `userMemory` content prepended to the standard system prompt.

---

### Phase 5: Error Handling and Edge Cases

- **Step 5.1: Test Graceful Handling of Missing/Unreadable Files (Re-verify)**

  - **Description:** Confirm that the integrated system handles missing or unreadable `GEMINI.md` files at any point in the hierarchy without crashing, and that merging logic correctly skips `null`/empty content.
  - **Acceptance Criteria:** (Covered by earlier steps, re-verify in integrated context)
    - Application operates normally, using available instructions.
  - **Test Cases:**
    - Set up a hierarchy with one `GEMINI.md` file unreadable. Run the CLI and issue a command. Verify it uses instructions from other readable files.

- **Step 5.2: (Optional) Test with Symbolic Links**
  - **Description:** If relevant, test how file discovery handles symbolic links to `GEMINI.md` files or to directories in the path. Standard Node.js `fs` operations usually resolve symlinks by default.
  - **Acceptance Criteria:**
    - Symlinks are resolved, and content from the target `GEMINI.md` is read.
    - Or, document if symlinks are not explicitly supported.
  - **Test Cases:**
    - Create `CWD/GEMINI.md` as a symlink to `../actual-GEMINI.md`.
    - Create a symlinked directory in the path containing a `GEMINI.md`.

---

### Phase 6: User Experience (Observational)

- **Step 6.1: Debug Logging**
  - **Description:** Implement debug logging (e.g., conditional on `config.getDebugMode()`). When active, log:
    - The CWD being used for memory resolution.
    - The determined "Project Root" (if any).
    - Each `GEMINI.md` path considered and whether it was found/read.
    - The final combined instruction string (or a snippet if very long).
    - Warnings for unreadable `GEMINI.md` files.
  - **File(s) to Modify:** `packages/cli/src/config/config.ts` (within the memory loading functions).
  - **Acceptance Criteria:**
    - In debug mode, logs provide a clear trace of the hierarchical memory loading process.
  - **Test Cases:**
    - Run the CLI with a debug flag in a project with multiple `GEMINI.md` files and observe console output for the expected trace.

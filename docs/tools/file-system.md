# Gemini CLI: File System Tools

The Gemini CLI provides a comprehensive suite of tools for interacting with the local file system. These tools allow the Gemini model to read from, write to, list, search, and modify files and directories, all under your control and typically with confirmation for sensitive operations.

All file system tools operate within a `rootDirectory` (usually the current working directory where you launched the CLI) for security, preventing unintended access to other parts of your system. Paths provided to these tools are generally expected to be absolute or are resolved relative to this root directory.

## 1. `list_directory` (ReadFolder)

- **Tool Name:** `list_directory`
- **Display Name:** ReadFolder
- **File:** `ls.ts`
- **Description:** Lists the names of files and subdirectories directly within a specified directory path. It can optionally ignore entries matching provided glob patterns.
- **Parameters:**
  - `path` (string, required): The absolute path to the directory to list.
  - `ignore` (array of strings, optional): A list of glob patterns to exclude from the listing (e.g., `["*.log", ".git"]`).
- **Behavior:**
  - Returns a list of file and directory names.
  - Indicates whether each entry is a directory.
  - Sorts entries with directories first, then alphabetically.
- **Output (`llmContent`):** A string like: `Directory listing for /path/to/your/folder:\n[DIR] subfolder1\nfile1.txt\nfile2.png`
- **Confirmation:** No.

## 2. `read_file` (ReadFile)

- **Tool Name:** `read_file`
- **Display Name:** ReadFile
- **File:** `read-file.ts`
- **Description:** Reads and returns the content of a specified file. Handles text, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDF files. For text files, it can read specific line ranges. Other binary file types are generally skipped.
- **Parameters:**
  - `path` (string, required): The absolute path to the file to read.
  - `offset` (number, optional): For text files, the 0-based line number to start reading from. Requires `limit` to be set.
  - `limit` (number, optional): For text files, the maximum number of lines to read. If omitted, reads a default maximum (e.g., 2000 lines) or the entire file if feasible.
- **Behavior:**
  - For text files: Returns the content. If `offset` and `limit` are used, returns only that slice of lines. Indicates if content was truncated due to line limits or line length limits.
  - For image and PDF files: Returns the file content as a base64 encoded data structure suitable for model consumption.
  - For other binary files: Attempts to identify and skip them, returning a message indicating it's a generic binary file.
- **Output:** (`llmContent`):
  - For text files: The file content, potentially prefixed with a truncation message (e.g., `[File content truncated: showing lines 1-100 of 500 total lines...]\nActual file content...`).
  - For image/PDF files: An object containing `inlineData` with `mimeType` and base64 `data` (e.g., `{ inlineData: { mimeType: 'image/png', data: 'base64encodedstring' } }`).
  - For other binary files: A message like `Cannot display content of binary file: /path/to/data.bin`.
- **Confirmation:** No.
- **Confirmation:** No.

## 3. `glob` (FindFiles)

- **Tool Name:** `glob`
- **Display Name:** FindFiles
- **File:** `glob.ts`
- **Description:** Efficiently finds files matching specific glob patterns (e.g., `src/**/*.ts`, `*.md`), returning absolute paths sorted by modification time (newest first).
- **Parameters:**
  - `pattern` (string, required): The glob pattern to match against (e.g., `"*.py"`, `"src/**/*.js"`).
  - `path` (string, optional): The absolute path to the directory to search within. If omitted, searches the tool's root directory.
- **Behavior:**
  - Searches for files matching the glob pattern within the specified directory.
  - Returns a list of absolute paths, sorted with the most recently modified files first.
  - Ignores common nuisance directories like `node_modules` and `.git` by default.
- **Output (`llmContent`):** A message like: `Found 5 file(s) matching "*.ts" within src, sorted by modification time (newest first):\nsrc/file1.ts\nsrc/subdir/file2.ts...`
- **Confirmation:** No.

## 4. `search_file_content` (SearchText)

- **Tool Name:** `search_file_content`
- **Display Name:** SearchText
- **File:** `grep.ts`
- **Description:** Searches for a regular expression pattern within the content of files in a specified directory. Can filter files by a glob pattern. Returns the lines containing matches, along with their file paths and line numbers.
- **Parameters:**
  - `pattern` (string, required): The regular expression (regex) to search for (e.g., `"function\s+myFunction"`).
  - `path` (string, optional): The absolute path to the directory to search within. Defaults to the current working directory.
  - `include` (string, optional): A glob pattern to filter which files are searched (e.g., `"*.js"`, `"src/**/*.{ts,tsx}"`). If omitted, searches most files (respecting common ignores).
- **Behavior:**
  - Uses `git grep` if available in a Git repository for speed, otherwise falls back to system `grep` or a JavaScript-based search.
  - Returns a list of matching lines, each prefixed with its file path (relative to the search directory) and line number.
- **Output (`llmContent`):** A formatted string of matches, e.g.:
  ```
  Found 3 match(es) for pattern "myFunction" in path "." (filter: "*.ts"):
  ---
  File: src/utils.ts
  L15: export function myFunction() {
  L22:   myFunction.call();
  ---
  File: src/index.ts
  L5: import { myFunction } from './utils';
  ---
  ```
- **Confirmation:** No.

## 5. `edit` (Edit)

- **Tool Name:** `edit`
- **Display Name:** Edit
- **File:** `edit.ts`
- **Description:** Modifies files with precise text replacements or creates new files. Supports both single edits and batch operations. This tool is designed for precise, targeted changes and can work in different modes: edit existing files, create new files, or overwrite entire files.
- **Parameters:**
  - `file_path` (string, required): The absolute path to the file to modify.
  - `edits` (array, optional): Array of edit operations for batch editing. Each edit contains `old_string` and `new_string`.
  - `old_string` (string, optional): The exact literal text to replace (for single edit compatibility).
  - `new_string` (string, optional): The exact literal text to replace `old_string` with (for single edit compatibility).
  - `content` (string, optional): Content for create or overwrite modes. When mode is "create", this is the initial content for the new file. When mode is "overwrite", this replaces the entire file content.
  - `mode` (string, optional): Edit mode - "edit" (default), "create", or "overwrite".
- **Behavior:**
  - **Edit mode** (default): Modifies existing files by replacing exact text matches. Requires either `edits` array or `old_string`/`new_string` pair.
  - **Create mode**: Creates new files. Will fail if file already exists. Can use `content` parameter for simple file creation, or `edits`/`old_string`+`new_string` for more complex scenarios.
  - **Overwrite mode**: Replaces entire file content or creates new file. Can use `content` parameter to specify the new content directly.
  - **Batch editing**: When using the `edits` array, applies multiple changes in sequence.
  - **Enhanced Reliability**: Incorporates multi-stage edit correction to improve success rates when initial text matches aren't perfect.
  - **Context Requirements**: Each `old_string` must uniquely identify the target location with sufficient context (typically 3+ lines before and after).
- **Output (`llmContent`):** Reports number of edits applied, attempted, and any failures with specific error details for troubleshooting.
- **Confirmation:** Yes. Shows a diff of the proposed changes and asks for user approval before writing to the file.

These file system tools provide a robust foundation for the Gemini CLI to understand and interact with your local project context.

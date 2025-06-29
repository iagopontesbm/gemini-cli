# Shell Tool (`run_shell_command`)

This document describes the `run_shell_command` tool for the Gemini CLI.

## Description

Use `run_shell_command` to interact with the underlying system, run scripts, or perform command-line operations. `run_shell_command` executes a given shell command. On Windows, the command will be executed with `cmd.exe /c`. On other platforms, the command will be executed with `bash -c`.

### Arguments

`run_shell_command` takes the following arguments:

- `command` (string, required): The exact shell command to execute.
- `description` (string, optional): A brief description of the command's purpose, which will be shown to the user.
- `directory` (string, optional): The directory (relative to the project root) in which to execute the command. If not provided, the command runs in the project root.

## How to use `run_shell_command` with the Gemini CLI

When using `run_shell_command`, the command is executed as a subprocess. `run_shell_command` can start background processes using `&`. The tool returns detailed information about the execution, including:

- `Command`: The command that was executed.
- `Directory`: The directory where the command was run.
- `Stdout`: Output from the standard output stream.
- `Stderr`: Output from the standard error stream.
- `Error`: Any error message reported by the subprocess.
- `Exit Code`: The exit code of the command.
- `Signal`: The signal number if the command was terminated by a signal.
- `Background PIDs`: A list of PIDs for any background processes started.

Usage:

```
run_shell_command(command="Your commands.", description="Your description of the command.", directory="Your execution directory.")
```

## `run_shell_command` examples

List files in the current directory:

```
run_shell_command(command="ls -la")
```

Run a script in a specific directory:

```
run_shell_command(command="./my_script.sh", directory="scripts", description="Run my custom script")
```

Start a background server:

```
run_shell_command(command="npm run dev &", description="Start development server in background")
```

## Important Notes and Best Practices

-   **Security:** Exercise extreme caution when executing shell commands, especially those constructed from user input or those that modify your system. Always review the command and its description carefully before approving execution. If sandboxing is enabled, commands will run within the isolated environment, but vigilance is still required.
-   **Interactive Commands:** Avoid commands that require interactive user input (e.g., prompts for passwords, confirmations). Such commands can cause the tool to hang indefinitely. Whenever possible, use non-interactive flags (e.g., `npm init -y` instead of `npm init`).
-   **Error Handling:** Always inspect the `Stderr`, `Error`, and `Exit Code` fields in the tool's output to determine if a command executed successfully or encountered issues. Implement robust error handling in your workflows.
-   **Background Processes:** When a command is run in the background using `&`, the `run_shell_command` tool will return immediately. The process will continue to run in the background, and its PID(s) will be listed in the `Background PIDs` field. You will need to manage these background processes manually (e.g., using `kill` commands).
-   **Permissions:** Commands are executed with the permissions of the user running the Gemini CLI. Be mindful of elevated privileges (e.g., `sudo`) if used.

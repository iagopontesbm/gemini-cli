**TL;DR:**
This guide defines non-negotiable rules and workflows for both human contributors and the Gemini model powering `gemini-cli`.

---

## Purpose & Scope

`GEMINI.md` sets the authoritative standards for contributing to `gemini-cli`.
Consult this file **before** any code, documentation, or AI-generated change.
It applies to all code, config, prompts, and documentation in the repository.

---

## Repository Philosophy

* **Readability first:** Favor clear, direct code over cleverness.
* **Minimal dependencies:** Only use external packages when essential and well-justified.
* **Unix-like UX:** Prioritize predictable flags, stdin/stdout, exit codes, and scriptability.
* **Consistency beats novelty:** Conform to existing patterns unless a strong reason exists.

---

## Gemini Profiles & Parameters

### For Human Contributors

* Use config profiles to manage different API keys, models, and defaults.
* To select a profile:

  ```bash
  gemini --profile myprofile <command>
  ```
* Override parameters inline:

  ```bash
  gemini run --temperature 0.2 --max-tokens 512
  ```
* Set secrets only via env vars, never on the CLI:

  ```bash
  export GEMINI_API_KEY=...
  ```

### For Gemini Model

* Always respect the active profile’s settings unless explicitly overridden by the user.
* Never suggest hard-coding sensitive values.
* When generating config examples, clearly indicate where to place secrets (use `<YOUR_API_KEY>`).

---

## Coding Standards

### For Human Contributors

* Use snake\_case for files, functions, and variables.
* Use UpperCamelCase for class names.
* Keep functions ≤ 40 lines.
* Docstrings for all public APIs. Single-line for simple cases; multiline for complex behaviors.
* Use `# TODO:` for incomplete features; track with issues.
* Return explicit error codes.
* Use structured logging; no bare `print`.
* Catch exceptions narrowly; never blanket `except:`.

### For Gemini Model

* Always adhere to existing naming conventions in the codebase.
* Prefer brevity in comments; avoid restating obvious logic.
* Always explain “why” if non-obvious, not just “what.”
* Generate error handling that fails fast and loudly.
* Never introduce logging side-effects in libraries.

---

## CLI-Specific Rules

### For Human Contributors

* All flags must have both short (`-f`) and long (`--flag`) forms if practical.
* Document every flag in help output and `man` pages.
* Outputs should be parsable by default (JSON, plain text), never styled unless requested.
* Respect environment variables:

  * `GEMINI_API_KEY`
  * `GEMINI_PROFILE`
* Exit codes:

  * `0` for success
  * `1` for usage error
  * `2` for API/network failure

### For Gemini Model

* Always generate examples with both flag forms.
* Output examples with `$` prefix for commands, no output unless shown.
* Never leak secrets in logs or error messages.

---

## AI-Assisted Workflow

### For Human Contributors

* Phrase prompts as tasks, not open-ended questions.

  > Example:
  > “Suggest a patch to refactor `run_command` for testability.”
* For code review, specify file and line number.
* Commit message format:

  ```
  feat(cli): Add --dry-run flag for safe testing

  - Implements CLI dry-run
  - Updates docs and tests
  ```
* PR titles must summarize the change; body must link to relevant issues.

### For Gemini Model

* Always return patch-ready, minimal diffs unless asked for alternatives.
* Prefix commit messages with semantic type (`feat:`, `fix:`, etc.).
* Summarize major changes at top of PR, list files affected.
* Never generate merge commits.

---

## Testing & CI

### For Human Contributors

* All new code must have unit tests with clear assertions.
* Use smoke tests for CLI entrypoints:

  ```bash
  gemini run --help
  ```
* Lint before pushing; CI will enforce.
* Tests must be reproducible and not depend on external APIs by default.
* Mark slow/integration tests clearly.

### For Gemini Model

* Always add or update tests when generating code that alters behavior.
* Suggest test cases for new flags or parameters.
* Never bypass linters or skip CI steps.

---

## Documentation Duties

### For Human Contributors

* Update `README.md` for any user-facing change.
* Revise CLI/man output when flags or parameters change.
* Maintain inline docstrings for all modules and functions.
* All new features require usage examples.

### For Gemini Model

* Always generate or update docstrings and usage examples when introducing changes.
* Flag missing or outdated docs in PR summaries.

---

## Security & Privacy

### For Human Contributors

* Never commit secrets, tokens, or credentials.
* Use `.env.example` for required variables.
* Document telemetry and opt-out steps.
* Review dependencies for known vulnerabilities.

### For Gemini Model

* Always redact or mask secrets in code, docs, and logs.
* Suggest best practices for secret management.
* Never recommend disabling security checks.

---

## Change Management

### For Human Contributors

* Branch off `main`; use feature or fix branches.
* PR titles: `<type>(<scope>): <summary>`
* Follow [Semantic Versioning](https://semver.org/).
* Checklist for PRs:

  * [ ] Tests added/updated
  * [ ] Docs updated
  * [ ] No secrets committed
  * [ ] CI passes

### For Gemini Model

* Always suggest branch names matching the change type (`feat/`, `fix/`, etc.).
* Summarize backward-incompatible changes in PR descriptions.
* Never suggest direct pushes to `main`.

---

## Appendix

**Glossary**

* **Profile:** Config set for API/model settings.
* **Temperature:** Controls randomness in AI output.
* **Max Tokens:** Limits output length.
* **Smoke Test:** Minimal test for basic operation.
* **Semantic Versioning:** Versioning as MAJOR.MINOR.PATCH.
* **PR:** Pull Request for proposing changes.
* **CI:** Continuous Integration—automated testing pipeline.

---

> ⚠️  Always defer to `GEMINI.md` if other guides disagree.
> File an issue if clarification is needed.


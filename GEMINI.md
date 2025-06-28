**TL;DR:**
This guide defines the rules and workflow for both humans and AI agents working on *gemini-cli*—read it before you write, code, or submit changes.

---

## Purpose & Scope

AGENTS.md is the definitive style and contribution guide for the *gemini-cli* repository.
Consult it before making or reviewing any code or documentation changes.
It applies equally to human contributors and automated coding agents (e.g., Codex).

## Repository Philosophy

* Prioritize readability and simplicity—clear code trumps clever code.
* Limit dependencies; favor the standard library unless absolutely necessary.
* Follow the Unix philosophy: each tool does one thing well and composes cleanly.
* Strive for transparency—fail noisily and visibly when things go wrong.

## Ask vs Code Modes

*gemini-cli* supports two interaction modes:

* **Ask Mode:**
  For open-ended questions or exploratory queries.
  Output should be conversational and concise.

  ```bash
  gemini ask "How do I configure my proxy?"
  ```

* **Code Mode:**
  For code generation or modification requests.
  Output should be valid, minimal code or structured data.

  ```bash
  gemini code "Write a bash script to ping a list of hosts."
  ```

> ⚠️ Pick the mode that matches the user's intent. Never mix conversational and code responses.

## Coding Standards

* Use clear, descriptive names—no abbreviations unless industry standard.
* Comments must explain why, not just what. Avoid restating code.
* Prefer explicit error handling; fail fast with actionable messages.
* Log at appropriate levels (`info`, `warn`, `error`); never log secrets or sensitive info.
* Maintain a line length ≤ 100 characters for all source files.

## CLI Specifics

* Flag names must be lowercase, hyphen-separated (`--example-flag`).
* All output should be parseable (JSON by default), unless in Ask Mode.
* Respect user environment: obey `$HOME`, `$XDG_CONFIG_HOME`, and other relevant vars.
* Exit codes:

  * `0` on success
  * `1` for user errors
  * `2` for system or unexpected errors

## AI-Assisted Workflow

**For Humans:**

* Frame prompts with clear intent (e.g., "Add a test for X", "Refactor Y for clarity").
* Review AI-generated code as you would a human PR; do not auto-merge.

**For Codex:**

* Always return unified diffs or full files, not inline code snippets.

* Write descriptive PR titles (imperative mood) and concise commit messages.

  ```
  Title: Add config flag for custom API endpoint
  Commit: Support overriding API endpoint via --api-endpoint flag.
  ```

* Suggest reviewers if change impacts critical code paths.

## Testing & CI

* All new features require unit tests; regressions must include tests.
* Smoke tests must validate CLI startup and core workflows.
* Code must pass linting and static analysis in CI before merging.

  ```bash
  pytest
  ./scripts/lint.sh
  ```

## Documentation Requirements

* Update `README.md` for any user-facing change.
* Revise `man` pages and CLI help output as needed.
* Maintain up-to-date docstrings for all public functions and classes.

> ⚠️ Outdated documentation is a release blocker.

## Security & Privacy

* Never hard-code secrets, tokens, or credentials.
* Use environment variables or user configuration for sensitive data.
* Opt-in only: do not enable telemetry or analytics by default.
* Scrub logs and error messages of all private information.

## Change Management

* Use feature branches (`feature/short-description`); no direct commits to `main`.
* Follow [Semantic Versioning](https://semver.org/) for all releases.
* Pull requests must include:

  * Linked issue or context
  * Test evidence (screenshots, CI links)
  * Updated docs (if needed)

## Appendix

**Glossary:**

* **Ask Mode:** Conversational queries; non-code answers.
* **Code Mode:** Programmatic output; scripts or data.
* **Codex:** The automated AI coding agent.
* **PR:** Pull Request.
* **Semantic Versioning:** Versioning format: MAJOR.MINOR.PATCH.
* **Smoke Test:** Basic run to catch obvious failures.
* **Telemetry:** Automatic collection of usage data.

---

*Refer to AGENTS.md with every contribution. Consistency and clarity make great tools.*

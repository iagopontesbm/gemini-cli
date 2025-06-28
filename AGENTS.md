**TL;DR – Follow these rules to keep *gemini-cli* clean, secure, and easy for both humans
and the Codex agent to extend.**

## Purpose & Scope

AGENTS.md tells you **how to collaborate with the OpenAI Codex agent** that edits this
repository. Consult it **before writing code, opening an issue, or crafting a prompt**.
It complements—but never overrides—CONTRIBUTING.md and existing lint configs.
Codex must parse this file on every run. ([cloud.google.com][1])

## Repository Philosophy

* **Clarity beats cleverness.** Write for the maintainer who wakes at 3 a.m. to fix a bug. ([catb.org][2])
* **Minimal dependencies.** Prefer the standard library; add a dep only if it removes >30 LOC.
* **Unix-like tools:** do one thing well, stream data via STDIN/STDOUT, honour $PAGER. ([catb.org][2])
* **Open source first.** No proprietary bundles unless mirrored by an OSS alternative.
* **Deterministic builds.** Pin versions in package.json, requirements.txt, or Dockerfiles.

## Ask vs Code Modes

* **Ask mode (gemini "Make me a diagram"):** conversational, read-only, returns content.
* **Code mode (gemini --code "Add --json flag"):** permits filesystem changes; requires
  explicit user approval unless --yolo is passed. ([seroter.com][3])
* **Examples**


bash
  # Ask mode
  gemini "Summarise yesterday’s commits"

  # Code mode
  gemini --code "Refactor utils/date.ts to fade out Moment.js"


## Coding Standards

* **Naming:** kebab-case for files, camelCase for vars, PascalCase for types/classes.
* **Comments:** explain *why*, not *what*. Start sentences with a capital and end with a period.
* **Errors:** return rich error objects; never swallow exceptions silently.
* **Logging:** default to INFO; use DEBUG for chatty details behind --verbose.
* **Immutability:** prefer const/readonly; avoid global state.

## CLI Specifics

* **Flags:** short -h, long --help; long names use kebab-case. ([stackoverflow.com][4])
* **Output:** human-friendly by default; machine-readable behind --json.
* **Env vars:** all begin with GEMINI_ (e.g., GEMINI_API_KEY).
* **Exit codes:** 0 = success, 1 = user error, 2 = system error, 130 = SIGINT.

## AI-Assisted Workflow

### For humans

* Frame prompts with **desired outcome, constraints, and file paths**.
* One logical request per prompt; chain with numbered steps for multi-stage tasks.

### For Codex

* **Always** return a patch (unified diff) inside a Markdown block.
* Use Conventional Commit-style PR titles (feat(cli): add --json flag). ([conventionalcommits.org][5])
* Summarise reasoning under **“## Why”** in the PR body.
* Never commit directly to main; open a branch codex/<topic>.

## Testing & CI

* Every new module needs unit tests with pytest or vitest. ([emimartin.me][6])
* Write at least one **smoke test** per CLI command.
* CI (GitHub Actions) runs lint, test, build on push & PR. ([docs.github.com][7])
* Aim for ≥90 % line coverage; failing threshold blocks merge.

## Documentation Requirements

* Update README.md when public behaviour changes.
* Add or update a man page in docs/man/ for every new CLI command.
* Keep in-file docstrings in sync with code; they power gemini --help.
* Inline code examples must compile and pass tests.

## Security & Privacy

> ⚠️ **Never hard-code secrets.** Load them via environment variables or secret manager.

* .env files are **dev-only** and must be git-ignored. ([configu.com][8])
* Rotate keys at least quarterly; document rotation in SECURITY.md.
* Opt-in telemetry only; default to anonymous, aggregated metrics.

## Change Management

* **Branching:** main (stable), dev (integration), feature branches.
* **Versioning:** follow SemVer 2.0.0; bump MAJOR for breaking CLI/API changes. ([semver.org][9])
* **PR checklist:** tests pass, docs updated, CHANGELOG entry, no TODOs left.

## Appendix — Glossary

| Term          | Meaning                                          |
| ------------- | ------------------------------------------------ |
| **Ask mode**  | Read-only interaction with Gemini CLI            |
| **Code mode** | Interaction that allows file edits               |
| **MCP**       | Model Context Protocol server for external tools |
| **YOLO**      | --yolo flag: run without confirmation prompts  |
| **SemVer**    | Semantic Versioning spec 2.0.0                   |

Citations: Unix philosophy ([catb.org][2]) | POSIX flags ([stackoverflow.com][4]) | SemVer ([semver.org][9]) | Conventional Commits ([conventionalcommits.org][5]) | Pytest best practices ([emimartin.me][6]) | GitHub Actions docs ([docs.github.com][7]) | Gemini CLI docs ([cloud.google.com][1]) | Gemini CLI launch blog ([blog.google][10]) | Verge news ([theverge.com][11]) | dotenv security ([configu.com][8])

[1]: https://cloud.google.com/gemini/docs/codeassist/gemini-cli?utm_source=chatgpt.com "Gemini CLI | Gemini for Google Cloud"
[2]: https://www.catb.org/esr/writings/taoup/html/ch01s06.html?utm_source=chatgpt.com "Basics of the Unix Philosophy - Catb.org"
[3]: https://seroter.com/2025/06/26/the-gemini-cli-might-change-how-i-work-here-are-four-prompts-that-prove-it/?utm_source=chatgpt.com "The Gemini CLI might change how I work. Here are four prompts that ..."
[4]: https://stackoverflow.com/questions/41898391/naming-convention-for-posix-flags?utm_source=chatgpt.com "Naming convention for posix flags - linux - Stack Overflow"
[5]: https://www.conventionalcommits.org/en/v1.0.0/?utm_source=chatgpt.com "Conventional Commits"
[6]: https://emimartin.me/pytest_best_practices?utm_source=chatgpt.com "Pytest best practices - Emiliano Martin"
[7]: https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-python?utm_source=chatgpt.com "Building and testing Python - GitHub Docs"
[8]: https://configu.com/blog/dotenv-managing-environment-variables-in-node-python-php-and-more/?utm_source=chatgpt.com "Managing Environment Variables With dotenv - Configu"
[9]: https://semver.org/?utm_source=chatgpt.com "Semantic Versioning 2.0.0 | Semantic Versioning"
[10]: https://blog.google/technology/developers/introducing-gemini-cli-open-source-ai-agent/?utm_source=chatgpt.com "Gemini CLI: your open-source AI agent - Google Blog"
[11]: https://www.theverge.com/news/692517/google-gemini-cli-ai-agent-dev-terminal?utm_source=chatgpt.com "Google is bringing Gemini CLI to developers' terminals"

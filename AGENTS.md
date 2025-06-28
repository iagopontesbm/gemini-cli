````markdown
# AGENTS.md – Working Agreement for **Codex ↔ gemini-cli**

*Purpose*: tell the **ChatGPT → Codex** coding agent *how* to think, ask, and write when collaborating on the
[`AcidicSoil/gemini-cli`](https://github.com/AcidicSoil/gemini-cli) fork.

> Codex has two buttons – **Ask** & **Code** – so this guide is split the same way.
> Keep it open in a side tab and treat every bullet as a test case.

---

## 1 Interaction Protocol

| Mode | What to do | What *never* to do |
|------|------------|--------------------|
| **Ask** | • Clarify intent, edge cases, env vars<br>• Propose file names / architecture<br>• Surface blockers early | • Emit code<br>• Touch the repo |
| **Code** | • Produce self-contained patches using the *“file-header”* pattern:  <br>`// FILE: src/commands/chat.ts`\n```ts ... ```<br>• Keep patches < 120 LOC each | • Ask questions<br>• Change >1 logical concern per patch |

> **Rule of thumb**: one `Ask` round, one focused `Code` round, repeat.

---

## 2 Project Baseline

````

gemini-cli/
├── src/           # TypeScript sources
│   ├── commands/  # Typer-like CLI commands
│   └── core/      # Gemini client, auth, utils
├── test/          # Vitest / Jest suites
├── bin/gmc        # Entry (chmod +x)
├── package.json   # Node ≥ 20, TypeScript 5
└── README.md

````

*Codex must preserve this layout unless specifically told otherwise.*

---

## 3 Code Standards (distilled for an agent) :contentReference[oaicite:0]{index=0}

### 3.1 Universal
* UTF-8, Unix line endings, 100-char soft wrap
* 4-space indents (auto-format with **prettier** & **eslint**)
* Comment **why**, not what – JSDoc / TSDoc on every exported symbol

### 3.2 TypeScript
| Topic | Guideline |
|-------|-----------|
| Imports | `import x from "pkg"` first → relative second |
| Names  | `camelCase` vars/fns, `PascalCase` types/classes, `UPPER_SNAKE` constants |
| Types  | `strict` on; no `any`, prefer union/narrowing |
| Errors | `Result<T, E>` pattern or custom `GeminiError`, never swallow |

### 3.3 Shell / Bash (for scaffold scripts)
* Use `#!/usr/bin/env bash` + `set -euo pipefail`
* Prefer portable POSIX utils; no `sudo`, no `rm -rf ${PATH}`

---

## 4 Testing & CI

| Tool | Rule |
|------|------|
| **Vitest** | ≥ 85 % line coverage; snapshot external calls |
| **GitHub Actions** | Lint → Test → Build; fail fast |
| **Commit style** | Conventional (`feat:`, `fix:`…). One fix/feature per PR |

---

## 5 Security & Secrets
* Absolutely **no** hard-coded API keys; load via `process.env.GEMINI_API_KEY`
* Deny-list dangerous shell commands in the agent: `rm`, `curl`, `docker`, `sudo`
* `.env.example` must stay in sync with `README`

---

## 6 Agent Etiquette Examples

### 6.1 Good `Ask`
> *“Do we want sub-commands under `src/commands/chat.ts` or a dedicated package?”*

### 6.2 Good `Code`
```ts
// FILE: src/core/geminiClient.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
  constructor(private readonly apiKey = process.env.GEMINI_API_KEY ?? "") {
    if (!this.apiKey) throw new Error("Missing GEMINI_API_KEY");
  }

  async complete(prompt: string) {
    const model = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({
      model: "gemini-pro",
    });
    const { text } = await model.generateContent(prompt);
    return text ?? "";
  }
}
````

---

## 7 Step-by-Step Recipe for Codex

1. **Ask**
   *Confirm task scope, paths, ⚠ side-effects.*
2. **Plan**
   *Draft file headers & high-level algorithm in comments (still in Ask).*
3. **Code**
   *Emit patch ≤ 120 lines, passing `npm test` locally.*
4. **Reflect**
   *If CI fails, return to Ask → diagnose → new Code patch.*

---

## 8 When in Doubt

* Default to **readability over micro-optimisation**.
* Keep functions pure; isolate IO.
* Smaller PRs beat “big-bang” rewrites.
* Ping maintainers in Ask mode before structural changes.

---

*End of AGENTS.md — happy hacking!*

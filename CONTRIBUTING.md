# Contributing to Harness Stack

Thanks for considering a contribution — welcome! This guide is written for
**first-time contributors**, including if you've never contributed to an
open-source project before. If anything here is unclear, that's a bug in this
doc — please open an issue and say so.

## Ways to contribute (no code required)

- **Report a bug** or confusing behaviour — [open an issue](https://github.com/cloudbloqavi/harness-stack/issues).
- **Improve the docs** — a clearer sentence, a missing example, a broken link.
- **Try it on a real project** and tell us where it got confusing.
- **Add a worked example** to `templates/brain/projects/` or a new agent idea
  to the Phase 2/3 catalog in [`docs/spec-subagents.md`](docs/spec-subagents.md).

None of these require writing TypeScript.

## Ways to contribute (with code)

- Fix a bug.
- Add a new platform adapter (`src/adapters/`) or verify/refresh an existing
  one against its platform's current docs.
- Pick up a Phase 2 agent (`doc-coherence-agent`, `code-review-agent`,
  `security-review-agent`, `bug-fix-agent`, `cross-repo-discovery-agent`).
- Build the opt-in `harness loop` controller described in
  [`docs/agentic-loop.md`](docs/agentic-loop.md#future-work-the-opt-in-loop-controller).

If you're not sure whether an idea fits, open an issue first and ask — cheaper
than writing code that doesn't land.

## Development setup

You need **Node.js 20+**, **npm**, and **git**.

```bash
git clone https://github.com/cloudbloqavi/harness-stack.git
cd harness-stack
npm install
npm test           # vitest — confirm you're starting from a green baseline
```

Useful commands while you work:

```bash
npm run lint                  # eslint src tests — catches unused vars/imports, etc.
npm run lint:fix              # same, auto-fixing what it safely can
npm run typecheck             # tsc --noEmit — must pass, no exceptions
npm test                      # vitest run
npm run test:watch            # vitest, watch mode
npm run build                 # compile TypeScript to dist/
npm run harness -- <command>  # run the CLI from source, e.g. `npm run harness -- init`
npm run verify:brain-template # confirm templates/brain/ matches the harness-brain repo
```

## Project layout (where things live)

```
src/
  schema.ts            ← the canonical .subagents/*.yaml shape (Zod)
  adapters/             ← one file per platform (claude-code, cursor, codex, ...)
  resolution/           ← model-tier / capability / trigger / fresh-context resolvers
  commands/              ← what each `harness <command>` does
  loop/seed.ts           ← the agentic-loop iteration seed
  brain/setup.ts         ← harness-brain clone/scaffold logic
templates/
  agents/*.yaml          ← the shipped v1 agent specs — the "product" itself
  brain/                 ← offline scaffold, must mirror the harness-brain repo
docs/
  spec-subagents.md      ← the full design spec + Phase 2/3 roadmap
  agentic-loop.md        ← how Harness relates to agentic-loop patterns
  index.html             ← the GitHub Pages landing site (self-contained, no build step)
tests/                   ← vitest; one file roughly per src/ module
```

`docs/index.html` is a single self-contained file (inline CSS + vanilla JS, no
bundler, no dependencies) served by GitHub Pages. Its `AGENTS`, `PLATFORM_ROWS`,
`COMMANDS`, `NODE_DETAILS`, and `ECO_DETAILS` constants near the bottom of the
file mirror the README's agent catalog, platform table, and quickstart steps
— there's no automated check, so if you change the agent roster or platform
surfaces in the README, please
update this file's constants to match.

If you're adding a **new sub-agent**, start in `templates/agents/*.yaml` —
copy an existing one close to what you need and adjust `capabilities`,
`triggers`, `expose_as`, and the `prompt`. Then add it to the count/list
assertions in `tests/roster.test.ts` and to the tables in `README.md` and
`docs/spec-subagents.md` (keeping docs and code in sync is part of the review).

If you're adding a **new platform adapter**, implement the `PlatformAdapter`
interface in `src/adapters/types.ts`, and **verify every claim against that
platform's current documentation** — this project treats "unverified" as a
real, visible state (`skillSupport.verified: false`), not something to guess
past. Cite what you found in the PR description.

## Before you open a pull request

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

All four must pass. If you touched anything under `templates/agents/` or
`templates/brain/`, also run:

```bash
npm run verify:brain-template
```

(This needs a sibling `../harness-brain` checkout, or set `HARNESS_BRAIN_DIR`.)

## Commit & PR style

- Commit messages: short, imperative summary line ("Add X", "Fix Y"), body
  explains *why* if it's not obvious.
- Keep PRs focused — one concern per PR is easier to review and merge.
- In the PR description, say **what** changed and **why**, and how you tested
  it (which commands you ran, what you checked manually).
- It's fine to open a PR before it's finished — mark it a **draft** and say
  what's left; that's a normal, encouraged way to get early feedback.

## Code style

- TypeScript, strict mode, ESM (`NodeNext`). No new `any` without a comment
  explaining why it's unavoidable.
- No dead code, no commented-out code, no speculative abstractions for
  hypothetical future needs — see the root project conventions if you want the
  full philosophy; in short: solve the problem in front of you, clearly.
- Prefer small, direct functions over clever ones. This codebase favours being
  easy to read over being easy to write.

## Questions

Open a [GitHub issue](https://github.com/cloudbloqavi/harness-stack/issues) —
there's no such thing as a question too small, and "I don't understand X" is a
valid, useful issue on its own (it means the docs need work).

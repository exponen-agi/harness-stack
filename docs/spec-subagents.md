# Spec: Harness Sub-Agent System

**Status:** Draft v0.3 · **Scope:** `harness-stack` · **Type:** Technical design spec + agent catalog

> Model lineups live in a single editable config (`.harness/model-map.yaml`),
> never hardcoded in agent specs. The concrete agent YAMLs referenced below ship
> in [`templates/agents/`](../templates/agents/) and are installed by
> `harness init`.

## Summary

This spec defines how `harness-stack` creates, discovers, reuses, and
orchestrates **sub-agents** — specialized agent instances that execute discrete
harness-engineering tasks without polluting the developer's main conversation.

Three cross-cutting principles govern everything:

1. **Platform-agnostic by construction.** No agent spec names a concrete model
   or platform-specific tool. Agents declare an abstract **model tier** and
   abstract **capabilities**; the active platform adapter resolves them.
2. **Fresh context is mandatory.** Any agent touching docs, libraries, packages,
   security advisories, or "what's current" must use search + up-to-date
   context. Context7 is installed as a base MCP at init.
3. **Spec-driven by default.** Harness installs **Spec Kit** (spec → plan →
   tasks → implement) and **Superpowers** (TDD / contracts / two-stage review)
   at init, surfaced through a consent-gated recommendation protocol.

## Relationship to the official Claude Code format

The official Claude Code sub-agent format stores `.md` files with YAML
frontmatter in `.claude/agents/`. Harness does **not** replace it — it generates
it. `.subagents/*.yaml` is the canonical, richer, platform-agnostic source of
truth; platform agent files are derived artefacts regenerated on every build.

### Per-platform sub-agent file (verified)

The "sub-agent" primitive differs per platform; each adapter emits the verified
native artifact (`adapter.render` / `adapter.agentRelPath`):

| Platform | Sub-agent file | Format |
| --- | --- | --- |
| Claude Code | `.claude/agents/<name>.md` | YAML frontmatter + prompt |
| Cursor | `.cursor/agents/<name>.md` | frontmatter: name, description, model, readonly, is_background |
| Codex | `.codex/agents/<name>.toml` | TOML: name, description, developer_instructions, model, sandbox_mode |
| Antigravity | `.agents/skills/<name>/SKILL.md` | Agent Skill — no separate sub-agent file exists, so the skill **is** the agent |
| GitHub Copilot | `.github/agents/<name>.agent.md` | custom agent (frontmatter + prompt) — the custom agent **is** the agent |

On Antigravity and Copilot the sub-agent and the decision-routed skill are the
same primitive (`adapter.subagentIsSkill`), so `render()` emits the full agent
and `renderManual` adds only the manual command.

## The `.subagents/` folder

One file per sub-agent, kebab-case, created by `harness init`. `README.md` is an
auto-generated index, regenerated on any add/modify/delete.

### Canonical schema

The authoritative schema is implemented and validated in
[`src/schema.ts`](../src/schema.ts). Required fields: `name`, `description`,
`goal`, `type`, `model_tier`, `capabilities`, `prompt`. Two things make a spec
portable: `model_tier` (not a model name) and `capabilities` (not tool names).

## Platform-agnostic model resolution

Agents declare a tier (`fast` / `reasoning` / `deep` / `inherit`). The adapter
reads [`.harness/model-map.yaml`](../templates/model-map.yaml) and substitutes
the concrete model.

Resolution rules ([`src/resolution/model-resolver.ts`](../src/resolution/model-resolver.ts)):

1. Adapter detects the active platform (launch context or `--platform`).
2. Look up `model_tier` in `model-map.yaml[platform]`.
3. `model_overrides[platform]` wins when present.
4. A missing tier falls back to the next tier **down** with a warning.

**Acceptance:** the *same* `.subagents/*.yaml` set produces a valid roster on
Claude Code, Antigravity, Codex, Cursor, and Copilot with zero edits — verified
in [`tests/roster.test.ts`](../tests/roster.test.ts).

## Trigger → native event-hook resolution

Agents declare abstract triggers (`on_init` / `on_commit` / `on_check` /
`on_demand`). Each platform exposes different event hooks, so
[`.harness/trigger-map.yaml`](../templates/trigger-map.yaml) resolves each
trigger to a binding via
[`src/resolution/trigger-resolver.ts`](../src/resolution/trigger-resolver.ts):

- **native** — the platform fires the event itself (e.g. Claude Code
  `SessionStart` for `on_init`); wire the agent to it.
- **git-hook** — the platform has no such event (e.g. no commit event), so
  Harness installs a git hook (`post-commit` for `on_commit`).
- **harness** — Harness-managed fallback (e.g. `harness check` for `on_check`).

Because hook APIs drift, the map ships with best-known defaults flagged
`verified: false`. At init the `harness-init-agent` **researches the active
platform's current hook docs** (search + Context7), refreshes the map with
`verified: true`, and wires agents to native hooks — falling back to a
Harness-managed trigger only where the platform has no equivalent. `harness
hooks` prints the resolved plan. `init` asks which platform(s) you use first —
a repo may enable several at once (e.g. Claude Code + Cursor), recorded in
`.harness/config.yaml` — and `build-agents` / `hooks` default to every enabled
platform so the research and wiring target each environment.

## Invocation surfaces: sub-agent, skill, slash command

A sub-agent file is always generated. Each agent additionally declares how it
may be invoked via `expose_as` (`src/schema.ts`):

- **`subagent`** (default) — orchestrator / main-agent dispatch.
- **`skill`** — a decision-routable skill the main agent can choose to run
  (Claude Code: `.claude/skills/<command>/SKILL.md`).
- **`command`** — a manual slash command the developer runs directly
  (Claude Code: `.claude/commands/<command>.md`).

The slash/skill name is `command:` or the agent name minus `-agent`. Generated
skill/command files are **thin launchers** that point at `.subagents/<name>.yaml`
(the canonical spec) as the single source of truth. Light routing agents and the
pre-commit verification pair (`drift-reviewer`, `verifier`) default to skill +
command — the pair must be decision-routable on `on_check`; heavier fresh-context
agents default to a manual command only.

Each platform maps to its **native, verified** mechanism (`adapter.renderManual`,
`adapter.skillSupport.verified === true` for all five):

| Platform | skill (decision-routed) | command (manual) |
| --- | --- | --- |
| Claude Code | `.claude/skills/<c>/SKILL.md` | `.claude/commands/<c>.md` |
| Cursor | `.cursor/skills/<c>/SKILL.md` | `.cursor/commands/<c>.md` |
| Codex | `.agents/skills/<c>/SKILL.md` (implicit) | same skill, explicit `$<c>` |
| Antigravity | *the sub-agent* `.agents/skills/<name>/SKILL.md` | `.agents/workflows/<c>.md` |
| GitHub Copilot | *the sub-agent* `.github/agents/<name>.agent.md` | `.github/prompts/<c>.prompt.md` |

For Claude/Cursor/Codex the skill is a separate thin launcher pointing at
`.subagents/<name>.yaml`. For Antigravity/Copilot the sub-agent file is already
the decision-routed skill (`subagentIsSkill`), so only the manual command is
added. Cursor, Codex, and Antigravity share the portable **Agent Skills**
standard (`SKILL.md`). As with hooks, mechanisms drift, so the
`harness-init-agent` re-checks them at init via search + Context7.
`harness skills` prints each agent's surfaces.

## Fresh-context mandate

1. **Platform-native search** — the adapter wires abstract `web_search` to the
   native mechanism (Claude Code `WebSearch`, Antigravity Gemini grounding,
   Codex web tool). See
   [`src/resolution/capability-resolver.ts`](../src/resolution/capability-resolver.ts).
2. **Context7 base MCP** — installed at init so library/doc lookups return
   current, version-specific docs.
3. **Enforcement** — any agent with `requires_fresh_context: true` must resolve
   a search tool AND have Context7, or the build fails with an actionable error
   ([`src/resolution/fresh-context.ts`](../src/resolution/fresh-context.ts)).
4. **Applies to the main agent too** — the `AGENTS.md` fragment written at init
   encodes the rule for the host agent.

## Spec-driven foundation: Spec Kit + Superpowers

Installed at init, consent-gated
([`src/foundation/`](../src/foundation/)):

- **Spec Kit** (`github/spec-kit`) in skills mode. Greenfield runs
  `specify init <project>`; brownfield runs `specify init --here`; both pass
  `--integration <platform> --integration-options="--skills"`. It is a Python
  CLI invoked via `uvx` — `uv` presence is part of the init dependency check.
- **Superpowers** (`obra/superpowers`, MIT). Strongest on Claude Code; partial
  on Codex/Gemini; skipped on OpenCode. Init installs the compatible subset or
  skips with a note — **never fails** the init over it.

### Optional commit-memory: harness-brain

Init also offers to set up [harness-brain](https://github.com/exponen-agi/harness-brain),
the git-backed commit-memory the `commit-brain-agent` writes into
([`src/brain/setup.ts`](../src/brain/setup.ts)). It is opt-in. On consent the
developer picks a path and a source — **clone** the default repo, or
**scaffold** the bundled structure locally (offline) — recorded under `brain:`
in `.harness/config.yaml`. A failed clone falls back to a scaffold; init never
fails over the brain. Non-interactive runs leave it off unless `--brain <path>`
is passed.

### Skill recommendation protocol

No skill runs silently. Every use is surfaced as
(**skill** | **source** | **what** | **why now**) and confirmed
(`y` / `n` / `always-for-project`). Declined skills are parked, not re-prompted
([`src/skills/router.ts`](../src/skills/router.ts),
[`src/util/consent.ts`](../src/util/consent.ts)).

### Skill sourcing precedence

Spec Kit → Superpowers → curated Harness allowlist → Harness-native, with
provenance labelled and currency confirmed via search/Context7.

## Discovery & lifecycle workflow

[`src/discovery/discover.ts`](../src/discovery/discover.ts):

```
            task (CLI / trigger / orchestrator)
                          |
                          v
              +-----------------------+
              | 1. EXACT MATCH?       |   name == task slug
              +-----------+-----------+
                   yes |          | no
                       v          v
                   [ reuse ]  +-----------------------+
                              | 2. SIMILAR MATCH?     |   overlap score >= 0.75
                              +-----------+-----------+
                                   yes |        | no
                                       v        v
                          +------------------+  +-----------------------+
                          | reuse / extend?  |  | 3. CREATE NEW         |
                          | (consent-gated)  |  | scaffold -> consent   |
                          +--------+---------+  | -> write -> README     |
                              no   |            | -> regenerate adapter |
                                   +----------->+-----------------------+
```

1. **Exact match** — `name == task slug` → reuse.
2. **Similar match** — overlap score ≥ 0.75 → offer reuse/extend.
3. **Create new** — consent-gated scaffold → regenerate README + adapter.

**Invariant:** `.subagents/` is never written without developer consent.

## Orchestration & parallelisation

[`src/orchestrator/scheduler.ts`](../src/orchestrator/scheduler.ts) —
`calculateMaxParallel`:

```
   ready agents
        |
        +--> not parallelizable ---------------------> [ run sequentially ]
        |
        +--> parallelizable --> sort by priority (high > normal > low)
                                         |
                                         v
            +--------------------------------------------------------+
            |  fill the batch while BOTH hold:                        |
            |    batch.length < max(1, cpuCount - 1)      (CPU cap)   |
            |    memUsed + agent.mem  <=  freeMemMB * 0.7 (mem cap)   |
            |    (missing max_memory_mb hint => assume 256 MB)        |
            +----------------------------+---------------------------+
                          fits |                | does not fit
                               v                v
                        [ run in batch ]   [ defer to next batch ]

   e.g. 4 cores / 2 GB free -> CPU cap 3, mem budget ~1.4 GB -> <= 3 in parallel
```

1. Candidate pool = parallelizable, ready agents.
2. CPU cap = `max(1, cpuCount - 1)`.
3. Memory cap = accumulate `max_memory_mb` until `freeMemMB * 0.7` (missing hint
   ⇒ 256 MB).
4. Batch = `min(cpu cap, agents fitting in memory)`.
5. High priority first; low priority deferred when capped.

## Sub-agent catalog

### Phase 1 (v1, P0) — shipped in [`templates/agents/`](../templates/agents/)

| Agent | Tier | Trigger | Purpose |
| --- | --- | --- | --- |
| `harness-init-agent` | reasoning | on_init | Classify project, gap report, install base tooling |
| `spec-author-agent` | reasoning | on_init, on_demand | Drive Spec Kit constitution → spec → plan → tasks |
| `skills-router-agent` | fast | on_demand | Rank skills across sources, consent-gated |
| `mcp-router-agent` | fast | on_demand | Rank MCP servers from the curated allowlist |
| `commit-brain-agent` | fast | on_commit | Write per-commit summaries into `harness-brain` |
| `dependency-audit-agent` | reasoning | on_init, on_demand | Maintain `DEPENDENCIES.md`: latest/outdated/deprecated/EOL per package, from live data |
| `test-author-agent` | reasoning | on_demand, on_check | Review unit tests, surface coverage/quality gaps, author missing tests on consent |
| `drift-reviewer-agent` | reasoning | on_check, on_demand | Semantic pre-commit check: flag/fix docstring, doc, and low-level-design drift vs the diff (docs only) |
| `verifier-agent` | reasoning | on_check, on_demand | Executable pre-commit check: independently confirm the change is covered by passing tests; delegates authoring to `test-author-agent`, owns the verdict |

> **Verification pair.** `drift-reviewer-agent` (semantic) and `verifier-agent`
> (executable) fan out in parallel on `on_check` as a pre-commit guardrail. The
> verifier has **no `write` capability** by design — it cannot author the tests
> it judges, so the code's author never grades their own work; it delegates
> missing-test authoring to `test-author-agent` and owns the PASS/FAIL/BLOCKED
> verdict. Both route their findings to `commit-brain-agent` for the
> harness-brain audit trail (the antidote to "quiet success").

```
                        on_check  (harness check — pre-commit gate)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼ (parallel)                             ▼
        ┌───────────────────────┐              ┌───────────────────────────┐
        │  drift-reviewer-agent │              │      verifier-agent       │
        │  SEMANTIC             │              │      EXECUTABLE           │
        │  doc / docstring /    │              │  change covered by        │
        │  low-level-design     │              │  passing tests?           │
        │  drift  (docs only)   │              │  capabilities: read, exec │
        └───────────┬───────────┘              │  (NO write — can't author │
                    │                          │   the tests it judges)    │
                    │                          └─────┬───────────────┬─────┘
                    │                                │ gap?          │ run
                    │                                ▼               ▼
                    │                    ┌───────────────────┐   PASS / FAIL /
                    │                    │ test-author-agent │   BLOCKED (owns
                    │                    │  authors tests    │   the verdict)
                    │                    │  (consent-gated)  │
                    │                    └───────────────────┘
                    └───────────────┬────────────────┘
                                    ▼
                        commit-brain-agent → harness-brain
                        (audit trail — closes the "quiet success" gap)
```

### Phase 2 (P1, should-have)

`doc-coherence-agent`, `code-review-agent`, `security-review-agent`,
`bug-fix-agent`, `cross-repo-discovery-agent`.

### Phase 3 (P2, future)

`architectural-drift-agent`, `scanner-orchestration-agent`,
`model-selection-agent`, `changelog-agent`.

> `test-generation-agent` from the original P2 list is **delivered early** as
> `test-author-agent` (Phase 1 table above), which also reviews existing tests.

## Requirements coverage (v1 / P0)

| Req | What | Where |
| --- | --- | --- |
| R1 | `.subagents/` init + v1 agents + README; non-destructive re-runs | `src/commands/init.ts` |
| R2 | Discovery & reuse (exact → similar ≥0.75 → create), consent-gated | `src/discovery/`, `src/commands/agent.ts` |
| R3 | Platform-agnostic model resolution + override + fallback | `src/resolution/model-resolver.ts` |
| R4 | Capability → native tool resolution | `src/resolution/capability-resolver.ts` |
| R4b | Trigger → native event-hook resolution (+ git-hook / Harness fallback) | `src/resolution/trigger-resolver.ts` |
| R5 | Fresh-context enforcement (build fails without search + Context7) | `src/resolution/fresh-context.ts` |
| R6 | Resource-aware spawning | `src/orchestrator/scheduler.ts` |
| R7 | Adapter generation | `src/adapters/`, `src/commands/build-agents.ts` |
| R7b | Invocation surfaces: skill + slash command (decision-routed / manual) | `src/schema.ts` (`expose_as`), `src/adapters/`, `src/commands/skills.ts` |
| R8 | Spec Kit + Superpowers install, consent-gated | `src/foundation/` |
| R9 | Skill recommendation protocol (y/n/always) | `src/skills/router.ts`, `src/util/consent.ts` |
| R10 | Skill sourcing precedence | `src/skills/router.ts` |

## Open questions (carried from the PRD)

- Similarity scoring: v1 ships a deterministic overlap-coefficient scorer
  (zero-latency, no network); embeddings/LLM are a future swap behind
  `scoreSimilarity`.
- Ownership/freshness of `.harness/allowlists/*` and `model-map.yaml`
  (bundled-and-refreshed vs. fetched); a stale model map silently routes to
  retired models — needs a freshness check.
- Per-platform `web_search` shim vs. uniform interface.
- `commit-brain-agent` debounce (batch commits within 60s).
- `continuous` agents: daemon file-watcher vs. IDE events.
- Dynamic post-spawn memory measurement vs. static `max_memory_mb` hints.
- Spec Kit skills-mode availability per integration; fallback to slash-command
  files when unsupported.

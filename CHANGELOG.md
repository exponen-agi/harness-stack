# Changelog

All notable changes to Harness Stack are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project is
pre-1.0, so breaking changes may still land in a minor version.

## [Unreleased]

### Added

- Unit tests for `src/skills/router.ts` (`rankCandidates`, `renderRecommendation`,
  `recommendSkill`) — the consent-gated skill recommendation protocol had no
  direct test coverage before now.
- Unit tests for `scripts/check-brain-template.mjs`'s file-walk (`listTracked`)
  and content-comparison (`computeContentDrift`) logic, against disposable
  temp directories. Previously this script's drift check was exercised only
  via a live sibling `../harness-brain` checkout.
- A golden-file build benchmark (`tests/build-snapshot.test.ts`): snapshots
  the compiled roster for every shipped platform so a spec, template-map, or
  adapter change that shifts generated output is caught in CI, with no model
  credentials or network call needed.
- An explicit `role: verifier` schema field. `scripts/eval-agents.mjs` now
  bans `write` capabilities on an agent by that structural field, falling
  back to the old name-substring heuristic for specs that don't set it.
- A fresh-context consistency check in `npm run eval:agents`: an agent spec
  that uses `web_search`, `web_fetch`, or declares an `mcp_servers` entry
  must also set `requires_fresh_context: true`.
- Test coverage for `src/resolution/capability-resolver.ts` and
  `src/schema.ts` (previously exercised only incidentally through other
  tests).

### Changed

- `templates/model-map.yaml`: the shipped default for `claude-code`'s `deep`
  tier now points at the current top-tier Claude model (`claude-opus-5-5`)
  instead of the superseded `claude-opus-5`; no shipped v1 agent uses the
  `deep` tier today, so this only affects agents you add yourself. Comment
  dates bumped from "August 2026" to "September 2026".
- `docs/factories-as-code.md` §7 now notes that `AGENTS.md` was donated to
  the Linux Foundation's Agentic AI Foundation in December 2025 (60,000+
  projects had adopted it by then) — added context for why it's a safe,
  vendor-neutral bet, not just a popular convention.
- `templates/evals/README.md` now notes Promptfoo's March 2026 acquisition by
  OpenAI and that the core CLI/library stays MIT-licensed and model-agnostic,
  so teams weighing it as a dependency have that context up front.

### Fixed

- `verifier-agent`, `test-author-agent`, and `drift-reviewer-agent` no longer
  hand code defects to a `bug-fix-agent` that isn't shipped yet — they now
  report the defect directly to the developer until that Phase 2 agent
  lands.

## [0.1.0] — initial public release

- v1 sub-agent roster (9 agents), platform-agnostic build pipeline, resolver
  suite (model tier, capability, trigger, fresh-context), 5 platform
  adapters, `harness` CLI, and the `harness-brain` commit-memory integration.

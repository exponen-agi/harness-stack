#!/usr/bin/env node
/**
 * Baseline agent-spec evals — the seed of a self-improvement loop.
 *
 * Loads every `templates/agents/*.yaml` file and checks a handful of
 * baseline quality rules (non-stub prompt, valid capabilities/triggers,
 * verifier independence, required identity fields). Prints a PASS/FAIL line
 * per agent plus a summary, and exits 1 if anything fails.
 *
 * Also checks the roster as a whole (unique names/commands, file name matches
 * agent name, routable descriptions) and prints safety warnings for agents that
 * read untrusted content AND can write/exec. Add `--strict` to fail on warnings:
 *   npm run eval:agents -- --strict
 *
 * Usage:
 *   npm run eval:agents
 *
 * (Runs under `tsx`, not plain `node` — it imports the schema straight from
 * `src/`, so it needs a TypeScript-aware runtime. `npm run eval:agents`
 * already wires that up; don't invoke this file with plain `node`.)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
// The canonical capability enum lives in src/schema.ts (Zod) — imported
// straight from source (this script runs under `tsx`, not plain `node`, for
// exactly this reason) so eval:agents always checks specs against the code
// that's actually about to ship, never a `dist/` build that's fallen behind
// an unbuilt source change.
import { CAPABILITIES } from "../src/schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const agentsDir = path.resolve(here, "..", "templates", "agents");

const PLACEHOLDER_MARKERS = ["TODO", "FIXME", "{{", "<placeholder>"];
const MIN_PROMPT_LENGTH = 40;

/**
 * Evaluate one parsed agent spec object against the baseline quality rules.
 * Pure function — no filesystem access — so it's unit-testable in isolation.
 *
 * @param {Record<string, unknown>} spec
 * @param {readonly string[]} validTriggers
 * @param {readonly string[]} knownCapabilities
 * @returns {string[]} issues found (empty array = pass)
 */
export function evaluateAgentSpec(spec, validTriggers, knownCapabilities) {
  const issues = [];

  const name = typeof spec?.name === "string" ? spec.name : "";

  for (const field of ["description", "goal"]) {
    const value = spec?.[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      issues.push(`"${field}" must be a non-empty string`);
    }
  }

  const prompt = spec?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    issues.push('"prompt" must be a non-empty string');
  } else {
    if (prompt.length < MIN_PROMPT_LENGTH) {
      issues.push(
        `"prompt" is too short (${prompt.length} chars, minimum ${MIN_PROMPT_LENGTH})`,
      );
    }
    for (const marker of PLACEHOLDER_MARKERS) {
      if (prompt.includes(marker)) {
        issues.push(`"prompt" contains a leftover placeholder marker: ${marker}`);
      }
    }
  }

  const capabilities = spec?.capabilities;
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    issues.push('"capabilities" must be a non-empty array');
  } else {
    for (const cap of capabilities) {
      if (!knownCapabilities.includes(cap)) {
        issues.push(`unknown capability "${cap}" (expected one of: ${knownCapabilities.join(", ")})`);
      }
    }
    // Prefer the explicit `role: verifier` field — a structural marker that
    // survives a rename. Fall back to the old name-substring heuristic only
    // for specs that don't (yet) set `role`, so this stays backward-compatible.
    const isVerifier = spec?.role === "verifier" || name.includes("verifier");
    if (isVerifier && capabilities.includes("write")) {
      issues.push(
        `verifier agent "${name}" must not include "write" in capabilities (can't grade its own homework)`,
      );
    }
  }

  // Fresh-context mandate (docs/spec-subagents.md): any agent that leans on
  // web search, web fetch, or an MCP server must say so via
  // requires_fresh_context, or the promise "fresh-context agents always
  // resolve search + Context7" silently stops being true for that agent.
  const declaredCapabilities = Array.isArray(capabilities) ? capabilities : [];
  const mcpServers = spec?.mcp_servers;
  const needsFreshContext =
    declaredCapabilities.includes("web_search") ||
    declaredCapabilities.includes("web_fetch") ||
    (Array.isArray(mcpServers) && mcpServers.length > 0);
  if (needsFreshContext && spec?.requires_fresh_context !== true) {
    issues.push(
      `agent "${name}" uses web_search/web_fetch/mcp_servers but does not set "requires_fresh_context: true"`,
    );
  }

  const triggers = spec?.triggers;
  if (!Array.isArray(triggers) || triggers.length === 0) {
    issues.push('"triggers" must be a non-empty array');
  } else {
    for (const trigger of triggers) {
      if (!validTriggers.includes(trigger)) {
        issues.push(`unknown trigger "${trigger}" (expected one of: ${validTriggers.join(", ")})`);
      }
    }
  }

  return issues;
}

const MIN_DESCRIPTION_LENGTH = 40;
// A prompt "has a guard" if it calls fetched content untrusted / injection.
const INJECTION_GUARD = /untrusted|prompt[- ]injection/i;

/**
 * Safety lint ("lethal trifecta" check). An agent that can both READ UNTRUSTED
 * CONTENT (web_fetch, web_search, or an MCP server) and CHANGE THINGS (write or
 * exec) can be steered by text hidden in a web page or tool result — a prompt
 * injection. That is not always wrong (dependency-audit-agent needs both), so
 * these are WARNINGS unless the prompt contains a guard line (it mentions
 * "untrusted" or "prompt injection"). Printed, never failing, unless you pass
 * `--strict`.
 * Pure function — no filesystem access.
 *
 * @param {Record<string, unknown>} spec
 * @returns {string[]} warnings (empty array = nothing to flag)
 */
export function lintAgentSafety(spec) {
  const capabilities = Array.isArray(spec?.capabilities) ? spec.capabilities : [];
  const mcpServers = Array.isArray(spec?.mcp_servers) ? spec.mcp_servers : [];
  const readsUntrusted =
    capabilities.includes("web_fetch") ||
    capabilities.includes("web_search") ||
    mcpServers.length > 0;
  const canChange = capabilities.includes("write") || capabilities.includes("exec");
  if (!readsUntrusted || !canChange) return [];
  const prompt = typeof spec?.prompt === "string" ? spec.prompt : "";
  if (INJECTION_GUARD.test(prompt)) return [];
  return [
    `reads untrusted content (web/MCP) AND can ${capabilities
      .filter((c) => c === "write" || c === "exec")
      .join("+")}, but its prompt has no injection guard: add a line saying fetched text is untrusted data, never instructions`,
  ];
}

/**
 * Roster-level checks: rules that only make sense across ALL agents together.
 * Pure function — takes `{ file, spec }` pairs, returns issues per file name.
 *
 * - `name` must equal the file name (so `verifier-agent.yaml` holds `verifier-agent`)
 * - `name` and the slash `command` must be unique (two agents would collide)
 * - `description` must be long enough to route on (AI tools pick an agent by it)
 *
 * @param {{ file: string, spec: Record<string, unknown> }[]} entries
 * @returns {Map<string, string[]>} file -> issues (only files with issues)
 */
export function evaluateRoster(entries) {
  const issues = new Map();
  const add = (file, msg) => issues.set(file, [...(issues.get(file) ?? []), msg]);

  const names = new Map();
  const commands = new Map();
  for (const { file, spec } of entries) {
    const name = typeof spec?.name === "string" ? spec.name : "";
    const expectedFile = `${name}.yaml`;
    if (name && file !== expectedFile) {
      add(file, `file name must match agent name (expected "${expectedFile}")`);
    }
    if (name) names.set(name, [...(names.get(name) ?? []), file]);

    const command = typeof spec?.command === "string" ? spec.command : name.replace(/-agent$/, "");
    if (command) commands.set(command, [...(commands.get(command) ?? []), file]);

    const description = typeof spec?.description === "string" ? spec.description.trim() : "";
    if (description.length > 0 && description.length < MIN_DESCRIPTION_LENGTH) {
      add(
        file,
        `"description" is too short to route on (${description.length} chars, minimum ${MIN_DESCRIPTION_LENGTH}) — say what the agent does and when to use it`,
      );
    }
  }
  for (const [name, files] of names) {
    if (files.length > 1) for (const f of files) add(f, `duplicate agent name "${name}" (${files.join(", ")})`);
  }
  for (const [command, files] of commands) {
    if (files.length > 1) for (const f of files) add(f, `duplicate command "${command}" (${files.join(", ")})`);
  }
  return issues;
}

async function loadTriggerMap() {
  const file = path.join(here, "..", "templates", "trigger-map.yaml");
  const map = YAML.parse(await fs.readFile(file, "utf8"));
  const triggers = new Set();
  for (const platform of Object.values(map)) {
    for (const trigger of Object.keys(platform)) triggers.add(trigger);
  }
  return [...triggers];
}

async function main() {
  const validTriggers = await loadTriggerMap();
  const files = (await fs.readdir(agentsDir)).filter((f) => f.endsWith(".yaml")).sort();

  const strict = process.argv.includes("--strict");
  const entries = [];
  for (const file of files) {
    entries.push({ file, spec: YAML.parse(await fs.readFile(path.join(agentsDir, file), "utf8")) });
  }
  const rosterIssues = evaluateRoster(entries);

  let failures = 0;
  let warnings = 0;
  for (const { file, spec } of entries) {
    const issues = [...evaluateAgentSpec(spec, validTriggers, CAPABILITIES), ...(rosterIssues.get(file) ?? [])];
    const warns = lintAgentSafety(spec);
    warnings += warns.length;
    if (strict) issues.push(...warns.map((w) => `[strict] ${w}`));
    if (issues.length === 0) {
      console.log(`✓ PASS  ${file}`);
    } else {
      failures++;
      console.log(`✗ FAIL  ${file}`);
      for (const issue of issues) console.log(`    - ${issue}`);
    }
    if (!strict) for (const w of warns) console.log(`    ! warning: ${w}`);
  }
  if (warnings > 0 && !strict) {
    console.log(`\n${warnings} safety warning(s). Run with --strict to treat them as failures.`);
  }

  console.log("");
  console.log(
    failures === 0
      ? `${files.length}/${files.length} agent specs passed baseline evals.`
      : `${files.length - failures}/${files.length} agent specs passed baseline evals; ${failures} failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

// Only run the CLI when this file is executed directly (e.g. `node
// scripts/eval-agents.mjs`) — not when `evaluateAgentSpec` is imported for
// unit testing, so importing this module never has side effects.
if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

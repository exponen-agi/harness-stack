#!/usr/bin/env node
/**
 * Baseline agent-spec evals — the seed of a self-improvement loop.
 *
 * Loads every `templates/agents/*.yaml` file and checks a handful of
 * baseline quality rules (non-stub prompt, valid capabilities/triggers,
 * verifier independence, required identity fields). Prints a PASS/FAIL line
 * per agent plus a summary, and exits 1 if anything fails.
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
    if (name.includes("verifier") && capabilities.includes("write")) {
      issues.push(
        `verifier agent "${name}" must not include "write" in capabilities (can't grade its own homework)`,
      );
    }
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

  let failures = 0;
  for (const file of files) {
    const raw = YAML.parse(await fs.readFile(path.join(agentsDir, file), "utf8"));
    const issues = evaluateAgentSpec(raw, validTriggers, CAPABILITIES);
    if (issues.length === 0) {
      console.log(`✓ PASS  ${file}`);
    } else {
      failures++;
      console.log(`✗ FAIL  ${file}`);
      for (const issue of issues) console.log(`    - ${issue}`);
    }
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

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { evaluateAgentSpec } from "../scripts/eval-agents.mjs";
import { CAPABILITIES } from "../src/schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const agentsDir = path.join(here, "..", "templates", "agents");

const validTriggers = ["on_init", "on_commit", "on_check", "on_demand"];

function validSpec(overrides: Record<string, unknown> = {}) {
  return {
    name: "example-agent",
    description: "Does an example thing.",
    goal: "Do the example thing reliably.",
    triggers: ["on_demand"],
    capabilities: ["read", "exec"],
    prompt: "You are an example agent. Do the example thing carefully and well.",
    ...overrides,
  };
}

describe("evaluateAgentSpec", () => {
  it("passes a valid, complete spec with zero issues", () => {
    const issues = evaluateAgentSpec(validSpec(), validTriggers, CAPABILITIES);
    expect(issues).toEqual([]);
  });

  it("fails a spec with a too-short prompt", () => {
    const issues = evaluateAgentSpec(
      validSpec({ prompt: "too short" }),
      validTriggers,
      CAPABILITIES,
    );
    expect(issues.some((i) => i.includes("too short"))).toBe(true);
  });

  it("fails a spec with an unknown capability", () => {
    const issues = evaluateAgentSpec(
      validSpec({ capabilities: ["read", "telekinesis"] }),
      validTriggers,
      CAPABILITIES,
    );
    expect(issues.some((i) => i.includes("unknown capability"))).toBe(true);
  });

  it("fails a spec with an undeclared/unknown trigger", () => {
    const issues = evaluateAgentSpec(
      validSpec({ triggers: ["on_full_moon"] }),
      validTriggers,
      CAPABILITIES,
    );
    expect(issues.some((i) => i.includes("unknown trigger"))).toBe(true);
  });

  it("fails a verifier agent that includes write in its capabilities", () => {
    const issues = evaluateAgentSpec(
      validSpec({
        name: "something-verifier-agent",
        capabilities: ["read", "write"],
      }),
      validTriggers,
      CAPABILITIES,
    );
    expect(issues.some((i) => i.includes("must not include"))).toBe(true);
  });

  it("returns zero issues for every shipped templates/agents/*.yaml spec", async () => {
    const files = (await fs.readdir(agentsDir)).filter((f) => f.endsWith(".yaml"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = YAML.parse(await fs.readFile(path.join(agentsDir, file), "utf8"));
      const issues = evaluateAgentSpec(raw, validTriggers, CAPABILITIES);
      expect(issues, `${file}: ${issues.join("; ")}`).toEqual([]);
    }
  });
});

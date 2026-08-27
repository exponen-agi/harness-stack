import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readYaml } from "../src/util/fsx.js";
import type { ModelMap } from "../src/resolution/model-resolver.js";

// Regression test for a real bug: templates/model-map.yaml once shipped Claude
// model IDs without the mandatory "claude-" prefix (e.g. "opus-4-8" instead
// of "claude-opus-5"). A bare tier name is not a valid Claude model ID, so
// every generated .claude/agents/*.md would have carried a broken `model:`
// field. Every platform resolves models differently, so we only check the
// one rule that's actually true everywhere: a tier value is either the
// literal "inherit" or a non-empty string the platform understands. For
// claude-code specifically we know the extra rule below and enforce it.

const here = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(here, "..", "templates", "model-map.yaml");

describe("templates/model-map.yaml (shipped default)", () => {
  it("gives every claude-code tier a real, prefixed Claude model ID", async () => {
    const map = await readYaml<ModelMap>(templatePath);
    const claudeCode = map["claude-code"];
    expect(claudeCode).toBeTruthy();

    for (const [tier, model] of Object.entries(claudeCode)) {
      if (model === "inherit") continue;
      expect(model, `claude-code.${tier}`).toMatch(/^claude-/);
    }
  });

  it("gives every platform block a resolvable value for each declared tier", async () => {
    const map = await readYaml<ModelMap>(templatePath);
    for (const [platform, tiers] of Object.entries(map)) {
      for (const [tier, model] of Object.entries(tiers)) {
        expect(typeof model, `${platform}.${tier}`).toBe("string");
        expect((model as string).length, `${platform}.${tier}`).toBeGreaterThan(0);
      }
    }
  });
});

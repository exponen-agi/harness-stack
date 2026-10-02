import { describe, it, expect } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

// The templates/evals/ starter kit is copy-pasted by users, and nothing runs it
// in CI (it needs an API key). These checks keep it from rotting silently.

const here = path.dirname(fileURLToPath(import.meta.url));
const evalsDir = path.resolve(here, "..", "templates", "evals");
const read = (name: string) => fs.readFile(path.join(evalsDir, name), "utf8");

describe("templates/evals starter kit", () => {
  it("promptfooconfig.yaml defaults to the model-map 'reasoning' tier for claude-code", async () => {
    const cfg = YAML.parse(await read("promptfooconfig.yaml"));
    const map = YAML.parse(
      await fs.readFile(path.resolve(here, "..", "templates", "model-map.yaml"), "utf8"),
    );
    const providers: { id: string }[] = cfg.providers;
    expect(providers[0]?.id).toBe(`anthropic:messages:${map["claude-code"].reasoning}`);
  });

  it("promptfooconfig.yaml has at least 2 scenarios, each with an assertion", async () => {
    const cfg = YAML.parse(await read("promptfooconfig.yaml"));
    expect(cfg.tests.length).toBeGreaterThanOrEqual(2);
    for (const t of cfg.tests) expect(t.assert?.length, t.description).toBeGreaterThan(0);
  });

  it("eval-gate.example.yml is valid, safe-by-default workflow YAML", async () => {
    const raw = await read("eval-gate.example.yml");
    const wf = YAML.parse(raw);
    expect(wf.on.pull_request).toBeTruthy();
    expect(wf.on).not.toHaveProperty("pull_request_target");
    expect(wf.permissions).toEqual({ contents: "read" });
    expect(wf.jobs.eval["timeout-minutes"]).toBeGreaterThan(0);
    // Secret must never be set at workflow/job level (only on one step).
    expect(JSON.stringify(wf.env ?? {})).not.toContain("ANTHROPIC_API_KEY");
    // It must point at files that actually exist in this kit.
    expect(raw).toContain("templates/evals/promptfooconfig.yaml");
    await expect(read("promptfooconfig.yaml")).resolves.toBeTruthy();
  });
});

import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
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

  it("every npx call in the kit pins an exact version (no @latest, no bare names)", async () => {
    // The paid step holds an API key. Running an unpinned package there would
    // hand the key to whatever version is newest today.
    for (const name of [
      "eval-gate.example.yml",
      "promptfooconfig.yaml",
      "README.md",
    ]) {
      const raw = await read(name);
      expect(raw, `${name} must not use @latest`).not.toMatch(/@latest\b/);
      const calls = [...raw.matchAll(/\bnpx\s+(?:--?[\w-]+\s+)*([@\w./-]+)/g)];
      for (const [, pkg] of calls) {
        expect(pkg, `${name}: "npx ${pkg}" must look like name@x.y.z`).toMatch(
          /^[@\w./-]+@\d+\.\d+\.\d+$/,
        );
      }
    }
  });

  describe("quality gate step", () => {
    const gatePath = path.join(evalsDir, "eval-gate.example.yml");

    /** Run the gate's real inline script against a fake results.json. */
    async function runGate(stats: Record<string, number>): Promise<number> {
      const wf = YAML.parse(await fs.readFile(gatePath, "utf8")) as {
        jobs: Record<string, { steps: { name?: string; run?: string }[] }>;
      };
      const step = Object.values(wf.jobs)
        .flatMap((j) => j.steps)
        .find((st) => st.name?.startsWith("Quality gate"));
      const run = step?.run ?? "";
      const script = run.slice(run.indexOf('"') + 1, run.lastIndexOf('"'));
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gate-"));
      try {
        await fs.writeFile(path.join(dir, "results.json"), JSON.stringify({ results: { stats } }));
        execFileSync(process.execPath, ["-e", script], { cwd: dir, stdio: "pipe" });
        return 0;
      } catch (err) {
        return (err as { status?: number }).status ?? 99;
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    }

    it("passes only when something passed and nothing failed or errored", async () => {
      expect(await runGate({ successes: 4, failures: 0, errors: 0 })).toBe(0);
    });
    it("fails on a failed scenario", async () => {
      expect(await runGate({ successes: 3, failures: 1, errors: 0 })).toBe(1);
    });
    it("fails on a provider error (bad key, outage) — the old gate let this pass", async () => {
      expect(await runGate({ successes: 3, failures: 0, errors: 1 })).toBe(1);
    });
    it("fails when no scenario ran at all", async () => {
      expect(await runGate({ successes: 0, failures: 0, errors: 0 })).toBe(1);
    });
  });
});

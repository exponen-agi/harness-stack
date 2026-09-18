/**
 * Golden-file benchmark for the build pipeline (the next rung on the eval
 * ladder described in docs/factories-as-code.md §5: `npm run eval:agents`
 * checks spec *hygiene*; this checks that compiled *output* doesn't shift
 * unnoticed). It needs no model credentials and no network call — unlike the
 * output-quality evals in templates/evals/, which score an agent's actual
 * responses and therefore do need a real model — so it runs in this repo's
 * own CI on every PR, the same way npm run eval:agents already does.
 *
 * It renders the full v1 roster for every shipped platform and snapshots the
 * generated file contents with Vitest's built-in `toMatchSnapshot()`. A
 * change to a `.subagents/*.yaml` prompt, `model-map.yaml`, `trigger-map.yaml`,
 * or an adapter's rendering logic will fail this test with a diff instead of
 * shipping a silent behaviour change in the files real users' AI tools read.
 * When a diff is intentional, refresh it with `npx vitest run -u` and review
 * the snapshot diff itself as part of the PR — the snapshot file is the
 * benchmark's "expected output," so a reviewer can read exactly what changed.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { parseSubagent, type Subagent } from "../src/schema.js";
import { buildRoster } from "../src/build.js";
import { collectBaseMcpNames } from "../src/project.js";
import type { ModelMap } from "../src/resolution/model-resolver.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tplDir = path.join(here, "..", "templates");

async function loadTemplateAgents(): Promise<Subagent[]> {
  const dir = path.join(tplDir, "agents");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".yaml")).sort();
  const agents: Subagent[] = [];
  for (const f of files) {
    const raw = YAML.parse(await fs.readFile(path.join(dir, f), "utf8"));
    agents.push(parseSubagent(raw, f));
  }
  return agents;
}

async function loadModelMap(): Promise<ModelMap> {
  return YAML.parse(await fs.readFile(path.join(tplDir, "model-map.yaml"), "utf8"));
}

describe("build output benchmark (golden-file snapshot)", () => {
  const platforms = ["claude-code", "antigravity", "codex", "cursor", "copilot"];

  it.each(platforms)("%s roster output matches its committed snapshot", async (platform) => {
    const agents = await loadTemplateAgents();
    const modelMap = await loadModelMap();
    const baseMcpNames = collectBaseMcpNames(agents);

    const report = buildRoster(agents, { platform, modelMap, baseMcpNames });
    expect(report.errors).toEqual([]);

    // Snapshot relPath + contents per agent, sorted for a stable diff order
    // regardless of the roster's internal iteration order.
    const rendered = report.results
      .map((r) => ({
        relPath: r.file.relPath,
        contents: r.file.contents,
        manualFiles: r.manualFiles.map((m) => ({ relPath: m.relPath, contents: m.contents })),
      }))
      .sort((a, b) => a.relPath.localeCompare(b.relPath));

    expect(rendered).toMatchSnapshot();
  });
});

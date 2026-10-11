import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSubagent, type Subagent } from "../src/schema.js";
import { readYaml } from "../src/util/fsx.js";

/**
 * The agent tables in README.md and docs/factories-as-code.md are written by
 * hand. CONTRIBUTING.md used to say "no automated check" for them. This test
 * is that check: if you add, remove or re-trigger an agent in
 * templates/agents/*.yaml and forget the docs, CI fails here.
 *
 * Line endings are normalised first so the test passes on Windows checkouts
 * (core.autocrlf) as well as Mac and Linux.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = path.join(root, "templates", "agents");

async function loadAgents(): Promise<Subagent[]> {
  const files = (await fs.readdir(agentsDir)).filter((f) => f.endsWith(".yaml"));
  return Promise.all(
    files.map(async (f) => parseSubagent(await readYaml(path.join(agentsDir, f)))),
  );
}

async function readDoc(...parts: string[]): Promise<string> {
  const text = await fs.readFile(path.join(root, ...parts), "utf8");
  return text.replace(/\r\n/g, "\n");
}

/** Return the table rows (as cell arrays) that start with an `agent-name` cell. */
export function agentRows(markdown: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of markdown.split("\n")) {
    const m = /^\|\s*`([a-z0-9-]+-agent)`\s*\|(.*)\|\s*$/.exec(line);
    if (!m) continue;
    rows.set(m[1]!, m[2]!.split("|").map((c) => c.trim()));
  }
  return rows;
}

describe("agentRows (helper)", () => {
  it("reads agent rows and ignores everything else", () => {
    const md = "| Agent | Tier |\n| --- | --- |\n| `a-agent` | fast | x |\nplain text";
    expect([...agentRows(md).keys()]).toEqual(["a-agent"]);
    expect(agentRows(md).get("a-agent")).toEqual(["fast", "x"]);
  });
});

describe("docs list exactly the shipped agents", () => {
  it("README 'v1 agent catalog' matches templates/agents (names + tier)", async () => {
    const agents = await loadAgents();
    const rows = agentRows(await readDoc("README.md"));
    expect([...rows.keys()].sort()).toEqual(agents.map((a) => a.name).sort());
    for (const a of agents) {
      expect(rows.get(a.name)![0], `${a.name} tier in README`).toBe(a.model_tier);
    }
  });

  it("factories-as-code roster matches templates/agents (names + triggers + write access)", async () => {
    const agents = await loadAgents();
    const rows = agentRows(await readDoc("docs", "factories-as-code.md"));
    expect([...rows.keys()].sort()).toEqual(agents.map((a) => a.name).sort());
    for (const a of agents) {
      const [triggerCell, , writeCell] = rows.get(a.name)!;
      const documented = [...triggerCell!.matchAll(/`(on_[a-z]+)`/g)].map((m) => m[1]!).sort();
      expect(documented, `${a.name} triggers in docs`).toEqual([...a.triggers].sort());
      const canWrite = a.capabilities.includes("write");
      expect(writeCell!.startsWith("Yes"), `${a.name} write access in docs`).toBe(canWrite);
    }
  });
});

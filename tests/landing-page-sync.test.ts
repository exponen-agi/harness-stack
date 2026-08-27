import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSubagent, exposesSkill } from "../src/schema.js";
import { readYaml } from "../src/util/fsx.js";

/**
 * docs/index.html is the GitHub Pages landing site. It restates the agent
 * roster and the install command in hand-maintained JS constants, and
 * CONTRIBUTING.md warns there is no automated check keeping them honest.
 *
 * That gap shipped two real bugs: the page advertised `git+https://…` — the
 * install form the README documents as never creating the `harness`
 * launcher — and it claimed "4 decision-routed" skills when five agents
 * expose one. Both were invisible to CI. These tests close that gap by
 * checking the page against the actual source of truth.
 *
 * The page is intentionally dependency-free, so we read the constants with
 * narrow regexes rather than adding an HTML/JS parser.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const indexHtmlPath = path.join(repoRoot, "docs", "index.html");
const agentsDir = path.join(repoRoot, "templates", "agents");

async function readIndexHtml(): Promise<string> {
  return fs.readFile(indexHtmlPath, "utf8");
}

async function loadShippedAgents() {
  const files = (await fs.readdir(agentsDir)).filter((f) => f.endsWith(".yaml"));
  return Promise.all(
    files.map(async (f) => parseSubagent(await readYaml(path.join(agentsDir, f)))),
  );
}

/** Pull the `var AGENTS = [ ... ];` block out of the landing page. */
function extractAgentsBlock(html: string): string {
  const match = html.match(/var AGENTS = \[([\s\S]*?)\];/);
  if (!match?.[1]) throw new Error("could not find `var AGENTS = [...]` in docs/index.html");
  return match[1];
}

/** Parse the `id` and `triggers` of each entry in the AGENTS block. */
function parseAgentEntries(block: string): { id: string; triggers: string[] }[] {
  const entries: { id: string; triggers: string[] }[] = [];
  for (const line of block.split("\n")) {
    const id = line.match(/id:\s*'([^']+)'/)?.[1];
    if (!id) continue;
    const triggersRaw = line.match(/triggers:\s*\[([^\]]*)\]/)?.[1] ?? "";
    const triggers = [...triggersRaw.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
    entries.push({ id, triggers });
  }
  return entries;
}

describe("docs/index.html stays in sync with templates/agents/", () => {
  it("lists exactly the shipped agents, no more and no fewer", async () => {
    const [html, agents] = await Promise.all([readIndexHtml(), loadShippedAgents()]);
    const onPage = parseAgentEntries(extractAgentsBlock(html))
      .map((e) => e.id)
      .sort();
    const shipped = agents.map((a) => a.name).sort();
    expect(onPage).toEqual(shipped);
  });

  it("shows the same triggers each agent actually declares", async () => {
    const [html, agents] = await Promise.all([readIndexHtml(), loadShippedAgents()]);
    const onPage = parseAgentEntries(extractAgentsBlock(html));
    const byName = new Map(agents.map((a) => [a.name, a]));

    for (const entry of onPage) {
      const spec = byName.get(entry.id);
      expect(spec, `${entry.id} is on the landing page but not in templates/agents/`).toBeTruthy();
      expect([...entry.triggers].sort(), `triggers for ${entry.id}`).toEqual(
        [...spec!.triggers].sort(),
      );
    }
  });

  it("states the real number of decision-routed skills", async () => {
    const [html, agents] = await Promise.all([readIndexHtml(), loadShippedAgents()]);
    const actual = agents.filter((a) => exposesSkill(a)).length;
    const claimed = html.match(/\((\d+) decision-routed\)/)?.[1];
    expect(claimed, "no '(N decision-routed)' claim found in docs/index.html").toBeTruthy();
    expect(Number(claimed)).toBe(actual);
  });
});

describe("docs/index.html advertises a working install command", () => {
  it("does not use the git+https form the README documents as broken", async () => {
    const html = await readIndexHtml();
    // `npm install -g git+https://…` links the package into npm's temp cache
    // instead of copying it, so the `harness` launcher is never created.
    expect(html).not.toContain("git+https://");
  });

  it("uses the same install command the README tells people to run", async () => {
    const [html, readme] = await Promise.all([
      readIndexHtml(),
      fs.readFile(path.join(repoRoot, "README.md"), "utf8"),
    ]);
    const pageCmd = html.match(/<code id="install-cmd">([^<]+)<\/code>/)?.[1];
    expect(pageCmd, "no install-cmd element found in docs/index.html").toBeTruthy();
    expect(readme).toContain(pageCmd!.trim());
  });
});

describe("repository URLs point at the current org", () => {
  it("has no stale cloudbloqavi org URLs outside the parity-locked brain template", async () => {
    // templates/brain/ must stay byte-identical to the harness-brain repo, so
    // its URLs can only change in lockstep with a companion PR there.
    const checked = [
      "README.md",
      "CONTRIBUTING.md",
      "docs/index.html",
      "docs/spec-subagents.md",
      ".github/workflows/ci.yml",
      "src/brain/setup.ts",
    ];
    for (const rel of checked) {
      const text = await fs.readFile(path.join(repoRoot, rel), "utf8");
      expect(text, `${rel} still points at the old org`).not.toContain(
        "github.com/cloudbloqavi/",
      );
    }
  });
});

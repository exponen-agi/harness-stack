import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { parseSubagent } from "../src/schema.js";
import {
  renderAgentCard,
  selectAgents,
  TRIGGER_MEANING,
} from "../src/commands/explain.js";
import { TRIGGERS } from "../src/schema.js";
import type { TriggerMap } from "../src/resolution/trigger-resolver.js";

const agentsDir = path.resolve(__dirname, "../templates/agents");
const map = parse(
  await fs.readFile(path.resolve(__dirname, "../templates/trigger-map.yaml"), "utf8"),
) as TriggerMap;
const agents = await Promise.all(
  (await fs.readdir(agentsDir))
    .filter((f) => f.endsWith(".yaml"))
    .map(async (f) =>
      parseSubagent(parse(await fs.readFile(path.join(agentsDir, f), "utf8")), f),
    ),
);

describe("explain", () => {
  it("has a plain-English meaning for every trigger", () => {
    for (const t of TRIGGERS) expect(TRIGGER_MEANING[t]).toBeTruthy();
  });

  it("selects by full name, short name, or nothing", () => {
    expect(selectAgents(agents, "verifier-agent")).toHaveLength(1);
    expect(selectAgents(agents, "Verifier")).toHaveLength(1);
    expect(selectAgents(agents)).toHaveLength(agents.length);
    expect(selectAgents(agents, "nope")).toHaveLength(0);
  });

  it("renders a card for every shipped agent on every platform", () => {
    for (const platform of Object.keys(map)) {
      for (const a of agents) {
        const text = renderAgentCard(a, platform, map).join("\n");
        expect(text).toContain(a.name);
        expect(text).toContain("Runs:");
      }
    }
  });

  it("says a read-only agent cannot change files, and shows its slash command", () => {
    const verifier = agents.find((a) => a.name === "verifier-agent")!;
    const text = renderAgentCard(verifier, "claude-code", map).join("\n");
    expect(text).toContain("cannot change your files");
    expect(text).toContain("/verify");
  });
});

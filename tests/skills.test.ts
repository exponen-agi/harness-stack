import { describe, it, expect } from "vitest";
import {
  parseSubagent,
  commandName,
  exposesSkill,
  exposesCommand,
} from "../src/schema.js";
import { claudeCodeAdapter } from "../src/adapters/claude-code.js";
import { cursorAdapter } from "../src/adapters/cursor.js";
import { codexAdapter } from "../src/adapters/codex.js";
import { antigravityAdapter } from "../src/adapters/antigravity.js";
import { copilotAdapter } from "../src/adapters/copilot.js";
import { buildRoster } from "../src/build.js";
import type { ModelMap } from "../src/resolution/model-resolver.js";
import type { PlatformAdapter } from "../src/adapters/types.js";

function agent(overrides: Record<string, unknown> = {}) {
  return parseSubagent({
    name: "demo-agent",
    description: "Demo agent.",
    goal: "Do the demo thing.",
    type: "on-demand",
    model_tier: "fast",
    capabilities: ["read"],
    prompt: "You are the demo agent.",
    ...overrides,
  });
}

describe("schema: invocation surfaces", () => {
  it("defaults expose_as to [subagent]", () => {
    const a = agent();
    expect(a.expose_as).toEqual(["subagent"]);
    expect(exposesSkill(a)).toBe(false);
    expect(exposesCommand(a)).toBe(false);
  });

  it("derives the command name by stripping -agent", () => {
    expect(commandName(agent())).toBe("demo");
    expect(commandName(agent({ command: "do-it" }))).toBe("do-it");
  });

  it("reads skill/command exposure flags", () => {
    const a = agent({ expose_as: ["subagent", "skill", "command"] });
    expect(exposesSkill(a)).toBe(true);
    expect(exposesCommand(a)).toBe(true);
  });
});

function manualCtx(overrides: Partial<{ wantsSkill: boolean; wantsCommand: boolean }> = {}) {
  return {
    agent: agent({ command: "demo" }),
    platform: "claude-code",
    command: "demo",
    wantsSkill: true,
    wantsCommand: true,
    ...overrides,
  };
}

describe("claude-code adapter: skill + command artifacts", () => {
  it("is verified and emits a SKILL.md + slash command (thin launchers)", () => {
    expect(claudeCodeAdapter.skillSupport.verified).toBe(true);
    const files = claudeCodeAdapter.renderManual!(manualCtx());
    const paths = files.map((f) => f.relPath).sort();
    expect(paths).toEqual([".claude/commands/demo.md", ".claude/skills/demo/SKILL.md"]);
    const skill = files.find((f) => f.relPath.endsWith("SKILL.md"))!;
    expect(skill.contents).toContain("name: demo");
    // Thin launcher → points at the canonical spec, not an inlined prompt.
    expect(skill.contents).toContain(".subagents/demo-agent.yaml");
  });

  it("emits only the requested surface", () => {
    const skillOnly = claudeCodeAdapter.renderManual!(manualCtx({ wantsCommand: false }));
    expect(skillOnly.map((f) => f.relPath)).toEqual([".claude/skills/demo/SKILL.md"]);
    const cmdOnly = claudeCodeAdapter.renderManual!(manualCtx({ wantsSkill: false }));
    expect(cmdOnly.map((f) => f.relPath)).toEqual([".claude/commands/demo.md"]);
  });
});

describe("platform-specific verified manual mappings", () => {
  const base = { agent: agent({ command: "demo" }), command: "demo", wantsSkill: true, wantsCommand: true };

  it("cursor: .cursor/skills + .cursor/commands", () => {
    expect(cursorAdapter.skillSupport.verified).toBe(true);
    const paths = cursorAdapter.renderManual!({ ...base, platform: "cursor" }).map((f) => f.relPath).sort();
    expect(paths).toEqual([".cursor/commands/demo.md", ".cursor/skills/demo/SKILL.md"]);
  });

  it("codex: single Agent-Skill file; command-only disables implicit invocation", () => {
    const both = codexAdapter.renderManual!({ ...base, platform: "codex" });
    expect(both.map((f) => f.relPath)).toEqual([".agents/skills/demo/SKILL.md"]);
    expect(both[0]!.contents).not.toContain("allow_implicit_invocation");
    const cmdOnly = codexAdapter.renderManual!({ ...base, platform: "codex", wantsSkill: false });
    expect(cmdOnly[0]!.contents).toContain("allow_implicit_invocation: false");
  });

  it("antigravity: sub-agent IS the skill; renderManual emits only the workflow", () => {
    expect(antigravityAdapter.subagentIsSkill).toBe(true);
    const paths = antigravityAdapter.renderManual!({ ...base, platform: "antigravity" }).map((f) => f.relPath);
    expect(paths).toEqual([".agents/workflows/demo.md"]);
  });

  it("copilot: custom agent IS the skill; renderManual emits only the prompt file", () => {
    expect(copilotAdapter.subagentIsSkill).toBe(true);
    const paths = copilotAdapter.renderManual!({ ...base, platform: "copilot" }).map((f) => f.relPath);
    expect(paths).toEqual([".github/prompts/demo.prompt.md"]);
  });
});

describe("verified sub-agent (render) conventions", () => {
  const a = agent({ name: "demo-agent" });
  const model = { effectiveTier: "fast" as const, model: "M-1", warning: undefined };
  const r = (adapter: PlatformAdapter) =>
    adapter.render({ agent: a, platform: adapter.id, model, tools: ["read_file"], unsupportedCapabilities: [] });

  it("claude-code: .claude/agents/<name>.md", () => {
    expect(claudeCodeAdapter.agentRelPath("demo-agent")).toBe(".claude/agents/demo-agent.md");
    expect(r(claudeCodeAdapter).relPath).toBe(".claude/agents/demo-agent.md");
  });

  it("cursor: .cursor/agents/<name>.md with YAML frontmatter (readonly/is_background)", () => {
    const f = r(cursorAdapter);
    expect(f.relPath).toBe(".cursor/agents/demo-agent.md");
    expect(f.contents.startsWith("---\n")).toBe(true);
    expect(f.contents).toContain("readonly: true"); // no write capability
    expect(f.contents).toContain("is_background:");
  });

  it("codex: .codex/agents/<name>.toml (TOML developer_instructions)", () => {
    const f = r(codexAdapter);
    expect(f.relPath).toBe(".codex/agents/demo-agent.toml");
    expect(f.contents).toContain('name = "demo-agent"');
    expect(f.contents).toContain("developer_instructions = ");
    expect(f.contents).toContain('sandbox_mode = "read-only"'); // no write capability
  });

  it("antigravity: .agents/skills/<name>/SKILL.md with the full prompt", () => {
    const f = r(antigravityAdapter);
    expect(f.relPath).toBe(".agents/skills/demo-agent/SKILL.md");
    expect(f.contents).toContain("You are the demo agent."); // full prompt, not a launcher
  });

  it("copilot: .github/agents/<name>.agent.md custom agent with the full prompt", () => {
    const f = r(copilotAdapter);
    expect(f.relPath).toBe(".github/agents/demo-agent.agent.md");
    expect(f.contents).toContain("You are the demo agent.");
  });
});

const modelMap: ModelMap = {
  "claude-code": { fast: "F", reasoning: "R", deep: "D", inherit: "inherit" },
  cursor: { fast: "inherit", reasoning: "inherit", deep: "inherit", inherit: "inherit" },
};

describe("buildRoster: manual files", () => {
  it("emits skill + command files only for exposed agents (claude-code)", () => {
    const agents = [
      agent({ name: "router-agent", expose_as: ["subagent", "skill", "command"], command: "route" }),
      agent({ name: "plain-agent" }), // subagent-only
    ];
    const report = buildRoster(agents, {
      platform: "claude-code",
      modelMap,
      baseMcpNames: new Set(),
    });
    expect(report.errors).toEqual([]);
    const router = report.results.find((r) => r.agent.name === "router-agent")!;
    const plain = report.results.find((r) => r.agent.name === "plain-agent")!;
    expect(router.manualFiles.map((f) => f.relPath).sort()).toEqual([
      ".claude/commands/route.md",
      ".claude/skills/route/SKILL.md",
    ]);
    expect(plain.manualFiles).toEqual([]);
    expect(report.notes).toEqual([]);
  });

  it("emits a verified command file on cursor with no pending note", () => {
    const agents = [
      agent({ name: "router-agent", expose_as: ["subagent", "command"], command: "route" }),
    ];
    const report = buildRoster(agents, {
      platform: "cursor",
      modelMap,
      baseMcpNames: new Set(),
    });
    expect(report.errors).toEqual([]);
    expect(report.results[0]!.manualFiles.map((f) => f.relPath)).toEqual([
      ".cursor/commands/route.md",
    ]);
    expect(report.notes).toEqual([]);
  });
});

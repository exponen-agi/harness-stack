import { describe, it, expect } from "vitest";
import {
  parseSubagent,
  commandName,
  exposesSkill,
  exposesCommand,
  SubagentValidationError,
} from "../src/schema.js";

const base = {
  name: "example-agent",
  description: "Does an example thing.",
  goal: "Do the example thing reliably.",
  type: "on-demand",
  model_tier: "reasoning",
  capabilities: ["read"],
  prompt: "You are an example agent. Do the example thing carefully and well.",
};

describe("parseSubagent", () => {
  it("parses a minimal valid spec and applies defaults", () => {
    const agent = parseSubagent(base);
    expect(agent.version).toBe("1.0.0");
    expect(agent.triggers).toEqual(["on_demand"]);
    expect(agent.expose_as).toEqual(["subagent"]);
    expect(agent.requires_fresh_context).toBe(false);
    expect(agent.role).toBeUndefined();
  });

  it("accepts an explicit role", () => {
    const agent = parseSubagent({ ...base, role: "verifier" });
    expect(agent.role).toBe("verifier");
  });

  it("throws SubagentValidationError with readable issues for an invalid model_tier", () => {
    expect(() => parseSubagent({ ...base, model_tier: "legendary" }, "bad.yaml")).toThrow(
      SubagentValidationError,
    );
    try {
      parseSubagent({ ...base, model_tier: "legendary" }, "bad.yaml");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SubagentValidationError);
      const e = err as SubagentValidationError;
      expect(e.file).toBe("bad.yaml");
      expect(e.issues.some((i) => i.includes("model_tier"))).toBe(true);
      expect(e.message).toContain("bad.yaml");
    }
  });

  it("throws for an invalid role", () => {
    expect(() => parseSubagent({ ...base, role: "manager" })).toThrow(
      SubagentValidationError,
    );
  });

  it("throws for an invalid trigger", () => {
    expect(() =>
      parseSubagent({ ...base, triggers: ["on_full_moon"] }),
    ).toThrow(SubagentValidationError);
  });

  it("rejects unknown top-level fields (strict schema)", () => {
    expect(() => parseSubagent({ ...base, made_up_field: true })).toThrow(
      SubagentValidationError,
    );
  });
});

describe("commandName", () => {
  it("strips a trailing -agent suffix by default", () => {
    expect(commandName({ name: "commit-brain-agent", command: undefined })).toBe(
      "commit-brain",
    );
  });

  it("prefers an explicit command over the derived name", () => {
    expect(commandName({ name: "verifier-agent", command: "verify" })).toBe(
      "verify",
    );
  });
});

describe("exposesSkill / exposesCommand", () => {
  it("reflects the expose_as array", () => {
    const agent = { expose_as: ["subagent", "skill"] as const };
    expect(exposesSkill(agent)).toBe(true);
    expect(exposesCommand(agent)).toBe(false);
  });

  it("is false for both when expose_as only has subagent", () => {
    const agent = { expose_as: ["subagent"] as const };
    expect(exposesSkill(agent)).toBe(false);
    expect(exposesCommand(agent)).toBe(false);
  });
});

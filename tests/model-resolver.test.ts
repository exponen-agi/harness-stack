import { describe, it, expect } from "vitest";
import { resolveModel, type ModelMap } from "../src/resolution/model-resolver.js";
import type { ModelTier, Subagent } from "../src/schema.js";

const map: ModelMap = {
  "claude-code": { fast: "haiku-4-5", reasoning: "sonnet-4-6", deep: "opus-4-8", inherit: "inherit" },
  // antigravity intentionally lacks a distinct `deep` to test fallback
  antigravity: { fast: "gemini-3.5-flash", reasoning: "gemini-3-pro", inherit: "inherit" },
};

const agent = (
  tier: ModelTier,
  overrides: Record<string, string> = {},
): Pick<Subagent, "model_tier" | "model_overrides"> => ({
  model_tier: tier,
  model_overrides: overrides,
});

describe("resolveModel (R3)", () => {
  it("resolves a tier to the concrete model per platform", () => {
    expect(resolveModel(agent("deep"), "claude-code", map).model).toBe("opus-4-8");
    expect(resolveModel(agent("fast"), "antigravity", map).model).toBe("gemini-3.5-flash");
  });

  it("lets model_overrides[platform] win", () => {
    const r = resolveModel(agent("fast", { "claude-code": "opus-4-8" }), "claude-code", map);
    expect(r.model).toBe("opus-4-8");
    expect(r.fellBack).toBe(false);
  });

  it("falls back to the next tier down with a warning when a tier is missing", () => {
    const r = resolveModel(agent("deep"), "antigravity", map);
    expect(r.model).toBe("gemini-3-pro");
    expect(r.fellBack).toBe(true);
    expect(r.effectiveTier).toBe("reasoning");
    expect(r.warning).toMatch(/falling back/);
  });

  it("throws a clear error for an unknown platform", () => {
    expect(() => resolveModel(agent("fast"), "nope", map)).toThrow(/model map entry/);
  });
});

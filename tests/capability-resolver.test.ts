import { describe, it, expect } from "vitest";
import {
  resolveCapabilities,
  hasResolvableSearch,
  CAPABILITY_MAPS,
} from "../src/resolution/capability-resolver.js";

const PLATFORMS = ["claude-code", "antigravity", "codex", "cursor", "copilot"];

describe("resolveCapabilities across all v1 platforms", () => {
  it("resolves every capability to at least one native tool on every platform", () => {
    for (const platform of PLATFORMS) {
      for (const capability of [
        "read",
        "write",
        "exec",
        "web_search",
        "web_fetch",
      ] as const) {
        const { tools, unsupported } = resolveCapabilities([capability], platform);
        expect(unsupported, `${platform}/${capability}`).toEqual([]);
        expect(tools.length, `${platform}/${capability}`).toBeGreaterThan(0);
      }
    }
  });

  it("de-duplicates tools shared across requested capabilities", () => {
    // claude-code's `read` capability maps to Read/Grep/Glob, none of which
    // overlap with `write` (Write/Edit) — assert the combined set has no
    // duplicate entries regardless.
    const { tools } = resolveCapabilities(["read", "read"], "claude-code");
    expect(tools).toEqual([...new Set(tools)]);
  });

  it("throws a clear error for an unregistered platform", () => {
    expect(() => resolveCapabilities(["read"], "not-a-real-platform")).toThrow(
      /No capability map for platform "not-a-real-platform"/,
    );
  });

  it("reports unsupported capabilities instead of silently dropping them", () => {
    // Every real platform maps every capability today, so exercise the
    // "platform is missing a mapping" branch by temporarily removing one
    // entry from the shared map, then restoring it.
    const saved = CAPABILITY_MAPS["claude-code"].write;
    // @ts-expect-error -- deliberately deleting to test the fallback branch
    delete CAPABILITY_MAPS["claude-code"].write;
    try {
      const { tools, unsupported } = resolveCapabilities(
        ["read", "write"],
        "claude-code",
      );
      expect(unsupported).toEqual(["write"]);
      expect(tools).not.toContain("Write");
    } finally {
      CAPABILITY_MAPS["claude-code"].write = saved;
    }
  });
});

describe("hasResolvableSearch", () => {
  it("is true for every v1 platform (all ship a web_search mapping)", () => {
    for (const platform of PLATFORMS) {
      expect(hasResolvableSearch(platform), platform).toBe(true);
    }
  });

  it("is false for an unregistered platform", () => {
    expect(hasResolvableSearch("not-a-real-platform")).toBe(false);
  });
});

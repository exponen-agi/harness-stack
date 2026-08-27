import { describe, it, expect } from "vitest";
import { calculateMaxParallel } from "../src/orchestrator/scheduler.js";
import { parseSubagent, type Subagent } from "../src/schema.js";

type Priority = "high" | "normal" | "low";

function mk(name: string, priority: Priority, mem: number, parallelizable = true): Subagent {
  return parseSubagent({
    name,
    description: "d",
    goal: "g",
    type: "on-demand",
    model_tier: "fast",
    capabilities: ["read"],
    parallelizable,
    resource_hint: { priority, max_memory_mb: mem },
    prompt: "p",
  });
}

describe("calculateMaxParallel (R6)", () => {
  it("caps at cpuCount - 1 and within the 70% memory budget", () => {
    // 4 cores → cpu cap 3. 2 GB free → budget ~1434 MB.
    const agents = [
      mk("a", "normal", 256),
      mk("b", "normal", 256),
      mk("c", "normal", 256),
      mk("d", "normal", 256),
    ];
    const plan = calculateMaxParallel(agents, { cpuCount: 4, freeMemMB: 2048 });
    expect(plan.maxByCpu).toBe(3);
    expect(plan.batch.length).toBeLessThanOrEqual(3);
    expect(plan.batch.length + plan.deferred.length).toBe(4);
  });

  it("runs high priority before low when constrained", () => {
    const agents = [
      mk("low1", "low", 256),
      mk("high1", "high", 256),
      mk("low2", "low", 256),
      mk("high2", "high", 256),
    ];
    const plan = calculateMaxParallel(agents, { cpuCount: 3, freeMemMB: 4096 });
    // cpu cap = 2, both high-priority should be selected first
    expect(plan.batch.map((a) => a.name).sort()).toEqual(["high1", "high2"]);
  });

  it("separates non-parallelizable agents into sequential", () => {
    const agents = [mk("seq", "high", 256, false), mk("par", "high", 256, true)];
    const plan = calculateMaxParallel(agents, { cpuCount: 8, freeMemMB: 8192 });
    expect(plan.sequential.map((a) => a.name)).toEqual(["seq"]);
    expect(plan.batch.map((a) => a.name)).toEqual(["par"]);
  });
});

import type { Subagent } from "../schema.js";
export declare const DEFAULT_AGENT_MEMORY_MB = 256;
export interface SchedulerEnv {
    cpuCount: number;
    freeMemMB: number;
}
export declare function currentEnv(): SchedulerEnv;
export interface ParallelPlan {
    /** Agents selected to run in this batch. */
    batch: Subagent[];
    /** Parallelizable agents deferred because of the resource cap. */
    deferred: Subagent[];
    /** Agents that cannot run in parallel; run sequentially. */
    sequential: Subagent[];
    maxByCpu: number;
}
/**
 * Compute the next batch of agents to spawn in parallel.
 *
 * 1. Candidate pool = parallelizable agents that are ready.
 * 2. CPU cap = max(1, cpuCount - 1) — leave a core for the developer.
 * 3. Memory cap = accumulate max_memory_mb until freeMemMB * 0.7 is consumed
 *    (missing hint ⇒ 256 MB).
 * 4. Batch = min(cpu cap, agents that fit in memory).
 * 5. Schedule high priority first; low priority is deferred when capped.
 */
export declare function calculateMaxParallel(readyAgents: Subagent[], env?: SchedulerEnv): ParallelPlan;
//# sourceMappingURL=scheduler.d.ts.map
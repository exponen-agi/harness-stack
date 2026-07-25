/**
 * Resource-aware spawning (spec R6).
 *
 * The orchestrator decides how many parallelizable agents may run at once,
 * capped by CPU and free memory, prioritising high-priority work.
 */
import os from "node:os";
export const DEFAULT_AGENT_MEMORY_MB = 256;
const MEMORY_HEADROOM = 0.7; // use at most 70% of free memory
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };
export function currentEnv() {
    return {
        cpuCount: os.cpus().length,
        freeMemMB: os.freemem() / 1024 / 1024,
    };
}
function memOf(agent) {
    return agent.resource_hint.max_memory_mb ?? DEFAULT_AGENT_MEMORY_MB;
}
function byPriority(a, b) {
    return ((PRIORITY_RANK[a.resource_hint.priority] ?? 1) -
        (PRIORITY_RANK[b.resource_hint.priority] ?? 1));
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
export function calculateMaxParallel(readyAgents, env = currentEnv()) {
    const sequential = readyAgents.filter((a) => !a.parallelizable);
    const pool = readyAgents.filter((a) => a.parallelizable).sort(byPriority);
    const maxByCpu = Math.max(1, env.cpuCount - 1);
    const memBudget = env.freeMemMB * MEMORY_HEADROOM;
    const batch = [];
    const deferred = [];
    let memUsed = 0;
    for (const agent of pool) {
        const need = memOf(agent);
        const fitsCpu = batch.length < maxByCpu;
        const fitsMem = memUsed + need <= memBudget || batch.length === 0;
        if (fitsCpu && fitsMem) {
            batch.push(agent);
            memUsed += need;
        }
        else {
            deferred.push(agent);
        }
    }
    return { batch, deferred, sequential, maxByCpu };
}
//# sourceMappingURL=scheduler.js.map
/**
 * `harness check` — plan the orchestration for check-triggered agents.
 *
 * Sub-agents execute on the host platform's agent loop (Harness does not
 * replace it). What Harness owns is the *schedule*: which agents are ready,
 * which run in parallel, and the resource-aware batch (spec R6). This command
 * computes and prints that plan; with `--all` it includes every on_check /
 * on_demand reviewer.
 */
import { loadSubagents } from "../project.js";
import { calculateMaxParallel, currentEnv } from "../orchestrator/scheduler.js";
import { log } from "../util/log.js";
export async function runCheck(opts) {
    const agents = await loadSubagents(opts.root);
    const ready = agents.filter((a) => {
        if (opts.all)
            return a.triggers.includes("on_check") || a.triggers.includes("on_demand");
        return a.triggers.includes("on_check");
    });
    if (ready.length === 0) {
        log.warn("No agents triggered for this check.");
        return;
    }
    const env = currentEnv();
    const plan = calculateMaxParallel(ready, env);
    log.step(`Check plan — ${env.cpuCount} CPUs, ${Math.round(env.freeMemMB)} MB free ` +
        `(CPU cap ${plan.maxByCpu})`);
    const fmt = (a) => `${a.name} [${a.resource_hint.priority}, ` +
        `${a.resource_hint.max_memory_mb ?? 256}MB, ${a.model_tier}]`;
    if (plan.batch.length) {
        log.info(`Run in parallel (${plan.batch.length}):`);
        plan.batch.forEach((a) => log.ok(`  ${fmt(a)}`));
    }
    if (plan.deferred.length) {
        log.info("Deferred (resource cap):");
        plan.deferred.forEach((a) => log.detail(`  ${fmt(a)}`));
    }
    if (plan.sequential.length) {
        log.info("Run sequentially (not parallelizable):");
        plan.sequential.forEach((a) => log.detail(`  ${fmt(a)}`));
    }
}
//# sourceMappingURL=check.js.map
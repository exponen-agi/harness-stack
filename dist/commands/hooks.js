/**
 * `harness hooks` — show how each agent's abstract triggers resolve to the
 * active platform's native event hooks, and where Harness falls back to its own
 * trigger because the platform has no equivalent.
 */
import { loadSubagents, loadTriggerMap } from "../project.js";
import { resolveAgentTriggers, describeBinding, } from "../resolution/trigger-resolver.js";
import { log } from "../util/log.js";
export async function runHooks(opts) {
    const agents = await loadSubagents(opts.root);
    if (agents.length === 0) {
        log.warn("No .subagents/*.yaml found. Run `harness init` first.");
        return;
    }
    const map = await loadTriggerMap(opts.root);
    log.step(`Hook wiring plan — platform=${opts.platform}`);
    let unverified = 0;
    let fallbacks = 0;
    for (const agent of agents) {
        log.info(agent.name);
        for (const r of resolveAgentTriggers(agent.triggers, opts.platform, map)) {
            const mark = r.fellBack ? "↺" : "✓";
            log.detail(`${mark} ${r.trigger}  ->  ${describeBinding(r.binding)}`);
            if (r.binding.verified === false)
                unverified++;
            if (r.fellBack)
                fallbacks++;
        }
    }
    log.step("Summary");
    log.detail(`${fallbacks} trigger(s) use a Harness fallback (no native hook).`);
    if (unverified > 0) {
        log.warn(`${unverified} binding(s) are unverified defaults — the harness-init-agent ` +
            `should confirm them against current ${opts.platform} docs.`);
    }
    else {
        log.ok("All resolved bindings are marked verified.");
    }
}
//# sourceMappingURL=hooks.js.map
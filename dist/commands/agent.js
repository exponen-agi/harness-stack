/**
 * `harness agent list` (spec R12) and `harness agent create <task>` (R11).
 *
 * `create` runs the discovery & reuse workflow (R2): exact match → similarity
 * (≥0.75) → create new, all consent-gated. The `.subagents/` folder is never
 * written without consent.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { loadSubagents, projectPaths } from "../project.js";
import { renderSubagentsReadme } from "../readme.js";
import { discover, slugify } from "../discovery/discover.js";
import { dumpYaml, writeYaml } from "../util/fsx.js";
import { confirm, isApproved } from "../util/consent.js";
import { log } from "../util/log.js";
import { parseSubagent } from "../schema.js";
export async function runAgentList(root) {
    const agents = await loadSubagents(root);
    const { readme } = projectPaths(root);
    const md = renderSubagentsReadme(agents);
    await fs.writeFile(readme, md, "utf8");
    console.log(md);
}
function scaffoldAgent(task) {
    return parseSubagent({
        name: task.slug,
        version: "1.0.0",
        description: task.description,
        goal: task.goal ?? task.description,
        type: "on-demand",
        triggers: ["on_demand"],
        model_tier: "reasoning",
        capabilities: ["read"],
        requires_fresh_context: false,
        parallelizable: true,
        resource_hint: { priority: "normal", estimated_duration: "medium" },
        memory_scope: "none",
        prompt: `You are the ${task.slug} agent.\n\n${task.description}\n\n` +
            `Report findings clearly and concisely. Read-only unless told otherwise.`,
    });
}
export async function runAgentCreate(opts) {
    const existing = await loadSubagents(opts.root);
    const task = {
        slug: slugify(opts.task),
        description: opts.task,
        goal: opts.goal,
    };
    const outcome = discover(task, existing);
    if (outcome.kind === "exact") {
        log.ok(`Exact match: \`${outcome.agent.name}\` already covers this. Reusing.`);
        return;
    }
    if (outcome.kind === "similar") {
        log.step("Found similar agent(s):");
        for (const hit of outcome.matches) {
            log.info(`${hit.agent.name} (~${Math.round(hit.score * 100)}% match): ${hit.agent.goal}`);
        }
        const top = outcome.matches[0];
        const reuse = await confirm(`Reuse \`${top.agent.name}\` instead of creating a new agent?`, { assumeYes: opts.assumeYes, projectRoot: opts.root });
        if (isApproved(reuse)) {
            log.ok(`Reusing \`${top.agent.name}\`.`);
            return;
        }
    }
    else {
        log.info("No existing agent matches. Proposing a new one.");
    }
    // CREATE NEW — show the scaffold, then gate on consent.
    const draft = scaffoldAgent(task);
    log.step(`Proposed .subagents/${draft.name}.yaml`);
    console.log(dumpYaml(draft));
    const consent = await confirm(`Create \`${draft.name}\`?`, {
        assumeYes: opts.assumeYes,
        projectRoot: opts.root,
    });
    if (!isApproved(consent)) {
        log.detail("Creation declined.");
        return;
    }
    const dest = path.join(projectPaths(opts.root).subagentsDir, `${draft.name}.yaml`);
    await writeYaml(dest, draft);
    log.ok(`wrote .subagents/${draft.name}.yaml`);
    // Regenerate README index.
    const agents = await loadSubagents(opts.root);
    await fs.writeFile(projectPaths(opts.root).readme, renderSubagentsReadme(agents), "utf8");
    log.ok("regenerated .subagents/README.md");
    log.info("Run `harness build-agents` to generate the platform agent file.");
}
//# sourceMappingURL=agent.js.map
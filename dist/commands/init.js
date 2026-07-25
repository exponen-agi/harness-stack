/**
 * `harness init` (spec R1, R5, R8).
 *
 * Creates `.subagents/` with the v1 agents + auto README, installs
 * Context7 as a base MCP, writes `.harness/model-map.yaml` + allowlists,
 * appends the operating-rules fragment to AGENTS.md, and (consent-gated)
 * installs the Spec Kit + Superpowers foundation. Re-runs never overwrite
 * user edits — existing files are preserved.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { projectPaths, loadSubagents, loadTriggerMap, } from "../project.js";
import { resolveTrigger, describeBinding, } from "../resolution/trigger-resolver.js";
import { templatesDir } from "../templates.js";
import { ensureDir, listFiles, pathExists, writeIfAbsent, } from "../util/fsx.js";
import { renderSubagentsReadme } from "../readme.js";
import { confirm, isApproved } from "../util/consent.js";
import { log } from "../util/log.js";
import { installSpecKit } from "../foundation/spec-kit.js";
import { installSuperpowers } from "../foundation/superpowers.js";
import { selectPlatforms } from "./select-platform.js";
import { setupBrain } from "../brain/setup.js";
import { dumpYaml } from "../util/fsx.js";
async function detectProjectType(root) {
    const entries = await fs.readdir(root).catch(() => []);
    const codeish = entries.filter((e) => !e.startsWith(".") &&
        !["README.md", "LICENSE", "node_modules"].includes(e));
    return codeish.length === 0 ? "greenfield" : "brownfield";
}
async function copyTemplateAgents(tplDir, destDir) {
    await ensureDir(destDir);
    const files = await listFiles(path.join(tplDir, "agents"), ".yaml");
    const written = [];
    const skipped = [];
    for (const f of files) {
        const dest = path.join(destDir, path.basename(f));
        const contents = await fs.readFile(f, "utf8");
        if (await writeIfAbsent(dest, contents))
            written.push(path.basename(f));
        else
            skipped.push(path.basename(f));
    }
    return { written, skipped };
}
export async function runInit(opts) {
    const paths = projectPaths(opts.root);
    // 0. Identify the agentic platform(s) (ask unless preselected/non-interactive).
    const platforms = await selectPlatforms({
        preselected: opts.platforms,
        fallback: opts.assumeYes ? "claude-code" : undefined,
    });
    // The first selected platform is "primary" — used for single-target steps
    // like the Spec Kit `--integration` flag.
    const primary = platforms[0];
    const projectType = await detectProjectType(opts.root);
    log.step(`Harness init — ${projectType} project, platform(s)=${platforms.join(", ")}`);
    // 0b. Commit-memory: opt into harness-brain (clone the default repo or
    //     scaffold the structure locally). Recorded in config below.
    log.step("Commit-memory (harness-brain)");
    const brain = await setupBrain({
        root: opts.root,
        brainPath: opts.brainPath,
        brainSource: opts.brainSource,
        brainRepo: opts.brainRepo,
        skipBrain: opts.skipBrain,
        assumeYes: opts.assumeYes,
        dryRun: opts.dryRunFoundation,
    });
    const tplDir = await templatesDir();
    // 1. .subagents/ + v1 agents (never overwrite).
    log.step("1. Sub-agents");
    const { written, skipped } = await copyTemplateAgents(tplDir, paths.subagentsDir);
    written.forEach((f) => log.ok(`wrote .subagents/${f}`));
    skipped.forEach((f) => log.detail(`kept existing .subagents/${f}`));
    // 2. .harness/ config: model-map + allowlists (never overwrite).
    log.step("2. Harness config");
    await ensureDir(paths.harnessDir);
    if (await writeIfAbsent(paths.modelMap, await fs.readFile(path.join(tplDir, "model-map.yaml"), "utf8")))
        log.ok("wrote .harness/model-map.yaml");
    else
        log.detail("kept existing .harness/model-map.yaml");
    if (await writeIfAbsent(paths.triggerMap, await fs.readFile(path.join(tplDir, "trigger-map.yaml"), "utf8")))
        log.ok("wrote .harness/trigger-map.yaml");
    else
        log.detail("kept existing .harness/trigger-map.yaml");
    // Project config records the enabled platform(s). Always written so re-runs
    // with a new selection update the set build-agents/hooks target.
    await fs.writeFile(paths.config, "# Harness project configuration\n" + dumpYaml({ platforms, brain }), "utf8");
    log.ok(`wrote .harness/config.yaml (platforms: ${platforms.join(", ")}` +
        (brain.enabled ? `; brain: ${brain.source ?? "configured"}` : "") +
        ")");
    await ensureDir(paths.allowlistsDir);
    for (const name of ["skills.yaml", "mcp-servers.yaml"]) {
        const dest = path.join(paths.allowlistsDir, name);
        if (await writeIfAbsent(dest, await fs.readFile(path.join(tplDir, "allowlists", name), "utf8")))
            log.ok(`wrote .harness/allowlists/${name}`);
        else
            log.detail(`kept existing .harness/allowlists/${name}`);
    }
    // 3. README index (always regenerated from current specs).
    const agents = await loadSubagents(opts.root);
    await fs.writeFile(paths.readme, renderSubagentsReadme(agents), "utf8");
    log.ok("regenerated .subagents/README.md");
    // 4. AGENTS.md operating-rules fragment (append once).
    log.step("3. AGENTS.md operating rules");
    await appendAgentsFragment(opts.root, tplDir);
    // 5. Event-hook wiring plan for each chosen platform.
    log.step("4. Event-hook wiring");
    for (const platform of platforms)
        await showHookPlan(opts.root, platform);
    // 6. Foundation install (consent-gated subprocesses). Spec Kit's
    //    --integration is single-target, so it runs for the primary platform;
    //    build-agents covers every selected platform.
    log.step("5. Spec-driven foundation");
    if (opts.skipFoundation) {
        log.detail("skipped (--skip-foundation)");
    }
    else {
        if (platforms.length > 1) {
            log.detail(`Spec Kit integration targets the primary platform (${primary}).`);
        }
        await installFoundation(opts.root, primary, projectType, opts);
    }
    log.step("Done.");
    log.info(`Next: \`harness build-agents\` generates files for all ${platforms.length} ` +
        `platform(s); add \`--platform <id>\` to target one.`);
    log.info("Then: `harness hooks` to review trigger -> native-hook wiring.");
}
async function showHookPlan(root, platform) {
    const map = await loadTriggerMap(root);
    const agents = await loadSubagents(root);
    const triggers = new Set();
    for (const a of agents)
        a.triggers.forEach((t) => triggers.add(t));
    log.info(`${platform}:`);
    let unverified = 0;
    for (const t of [...triggers].sort()) {
        const r = resolveTrigger(platform, t, map);
        const mark = r.fellBack ? "↺ fallback" : "✓ native";
        log.detail(`  ${t}  ->  ${describeBinding(r.binding)}  [${mark}]`);
        if (r.binding.verified === false)
            unverified++;
    }
    if (unverified > 0) {
        log.warn(`  ${unverified} hook binding(s) are unverified defaults for ${platform}. ` +
            `The harness-init-agent will confirm them against current docs via ` +
            `search + Context7, then refresh .harness/trigger-map.yaml.`);
    }
}
async function appendAgentsFragment(root, tplDir) {
    const fragment = await fs.readFile(path.join(tplDir, "AGENTS.fragment.md"), "utf8");
    const agentsMd = path.join(root, "AGENTS.md");
    if (!(await pathExists(agentsMd))) {
        await fs.writeFile(agentsMd, `# AGENTS\n\n${fragment}`, "utf8");
        log.ok("created AGENTS.md with Harness operating rules");
        return;
    }
    const current = await fs.readFile(agentsMd, "utf8");
    if (current.includes("<!-- HARNESS:BEGIN")) {
        log.detail("AGENTS.md already contains the Harness fragment");
        return;
    }
    await fs.writeFile(agentsMd, `${current.trimEnd()}\n\n${fragment}`, "utf8");
    log.ok("appended Harness operating rules to AGENTS.md");
}
async function installFoundation(root, platform, projectType, opts) {
    const consent = await confirm("Install the spec-driven foundation (Spec Kit + Superpowers)?", { assumeYes: opts.assumeYes, projectRoot: root, key: "foundation" });
    if (!isApproved(consent)) {
        log.detail("foundation install declined — parked");
        return;
    }
    const projectName = path.basename(path.resolve(root));
    const specKit = await installSpecKit(projectType, platform, {
        cwd: root,
        projectName,
        dryRun: opts.dryRunFoundation,
    });
    specKit.ok
        ? log.ok(`Spec Kit: ${specKit.message}`)
        : log.warn(`Spec Kit: ${specKit.message}`);
    const sp = await installSuperpowers(platform, {
        cwd: root,
        dryRun: opts.dryRunFoundation,
    });
    log.ok(`Superpowers (${sp.level}): ${sp.message}`);
}
//# sourceMappingURL=init.js.map
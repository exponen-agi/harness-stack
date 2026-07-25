/**
 * `harness build-agents` (spec R7).
 *
 * Regenerates platform-native agent files from `.subagents/*.yaml` for the
 * active platform. Enforces fresh-context + model resolution; if any agent
 * fails, the whole build fails with one clear, complete error message.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { loadModelMap, loadSubagents, collectBaseMcpNames, } from "../project.js";
import { buildRoster } from "../build.js";
import { ensureDir } from "../util/fsx.js";
import { log } from "../util/log.js";
export async function runBuildAgents(opts) {
    const agents = await loadSubagents(opts.root);
    if (agents.length === 0) {
        log.warn("No .subagents/*.yaml found. Run `harness init` first.");
        return { written: 0, manual: 0 };
    }
    const modelMap = await loadModelMap(opts.root);
    const baseMcpNames = collectBaseMcpNames(agents);
    const report = buildRoster(agents, {
        platform: opts.platform,
        modelMap,
        baseMcpNames,
    });
    if (report.errors.length > 0) {
        log.error(`Build failed for platform "${opts.platform}":`);
        report.errors.forEach((e) => log.detail(`- ${e}`));
        throw new Error(`${report.errors.length} agent(s) failed to build. Fix the above and retry.`);
    }
    log.step(`Building ${report.results.length} agent(s) for ${opts.platform}`);
    let manualWritten = 0;
    for (const r of report.results) {
        const dest = path.join(opts.root, r.file.relPath);
        await ensureDir(path.dirname(dest));
        await fs.writeFile(dest, r.file.contents, "utf8");
        log.ok(`${r.agent.name} → ${r.file.relPath}`);
        for (const m of r.manualFiles) {
            const mdest = path.join(opts.root, m.relPath);
            await ensureDir(path.dirname(mdest));
            await fs.writeFile(mdest, m.contents, "utf8");
            log.detail(`  ↳ ${m.relPath}`);
            manualWritten++;
        }
        r.warnings.forEach((w) => log.warn(`  ${w}`));
    }
    report.notes.forEach((n) => log.warn(n));
    if (manualWritten > 0) {
        log.info(`${manualWritten} skill/command artifact(s) generated.`);
    }
    return { written: report.results.length, manual: manualWritten };
}
//# sourceMappingURL=build-agents.js.map
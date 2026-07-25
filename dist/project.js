/** Project layout + loaders for the harness control files. */
import path from "node:path";
import { parseSubagent } from "./schema.js";
import { listFiles, pathExists, readYaml } from "./util/fsx.js";
export function projectPaths(root) {
    return {
        root,
        subagentsDir: path.join(root, ".subagents"),
        harnessDir: path.join(root, ".harness"),
        modelMap: path.join(root, ".harness", "model-map.yaml"),
        triggerMap: path.join(root, ".harness", "trigger-map.yaml"),
        config: path.join(root, ".harness", "config.yaml"),
        allowlistsDir: path.join(root, ".harness", "allowlists"),
        readme: path.join(root, ".subagents", "README.md"),
    };
}
/** Load and validate every `.subagents/*.yaml` (excluding README). */
export async function loadSubagents(root) {
    const { subagentsDir } = projectPaths(root);
    const files = await listFiles(subagentsDir, ".yaml");
    const agents = [];
    for (const file of files) {
        const raw = await readYaml(file);
        agents.push(parseSubagent(raw, path.relative(root, file)));
    }
    return agents;
}
export async function loadModelMap(root) {
    const { modelMap } = projectPaths(root);
    if (!(await pathExists(modelMap))) {
        throw new Error(`Missing .harness/model-map.yaml. Run \`harness init\` first.`);
    }
    return readYaml(modelMap);
}
export async function loadTriggerMap(root) {
    const { triggerMap } = projectPaths(root);
    if (!(await pathExists(triggerMap))) {
        throw new Error(`Missing .harness/trigger-map.yaml. Run \`harness init\` first.`);
    }
    return readYaml(triggerMap);
}
/**
 * The platforms enabled for this project. A repo may target several agentic
 * environments at once (e.g. Claude Code + Cursor). Falls back to a single
 * default when no config is present.
 */
export async function loadPlatforms(root, fallback = "claude-code") {
    const { config } = projectPaths(root);
    if (!(await pathExists(config)))
        return [fallback];
    const cfg = await readYaml(config);
    const platforms = Array.isArray(cfg?.platforms)
        ? cfg.platforms.filter((p) => typeof p === "string")
        : [];
    return platforms.length > 0 ? platforms : [fallback];
}
/**
 * The harness-brain configuration for this project, if any. Returns a disabled
 * config when none is recorded.
 */
export async function loadBrainConfig(root) {
    const { config } = projectPaths(root);
    if (!(await pathExists(config)))
        return { enabled: false };
    const cfg = await readYaml(config);
    const brain = cfg?.brain;
    if (!brain || typeof brain !== "object")
        return { enabled: false };
    return { ...brain, enabled: Boolean(brain.enabled) };
}
/** Names of base MCP servers (e.g. context7) declared across all agents. */
export function collectBaseMcpNames(agents) {
    const names = new Set();
    for (const agent of agents) {
        for (const srv of agent.mcp_servers) {
            if (srv.base)
                names.add(srv.name);
        }
    }
    // Context7 is installed as a base MCP at init regardless of per-agent decls.
    names.add("context7");
    return names;
}
//# sourceMappingURL=project.js.map
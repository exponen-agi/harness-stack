/**
 * The build pipeline: canonical `.subagents/*.yaml` → platform-native agent
 * files. Resolves model tier + capabilities, enforces the fresh-context
 * mandate, then renders via the active platform adapter (spec R3–R5, R7).
 */
import type { Subagent } from "./schema.js";
import type { ModelMap } from "./resolution/model-resolver.js";
import type { GeneratedFile } from "./adapters/types.js";
export interface BuildOptions {
    platform: string;
    modelMap: ModelMap;
    baseMcpNames: ReadonlySet<string>;
}
export interface AgentBuildResult {
    agent: Subagent;
    file: GeneratedFile;
    /** Decision-routable skill / manual command artifacts (may be empty). */
    manualFiles: GeneratedFile[];
    warnings: string[];
}
export interface BuildReport {
    results: AgentBuildResult[];
    errors: string[];
    /** Build-level notes (e.g. a platform's skill mapping is still pending). */
    notes: string[];
}
/**
 * Build the full roster. Collects every fresh-context / resolution error so the
 * caller can fail the build with one clear, complete message rather than dying
 * on the first bad agent.
 */
export declare function buildRoster(agents: Subagent[], opts: BuildOptions): BuildReport;
//# sourceMappingURL=build.d.ts.map
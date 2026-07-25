import { type Subagent } from "./schema.js";
import type { ModelMap } from "./resolution/model-resolver.js";
import type { TriggerMap } from "./resolution/trigger-resolver.js";
export interface ProjectPaths {
    root: string;
    subagentsDir: string;
    harnessDir: string;
    modelMap: string;
    triggerMap: string;
    config: string;
    allowlistsDir: string;
    readme: string;
}
export type BrainSource = "clone" | "scaffold";
/** Optional harness-brain (commit-memory) wiring for this project. */
export interface BrainConfig {
    /** Whether commit-memory is set up for this project. */
    enabled: boolean;
    /** Brain location, stored relative to the project root when possible. */
    path?: string;
    /** How the brain was created. */
    source?: BrainSource;
    /** Upstream repo when the brain was cloned. */
    repo?: string;
}
export interface HarnessConfig {
    /** Agentic platforms enabled for this project (one or more). */
    platforms: string[];
    /** harness-brain commit-memory configuration (optional). */
    brain?: BrainConfig;
}
export declare function projectPaths(root: string): ProjectPaths;
/** Load and validate every `.subagents/*.yaml` (excluding README). */
export declare function loadSubagents(root: string): Promise<Subagent[]>;
export declare function loadModelMap(root: string): Promise<ModelMap>;
export declare function loadTriggerMap(root: string): Promise<TriggerMap>;
/**
 * The platforms enabled for this project. A repo may target several agentic
 * environments at once (e.g. Claude Code + Cursor). Falls back to a single
 * default when no config is present.
 */
export declare function loadPlatforms(root: string, fallback?: string): Promise<string[]>;
/**
 * The harness-brain configuration for this project, if any. Returns a disabled
 * config when none is recorded.
 */
export declare function loadBrainConfig(root: string): Promise<BrainConfig>;
/** Names of base MCP servers (e.g. context7) declared across all agents. */
export declare function collectBaseMcpNames(agents: Subagent[]): Set<string>;
//# sourceMappingURL=project.d.ts.map
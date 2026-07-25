/**
 * Capability → platform-native tool resolution (spec R4).
 *
 * Agents declare abstract capabilities (read/write/exec/web_search/web_fetch).
 * Each platform adapter maps them to its native tool names. This keeps the
 * same `.subagents/*.yaml` valid on Claude Code, Antigravity, Codex, etc.
 */
import type { Capability } from "../schema.js";
export type CapabilityMap = Record<Capability, string[]>;
/** Built-in maps for the platforms shipped in v1. */
export declare const CAPABILITY_MAPS: Record<string, CapabilityMap>;
export interface ResolvedCapabilities {
    tools: string[];
    /** Capabilities the platform could not satisfy. */
    unsupported: Capability[];
}
export declare function resolveCapabilities(capabilities: Capability[], platform: string): ResolvedCapabilities;
/** Does the platform expose any web-search capability for this agent? */
export declare function hasResolvableSearch(platform: string): boolean;
//# sourceMappingURL=capability-resolver.d.ts.map
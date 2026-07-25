/** Adapter contract: canonical Subagent → platform-native agent file. */
import type { Subagent } from "../schema.js";
import type { ResolvedModel } from "../resolution/model-resolver.js";
export interface ResolvedAgent {
    agent: Subagent;
    platform: string;
    model: ResolvedModel;
    /** Platform-native tool names mapped from abstract capabilities. */
    tools: string[];
    /** Capabilities the platform could not satisfy (already warned). */
    unsupportedCapabilities: string[];
}
export interface GeneratedFile {
    /** Path relative to the project root. */
    relPath: string;
    contents: string;
}
/** Context for rendering an agent's manual/skill entry points. */
export interface ManualContext {
    agent: Subagent;
    platform: string;
    /** Resolved slash/skill command name. */
    command: string;
    /** A decision-routable skill surface is requested. */
    wantsSkill: boolean;
    /** A manual slash-command surface is requested. */
    wantsCommand: boolean;
}
export interface PlatformAdapter {
    /** Stable id, matches keys in model-map.yaml. */
    readonly id: string;
    readonly displayName: string;
    /** Render one resolved agent into its platform-native sub-agent file. */
    render(resolved: ResolvedAgent): GeneratedFile;
    /** Path (relative to root) of this agent's canonical sub-agent file. */
    agentRelPath(name: string): string;
    /**
     * True when the platform's sub-agent IS its decision-routed skill primitive
     * (e.g. Antigravity Agent Skills, Copilot custom agents). For these, render()
     * emits the full agent and renderManual must NOT also emit a thin skill.
     */
    readonly subagentIsSkill?: boolean;
    /**
     * Whether the skill/command mechanism is confirmed against the platform's
     * current docs. The bundled mappings are verified; the harness-init-agent
     * re-checks them at init (APIs drift), mirroring the trigger map.
     */
    readonly skillSupport: {
        verified: boolean;
        note?: string;
    };
    /**
     * Render the requested manual surfaces (skill and/or command) as the
     * platform's native files. Returns zero or more files — some platforms
     * satisfy both surfaces with a single native artifact, and platforms where
     * the sub-agent is the skill emit only the command here.
     */
    renderManual?(ctx: ManualContext): GeneratedFile[];
}
//# sourceMappingURL=types.d.ts.map
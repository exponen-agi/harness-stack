import type { Subagent, Trigger } from "../schema.js";
import { type TriggerMap } from "../resolution/trigger-resolver.js";
export interface ExplainOptions {
    root: string;
    platform: string;
    /** Show only this agent (exact name, or name without "-agent"). */
    agent?: string;
}
/** Plain-English meaning of each abstract trigger. */
export declare const TRIGGER_MEANING: Record<Trigger, string>;
/** Plain-English meaning of each capability. */
export declare const CAPABILITY_MEANING: Record<string, string>;
/** Pick agents by name. Accepts "verifier" as a short form of "verifier-agent". */
export declare function selectAgents(agents: Subagent[], wanted?: string): Subagent[];
/** Build the card for one agent as plain lines of text (easy to unit-test). */
export declare function renderAgentCard(agent: Subagent, platform: string, map: TriggerMap): string[];
export declare function runExplain(opts: ExplainOptions): Promise<void>;
//# sourceMappingURL=explain.d.ts.map
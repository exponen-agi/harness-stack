/**
 * Trigger → native event-hook resolution.
 *
 * Agents declare abstract triggers (on_init / on_commit / on_check / on_demand).
 * Each agentic platform (Claude Code, Antigravity, Codex, Cursor, Copilot)
 * exposes its own event hooks. This resolver maps an abstract trigger to the
 * platform's native hook where one exists, and falls back to a Harness-managed
 * mechanism (e.g. an installed git hook or `harness check`) where it does not.
 *
 * Like the model map, the concrete mapping lives in a single editable file —
 * `.harness/trigger-map.yaml` — because platform hook APIs drift. The
 * `harness-init-agent` refreshes that file by researching the active
 * platform's current hook documentation (fresh-context mandate).
 */
import type { Trigger } from "../schema.js";
export type HookKind = "native" | "git-hook" | "harness";
export interface HookBinding {
    /** native  = the platform fires this directly (e.g. SessionStart).
     *  git-hook = Harness installs a git hook (e.g. post-commit).
     *  harness  = Harness-managed fallback (e.g. `harness check`). */
    kind: HookKind;
    /** Native or git-hook name. */
    hook?: string;
    /** Harness fallback mechanism description. */
    mechanism?: string;
    /** false => shipped as a best-known default; init agent must confirm via research. */
    verified?: boolean;
    note?: string;
}
export type TriggerMap = Record<string, Partial<Record<Trigger, HookBinding>>>;
/** The Harness-managed fallback used when a platform has no binding. */
export declare function harnessFallback(trigger: Trigger): HookBinding;
export interface ResolvedTrigger {
    trigger: Trigger;
    binding: HookBinding;
    /** True when no platform-native binding existed and we fell back to Harness. */
    fellBack: boolean;
}
/** Resolve a single trigger for a platform. */
export declare function resolveTrigger(platform: string, trigger: Trigger, map: TriggerMap): ResolvedTrigger;
/** Resolve every trigger declared by an agent, de-duplicated. */
export declare function resolveAgentTriggers(triggers: readonly Trigger[], platform: string, map: TriggerMap): ResolvedTrigger[];
export declare function describeBinding(b: HookBinding): string;
//# sourceMappingURL=trigger-resolver.d.ts.map
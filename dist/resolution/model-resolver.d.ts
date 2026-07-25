/**
 * Platform-agnostic model resolution (spec R3).
 *
 * Agents declare an abstract `model_tier`. The active platform adapter reads
 * `.harness/model-map.yaml` to substitute the concrete model. Concrete model
 * names live in exactly one place — the model map — so keeping Harness current
 * means editing one file, not every agent spec.
 */
import type { ModelTier, Subagent } from "../schema.js";
export type ModelMap = Record<string, Partial<Record<ModelTier, string>>>;
export interface ResolvedModel {
    model: string;
    /** True when the requested tier was missing and we fell back. */
    fellBack: boolean;
    /** The tier actually used after any fallback. */
    effectiveTier: ModelTier;
    warning?: string;
}
/**
 * Resolve an agent's model for a given platform.
 *
 * Precedence:
 *   1. `model_overrides[platform]` on the agent wins outright.
 *   2. `model-map.yaml[platform][tier]`.
 *   3. If the tier is missing on that platform, fall back to the next tier
 *      *down* (deep → reasoning → fast) and emit a warning.
 */
export declare function resolveModel(agent: Pick<Subagent, "model_tier" | "model_overrides">, platform: string, modelMap: ModelMap): ResolvedModel;
export declare function isValidTier(tier: string): tier is ModelTier;
//# sourceMappingURL=model-resolver.d.ts.map
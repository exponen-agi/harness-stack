/**
 * Discovery & reuse workflow (spec R2).
 *
 *   1. EXACT MATCH   — name == task slug → reuse as-is.
 *   2. SIMILAR MATCH — score every spec against the task; ≥ 0.75 = similar.
 *   3. CREATE NEW    — generate a new spec (consent-gated by the caller).
 *
 * This module is pure: it reports what it found. Writing to `.subagents/` and
 * asking for consent is the caller's job, keeping the invariant that the folder
 * is never written without developer consent.
 */
import type { Subagent } from "../schema.js";
export declare const SIMILARITY_THRESHOLD = 0.75;
export interface TaskSpec {
    /** Kebab-case slug derived from the task; matched against agent names. */
    slug: string;
    description: string;
    goal?: string;
}
export interface SimilarityHit {
    agent: Subagent;
    score: number;
}
export type DiscoveryOutcome = {
    kind: "exact";
    agent: Subagent;
} | {
    kind: "similar";
    matches: SimilarityHit[];
} | {
    kind: "none";
};
export declare function slugify(text: string): string;
export declare function discover(task: TaskSpec, existing: Subagent[]): DiscoveryOutcome;
//# sourceMappingURL=discover.d.ts.map
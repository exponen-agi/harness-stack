/**
 * Skill sourcing precedence + recommendation protocol (spec R9, R10).
 *
 * The skills-router searches sources in a fixed precedence order and labels
 * each candidate's provenance. No skill is ever invoked silently: every use is
 * surfaced as (skill | source | what | why-now) and consent-gated.
 */
import { type ConsentOptions } from "../util/consent.js";
export type SkillSource = "Spec Kit" | "Superpowers" | "Curated allowlist" | "Harness-native";
/** Precedence order used when ranking candidates from multiple sources. */
export declare const SOURCE_PRECEDENCE: SkillSource[];
export interface SkillCandidate {
    name: string;
    source: SkillSource;
    /** What the skill does. */
    what: string;
    /** Why it matters for the task at hand, right now. */
    whyNow: string;
    /** Optional trust/maintenance signal (stars, last-updated, "vetted"). */
    trustSignal?: string;
    /** Raw relevance score from the router (higher = better). */
    score?: number;
}
/** Rank candidates by source precedence, then by score. */
export declare function rankCandidates(candidates: SkillCandidate[]): SkillCandidate[];
/** Render the standard recommendation card for a skill. */
export declare function renderRecommendation(c: SkillCandidate): string;
/**
 * Present a skill and ask for consent (y / n / always-for-project).
 * Returns whether the skill is approved for use. Declined skills are parked
 * (remembered) by the consent store and not re-prompted.
 */
export declare function recommendSkill(c: SkillCandidate, opts?: ConsentOptions): Promise<boolean>;
//# sourceMappingURL=router.d.ts.map
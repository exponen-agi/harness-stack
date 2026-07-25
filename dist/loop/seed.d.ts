import type { BrainConfig } from "../project.js";
export interface IterationSeed {
    /** The invariant goal fed unchanged every iteration, and where it came from. */
    northStar: {
        text: string;
        source: string;
    };
    /** The mutable loop-state digest from the brain's compact rollup. */
    currentState: {
        text: string;
        source: string;
    };
    /** The stop/continue signal + hard limits (static contract text). */
    guardrails: string[];
    /** The re-research-every-iteration reminder (fresh-context mandate). */
    freshContext: string;
}
export interface AssembleSeedOptions {
    root: string;
    /** Absolute brain path; when omitted, taken from BrainConfig / env. */
    brainPath?: string;
    brain?: BrainConfig;
    /** Repo name used to locate the brain folder; defaults to the root's basename. */
    repoName?: string;
}
/**
 * Locate the brain's current-state digest for this repo: find the repo folder
 * under `projects/<brain>/<repo>/`, then read the newest compact rollup at that
 * brain's root. Degrades gracefully when the brain or repo is absent.
 */
export declare function findBrainCompact(brainPath: string, repoName: string): Promise<{
    text: string;
    source: string;
} | null>;
/**
 * Assemble the canonical iteration seed. Pure with respect to the filesystem it
 * reads; writes nothing.
 */
export declare function assembleSeed(opts: AssembleSeedOptions): Promise<IterationSeed>;
/** Render the seed as the Markdown block fed to an iteration (or printed). */
export declare function renderSeed(seed: IterationSeed): string;
//# sourceMappingURL=seed.d.ts.map
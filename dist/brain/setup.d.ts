import type { BrainConfig, BrainSource } from "../project.js";
/** Default upstream repo cloned when the developer opts into "clone". */
export declare const DEFAULT_BRAIN_REPO = "https://github.com/cloudbloqavi/harness-brain.git";
/** Default location, a sibling of the project so the brain is its own repo. */
export declare const DEFAULT_BRAIN_DIR = "../harness-brain";
export interface BrainSetupOptions {
    root: string;
    /** Explicit target path (presence enables the brain non-interactively). */
    brainPath?: string;
    /** clone | scaffold. Defaults to clone. */
    brainSource?: string;
    /** Override the clone source repo. */
    brainRepo?: string;
    /** Explicitly skip brain setup. */
    skipBrain?: boolean;
    assumeYes?: boolean;
    /** Print the actions (e.g. git clone) without performing them. */
    dryRun?: boolean;
}
/** Normalise a free-form source choice ("1"/"clone"/"s"/"scaffold"). */
export declare function parseBrainSource(raw: string | undefined, fallback?: BrainSource): BrainSource;
/** Resolve the chosen path to an absolute target + a root-relative form. */
export declare function resolveBrainPath(root: string, input: string | undefined): {
    abs: string;
    stored: string;
};
export declare function cloneBrain(repo: string, abs: string, opts: {
    dryRun?: boolean;
}): Promise<{
    ok: boolean;
    message: string;
}>;
export declare function scaffoldBrain(abs: string): Promise<{
    ok: boolean;
    message: string;
}>;
/**
 * Orchestrate the opt-in brain setup and return the config to persist.
 * Never throws on a failed clone — it falls back to a local scaffold so init
 * always completes.
 */
export declare function setupBrain(opts: BrainSetupOptions): Promise<BrainConfig>;
//# sourceMappingURL=setup.d.ts.map
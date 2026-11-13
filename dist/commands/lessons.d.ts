import { type RepeatedLesson } from "../brain/lessons.js";
export interface LessonsOptions {
    root: string;
    /** Explicit brain checkout; else HARNESS_BRAIN_PATH; else .harness/config.yaml. */
    brainPath?: string;
    /** Minimum number of different commits (default 2). */
    minCommits?: number;
    /** Print JSON instead of text (for scripts and CI). */
    json?: boolean;
}
/** Same lookup order as `harness seed`: flag, then env var, then config. */
export declare function resolveBrainDir(root: string, explicit?: string): Promise<string | undefined>;
/** Parse `--min`: a whole number of at least 2 (one commit is not a repeat). */
export declare function parseMinCommits(raw: string): number;
export declare function runLessons(opts: LessonsOptions): Promise<RepeatedLesson[]>;
//# sourceMappingURL=lessons.d.ts.map
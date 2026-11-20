import { type RepeatedLesson } from "../brain/lessons.js";
export interface LessonsOptions {
    root: string;
    /** Explicit brain checkout; else HARNESS_BRAIN_PATH; else .harness/config.yaml. */
    brainPath?: string;
    /** Minimum number of different commits (default 2). */
    minCommits?: number;
    /** Print JSON instead of text (for scripts and CI). */
    json?: boolean;
    /**
     * Also write a Markdown proposal (rule snippets + evidence) to this path,
     * relative to `root`. It is the only file this command ever writes, and only
     * when at least one lesson was found.
     */
    propose?: string;
    /** Date shown in the proposal title (YYYY-MM-DD). Default: today (UTC). */
    today?: string;
}
/** Same lookup order as `harness seed`: flag, then env var, then config. */
export declare function resolveBrainDir(root: string, explicit?: string): Promise<string | undefined>;
/** Parse `--min`: a whole number of at least 2 (one commit is not a repeat). */
export declare function parseMinCommits(raw: string): number;
export declare function runLessons(opts: LessonsOptions): Promise<RepeatedLesson[]>;
//# sourceMappingURL=lessons.d.ts.map
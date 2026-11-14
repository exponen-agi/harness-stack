/** One to-do item taken from one commit section of a detailed log. */
export interface LessonItem {
    /** Cleaned to-do text, e.g. "Remove the /v1 route after the sunset window". */
    text: string;
    /** Short commit SHA from the section heading ("" if the heading has none). */
    sha: string;
    /** Brain-relative log path with "/" separators, e.g. "brain-1/api/26-06-07-HAR.md". */
    file: string;
}
/** A group of similar to-dos seen in more than one commit. */
export interface RepeatedLesson {
    /** The first item seen; used as the lesson's title. */
    title: string;
    /** Every matching item, in the order found. */
    items: LessonItem[];
    /** Number of DIFFERENT commits (file + sha) the lesson appears in. */
    commits: number;
}
/** Two to-dos with at least this token overlap count as the same lesson. */
export declare const DEFAULT_SIMILARITY = 0.5;
/** A lesson must appear in at least this many different commits. */
export declare const DEFAULT_MIN_COMMITS = 2;
/** Overlap coefficient (shared tokens / smaller set) in [0, 1]. */
export declare function lessonSimilarity(a: string, b: string): number;
/** Split one "Flags / to-dos" value into separate to-do items. */
export declare function splitTodos(value: string): string[];
/**
 * Pull every to-do out of one detailed log (`<YY-MM-DD>-HAR.md`). Pure: it
 * only looks at the text, so it is easy to test. Handles Windows (CRLF)
 * line endings.
 */
export declare function extractTodos(text: string, file: string): LessonItem[];
/**
 * Group similar to-dos and keep the groups seen in at least `minCommits`
 * different commits. Greedy and order-stable: each item joins the first
 * group whose title is similar enough, so the output never changes between
 * runs on the same input.
 */
export declare function findRepeatedLessons(items: readonly LessonItem[], opts?: {
    minCommits?: number;
    similarity?: number;
}): RepeatedLesson[];
/**
 * Read every detailed log in a brain checkout and return its to-dos.
 * Missing folders give an empty list, never an error.
 */
export declare function collectBrainTodos(brainPath: string): Promise<LessonItem[]>;
/** Plain-English report. Empty input gives a short "nothing yet" message. */
export declare function renderLessons(lessons: readonly RepeatedLesson[], minCommits: number): string;
//# sourceMappingURL=lessons.d.ts.map
export type ConsentAnswer = "yes" | "no" | "always";
export interface ConsentOptions {
    /** Assume "yes" for everything (non-interactive / CI). */
    assumeYes?: boolean;
    /** Project root, used to locate the persisted consent store. */
    projectRoot?: string;
}
/**
 * Ask for consent. `key` identifies the decision so "always"/"declined" can be
 * remembered. Pass `allowAlways: false` for one-off prompts (plain y/n).
 */
export declare function confirm(question: string, opts?: ConsentOptions & {
    key?: string;
    allowAlways?: boolean;
}): Promise<ConsentAnswer>;
export declare function isApproved(answer: ConsentAnswer): boolean;
//# sourceMappingURL=consent.d.ts.map
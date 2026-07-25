export interface SelectPlatformOptions {
    /** Pre-chosen platform(s) (e.g. --platform a,b). Skips the prompt. */
    preselected?: string[];
    /** Non-interactive default when there's no TTY and nothing preselected. */
    fallback?: string;
}
/** Parse a free-form selection ("1,3" / "claude-code cursor" / "all"). */
export declare function parseSelection(raw: string, ids: string[]): string[];
export declare function selectPlatforms(opts?: SelectPlatformOptions): Promise<string[]>;
//# sourceMappingURL=select-platform.d.ts.map
export type GitHookInstallStatus = "installed" | "appended" | "updated" | "skipped-worktree";
export interface GitHookInstallResult {
    status: GitHookInstallStatus;
}
/**
 * Install (or refresh) a git hook containing a Harness-managed block.
 *
 *  - no hook file yet         -> write one, return "installed"
 *  - hook file, no our block  -> append our block, return "appended"
 *  - hook file, has our block -> replace just that block, return "updated"
 *  - `.git` is a file (worktree/submodule) or missing -> write nothing,
 *    return "skipped-worktree"
 */
export declare function installGitHook(repoRoot: string, hookName: string, hookBody: string): GitHookInstallResult;
//# sourceMappingURL=git-hooks.d.ts.map
/**
 * Git-hook installation — the `on_commit` trigger's concrete implementation.
 *
 * `.harness/trigger-map.yaml` resolves `on_commit` to `{ kind: git-hook, hook:
 * post-commit }` on every shipped platform (none has a native commit event).
 * This module is what actually materializes that: it writes a managed block
 * into `.git/hooks/<hookName>` rather than leaving the mapping as a plan
 * `harness init` only describes in its own output.
 *
 * Re-running install (e.g. on every `harness init`) must be idempotent and
 * must never clobber a hook a developer or another tool already installed —
 * hence the clearly-delimited managed block that's appended once and then
 * replaced in place on subsequent runs.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import path from "node:path";

export type GitHookInstallStatus =
  | "installed"
  | "appended"
  | "updated"
  | "skipped-worktree";

export interface GitHookInstallResult {
  status: GitHookInstallStatus;
}

// `on_commit` is the only abstract trigger any shipped platform maps to
// `git-hook` today (see templates/trigger-map.yaml) — if that ever changes,
// this label should become a parameter instead of a constant.
const MANAGED_TRIGGER_LABEL = "on_commit";
const BEGIN_MARKER = `# >>> harness-stack managed block (${MANAGED_TRIGGER_LABEL}) >>>`;
const END_MARKER = `# <<< harness-stack managed block (${MANAGED_TRIGGER_LABEL}) <<<`;

function isRealGitDir(gitPath: string): boolean {
  // A git worktree or submodule has a `.git` FILE (e.g. a single line like
  // `gitdir: ../.git/worktrees/xyz`) rather than the usual `.git` directory.
  // Treat that — and a missing `.git` altogether — as "nothing safe to write
  // hooks into" rather than guessing at the real git dir it points to.
  return existsSync(gitPath) && statSync(gitPath).isDirectory();
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
export function installGitHook(
  repoRoot: string,
  hookName: string,
  hookBody: string,
): GitHookInstallResult {
  const gitPath = path.join(repoRoot, ".git");
  if (!isRealGitDir(gitPath)) {
    return { status: "skipped-worktree" };
  }

  const hooksDir = path.join(gitPath, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, hookName);
  const block = `${BEGIN_MARKER}\n${hookBody}\n${END_MARKER}`;

  if (!existsSync(hookPath)) {
    const contents =
      "#!/bin/sh\n" +
      // This shebang works identically on macOS, Linux, AND Windows: Git for
      // Windows bundles its own sh.exe (Git Bash), and git always invokes
      // hook scripts through it — shebang and all — even on Windows.
      "\n" +
      `${block}\n`;
    writeFileSync(hookPath, contents, "utf8");
    // Windows has no POSIX executable bit; chmod there is a no-op at best
    // and can throw on some filesystems, so skip it — same pattern as the
    // which/where platform branch in src/foundation/exec.ts.
    if (process.platform !== "win32") chmodSync(hookPath, 0o755);
    return { status: "installed" };
  }

  const existing = readFileSync(hookPath, "utf8");
  const beginIdx = existing.indexOf(BEGIN_MARKER);
  const endIdx = existing.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    const appended = `${existing.replace(/\s*$/, "")}\n\n${block}\n`;
    writeFileSync(hookPath, appended, "utf8");
    return { status: "appended" };
  }

  const updated =
    existing.slice(0, beginIdx) + block + existing.slice(endIdx + END_MARKER.length);
  writeFileSync(hookPath, updated, "utf8");
  return { status: "updated" };
}

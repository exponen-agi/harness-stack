import { describe, it, expect, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { installGitHook } from "../src/foundation/git-hooks.js";

let tmpDir: string | undefined;

function mkRepo(): string {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "harness-hook-"));
  return tmpDir;
}

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

describe("installGitHook", () => {
  it("installs a fresh hook when none exists", () => {
    const repoRoot = mkRepo();
    mkdirSync(path.join(repoRoot, ".git"), { recursive: true });

    const result = installGitHook(repoRoot, "post-commit", 'echo "hi"');
    expect(result.status).toBe("installed");

    const hookPath = path.join(repoRoot, ".git", "hooks", "post-commit");
    const contents = readFileSync(hookPath, "utf8");
    expect(contents.startsWith("#!/bin/sh")).toBe(true);
    expect(contents).toContain("# >>> harness-stack managed block (on_commit) >>>");
    expect(contents).toContain('echo "hi"');
    expect(contents).toContain("# <<< harness-stack managed block (on_commit) <<<");

    if (process.platform !== "win32") {
      const mode = statSync(hookPath).mode;
      expect(mode & 0o111).toBe(0o111); // executable for owner/group/other
    }
  });

  it("appends to a pre-existing foreign hook, preserving its content", () => {
    const repoRoot = mkRepo();
    mkdirSync(path.join(repoRoot, ".git", "hooks"), { recursive: true });
    const hookPath = path.join(repoRoot, ".git", "hooks", "post-commit");
    const foreign = '#!/bin/sh\necho "pre-existing hook"\n';
    writeFileSync(hookPath, foreign, "utf8");

    const result = installGitHook(repoRoot, "post-commit", 'echo "hi"');
    expect(result.status).toBe("appended");

    const contents = readFileSync(hookPath, "utf8");
    expect(contents).toContain('echo "pre-existing hook"');
    expect(contents).toContain("# >>> harness-stack managed block (on_commit) >>>");
    expect(contents.indexOf('echo "pre-existing hook"')).toBeLessThan(
      contents.indexOf("# >>> harness-stack managed block"),
    );
  });

  it("is idempotent: a second install updates in place without duplicating the block", () => {
    const repoRoot = mkRepo();
    mkdirSync(path.join(repoRoot, ".git"), { recursive: true });

    const first = installGitHook(repoRoot, "post-commit", 'echo "hi"');
    expect(first.status).toBe("installed");

    const second = installGitHook(repoRoot, "post-commit", 'echo "hi"');
    expect(second.status).toBe("updated");

    const hookPath = path.join(repoRoot, ".git", "hooks", "post-commit");
    const contents = readFileSync(hookPath, "utf8");
    const beginCount = contents.split("# >>> harness-stack managed block (on_commit) >>>").length - 1;
    expect(beginCount).toBe(1);
  });

  it("skips a worktree (.git is a file, not a directory) without writing anything", () => {
    const repoRoot = mkRepo();
    writeFileSync(path.join(repoRoot, ".git"), "gitdir: /some/path/.git/worktrees/xyz\n", "utf8");

    const result = installGitHook(repoRoot, "post-commit", 'echo "hi"');
    expect(result.status).toBe("skipped-worktree");

    const hooksDir = path.join(repoRoot, ".git", "hooks");
    expect(fsPathExists(hooksDir)).toBe(false);
  });
});

function fsPathExists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

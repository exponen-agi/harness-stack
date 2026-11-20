/**
 * `harness lessons` — list to-dos that keep coming back in harness-brain.
 *
 * This is the "learn from history" step of the self-improvement loop:
 *
 *   commit -> commit-brain-agent writes a log -> `harness lessons` finds
 *   repeats -> a person turns one into a rule -> reviewed PR -> evals in CI
 *
 * Read-only. It prints a report and changes nothing. The exit code is always
 * 0: a repeated lesson is a suggestion, not a failure.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { loadBrainConfig } from "../project.js";
import {
  collectBrainTodos,
  DEFAULT_MIN_COMMITS,
  findRepeatedLessons,
  renderLessons,
  renderProposal,
  type RepeatedLesson,
} from "../brain/lessons.js";
import { pathExists } from "../util/fsx.js";
import { log } from "../util/log.js";

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
export async function resolveBrainDir(
  root: string,
  explicit?: string,
): Promise<string | undefined> {
  if (explicit) return path.resolve(root, explicit);
  if (process.env.HARNESS_BRAIN_PATH) return path.resolve(root, process.env.HARNESS_BRAIN_PATH);
  const brain = await loadBrainConfig(root);
  return brain.enabled && brain.path ? path.resolve(root, brain.path) : undefined;
}

/** Parse `--min`: a whole number of at least 2 (one commit is not a repeat). */
export function parseMinCommits(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 2) {
    throw new Error(`--min must be a whole number of 2 or more (got "${raw}")`);
  }
  return n;
}

async function writeProposal(
  opts: LessonsOptions,
  lessons: readonly RepeatedLesson[],
  minCommits: number,
): Promise<void> {
  // Messages go to stderr so `--json --propose` still prints valid JSON.
  if (lessons.length === 0) {
    log.warn("No repeated lessons, so no proposal file was written.");
    return;
  }
  const target = path.resolve(opts.root, opts.propose!);
  const date = opts.today ?? new Date().toISOString().slice(0, 10);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderProposal(lessons, minCommits, date) + "\n", "utf8");
  process.stderr.write(
    `Wrote a draft proposal to ${path.relative(opts.root, target) || target}.\n` +
      "Review it, keep the rules you want, and open a pull request.\n",
  );
}

export async function runLessons(opts: LessonsOptions): Promise<RepeatedLesson[]> {
  const minCommits = opts.minCommits ?? DEFAULT_MIN_COMMITS;
  const brainDir = await resolveBrainDir(opts.root, opts.brainPath);
  if (!brainDir || !(await pathExists(path.join(brainDir, "projects")))) {
    log.warn(
      brainDir
        ? `No harness-brain found at ${brainDir} (expected a "projects" folder).`
        : "No harness-brain configured, so there is no history to learn from yet.",
    );
    if (opts.json) {
      // Keep stdout valid JSON for scripts; the hint above went to stderr.
      process.stdout.write("[]\n");
      return [];
    }
    log.detail("Point Harness at your brain checkout, then run this again:");
    log.detail("  macOS / Linux / Git Bash:  export HARNESS_BRAIN_PATH=../harness-brain");
    log.detail('  Windows PowerShell:        $env:HARNESS_BRAIN_PATH = "..\\harness-brain"');
    log.detail("  Or pass it once:           harness lessons --brain ../harness-brain");
    return [];
  }

  const lessons = findRepeatedLessons(await collectBrainTodos(brainDir), { minCommits });
  if (opts.json) {
    process.stdout.write(JSON.stringify(lessons, null, 2) + "\n");
  } else {
    process.stdout.write(renderLessons(lessons, minCommits) + "\n");
  }
  if (opts.propose) await writeProposal(opts, lessons, minCommits);
  return lessons;
}

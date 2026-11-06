/**
 * `harness doctor` — one command that answers "is my setup healthy, and what
 * should I do next?" in plain English.
 *
 * It only reads files; it never changes anything. Each check returns a small
 * finding (`ok`, `warn` or `fail`) with a `fix` hint. The checks are pure
 * functions so they can be unit-tested without a real project on disk.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  collectBaseMcpNames,
  loadModelMap,
  loadPlatforms,
  loadSubagents,
  loadTriggerMap,
  projectPaths,
} from "../project.js";
import { buildRoster } from "../build.js";
import { listPlatforms } from "../adapters/registry.js";
import { which } from "../foundation/exec.js";
import { pathExists } from "../util/fsx.js";
import { log } from "../util/log.js";
import type { GeneratedFile } from "../adapters/types.js";
import type { TriggerMap } from "../resolution/trigger-resolver.js";

export type Severity = "ok" | "warn" | "fail";

export interface Finding {
  severity: Severity;
  /** What was checked, in plain English. */
  message: string;
  /** What the developer should do, when severity is not "ok". */
  fix?: string;
}

// commander v15 (our CLI parser) needs Node 22.12 or newer.
export const MIN_NODE = { major: 22, minor: 12 };

/** Check the running Node.js version. `version` looks like "22.4.0". */
export function checkNodeVersion(version: string): Finding {
  const [major = Number.NaN, minor = 0] = version.split(".").map((n) => Number.parseInt(n, 10));
  const ok =
    major > MIN_NODE.major || (major === MIN_NODE.major && minor >= MIN_NODE.minor);
  if (ok) {
    return { severity: "ok", message: `Node.js ${version}` };
  }
  return {
    severity: "fail",
    message: `Node.js ${version} is too old (need ${MIN_NODE.major}.${MIN_NODE.minor} or newer)`,
    fix: "Install a newer Node.js from https://nodejs.org (or run `nvm install 22`).",
  };
}

/** Check that the configured platform names are ones Harness knows. */
export function checkPlatforms(
  platforms: readonly string[],
  known: readonly string[] = listPlatforms(),
): Finding {
  const unknown = platforms.filter((p) => !known.includes(p));
  if (unknown.length === 0) {
    return { severity: "ok", message: `Platform(s): ${platforms.join(", ")}` };
  }
  return {
    severity: "fail",
    message: `Unknown platform(s) in .harness/config.yaml: ${unknown.join(", ")}`,
    fix: `Use one of: ${known.join(", ")}.`,
  };
}

/** Line endings differ between Windows and macOS/Linux; compare without them. */
const normalize = (s: string) => s.replace(/\r\n/g, "\n");

export interface GeneratedState {
  missing: string[];
  stale: string[];
}

/**
 * Compare freshly generated files with what is on disk.
 * `readExisting` returns the file text, or `undefined` when it does not exist.
 */
export async function compareGenerated(
  expected: readonly GeneratedFile[],
  readExisting: (relPath: string) => Promise<string | undefined>,
): Promise<GeneratedState> {
  const state: GeneratedState = { missing: [], stale: [] };
  for (const file of expected) {
    const actual = await readExisting(file.relPath);
    if (actual === undefined) state.missing.push(file.relPath);
    else if (normalize(actual) !== normalize(file.contents)) state.stale.push(file.relPath);
  }
  return state;
}

export function checkGenerated(platform: string, state: GeneratedState): Finding {
  const fix = `Run \`harness build-agents -p ${platform}\` to regenerate them.`;
  if (state.missing.length === 0 && state.stale.length === 0) {
    return { severity: "ok", message: `${platform}: generated agent files are up to date` };
  }
  const parts: string[] = [];
  if (state.missing.length) parts.push(`${state.missing.length} missing`);
  if (state.stale.length) parts.push(`${state.stale.length} out of date`);
  return { severity: "warn", message: `${platform}: ${parts.join(", ")} generated file(s)`, fix };
}

/** Count trigger bindings that are still unconfirmed best-guess defaults. */
export function countUnverified(map: TriggerMap, platforms: readonly string[]): number {
  let n = 0;
  for (const p of platforms) {
    for (const binding of Object.values(map[p] ?? {})) {
      if (binding && binding.verified === false) n++;
    }
  }
  return n;
}

export function checkUnverifiedTriggers(count: number): Finding {
  if (count === 0) return { severity: "ok", message: "All trigger bindings are verified" };
  return {
    severity: "warn",
    message: `${count} trigger binding(s) are unverified defaults`,
    fix: "Run `harness hooks` to see them. Check the platform's current hook docs, then set `verified: true` in .harness/trigger-map.yaml.",
  };
}

/** A model lineup older than this many days is probably out of date. */
export const MODEL_MAP_MAX_AGE_DAYS = 90;

const LAST_REVIEWED = /^#\s*last-reviewed:\s*(\d{4})-(\d{2})-(\d{2})\s*$/m;

/**
 * Model names change every few months. `model-map.yaml` carries a comment line
 * `# last-reviewed: YYYY-MM-DD`. Warn when that date is missing or too old.
 * `now` is a parameter so tests do not depend on today's date.
 */
export function checkModelMapFreshness(
  text: string,
  now: Date = new Date(),
  maxAgeDays: number = MODEL_MAP_MAX_AGE_DAYS,
): Finding {
  const fix =
    "Check each platform's current model list, update .harness/model-map.yaml, then set `# last-reviewed:` to today's date (YYYY-MM-DD).";
  const m = LAST_REVIEWED.exec(text);
  if (!m) {
    return {
      severity: "warn",
      message: "model-map.yaml has no `# last-reviewed: YYYY-MM-DD` line, so we cannot tell if the model names are current",
      fix,
    };
  }
  const reviewed = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(reviewed)) {
    return { severity: "warn", message: "model-map.yaml `last-reviewed` is not a valid date", fix };
  }
  const days = Math.floor((now.getTime() - reviewed) / 86_400_000);
  if (days > maxAgeDays) {
    return {
      severity: "warn",
      message: `Model names were last reviewed ${days} days ago (limit: ${maxAgeDays})`,
      fix,
    };
  }
  return { severity: "ok", message: "Model names were reviewed recently" };
}

/** Worst severity wins: fail > warn > ok. */
export function overallSeverity(findings: readonly Finding[]): Severity {
  if (findings.some((f) => f.severity === "fail")) return "fail";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  return "ok";
}

export interface DoctorOptions {
  root: string;
}

export async function runDoctor(opts: DoctorOptions): Promise<Severity> {
  const findings: Finding[] = [];
  const paths = projectPaths(opts.root);

  log.step(`Harness doctor — ${process.platform}, Node ${process.versions.node}`);
  findings.push(checkNodeVersion(process.versions.node));

  const hasGit = await which("git");
  findings.push(
    hasGit
      ? { severity: "ok", message: "git is installed" }
      : {
          severity: "fail",
          message: "git was not found on PATH",
          fix: "Install git from https://git-scm.com and reopen your terminal.",
        },
  );

  if (!(await pathExists(paths.subagentsDir)) || !(await pathExists(paths.config))) {
    findings.push({
      severity: "fail",
      message: "This folder is not set up for Harness yet",
      fix: "Run `harness init` in your project root.",
    });
    return report(findings);
  }

  try {
    const agents = await loadSubagents(opts.root);
    findings.push({ severity: "ok", message: `${agents.length} agent spec(s) are valid` });

    const platforms = await loadPlatforms(opts.root);
    findings.push(checkPlatforms(platforms));

    const known = platforms.filter((p) => listPlatforms().includes(p));
    const modelMap = await loadModelMap(opts.root);
    const triggerMap = await loadTriggerMap(opts.root);
    for (const platform of known) {
      const built = buildRoster(agents, {
        platform,
        modelMap,
        baseMcpNames: collectBaseMcpNames(agents),
      });
      if (built.errors.length > 0) {
        findings.push({
          severity: "fail",
          message: `${platform}: ${built.errors.length} agent(s) cannot be built`,
          fix: `Run \`harness build-agents -p ${platform}\` to see the full error list.`,
        });
        continue;
      }
      const expected = built.results.flatMap((r) => [r.file, ...r.manualFiles]);
      const state = await compareGenerated(expected, (rel) =>
        fs.readFile(path.join(opts.root, rel), "utf8").catch(() => undefined),
      );
      findings.push(checkGenerated(platform, state));
    }
    findings.push(checkUnverifiedTriggers(countUnverified(triggerMap, known)));
    findings.push(
      checkModelMapFreshness(await fs.readFile(paths.modelMap, "utf8")),
    );
  } catch (err) {
    findings.push({
      severity: "fail",
      message: err instanceof Error ? err.message : String(err),
      fix: "Fix the file named above, then run `harness doctor` again.",
    });
  }

  return report(findings);
}

function report(findings: Finding[]): Severity {
  for (const f of findings) {
    if (f.severity === "ok") log.ok(f.message);
    else if (f.severity === "warn") log.warn(f.message);
    else log.error(f.message);
    if (f.fix && f.severity !== "ok") log.detail(`→ ${f.fix}`);
  }
  const overall = overallSeverity(findings);
  log.step(
    overall === "ok"
      ? "All good."
      : overall === "warn"
        ? "Works, but see the warnings above."
        : "Problems found — fix the items marked ✗ first.",
  );
  return overall;
}

/**
 * harness-brain setup for `harness init`.
 *
 * Commit-memory is optional. If the developer opts in, we either CLONE the
 * default harness-brain template repo or SCAFFOLD the same structure locally
 * (offline) at a path they choose. Either way they get the brain layout shown
 * in the bundled examples, then point `HARNESS_BRAIN_PATH` at it. The decision
 * is recorded in `.harness/config.yaml` so it is not re-asked.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import readline from "node:readline/promises";
import { run, which } from "../foundation/exec.js";
import { pathExists, ensureDir } from "../util/fsx.js";
import { confirm, isApproved } from "../util/consent.js";
import { templatesDir } from "../templates.js";
import { log } from "../util/log.js";
/** Default upstream repo cloned when the developer opts into "clone". */
export const DEFAULT_BRAIN_REPO = "https://github.com/cloudbloqavi/harness-brain.git";
/** Default location, a sibling of the project so the brain is its own repo. */
export const DEFAULT_BRAIN_DIR = "../harness-brain";
/** Normalise a free-form source choice ("1"/"clone"/"s"/"scaffold"). */
export function parseBrainSource(raw, fallback = "clone") {
    const v = (raw ?? "").trim().toLowerCase();
    if (["clone", "c", "1", "git"].includes(v))
        return "clone";
    if (["scaffold", "s", "2", "local", "copy"].includes(v))
        return "scaffold";
    return fallback;
}
/** Resolve the chosen path to an absolute target + a root-relative form. */
export function resolveBrainPath(root, input) {
    const chosen = input && input.trim() ? input.trim() : DEFAULT_BRAIN_DIR;
    const abs = path.resolve(root, chosen);
    const rel = path.relative(root, abs);
    return { abs, stored: rel === "" ? "." : rel };
}
export async function cloneBrain(repo, abs, opts) {
    if (opts.dryRun) {
        return { ok: true, message: `would run: git clone --depth 1 ${repo} ${abs}` };
    }
    if (!(await which("git"))) {
        return {
            ok: false,
            message: "git not found on PATH — cannot clone. Re-run with " +
                "`--brain-source scaffold`, or install git.",
        };
    }
    const res = await run("git", ["clone", "--depth", "1", repo, abs], {
        timeoutMs: 120_000,
    });
    if (res.code !== 0) {
        return {
            ok: false,
            message: `git clone failed (exit ${res.code}): ${res.stderr.trim() || res.stdout.trim()}`,
        };
    }
    return { ok: true, message: `cloned ${repo} -> ${abs}` };
}
export async function scaffoldBrain(abs) {
    const tpl = path.join(await templatesDir(), "brain");
    if (!(await pathExists(tpl))) {
        return { ok: false, message: `brain template missing at ${tpl}` };
    }
    await ensureDir(abs);
    await fs.cp(tpl, abs, { recursive: true });
    return { ok: true, message: `scaffolded brain structure -> ${abs}` };
}
async function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        return (await rl.question(question)).trim();
    }
    finally {
        rl.close();
    }
}
/**
 * Orchestrate the opt-in brain setup and return the config to persist.
 * Never throws on a failed clone — it falls back to a local scaffold so init
 * always completes.
 */
export async function setupBrain(opts) {
    const { root } = opts;
    if (opts.skipBrain) {
        log.detail("harness-brain setup skipped (--skip-brain)");
        return { enabled: false };
    }
    const flagsGiven = Boolean(opts.brainPath || opts.brainSource || opts.brainRepo);
    const interactive = Boolean(process.stdin.isTTY) && !opts.assumeYes;
    // 1. Decide whether to set up a brain at all.
    if (!flagsGiven) {
        if (!interactive) {
            log.detail("harness-brain not configured (pass --brain <path> to enable).");
            return { enabled: false };
        }
        const ans = await confirm("Set up a harness-brain commit-memory for this project?", { projectRoot: root, key: "brain", allowAlways: false });
        if (!isApproved(ans)) {
            log.detail("harness-brain declined — add it later with `harness init --brain <path>`.");
            return { enabled: false };
        }
    }
    // 2. Path + source (prompt when interactive and not provided).
    let pathInput = opts.brainPath;
    let source = parseBrainSource(opts.brainSource);
    if (interactive && !opts.brainPath) {
        pathInput = await ask(`Path for harness-brain [${DEFAULT_BRAIN_DIR}]: `);
    }
    if (interactive && !opts.brainSource) {
        const raw = await ask("Source — 1) clone the default harness-brain repo  " +
            "2) scaffold the structure locally  [1]: ");
        source = parseBrainSource(raw);
    }
    const { abs, stored } = resolveBrainPath(root, pathInput);
    const repo = opts.brainRepo ?? DEFAULT_BRAIN_REPO;
    // 3. Never clobber an existing non-empty directory.
    if (await pathExists(abs)) {
        const entries = await fs.readdir(abs).catch(() => []);
        if (entries.length > 0) {
            log.warn(`${abs} already exists and is not empty — leaving it as-is.`);
            log.info(`Point the agents at it:  export HARNESS_BRAIN_PATH=${abs}`);
            return {
                enabled: true,
                path: stored,
                source,
                ...(source === "clone" ? { repo } : {}),
            };
        }
    }
    // 4. Perform the chosen action; fall back to scaffold if a clone fails.
    const result = source === "clone"
        ? await cloneBrain(repo, abs, { dryRun: opts.dryRun })
        : await scaffoldBrain(abs);
    if (result.ok) {
        log.ok(`harness-brain: ${result.message}`);
        log.info(`Point the agents at it:  export HARNESS_BRAIN_PATH=${abs}`);
        return {
            enabled: true,
            path: stored,
            source,
            ...(source === "clone" ? { repo } : {}),
        };
    }
    log.warn(`harness-brain: ${result.message}`);
    if (source === "clone" && !opts.dryRun) {
        log.detail("Falling back to a local scaffold...");
        const fb = await scaffoldBrain(abs);
        if (fb.ok) {
            log.ok(`harness-brain: ${fb.message}`);
            log.info(`Point the agents at it:  export HARNESS_BRAIN_PATH=${abs}`);
            return { enabled: true, path: stored, source: "scaffold" };
        }
        log.warn(`harness-brain: ${fb.message}`);
    }
    return { enabled: false };
}
//# sourceMappingURL=setup.js.map
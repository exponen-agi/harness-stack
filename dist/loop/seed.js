/**
 * The iteration seed — the materialized "context-reset" contract for agentic
 * loops (borrow-now stage 1 & 2).
 *
 * An agentic loop re-runs an agent until a goal or stopping condition is met.
 * The single biggest failure mode is *drift*: each turn accretes noise from the
 * previous turn and the agent slowly forgets the goal. The discipline that
 * prevents it is to RESET context every iteration and re-seed from a stable
 * source of truth rather than the previous turn's transcript.
 *
 * This module assembles that seed. It is deliberately usable TODAY, in the
 * default human-in-the-loop mode (`harness seed`), and is the exact input the
 * future opt-in loop controller will feed on every iteration. It builds no
 * loop and runs no agent — it only assembles the seed.
 *
 * The seed has two planes, matching the "cron + decision-maker" model:
 *   - NORTH STAR  (invariant) — the goal/spec, fed UNCHANGED every iteration.
 *   - CURRENT STATE (mutable) — the brain's compact rollup: "read the current
 *     state of the work before acting". This is where harness-brain doubles as
 *     loop-state (#2): the compact rollup is the per-iteration state digest;
 *     the detailed logs remain the append-only audit trail.
 * plus two static guardrails woven in: the verification pair as the stop/continue
 * signal, and the fresh-context mandate (re-research each turn, never from
 * stale memory).
 */
import path from "node:path";
import fs from "node:fs/promises";
import { pathExists } from "../util/fsx.js";
/** Files, in priority order, that can supply the north-star goal. */
const NORTH_STAR_SOURCES = [
    ".harness/SEED.md",
    ".specify/memory/constitution.md",
    "specs", // most-recent specs/<n>/spec.md — handled specially
    "README.md",
];
async function readFirst(root, rel) {
    const abs = path.join(root, rel);
    if (!(await pathExists(abs)))
        return null;
    try {
        const text = (await fs.readFile(abs, "utf8")).trim();
        return text.length ? text : null;
    }
    catch {
        return null;
    }
}
/** The newest `specs/<something>/spec.md` (spec-kit greenfield/brownfield layout). */
async function latestSpec(root) {
    const specsDir = path.join(root, "specs");
    if (!(await pathExists(specsDir)))
        return null;
    try {
        const entries = await fs.readdir(specsDir, { withFileTypes: true });
        const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
        // Names are typically numbered/dated, so the last sorted is the newest.
        for (const d of dirs.reverse()) {
            const spec = path.join(specsDir, d, "spec.md");
            if (await pathExists(spec)) {
                const text = (await fs.readFile(spec, "utf8")).trim();
                if (text.length)
                    return { text, source: `specs/${d}/spec.md` };
            }
        }
    }
    catch {
        /* fall through */
    }
    return null;
}
async function resolveNorthStar(root) {
    for (const rel of NORTH_STAR_SOURCES) {
        if (rel === "specs") {
            const spec = await latestSpec(root);
            if (spec)
                return spec;
            continue;
        }
        const text = await readFirst(root, rel);
        if (text)
            return { text: firstSection(text, rel), source: rel };
    }
    return {
        source: "(none found)",
        text: "No north-star found. Create `.harness/SEED.md` with the stable goal / " +
            "spec for this work — it is fed unchanged on every loop iteration and is " +
            "the single biggest lever on loop quality (a vague seed compounds into " +
            "confident, repeated errors).",
    };
}
/** For a long README, keep the first section so the seed stays tight. Files
 * authored to BE the north-star (SEED.md, a Spec Kit constitution) are kept
 * whole — truncating them would drop the very substance fed each iteration. */
function firstSection(text, rel) {
    if (rel === ".harness/SEED.md" || rel.endsWith("constitution.md"))
        return text;
    const lines = text.split("\n");
    const out = [];
    let seenHeading = false;
    for (const line of lines) {
        const isH = /^#{1,6}\s/.test(line);
        if (isH && seenHeading)
            break;
        if (isH)
            seenHeading = true;
        out.push(line);
        if (out.length >= 40)
            break;
    }
    return out.join("\n").trim();
}
/**
 * Locate the brain's current-state digest for this repo: find the repo folder
 * under `projects/<brain>/<repo>/`, then read the newest compact rollup at that
 * brain's root. Degrades gracefully when the brain or repo is absent.
 */
export async function findBrainCompact(brainPath, repoName) {
    const projects = path.join(brainPath, "projects");
    if (!(await pathExists(projects)))
        return null;
    try {
        const brains = await fs.readdir(projects, { withFileTypes: true });
        for (const b of brains) {
            if (!b.isDirectory())
                continue;
            const brainDir = path.join(projects, b.name);
            const repoDir = path.join(brainDir, repoName);
            if (!(await pathExists(repoDir)))
                continue;
            // Found a brain holding the repo — read the newest compact rollup at its
            // root. If this brain has no rollup yet, keep scanning: a repo normally
            // lives in exactly one brain, but don't give up on a half-populated one.
            const files = (await fs.readdir(brainDir))
                .filter((f) => /-HAR-compact\.md$/.test(f))
                .sort();
            if (!files.length)
                continue;
            const newest = files[files.length - 1];
            const text = (await fs.readFile(path.join(brainDir, newest), "utf8")).trim();
            return { text, source: `${b.name}/${newest}` };
        }
    }
    catch {
        /* fall through */
    }
    return null;
}
const NO_STATE = "No brain state yet. Once `commit-brain-agent` has written a compact rollup, " +
    "the most recent one is injected here as the loop's current-state digest " +
    "(harness-brain as loop-state). Until then, each iteration starts from the " +
    "north-star only.";
const GUARDRAILS = [
    "STOP/CONTINUE via the verification pair, not self-assessment: an iteration " +
        "is only 'done' when the verifier-agent returns PASS (tests green + change " +
        "covered) and the drift-reviewer-agent reports no unresolved drift. Plan " +
        "them with `harness check`; the host agent loop runs them (/verify + " +
        "/review-drift).",
    "HARD LIMITS are mandatory: cap max iterations and a token/time budget, and " +
        "stop on no-progress (same verdict N turns running). No stopping condition " +
        "means runaway cost — never omit it.",
    "HUMAN-IN-THE-LOOP is the default: findings surface for review before commit. " +
        "The autonomous loop controller is strictly opt-in.",
];
const FRESH_CONTEXT = "Re-establish fresh context every iteration: agents with " +
    "requires_fresh_context re-verify library/API/version/CVE facts via " +
    "web_search + Context7 each turn — never from stale memory or a previous " +
    "turn's transcript.";
/**
 * Assemble the canonical iteration seed. Pure with respect to the filesystem it
 * reads; writes nothing.
 */
export async function assembleSeed(opts) {
    const repoName = opts.repoName ?? path.basename(path.resolve(opts.root));
    const northStar = await resolveNorthStar(opts.root);
    const brainPath = opts.brainPath ??
        process.env.HARNESS_BRAIN_PATH ??
        (opts.brain?.enabled && opts.brain.path
            ? path.resolve(opts.root, opts.brain.path)
            : undefined);
    let currentState = {
        text: NO_STATE,
        source: "(no brain configured)",
    };
    if (brainPath) {
        const found = await findBrainCompact(brainPath, repoName);
        currentState = found ?? { text: NO_STATE, source: `${brainPath} (no rollup for ${repoName})` };
    }
    return {
        northStar,
        currentState,
        guardrails: GUARDRAILS,
        freshContext: FRESH_CONTEXT,
    };
}
/** Render the seed as the Markdown block fed to an iteration (or printed). */
export function renderSeed(seed) {
    const bullets = (xs) => xs.map((x) => `- ${x}`).join("\n");
    return [
        "# Harness iteration seed",
        "",
        "<!-- The stable context fed at the START of every loop iteration, after a",
        "     context reset. Re-seed from THIS, never from the previous turn. -->",
        "",
        `## North star (invariant)  ·  source: ${seed.northStar.source}`,
        "",
        seed.northStar.text,
        "",
        `## Current state (from harness-brain)  ·  source: ${seed.currentState.source}`,
        "",
        seed.currentState.text,
        "",
        "## Guardrails (stop / continue)",
        "",
        bullets(seed.guardrails),
        "",
        "## Fresh context",
        "",
        seed.freshContext,
        "",
    ].join("\n");
}
//# sourceMappingURL=seed.js.map
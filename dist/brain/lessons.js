/**
 * Repeated lessons: the self-improvement step of the harness-brain loop.
 *
 * `commit-brain-agent` writes a "**Flags / to-dos:**" line for every commit.
 * When the SAME to-do shows up in two or more different commits, it is no
 * longer a one-off: it is a lesson the team keeps re-learning. This module
 * finds those repeats so a person can turn them into a permanent rule (an
 * `AGENTS.md` line, an agent prompt rule, or an eval scenario).
 *
 * Rules on purpose:
 *   - Read-only. It never edits the brain, the specs, or any prompt.
 *   - A lesson is only a CANDIDATE. It becomes a rule only through a normal,
 *     reviewed pull request (the same gate as every other spec change).
 *   - Deterministic, no network, no model call: plain token overlap, so the
 *     result is the same on every machine and in CI.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { pathExists } from "../util/fsx.js";
/** Two to-dos with at least this token overlap count as the same lesson. */
export const DEFAULT_SIMILARITY = 0.5;
/** A lesson must appear in at least this many different commits. */
export const DEFAULT_MIN_COMMITS = 2;
const EMPTY_VALUES = new Set(["none", "n/a", "na", "-", "tbd", "todo", "nothing", "no"]);
const STOP = new Set([
    "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "by",
    "is", "are", "be", "this", "that", "it", "as", "at", "from", "into", "via",
    "after", "before", "once", "when", "then", "we", "our", "its", "add", "post",
]);
function tokens(text) {
    return new Set(text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 2 && !STOP.has(t))
        // crude singular form, so "routes" and "route" match
        .map((t) => (t.endsWith("s") && t.length > 4 ? t.slice(0, -1) : t)));
}
/** Overlap coefficient (shared tokens / smaller set) in [0, 1]. */
export function lessonSimilarity(a, b) {
    const sa = tokens(a);
    const sb = tokens(b);
    if (sa.size === 0 || sb.size === 0)
        return 0;
    let shared = 0;
    for (const t of sa)
        if (sb.has(t))
            shared++;
    return shared / Math.min(sa.size, sb.size);
}
/** Remove Markdown noise so two to-dos compare on words, not formatting. */
function clean(item) {
    return item
        .replace(/^[-*+]\s+/, "")
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .replace(/[.\s]+$/, "")
        .trim();
}
/** Split one "Flags / to-dos" value into separate to-do items. */
export function splitTodos(value) {
    return value
        .split(/\n\s*[-*+]\s+|;|\.\s+(?=[A-Z`])/)
        .map(clean)
        .filter((t) => t.length >= 3 && !EMPTY_VALUES.has(t.toLowerCase()));
}
/**
 * Pull every to-do out of one detailed log (`<YY-MM-DD>-HAR.md`). Pure: it
 * only looks at the text, so it is easy to test. Handles Windows (CRLF)
 * line endings.
 */
export function extractTodos(text, file) {
    const body = text.replace(/\r\n/g, "\n");
    const out = [];
    for (const section of body.split(/^## /m).slice(1)) {
        const heading = section.split("\n", 1)[0] ?? "";
        const sha = /^([0-9a-f]{7,40})\b/i.exec(heading)?.[1] ?? "";
        const match = /\*\*Flags \/ to-dos:?\*\*[ \t]*([\s\S]*?)(?=\n\*\*[^*\n]+:?\*\*|\n## |$)/.exec(section);
        if (!match?.[1])
            continue;
        for (const todo of splitTodos(match[1]))
            out.push({ text: todo, sha, file });
    }
    return out;
}
/**
 * Group similar to-dos and keep the groups seen in at least `minCommits`
 * different commits. Greedy and order-stable: each item joins the first
 * group whose title is similar enough, so the output never changes between
 * runs on the same input.
 */
export function findRepeatedLessons(items, opts = {}) {
    const minCommits = opts.minCommits ?? DEFAULT_MIN_COMMITS;
    const similarity = opts.similarity ?? DEFAULT_SIMILARITY;
    const groups = [];
    for (const item of items) {
        const group = groups.find((g) => lessonSimilarity(g.title, item.text) >= similarity);
        if (group)
            group.items.push(item);
        else
            groups.push({ title: item.text, items: [item] });
    }
    return groups
        .map((g) => ({
        title: g.title,
        items: g.items,
        commits: new Set(g.items.map((i) => `${i.file}#${i.sha}`)).size,
    }))
        .filter((g) => g.commits >= minCommits)
        .sort((a, b) => b.commits - a.commits);
}
/** Every detailed log under `<brain>/projects/<brain-n>/<repo>/`. */
async function listDetailedLogs(brainPath) {
    const projects = path.join(brainPath, "projects");
    if (!(await pathExists(projects)))
        return [];
    const found = [];
    for (const brain of await fs.readdir(projects, { withFileTypes: true })) {
        if (!brain.isDirectory())
            continue;
        const brainDir = path.join(projects, brain.name);
        for (const repo of await fs.readdir(brainDir, { withFileTypes: true })) {
            if (!repo.isDirectory())
                continue;
            const repoDir = path.join(brainDir, repo.name);
            for (const f of (await fs.readdir(repoDir)).sort()) {
                if (/^\d{2}-\d{2}-\d{2}-HAR\.md$/.test(f))
                    found.push(path.join(repoDir, f));
            }
        }
    }
    return found.sort();
}
/**
 * Read every detailed log in a brain checkout and return its to-dos.
 * Missing folders give an empty list, never an error.
 */
export async function collectBrainTodos(brainPath) {
    const projects = path.join(brainPath, "projects");
    const items = [];
    for (const abs of await listDetailedLogs(brainPath)) {
        // Always "/" in output, so the report reads the same on Windows.
        const rel = path.relative(projects, abs).split(path.sep).join("/");
        items.push(...extractTodos(await fs.readFile(abs, "utf8"), rel));
    }
    return items;
}
/** Plain-English report. Empty input gives a short "nothing yet" message. */
export function renderLessons(lessons, minCommits) {
    if (lessons.length === 0) {
        return [
            `No repeated lessons yet (no to-do appears in ${minCommits}+ different commits).`,
            "That is good news. Run this again after more commits.",
        ].join("\n");
    }
    const lines = [
        `Repeated lessons (each seen in ${minCommits}+ different commits):`,
        "",
    ];
    lessons.forEach((l, i) => {
        lines.push(`${i + 1}. ${l.title}  (${l.commits} commits)`);
        for (const item of l.items) {
            lines.push(`   - ${item.file}${item.sha ? ` @ ${item.sha}` : ""}: ${item.text}`);
        }
        lines.push("");
    });
    lines.push("How to use this (nothing was changed for you):", "  1. Pick a lesson that should never need a reminder again.", "  2. Turn it into ONE rule: a line in AGENTS.md, a rule in an agent's", "     .subagents/*.yaml prompt, or a scenario in your evals.", "  3. Run `harness build-agents` and `npm run eval:agents -- --strict`,", "     then open a pull request so a person reviews the rule.");
    return lines.join("\n");
}
//# sourceMappingURL=lessons.js.map
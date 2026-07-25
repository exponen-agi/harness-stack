/**
 * Interactive agentic-platform selection for `harness init`.
 *
 * The whole framework is platform-agnostic, so the first init decision is:
 * which agentic environment(s) are you using? A repo may target several at once
 * (e.g. Claude Code + Cursor), so selection is multi-choice. We ask rather than
 * silently defaulting, then resolve models, capabilities, and event hooks for
 * every chosen platform.
 */
import readline from "node:readline/promises";
import { listAdapters } from "../adapters/registry.js";
import { log } from "../util/log.js";
function validate(ids, known) {
    const unknown = ids.filter((id) => !known.includes(id));
    if (unknown.length > 0) {
        throw new Error(`Unknown platform(s): ${unknown.join(", ")}. Known: ${known.join(", ")}.`);
    }
    return [...new Set(ids)];
}
/** Parse a free-form selection ("1,3" / "claude-code cursor" / "all"). */
export function parseSelection(raw, ids) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === "")
        return [ids[0]];
    if (trimmed === "all" || trimmed === "*")
        return [...ids];
    const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
    const picked = [];
    for (const tok of tokens) {
        const n = Number(tok);
        if (Number.isInteger(n) && n >= 1 && n <= ids.length) {
            picked.push(ids[n - 1]);
        }
        else if (ids.includes(tok)) {
            picked.push(tok);
        }
    }
    return [...new Set(picked)];
}
export async function selectPlatforms(opts = {}) {
    const adapters = listAdapters();
    const ids = adapters.map((a) => a.id);
    if (opts.preselected && opts.preselected.length > 0) {
        return validate(opts.preselected, ids);
    }
    const fallback = opts.fallback ?? ids[0];
    if (!process.stdin.isTTY)
        return [fallback];
    log.step("Which agentic coding platform(s) are you using?");
    log.detail("Select one or more — a repo can target several at once.");
    adapters.forEach((a, i) => log.info(`  ${i + 1}) ${a.displayName} (${a.id})`));
    log.detail('Enter numbers/ids separated by space or comma, or "all".');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        const raw = await rl.question(`Select (default 1): `);
        const picked = parseSelection(raw, ids);
        if (picked.length === 0) {
            log.warn(`No valid choice; using ${adapters[0].displayName}.`);
            return [adapters[0].id];
        }
        return picked;
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=select-platform.js.map
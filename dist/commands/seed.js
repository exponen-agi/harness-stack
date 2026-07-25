/**
 * `harness seed` — print the canonical iteration seed for this project: the
 * stable north-star (invariant goal/spec) plus the brain's current-state
 * digest, with the guardrails and fresh-context mandate woven in.
 *
 * This is the human-in-the-loop default made concrete: run it to get the exact
 * context you should feed at the start of each iteration (after a reset), and
 * it is the same seed the future opt-in loop controller will feed automatically.
 * Read-only — it assembles and prints, nothing else.
 */
import { loadBrainConfig } from "../project.js";
import { assembleSeed, renderSeed } from "../loop/seed.js";
export async function runSeed(opts) {
    const brain = await loadBrainConfig(opts.root);
    const seed = await assembleSeed({ root: opts.root, brain, repoName: opts.repoName });
    process.stdout.write(renderSeed(seed) + "\n");
}
//# sourceMappingURL=seed.js.map
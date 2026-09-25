#!/usr/bin/env node
/**
 * Drift check: `templates/brain/` must stay byte-identical to the harness-brain
 * repo's content (the subtrees a scaffold reproduces). Run after editing either
 * side so the bundled scaffold never diverges from the live example repo.
 *
 * Usage:
 *   node scripts/check-brain-template.mjs [path-to-harness-brain]
 *
 * The brain checkout is resolved from, in order:
 *   1. the CLI argument
 *   2. $HARNESS_BRAIN_DIR
 *   3. ../harness-brain (sibling checkout)
 *
 * Exit codes: 0 = in sync · 1 = drift · 2 = brain checkout not found.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Top-level entries a scaffold reproduces (everything else in the brain — .git,
 *  .github CI — is repo-specific and intentionally not bundled). */
const TRACKED = ["README.md", "_templates", "projects"];

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "..", "templates", "brain");
const brainDir = path.resolve(
  process.argv[2] || process.env.HARNESS_BRAIN_DIR || path.join(here, "..", "..", "harness-brain"),
);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Recursively list files under `root` limited to `roots` (default: the
 *  TRACKED top-level entries), as paths relative to `root`. Exported so the
 *  walk itself is unit-testable against disposable temp directories, without
 *  a live sibling checkout. */
export async function listTracked(root, roots = TRACKED) {
  const out = [];
  async function walk(rel) {
    const abs = path.join(root, rel);
    const st = await fs.stat(abs);
    if (st.isDirectory()) {
      for (const name of await fs.readdir(abs)) {
        await walk(path.join(rel, name));
      }
    } else {
      out.push(rel);
    }
  }
  for (const top of roots) {
    if (await exists(path.join(root, top))) await walk(top);
  }
  return out.sort();
}

/**
 * Byte-for-byte compare each `common` path between two roots. Exported (same
 * reason as `listTracked`) so the content-drift half of the check also runs
 * against disposable temp directories instead of only ever being exercised
 * via a live CI clone.
 *
 * @param {string} baseA
 * @param {string} baseB
 * @param {readonly string[]} commonPaths relative paths present under both
 * @returns {Promise<string[]>} the subset of commonPaths whose content differs
 */
export async function computeContentDrift(baseA, baseB, commonPaths) {
  const drifted = [];
  for (const rel of commonPaths) {
    const [a, b] = await Promise.all([
      fs.readFile(path.join(baseA, rel), "utf8"),
      fs.readFile(path.join(baseB, rel), "utf8"),
    ]);
    if (a !== b) drifted.push(rel);
  }
  return drifted;
}

async function main() {
  if (!(await exists(templateDir))) {
    console.error(`✗ template dir missing: ${templateDir}`);
    process.exit(1);
  }
  if (!(await exists(brainDir))) {
    console.error(
      `! harness-brain checkout not found at: ${brainDir}\n` +
        `  Pass a path, set HARNESS_BRAIN_DIR, or place it at ../harness-brain.`,
    );
    process.exit(2);
  }

  const [tplFiles, brainFiles] = await Promise.all([
    listTracked(templateDir),
    listTracked(brainDir),
  ]);

  const tplSet = new Set(tplFiles);
  const brainSet = new Set(brainFiles);

  const missingFromTemplate = brainFiles.filter((f) => !tplSet.has(f)); // in brain, not bundled
  const extraInTemplate = tplFiles.filter((f) => !brainSet.has(f)); // bundled, not in brain
  const common = tplFiles.filter((f) => brainSet.has(f));

  const contentDrift = await computeContentDrift(templateDir, brainDir, common);

  const problems =
    missingFromTemplate.length + extraInTemplate.length + contentDrift.length;

  if (problems === 0) {
    console.log(
      `✓ templates/brain/ is in sync with ${path.relative(process.cwd(), brainDir) || brainDir} ` +
        `(${common.length} files checked)`,
    );
    process.exit(0);
  }

  console.error("✗ templates/brain/ has drifted from the harness-brain repo:\n");
  for (const f of missingFromTemplate)
    console.error(`  - in brain, missing from template:  ${f}`);
  for (const f of extraInTemplate)
    console.error(`  - in template, missing from brain:  ${f}`);
  for (const f of contentDrift)
    console.error(`  - content differs:                  ${f}`);
  console.error(
    `\nResync: copy the brain's ${TRACKED.join(", ")} into templates/brain/ ` +
      `(or update the brain), then re-run \`npm run verify:brain-template\`.`,
  );
  process.exit(1);
}

// Only run the CLI when this file is executed directly — not when
// listTracked/computeContentDrift are imported for unit testing.
if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

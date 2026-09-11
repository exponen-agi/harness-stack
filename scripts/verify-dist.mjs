#!/usr/bin/env node
/**
 * Drift check: the committed `dist/` must match what `npm run build` produces
 * from the current `src/`. `dist/` is intentionally checked into git (see the
 * README's "Why is dist/ committed?" note) so `npm install -g` from a git URL
 * still works when devDependencies aren't installed. That convenience has a
 * cost: nothing else stops a contributor from editing `src/`, forgetting to
 * rebuild, and committing a stale `dist/` with every other local check green.
 * This script is that catch — run it before opening a PR, or let CI run it.
 *
 * Usage:
 *   npm run verify:dist
 *
 * Exit codes: 0 = dist/ is fresh · 1 = dist/ is stale or the build failed.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/**
 * Parse `git status --porcelain -- dist` output into a list of changed paths,
 * relative to the repo root. Pure function — no filesystem/process access —
 * so it's unit-testable without a real build.
 *
 * @param {string} porcelain
 * @returns {string[]}
 */
export function changedPaths(porcelain) {
  return porcelain
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(3).trim());
}

function main() {
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });

  const porcelain = execFileSync(
    "git",
    ["status", "--porcelain", "--", "dist"],
    { cwd: root, encoding: "utf8" },
  );

  const changed = changedPaths(porcelain);
  if (changed.length === 0) {
    console.log("[verify-dist] dist/ matches a fresh build of src/.");
    return;
  }

  console.error(
    "[verify-dist] dist/ is out of date with src/. Run `npm run build` and commit the result:\n",
  );
  for (const f of changed) console.error(`  - ${f}`);
  process.exitCode = 1;
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? "")) {
  main();
}

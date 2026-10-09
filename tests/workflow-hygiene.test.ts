import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
 * Security hygiene for GitHub Actions workflows. Agent tooling is a target for
 * prompt-injection and supply-chain attacks, so CI must not run with the broad
 * default token. Every workflow (and the eval-gate template we ship to users)
 * must declare a top-level `permissions:` block, and must not grant write
 * access there.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  ...["ci.yml"].map((f) => path.join(root, ".github", "workflows", f)),
  path.join(root, "templates", "evals", "eval-gate.example.yml"),
];

describe("workflow token permissions", () => {
  for (const file of files) {
    it(`${path.relative(root, file)} declares read-only top-level permissions`, async () => {
      const doc = YAML.parse(await fs.readFile(file, "utf8")) as {
        permissions?: unknown;
      };
      expect(doc.permissions, "missing top-level `permissions:`").toBeTruthy();
      const perms = doc.permissions;
      if (typeof perms === "string") {
        expect(perms).toBe("read-all");
      } else {
        for (const [scope, level] of Object.entries(perms as Record<string, string>)) {
          expect(level, `${scope} must not be write at the top level`).not.toBe("write");
        }
      }
    });
  }

  it("covers every workflow file in .github/workflows", async () => {
    const all = (await fs.readdir(path.join(root, ".github", "workflows"))).filter((f) =>
      /\.ya?ml$/.test(f),
    );
    expect(all.sort()).toEqual(["ci.yml"]);
  });
});

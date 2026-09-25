import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  listTracked,
  computeContentDrift,
} from "../scripts/check-brain-template.mjs";

/**
 * scripts/check-brain-template.mjs previously ran its file-walk and
 * content-comparison logic only against a live sibling `../harness-brain`
 * checkout (in CI, or a developer's own machine). These tests exercise both
 * pieces against disposable temp directories instead, so they're covered
 * without a network call or a real sibling repo.
 */

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-stack-brain-template-test-"));
}

async function writeFiles(base: string, files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(base, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
  }
}

describe("listTracked", () => {
  it("finds nested files under the given roots only, sorted", async () => {
    const base = await makeTempDir();
    try {
      await writeFiles(base, {
        "README.md": "hello",
        "_templates/YY-MM-DD-HAR.md": "template",
        "projects/brain-1/README.md": "brain one",
        "projects/brain-1/ledger-api/README.md": "nested",
        "not-tracked/ignored.md": "should not appear",
      });
      const found = await listTracked(base, ["README.md", "_templates", "projects"]);
      // listTracked joins path segments with path.join, which is
      // backslash-separated on Windows — build expectations the same way
      // rather than hardcoding "/", so this test holds on every OS.
      expect(found).toEqual([
        "README.md",
        path.join("_templates", "YY-MM-DD-HAR.md"),
        path.join("projects", "brain-1", "README.md"),
        path.join("projects", "brain-1", "ledger-api", "README.md"),
      ]);
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it("returns an empty list when none of the tracked roots exist", async () => {
    const base = await makeTempDir();
    try {
      const found = await listTracked(base, ["README.md", "_templates", "projects"]);
      expect(found).toEqual([]);
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });

  it("defaults to the module's own TRACKED roots when none are passed", async () => {
    const base = await makeTempDir();
    try {
      await writeFiles(base, {
        "README.md": "hello",
        "projects/brain-1/README.md": "brain one",
        "not-tracked/ignored.md": "should not appear",
      });
      const found = await listTracked(base);
      expect(found).toEqual(["README.md", path.join("projects", "brain-1", "README.md")]);
    } finally {
      await fs.rm(base, { recursive: true, force: true });
    }
  });
});

describe("computeContentDrift", () => {
  it("reports no drift when common files are identical", async () => {
    const a = await makeTempDir();
    const b = await makeTempDir();
    try {
      await writeFiles(a, { "README.md": "same content\n" });
      await writeFiles(b, { "README.md": "same content\n" });
      const drift = await computeContentDrift(a, b, ["README.md"]);
      expect(drift).toEqual([]);
    } finally {
      await fs.rm(a, { recursive: true, force: true });
      await fs.rm(b, { recursive: true, force: true });
    }
  });

  it("flags only the files whose content actually differs", async () => {
    const a = await makeTempDir();
    const b = await makeTempDir();
    try {
      await writeFiles(a, {
        "README.md": "same content\n",
        "_templates/YY-MM-DD-HAR.md": "template v1\n",
      });
      await writeFiles(b, {
        "README.md": "same content\n",
        "_templates/YY-MM-DD-HAR.md": "template v2 — edited on one side only\n",
      });
      const drift = await computeContentDrift(a, b, [
        "README.md",
        "_templates/YY-MM-DD-HAR.md",
      ]);
      expect(drift).toEqual(["_templates/YY-MM-DD-HAR.md"]);
    } finally {
      await fs.rm(a, { recursive: true, force: true });
      await fs.rm(b, { recursive: true, force: true });
    }
  });
});

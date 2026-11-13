import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectBrainTodos,
  extractTodos,
  findRepeatedLessons,
  lessonSimilarity,
  renderLessons,
  splitTodos,
  type LessonItem,
} from "../src/brain/lessons.js";
import { parseMinCommits, resolveBrainDir } from "../src/commands/lessons.js";

const bundledBrain = path.resolve(__dirname, "../templates/brain");

const LOG = `# api — 26-06-07  (detailed log)

## 7f3a9c1 — Add v2

**What changed:** Added v2.

**Why:** Speed.

**Files:** \`a.ts\`

**Flags / to-dos:** Remove the \`/v1\` route after the sunset window; add metrics
on cursor depth.

## a9f0c12 — Headers

**What changed:** Headers.

**Why:** Signals.

**Files:** \`b.ts\`

**Flags / to-dos:** None.
`;

const tempDirs: string[] = [];
afterEach(async () => {
  for (const d of tempDirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
});

describe("splitTodos", () => {
  it("splits on ';', sentences and bullets, and drops 'None'", () => {
    expect(splitTodos("Fix A; fix B. Then fix C.")).toEqual(["Fix A", "fix B", "Then fix C"]);
    expect(splitTodos("\n- one thing\n- two things")).toEqual(["one thing", "two things"]);
    expect(splitTodos("None.")).toEqual([]);
    expect(splitTodos("N/A")).toEqual([]);
  });
});

describe("extractTodos", () => {
  it("reads every Flags / to-dos item with its commit SHA", () => {
    const items = extractTodos(LOG, "brain-1/api/26-06-07-HAR.md");
    expect(items.map((i) => i.text)).toEqual([
      "Remove the /v1 route after the sunset window",
      "add metrics on cursor depth",
    ]);
    expect(items.every((i) => i.sha === "7f3a9c1")).toBe(true);
  });

  it("gives the same result for Windows (CRLF) line endings", () => {
    const lf = extractTodos(LOG, "f");
    const crlf = extractTodos(LOG.replace(/\n/g, "\r\n"), "f");
    expect(crlf).toEqual(lf);
  });

  it("returns nothing when no section has the field", () => {
    expect(extractTodos("# x\n\n## abc1234 — y\n\n**Why:** z\n", "f")).toEqual([]);
  });
});

describe("findRepeatedLessons", () => {
  const item = (text: string, sha: string, file = "brain-1/r/26-01-01-HAR.md"): LessonItem => ({
    text,
    sha,
    file,
  });

  it("groups similar to-dos from different commits", () => {
    const lessons = findRepeatedLessons([
      item("Remove the /v1 route after the sunset window", "aaaaaaa"),
      item("Remove the /v1 fallback shim post-sunset", "bbbbbbb"),
      item("Add a dark mode toggle", "ccccccc"),
    ]);
    expect(lessons).toHaveLength(1);
    expect(lessons[0]!.commits).toBe(2);
    expect(lessons[0]!.title).toBe("Remove the /v1 route after the sunset window");
  });

  it("does not count the same commit twice", () => {
    const lessons = findRepeatedLessons([
      item("Rotate the API key", "aaaaaaa"),
      item("Rotate the API keys", "aaaaaaa"),
    ]);
    expect(lessons).toEqual([]);
  });

  it("respects minCommits and sorts the most repeated first", () => {
    const items = [
      item("Pin the promptfoo version", "a000001"),
      item("Pin promptfoo version again", "a000002"),
      item("Update the changelog", "b000001"),
      item("Update changelog", "b000002"),
      item("Update the changelog entry", "b000003"),
    ];
    const two = findRepeatedLessons(items);
    expect(two.map((l) => l.commits)).toEqual([3, 2]);
    expect(findRepeatedLessons(items, { minCommits: 3 })).toHaveLength(1);
  });

  it("scores unrelated text as not similar", () => {
    expect(lessonSimilarity("Add dark mode", "Rotate API key")).toBe(0);
    expect(lessonSimilarity("", "anything")).toBe(0);
  });
});

describe("collectBrainTodos (real files)", () => {
  it("finds the repeated /v1 sunset lesson in the bundled sample brain", async () => {
    const lessons = findRepeatedLessons(await collectBrainTodos(bundledBrain));
    expect(lessons).toHaveLength(1);
    expect(lessons[0]!.items.map((i) => i.file).sort()).toEqual([
      "brain-1/ledger-api/26-06-07-HAR.md",
      "brain-1/ledger-web/26-06-07-HAR.md",
    ]);
  });

  it("uses '/' in paths and ignores files that are not detailed logs", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lessons-"));
    tempDirs.push(dir);
    const repo = path.join(dir, "projects", "brain-1", "api");
    await fs.mkdir(repo, { recursive: true });
    await fs.writeFile(path.join(repo, "26-06-07-HAR.md"), LOG);
    await fs.writeFile(path.join(repo, "README.md"), "**Flags / to-dos:** Ignore me");
    const items = await collectBrainTodos(dir);
    expect(items).toHaveLength(2);
    expect(items[0]!.file).toBe("brain-1/api/26-06-07-HAR.md");
  });

  it("returns an empty list for a folder with no brain", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lessons-"));
    tempDirs.push(dir);
    expect(await collectBrainTodos(dir)).toEqual([]);
  });
});

describe("renderLessons", () => {
  it("says so plainly when there is nothing to promote", () => {
    expect(renderLessons([], 2)).toContain("No repeated lessons yet");
  });

  it("lists sources and tells the reader to use a pull request", () => {
    const text = renderLessons(
      [{ title: "Fix X", commits: 2, items: [{ text: "Fix X", sha: "abc1234", file: "b/r/f.md" }] }],
      2,
    );
    expect(text).toContain("b/r/f.md @ abc1234");
    expect(text).toContain("pull request");
  });
});

describe("lessons command helpers", () => {
  it("only accepts a whole number of 2 or more for --min", () => {
    expect(parseMinCommits("3")).toBe(3);
    expect(() => parseMinCommits("1")).toThrow();
    expect(() => parseMinCommits("two")).toThrow();
    expect(() => parseMinCommits("2.5")).toThrow();
  });

  it("prefers an explicit --brain path over the environment", async () => {
    const before = process.env.HARNESS_BRAIN_PATH;
    process.env.HARNESS_BRAIN_PATH = "from-env";
    try {
      const root = path.resolve("/tmp/project");
      expect(await resolveBrainDir(root, "explicit")).toBe(path.resolve(root, "explicit"));
      expect(await resolveBrainDir(root)).toBe(path.resolve(root, "from-env"));
    } finally {
      if (before === undefined) delete process.env.HARNESS_BRAIN_PATH;
      else process.env.HARNESS_BRAIN_PATH = before;
    }
  });
});

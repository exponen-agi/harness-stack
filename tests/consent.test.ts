import { describe, it, expect, vi, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { confirm, isApproved } from "../src/util/consent.js";

// Hoisted by vitest to the top of the file (ahead of the import above), so
// every `confirm()` call in this file that reaches the interactive branch
// uses this mock instead of a real TTY prompt. Tests that stay on the
// assumeYes / non-interactive / persisted-store paths never touch it.
vi.mock("node:readline/promises", () => ({
  default: {
    createInterface: () => ({
      question: async () => "always",
      close: () => {},
    }),
  },
}));

/**
 * consent.ts is the invariant gate: "Harness never writes to .subagents/,
 * installs tooling, or invokes a skill without developer consent." These
 * tests exercise that gate directly, since nothing else in the suite did.
 */

async function makeProjectRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-consent-test-"));
}

async function readStore(root: string): Promise<unknown> {
  const file = path.join(root, ".harness", "consent.json");
  return JSON.parse(await fs.readFile(file, "utf8"));
}

const originalIsTTY = process.stdin.isTTY;

afterEach(() => {
  process.stdin.isTTY = originalIsTTY;
  vi.restoreAllMocks();
});

describe("isApproved()", () => {
  it("treats only 'yes' and 'always' as approval", () => {
    expect(isApproved("yes")).toBe(true);
    expect(isApproved("always")).toBe(true);
    expect(isApproved("no")).toBe(false);
  });
});

describe("confirm(): assumeYes short-circuit", () => {
  it("returns 'yes' immediately without touching the persisted store", async () => {
    const root = await makeProjectRoot();
    const answer = await confirm("Write files?", {
      assumeYes: true,
      projectRoot: root,
      key: "test.write",
    });
    expect(answer).toBe("yes");
    // No store should have been created — assumeYes never persists.
    const storeFile = path.join(root, ".harness", "consent.json");
    await expect(fs.access(storeFile)).rejects.toThrow();
  });
});

describe("confirm(): non-interactive default (no TTY, no --yes)", () => {
  it("defaults to declining ('no') rather than assuming consent", async () => {
    const root = await makeProjectRoot();
    process.stdin.isTTY = undefined;
    const answer = await confirm("Install tooling?", {
      projectRoot: root,
      key: "test.install",
    });
    expect(answer).toBe("no");
  });

  it("does not persist a decline reached via the non-interactive default", async () => {
    const root = await makeProjectRoot();
    process.stdin.isTTY = undefined;
    await confirm("Install tooling?", { projectRoot: root, key: "test.install" });
    const storeFile = path.join(root, ".harness", "consent.json");
    await expect(fs.access(storeFile)).rejects.toThrow();
  });
});

describe("confirm(): persisted 'always' and 'declined' memory", () => {
  it("returns 'always' without re-prompting once a key was approved 'always'", async () => {
    const root = await makeProjectRoot();
    await fs.mkdir(path.join(root, ".harness"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".harness", "consent.json"),
      JSON.stringify({ always: ["test.write"], declined: [] }),
    );
    // No TTY and no assumeYes — if the store weren't consulted first, this
    // would fall through to the non-interactive "no" default instead.
    process.stdin.isTTY = undefined;
    const answer = await confirm("Write files?", {
      projectRoot: root,
      key: "test.write",
    });
    expect(answer).toBe("always");
  });

  it("returns 'no' without re-prompting once a key was declined", async () => {
    const root = await makeProjectRoot();
    await fs.mkdir(path.join(root, ".harness"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".harness", "consent.json"),
      JSON.stringify({ always: [], declined: ["test.install"] }),
    );
    process.stdin.isTTY = undefined;
    const answer = await confirm("Install tooling?", {
      projectRoot: root,
      key: "test.install",
    });
    expect(answer).toBe("no");
  });

  it("treats a corrupt consent.json as an empty store instead of throwing", async () => {
    const root = await makeProjectRoot();
    await fs.mkdir(path.join(root, ".harness"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".harness", "consent.json"),
      "{ not valid json",
    );
    process.stdin.isTTY = undefined;
    const answer = await confirm("Write files?", {
      projectRoot: root,
      key: "test.write",
    });
    expect(answer).toBe("no");
  });
});

describe("confirm(): interactive prompt persistence", () => {
  it("persists an 'always' answer to the store for next time", async () => {
    const root = await makeProjectRoot();
    process.stdin.isTTY = true;
    const answer = await confirm("Write files?", {
      projectRoot: root,
      key: "test.write",
      allowAlways: true,
    });
    expect(answer).toBe("always");
    const store = await readStore(root);
    expect(store).toEqual({ always: ["test.write"], declined: [] });
  });
});

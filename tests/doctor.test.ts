import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  checkNodeVersion,
  checkPlatforms,
  compareGenerated,
  checkGenerated,
  countUnverified,
  checkUnverifiedTriggers,
  overallSeverity,
  runDoctor,
} from "../src/commands/doctor.js";
import { needsWindowsShell } from "../src/foundation/exec.js";

describe("checkNodeVersion", () => {
  it.each([["22.12.0"], ["22.22.0"], ["24.1.0"]])("accepts %s", (v) => {
    expect(checkNodeVersion(v).severity).toBe("ok");
  });
  it.each([["20.19.0"], ["22.11.9"], ["garbage"]])("rejects %s with a fix hint", (v) => {
    const f = checkNodeVersion(v);
    expect(f.severity).toBe("fail");
    expect(f.fix).toContain("nodejs.org");
  });
});

describe("checkPlatforms", () => {
  it("passes for known platforms", () => {
    expect(checkPlatforms(["claude-code", "cursor"]).severity).toBe("ok");
  });
  it("fails and names the unknown one", () => {
    const f = checkPlatforms(["claude-code", "vim"]);
    expect(f.severity).toBe("fail");
    expect(f.message).toContain("vim");
  });
});

describe("compareGenerated", () => {
  const files = [
    { relPath: "a.md", contents: "one\ntwo\n" },
    { relPath: "b.md", contents: "same\n" },
    { relPath: "c.md", contents: "new\n" },
  ];
  const disk: Record<string, string> = { "a.md": "one\r\ntwo\r\n", "b.md": "old\n" };

  it("ignores Windows line endings, flags changed and missing files", async () => {
    const state = await compareGenerated(files, async (p) => disk[p]);
    expect(state.stale).toEqual(["b.md"]);
    expect(state.missing).toEqual(["c.md"]);
  });

  it("maps state to a finding with the right rebuild command", () => {
    expect(checkGenerated("cursor", { missing: [], stale: [] }).severity).toBe("ok");
    const f = checkGenerated("cursor", { missing: ["x"], stale: ["y"] });
    expect(f.severity).toBe("warn");
    expect(f.fix).toContain("harness build-agents -p cursor");
  });
});

describe("trigger verification", () => {
  const map = {
    cursor: { on_init: { kind: "native", verified: false }, on_commit: { kind: "git-hook", verified: true } },
    codex: { on_init: { kind: "native", verified: false } },
  } as never;
  it("counts only unverified bindings on the chosen platforms", () => {
    expect(countUnverified(map, ["cursor"])).toBe(1);
    expect(countUnverified(map, ["cursor", "codex", "missing"])).toBe(2);
  });
  it("warns only when something is unverified", () => {
    expect(checkUnverifiedTriggers(0).severity).toBe("ok");
    expect(checkUnverifiedTriggers(2).severity).toBe("warn");
  });
});

describe("overallSeverity", () => {
  it("returns the worst severity", () => {
    const f = (severity: "ok" | "warn" | "fail") => ({ severity, message: "" });
    expect(overallSeverity([f("ok")])).toBe("ok");
    expect(overallSeverity([f("ok"), f("warn")])).toBe("warn");
    expect(overallSeverity([f("warn"), f("fail")])).toBe("fail");
  });
});

describe("needsWindowsShell", () => {
  it("is true only for npm-style shims on Windows", () => {
    expect(needsWindowsShell("claude", "win32")).toBe(true);
    expect(needsWindowsShell("NPM", "win32")).toBe(true);
    expect(needsWindowsShell("git", "win32")).toBe(false);
    expect(needsWindowsShell("claude", "linux")).toBe(false);
    expect(needsWindowsShell("claude", "darwin")).toBe(false);
  });
});

describe("runDoctor on an empty folder", () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-doctor-"));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  it("fails and tells the developer to run harness init", async () => {
    expect(await runDoctor({ root })).toBe("fail");
  });
});

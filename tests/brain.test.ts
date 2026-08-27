import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseBrainSource,
  resolveBrainPath,
  cloneBrain,
  scaffoldBrain,
  setupBrain,
  DEFAULT_BRAIN_DIR,
} from "../src/brain/setup.js";

describe("parseBrainSource", () => {
  it("maps clone synonyms", () => {
    for (const v of ["clone", "c", "1", "git", "CLONE", " 1 "]) {
      expect(parseBrainSource(v)).toBe("clone");
    }
  });
  it("maps scaffold synonyms", () => {
    for (const v of ["scaffold", "s", "2", "local", "copy"]) {
      expect(parseBrainSource(v)).toBe("scaffold");
    }
  });
  it("falls back to clone for empty/unknown", () => {
    expect(parseBrainSource(undefined)).toBe("clone");
    expect(parseBrainSource("nonsense")).toBe("clone");
    expect(parseBrainSource("nonsense", "scaffold")).toBe("scaffold");
  });
});

describe("resolveBrainPath", () => {
  it("defaults to a sibling harness-brain", () => {
    const { abs, stored } = resolveBrainPath("/work/app", undefined);
    expect(abs).toBe(path.resolve("/work/app", DEFAULT_BRAIN_DIR));
    expect(stored).toBe("../harness-brain");
  });
  it("keeps an in-repo relative form", () => {
    const { abs, stored } = resolveBrainPath("/work/app", "memory/brain");
    // `abs` is a native absolute path — on Windows that is D:\work\app\...,
    // so compare against path.resolve rather than a hardcoded POSIX literal.
    expect(abs).toBe(path.resolve("/work/app", "memory/brain"));
    expect(stored).toBe("memory/brain");
  });
  it("stores a POSIX-separated path so the config stays portable", () => {
    // .harness/config.yaml is committed and shared across platforms, so the
    // persisted value must never carry Windows separators.
    for (const input of [undefined, "memory/brain", "../harness-brain"]) {
      const { stored } = resolveBrainPath("/work/app", input);
      expect(stored, `stored for ${String(input)}`).not.toContain("\\");
    }
  });
});

describe("cloneBrain (dry run)", () => {
  it("prints the command without touching the network", async () => {
    const res = await cloneBrain("https://example.com/brain.git", "/tmp/b", {
      dryRun: true,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toContain("git clone --depth 1 https://example.com/brain.git");
  });
});

describe("scaffoldBrain + setupBrain (offline)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "harness-brain-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("copies the bundled brain template into the target", async () => {
    const dest = path.join(tmp, "brain");
    const res = await scaffoldBrain(dest);
    expect(res.ok).toBe(true);
    expect(await fs.readFile(path.join(dest, "README.md"), "utf8")).toContain(
      "Harness Brain",
    );
    // The example structure (brains + templates) comes along.
    await fs.access(path.join(dest, "_templates", "YY-MM-DD-HAR.md"));
    await fs.access(path.join(dest, "projects", "brain-1", "README.md"));
  });

  it("setupBrain scaffolds and returns an enabled config", async () => {
    const dest = path.join(tmp, "memory");
    const cfg = await setupBrain({
      root: tmp,
      brainPath: dest,
      brainSource: "scaffold",
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.source).toBe("scaffold");
    expect(cfg.path).toBe("memory");
    await fs.access(path.join(dest, "projects", "README.md"));
  });

  it("setupBrain honours --skip-brain", async () => {
    const cfg = await setupBrain({ root: tmp, skipBrain: true });
    expect(cfg).toEqual({ enabled: false });
  });

  it("does not clobber an existing non-empty target", async () => {
    const dest = path.join(tmp, "existing");
    await fs.mkdir(dest, { recursive: true });
    await fs.writeFile(path.join(dest, "keep.md"), "mine", "utf8");
    const cfg = await setupBrain({
      root: tmp,
      brainPath: dest,
      brainSource: "scaffold",
    });
    expect(cfg.enabled).toBe(true);
    // The user's file is untouched and no template was copied over it.
    expect(await fs.readFile(path.join(dest, "keep.md"), "utf8")).toBe("mine");
    expect(await pathMissing(path.join(dest, "projects"))).toBe(true);
  });
});

async function pathMissing(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return false;
  } catch {
    return true;
  }
}

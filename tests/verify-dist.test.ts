import { describe, it, expect } from "vitest";
import { changedPaths } from "../scripts/verify-dist.mjs";

describe("changedPaths", () => {
  it("returns an empty list for empty output", () => {
    expect(changedPaths("")).toEqual([]);
  });

  it("returns an empty list for whitespace-only output", () => {
    expect(changedPaths("\n  \n")).toEqual([]);
  });

  it("extracts the path from a modified-file line", () => {
    expect(changedPaths(" M dist/cli.js\n")).toEqual(["dist/cli.js"]);
  });

  it("extracts the path from an untracked-file line", () => {
    expect(changedPaths("?? dist/new-file.js\n")).toEqual(["dist/new-file.js"]);
  });

  it("handles multiple changed files", () => {
    const porcelain = " M dist/cli.js\n M dist/index.js\n?? dist/new-file.js\n";
    expect(changedPaths(porcelain)).toEqual([
      "dist/cli.js",
      "dist/index.js",
      "dist/new-file.js",
    ]);
  });

  it("ignores trailing blank lines", () => {
    expect(changedPaths(" M dist/cli.js\n\n")).toEqual(["dist/cli.js"]);
  });
});

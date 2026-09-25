import { describe, it, expect, vi, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  rankCandidates,
  renderRecommendation,
  recommendSkill,
  SOURCE_PRECEDENCE,
  type SkillCandidate,
} from "../src/skills/router.js";

/**
 * src/skills/router.ts backs the "no skill runs silently" promise
 * (docs/spec-subagents.md's skill recommendation protocol): every
 * recommendation is ranked by a fixed source precedence, rendered with its
 * provenance, and gated on consent. Nothing else in the suite exercised this
 * module directly — consent.test.ts covers consent.ts itself, not the
 * ranking/rendering logic layered on top of it here.
 */

function candidate(overrides: Partial<SkillCandidate> = {}): SkillCandidate {
  return {
    name: "example-skill",
    source: "Harness-native",
    what: "Does an example thing.",
    whyNow: "Because the task at hand needs it.",
    ...overrides,
  };
}

describe("rankCandidates", () => {
  it("orders candidates by source precedence first", () => {
    const ranked = rankCandidates([
      candidate({ name: "native", source: "Harness-native" }),
      candidate({ name: "spec-kit", source: "Spec Kit" }),
      candidate({ name: "allowlist", source: "Curated allowlist" }),
      candidate({ name: "superpowers", source: "Superpowers" }),
    ]);
    expect(ranked.map((c) => c.name)).toEqual([
      "spec-kit",
      "superpowers",
      "allowlist",
      "native",
    ]);
  });

  it("matches the documented SOURCE_PRECEDENCE order exactly", () => {
    expect(SOURCE_PRECEDENCE).toEqual([
      "Spec Kit",
      "Superpowers",
      "Curated allowlist",
      "Harness-native",
    ]);
  });

  it("breaks ties within the same source by score, higher first", () => {
    const ranked = rankCandidates([
      candidate({ name: "low", source: "Curated allowlist", score: 0.2 }),
      candidate({ name: "high", source: "Curated allowlist", score: 0.9 }),
      candidate({ name: "mid", source: "Curated allowlist", score: 0.5 }),
    ]);
    expect(ranked.map((c) => c.name)).toEqual(["high", "mid", "low"]);
  });

  it("treats a missing score as 0 when breaking ties", () => {
    const ranked = rankCandidates([
      candidate({ name: "scored", source: "Harness-native", score: 0.1 }),
      candidate({ name: "unscored", source: "Harness-native" }),
    ]);
    expect(ranked.map((c) => c.name)).toEqual(["scored", "unscored"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      candidate({ name: "b", source: "Harness-native" }),
      candidate({ name: "a", source: "Spec Kit" }),
    ];
    const inputCopy = [...input];
    rankCandidates(input);
    expect(input).toEqual(inputCopy);
  });
});

describe("renderRecommendation", () => {
  it("includes name, source, what, and why-now", () => {
    const rendered = renderRecommendation(
      candidate({
        name: "test-driven-development",
        source: "Superpowers",
        what: "Enforces red-green-refactor.",
        whyNow: "You're about to write a new agent capability.",
      }),
    );
    expect(rendered).toContain("Skill    : test-driven-development");
    expect(rendered).toContain("Source   : Superpowers");
    expect(rendered).toContain("What     : Enforces red-green-refactor.");
    expect(rendered).toContain("Why now  : You're about to write a new agent capability.");
  });

  it("omits the Trust line when trustSignal is not set", () => {
    const rendered = renderRecommendation(candidate());
    expect(rendered).not.toContain("Trust");
  });

  it("includes the Trust line when trustSignal is set", () => {
    const rendered = renderRecommendation(
      candidate({ trustSignal: "vetted, 4.2k stars" }),
    );
    expect(rendered).toContain("Trust    : vetted, 4.2k stars");
  });
});

// Hoisted by vitest to the top of the file (ahead of the router import
// above), same pattern as tests/consent.test.ts, so any recommendSkill()
// call in this file that reaches the interactive branch answers "always"
// instead of hitting a real TTY prompt.
vi.mock("node:readline/promises", () => ({
  default: {
    createInterface: () => ({
      question: async () => "always",
      close: () => {},
    }),
  },
}));

describe("recommendSkill", () => {
  const originalIsTTY = process.stdin.isTTY;

  afterEach(() => {
    process.stdin.isTTY = originalIsTTY;
    vi.restoreAllMocks();
  });

  async function makeProjectRoot(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), "harness-skills-router-test-"));
  }

  it("returns true when consent is given via assumeYes", async () => {
    const root = await makeProjectRoot();
    const approved = await recommendSkill(candidate({ name: "assume-yes-skill" }), {
      assumeYes: true,
      projectRoot: root,
    });
    expect(approved).toBe(true);
  });

  it("returns false (never runs silently) with no TTY and no assumeYes", async () => {
    const root = await makeProjectRoot();
    process.stdin.isTTY = undefined;
    const approved = await recommendSkill(candidate({ name: "no-tty-skill" }), {
      projectRoot: root,
    });
    expect(approved).toBe(false);
  });

  it("keys the persisted consent decision by source and name, so two same-named skills from different sources don't collide", async () => {
    const root = await makeProjectRoot();
    process.stdin.isTTY = true;
    await recommendSkill(candidate({ name: "shared-name", source: "Superpowers" }), {
      projectRoot: root,
    });
    await recommendSkill(candidate({ name: "shared-name", source: "Harness-native" }), {
      projectRoot: root,
    });
    const consentFile = path.join(root, ".harness", "consent.json");
    const store = JSON.parse(await fs.readFile(consentFile, "utf8"));
    expect(store.always).toEqual(
      expect.arrayContaining([
        "skill:Superpowers:shared-name",
        "skill:Harness-native:shared-name",
      ]),
    );
    expect(store.always).toHaveLength(2);
  });
});

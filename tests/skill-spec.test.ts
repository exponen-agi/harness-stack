/**
 * Agent Skills spec check (src/adapters/skill-spec.ts).
 *
 * Unit cases for each rule, plus one end-to-end check: every SKILL.md that
 * the shipped roster generates, on every platform, must follow the spec.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { checkSkillFile, isSkillFile } from "../src/adapters/skill-spec.js";
import { parseSubagent, type Subagent } from "../src/schema.js";
import { buildRoster } from "../src/build.js";
import { collectBaseMcpNames } from "../src/project.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const tplDir = path.join(here, "..", "templates");

const skill = (relPath: string, fm: string, body = "Body text.") => ({
  relPath,
  contents: `---\n${fm}\n---\n\n${body}\n`,
});

describe("isSkillFile", () => {
  it("matches SKILL.md inside a folder, with / or \\ separators", () => {
    expect(isSkillFile(".claude/skills/verify/SKILL.md")).toBe(true);
    expect(isSkillFile(".cursor\\skills\\verify\\SKILL.md")).toBe(true);
    expect(isSkillFile(".claude/commands/verify.md")).toBe(false);
  });
});

describe("checkSkillFile", () => {
  it("passes a valid skill", () => {
    const f = skill(".claude/skills/verify/SKILL.md", "name: verify\ndescription: Runs the tests for a change.");
    expect(checkSkillFile(f)).toEqual([]);
  });

  it("accepts Windows (CRLF) line endings", () => {
    const f = skill(".claude/skills/verify/SKILL.md", "name: verify\ndescription: Runs tests.");
    f.contents = f.contents.replace(/\n/g, "\r\n");
    expect(checkSkillFile(f)).toEqual([]);
  });

  it("flags a missing frontmatter block", () => {
    const f = { relPath: "x/verify/SKILL.md", contents: "# no frontmatter\n" };
    expect(checkSkillFile(f)[0]).toContain("missing YAML frontmatter");
  });

  it("flags a name that does not match its folder", () => {
    const f = skill("x/verify/SKILL.md", "name: check\ndescription: Runs tests.");
    expect(checkSkillFile(f).join()).toContain("must equal its folder name");
  });

  it.each(["Verify", "-verify", "verify-", "ver--ify"])("flags the bad name %s", (name) => {
    const f = skill(`x/${name}/SKILL.md`, `name: "${name}"\ndescription: Runs tests.`);
    expect(checkSkillFile(f).join()).toContain("lowercase letters, numbers and single hyphens");
  });

  it("flags a name longer than 64 chars", () => {
    const name = "a".repeat(65);
    const f = skill(`x/${name}/SKILL.md`, `name: ${name}\ndescription: Runs tests.`);
    expect(checkSkillFile(f).join()).toContain("max 64");
  });

  it("flags a missing or too-long description", () => {
    expect(checkSkillFile(skill("x/verify/SKILL.md", "name: verify")).join()).toContain(
      '"description" is missing',
    );
    const long = skill("x/verify/SKILL.md", `name: verify\ndescription: ${"d".repeat(1025)}`);
    expect(checkSkillFile(long).join()).toContain("max 1024");
  });

  it("flags a body over 500 lines", () => {
    const f = skill("x/verify/SKILL.md", "name: verify\ndescription: Runs tests.", "line\n".repeat(600));
    expect(checkSkillFile(f).join()).toContain("keep it under 500");
  });
});

describe("shipped roster", () => {
  it.each(["claude-code", "antigravity", "codex", "cursor", "copilot"])(
    "every generated SKILL.md on %s follows the Agent Skills spec",
    async (platform) => {
      const dir = path.join(tplDir, "agents");
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".yaml")).sort();
      const agents: Subagent[] = [];
      for (const f of files) {
        agents.push(parseSubagent(YAML.parse(await fs.readFile(path.join(dir, f), "utf8")), f));
      }
      const modelMap = YAML.parse(await fs.readFile(path.join(tplDir, "model-map.yaml"), "utf8"));
      const report = buildRoster(agents, { platform, modelMap, baseMcpNames: collectBaseMcpNames(agents) });
      expect(report.errors).toEqual([]);
      const skills = report.results.flatMap((r) => r.manualFiles).filter((m) => isSkillFile(m.relPath));
      for (const s of skills) expect(checkSkillFile(s)).toEqual([]);
      for (const r of report.results) {
        expect(r.warnings.filter((w) => w.startsWith("Agent Skills spec"))).toEqual([]);
      }
    },
  );
});

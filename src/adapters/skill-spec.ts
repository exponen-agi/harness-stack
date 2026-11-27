/**
 * Agent Skills spec check for generated `SKILL.md` files.
 *
 * Claude Code, Codex, Cursor and Antigravity all read skills in the open
 * Agent Skills format (https://agentskills.io/specification). A tool may
 * skip a skill whose frontmatter breaks the rules, without telling you.
 * This check catches that at build time instead.
 *
 * Rules (from the spec):
 *   - `name`: 1-64 chars, lowercase a-z / 0-9 / hyphens, no hyphen at the
 *     start or end, no "--", and equal to the folder name.
 *   - `description`: 1-1024 chars.
 *   - Body: keep it under 500 lines (a recommendation, so we warn).
 *
 * Pure function, no file system access, so it is easy to unit-test.
 */
import YAML from "yaml";
import type { GeneratedFile } from "./types.js";

export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX_LINES = 500;
const SKILL_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** True when the generated file is a skill (`.../<name>/SKILL.md`). */
export function isSkillFile(relPath: string): boolean {
  return relPath.replace(/\\/g, "/").endsWith("/SKILL.md");
}

/**
 * Check one generated skill file. Returns a list of problems in plain
 * English (empty list = the file follows the spec).
 */
export function checkSkillFile(file: GeneratedFile): string[] {
  const problems: string[] = [];
  const where = file.relPath;
  // Normalise Windows line endings so the check gives the same answer everywhere.
  const text = file.contents.replace(/\r\n/g, "\n");

  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) {
    return [`${where}: missing YAML frontmatter (--- ... ---) at the top`];
  }
  let fm: Record<string, unknown>;
  try {
    const parsed: unknown = YAML.parse(match[1] ?? "");
    fm = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (err) {
    return [`${where}: frontmatter is not valid YAML (${(err as Error).message})`];
  }

  const name = typeof fm.name === "string" ? fm.name : "";
  const folder = where.replace(/\\/g, "/").split("/").slice(-2, -1)[0] ?? "";
  if (!name) {
    problems.push(`${where}: "name" is missing`);
  } else {
    if (name.length > SKILL_NAME_MAX) {
      problems.push(
        `${where}: "name" is ${name.length} chars (max ${SKILL_NAME_MAX}). Set a shorter \`command:\` in the agent spec`,
      );
    }
    if (!SKILL_NAME_RE.test(name)) {
      problems.push(
        `${where}: "name" must use only lowercase letters, numbers and single hyphens`,
      );
    }
    if (folder && name !== folder) {
      problems.push(`${where}: "name" (${name}) must equal its folder name (${folder})`);
    }
  }

  const description = typeof fm.description === "string" ? fm.description.trim() : "";
  if (!description) {
    problems.push(`${where}: "description" is missing or empty`);
  } else if (description.length > SKILL_DESCRIPTION_MAX) {
    problems.push(
      `${where}: "description" is ${description.length} chars (max ${SKILL_DESCRIPTION_MAX}). Shorten the agent's \`description:\``,
    );
  }

  const bodyLines = (match[2] ?? "").split("\n").length;
  if (bodyLines > SKILL_BODY_MAX_LINES) {
    problems.push(
      `${where}: body is ${bodyLines} lines (keep it under ${SKILL_BODY_MAX_LINES}; move detail into linked files)`,
    );
  }

  return problems;
}

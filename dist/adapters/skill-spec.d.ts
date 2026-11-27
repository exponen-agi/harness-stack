import type { GeneratedFile } from "./types.js";
export declare const SKILL_NAME_MAX = 64;
export declare const SKILL_DESCRIPTION_MAX = 1024;
export declare const SKILL_BODY_MAX_LINES = 500;
/** True when the generated file is a skill (`.../<name>/SKILL.md`). */
export declare function isSkillFile(relPath: string): boolean;
/**
 * Check one generated skill file. Returns a list of problems in plain
 * English (empty list = the file follows the spec).
 */
export declare function checkSkillFile(file: GeneratedFile): string[];
//# sourceMappingURL=skill-spec.d.ts.map
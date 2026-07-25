import type { Subagent } from "../schema.js";
export declare function launcherBody(agent: Subagent, kind: "skill" | "command" | "workflow"): string;
/** Wrap a markdown body in a YAML frontmatter block. */
export declare function withFrontmatter(frontmatter: Record<string, unknown>, body: string): string;
//# sourceMappingURL=manual.d.ts.map
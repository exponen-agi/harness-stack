/**
 * Antigravity adapter.
 *
 * Verified: Antigravity has no standalone sub-agent file — agents are expressed
 * as Agent Skills under .agents/skills/<name>/SKILL.md (plus AGENTS.md), and
 * sub-agent definitions live inside skills. So the sub-agent IS the skill here:
 * render() emits a full SKILL.md and renderManual emits only the manual
 * workflow. https://antigravity.google/docs/skills · /docs/subagents
 */
import type { PlatformAdapter } from "./types.js";
export declare const antigravityAdapter: PlatformAdapter;
//# sourceMappingURL=antigravity.d.ts.map
/**
 * Codex adapter.
 *
 * Verified: Codex custom sub-agents are TOML files in .codex/agents/<name>.toml
 * (name, description, developer_instructions, optional model / sandbox_mode);
 * https://developers.openai.com/codex/subagents. Skills are separate
 * (.agents/skills/, see renderManual).
 */
import type { PlatformAdapter } from "./types.js";
export declare const codexAdapter: PlatformAdapter;
//# sourceMappingURL=codex.d.ts.map
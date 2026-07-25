/**
 * GitHub Copilot adapter.
 *
 * Verified: a Copilot custom agent IS the sub-agent — a Markdown file with YAML
 * frontmatter at .github/agents/<name>.agent.md (name, description, tools,
 * model), decision-routed/selectable. Manual invocation is a prompt file at
 * .github/prompts/<name>.prompt.md (/<name>).
 * https://code.visualstudio.com/docs/agent-customization/custom-agents
 */
import type { PlatformAdapter } from "./types.js";
export declare const copilotAdapter: PlatformAdapter;
//# sourceMappingURL=copilot.d.ts.map
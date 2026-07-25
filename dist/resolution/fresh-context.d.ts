/**
 * Fresh-context enforcement (spec R5).
 *
 * Any agent with `requires_fresh_context: true` MUST end up with a resolvable
 * web_search tool AND Context7 available, or the build fails with an
 * actionable error. No agent reasons about libraries, APIs, versions, or CVEs
 * from stale training data.
 */
import type { Subagent } from "../schema.js";
export declare const CONTEXT7_MCP: {
    name: string;
    mode: "url";
    url: string;
    auth: "none";
    base: boolean;
};
export interface FreshContextResult {
    ok: boolean;
    errors: string[];
}
/**
 * Validate an agent's fresh-context requirements against a platform and the
 * set of base MCP servers installed for the project.
 */
export declare function checkFreshContext(agent: Subagent, platform: string, baseMcpNames: ReadonlySet<string>): FreshContextResult;
//# sourceMappingURL=fresh-context.d.ts.map
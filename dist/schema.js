/**
 * Canonical, platform-agnostic sub-agent schema.
 *
 * This is the single source of truth for what a `.subagents/<agent>.yaml`
 * file may contain. Platform-specific agent files (.claude/agents/*.md, etc.)
 * are derived from validated instances of this schema — never authored directly.
 */
import { z } from "zod";
export const MODEL_TIERS = ["fast", "reasoning", "deep", "inherit"];
export const CAPABILITIES = [
    "read",
    "write",
    "exec",
    "web_search",
    "web_fetch",
];
export const AGENT_TYPES = ["on-demand", "continuous"];
export const TRIGGERS = [
    "on_commit",
    "on_check",
    "on_demand",
    "on_init",
];
/**
 * Invocation surfaces an agent can be exposed on, in addition to the
 * always-generated sub-agent file:
 *   - `subagent` — orchestrator/main-agent dispatch (the default).
 *   - `skill`    — a decision-routable skill the main agent can choose to run.
 *   - `command`  — a manual slash command the developer invokes directly.
 */
export const EXPOSURES = ["subagent", "skill", "command"];
const semver = z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "version must be semver, e.g. 1.0.0");
const kebab = z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "name must be kebab-case (lowercase, hyphen-separated)");
const mcpServerSchema = z
    .object({
    name: z.string(),
    mode: z.enum(["url", "npx", "stdio"]),
    url: z.string().optional(),
    package: z.string().optional(),
    command: z.string().optional(),
    auth: z.enum(["none", "env", "oauth"]).default("none"),
    env_var: z.string().optional(),
    base: z.boolean().optional(),
})
    .superRefine((srv, ctx) => {
    if (srv.mode === "url" && !srv.url) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `mcp server "${srv.name}" uses mode=url but has no url`,
        });
    }
    if (srv.mode === "npx" && !srv.package) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `mcp server "${srv.name}" uses mode=npx but has no package`,
        });
    }
    if (srv.mode === "stdio" && !srv.command) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `mcp server "${srv.name}" uses mode=stdio but has no command`,
        });
    }
    if (srv.auth === "env" && !srv.env_var) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `mcp server "${srv.name}" uses auth=env but has no env_var`,
        });
    }
});
const skillRefSchema = z.object({
    name: z.string(),
    path: z.string(),
});
const resourceHintSchema = z.object({
    priority: z.enum(["high", "normal", "low"]).default("normal"),
    max_memory_mb: z.number().int().positive().optional(),
    estimated_duration: z.enum(["fast", "medium", "slow"]).optional(),
});
export const subagentSchema = z
    .object({
    // Identity
    name: kebab,
    version: semver.default("1.0.0"),
    description: z.string().min(1),
    goal: z.string().min(1),
    // Execution model
    type: z.enum(AGENT_TYPES),
    triggers: z.array(z.enum(TRIGGERS)).default(["on_demand"]),
    // Invocation surfaces (sub-agent file is always generated; these add
    // decision-routable skill and/or manual slash-command entry points).
    expose_as: z.array(z.enum(EXPOSURES)).default(["subagent"]),
    /** Explicit slash/skill command name; defaults to the de-suffixed name. */
    command: kebab.optional(),
    // Model (abstract)
    model_tier: z.enum(MODEL_TIERS),
    model_overrides: z.record(z.string(), z.string()).default({}),
    // Capabilities (abstract)
    capabilities: z.array(z.enum(CAPABILITIES)).min(1),
    requires_fresh_context: z.boolean().default(false),
    // Skills + MCP
    skills: z.array(skillRefSchema).default([]),
    mcp_servers: z.array(mcpServerSchema).default([]),
    // Parallelisation + resources
    parallelizable: z.boolean().default(false),
    resource_hint: resourceHintSchema.default({ priority: "normal" }),
    // Memory
    memory_scope: z.enum(["project", "user", "none"]).default("none"),
    // System prompt
    prompt: z.string().min(1),
})
    .strict();
/**
 * The slash/skill command name for an agent: the explicit `command` when set,
 * otherwise the agent name with a trailing `-agent` stripped
 * (e.g. `commit-brain-agent` → `commit-brain`).
 */
export function commandName(agent) {
    return agent.command ?? agent.name.replace(/-agent$/, "");
}
/** Does this agent want a decision-routable skill surface? */
export function exposesSkill(agent) {
    return agent.expose_as.includes("skill");
}
/** Does this agent want a manual slash-command surface? */
export function exposesCommand(agent) {
    return agent.expose_as.includes("command");
}
/** A validation failure with a human-friendly, source-located message. */
export class SubagentValidationError extends Error {
    file;
    issues;
    constructor(file, issues) {
        super(`Invalid sub-agent spec (${file}):\n` +
            issues.map((i) => `  - ${i}`).join("\n"));
        this.file = file;
        this.issues = issues;
        this.name = "SubagentValidationError";
    }
}
/**
 * Parse + validate a raw object into a Subagent. Throws
 * SubagentValidationError with a flat list of readable issues on failure.
 */
export function parseSubagent(raw, file = "<inline>") {
    const result = subagentSchema.safeParse(raw);
    if (!result.success) {
        const issues = result.error.issues.map((i) => {
            const path = i.path.length ? `${i.path.join(".")}: ` : "";
            return `${path}${i.message}`;
        });
        throw new SubagentValidationError(file, issues);
    }
    return result.data;
}
//# sourceMappingURL=schema.js.map
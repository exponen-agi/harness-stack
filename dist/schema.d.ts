/**
 * Canonical, platform-agnostic sub-agent schema.
 *
 * This is the single source of truth for what a `.subagents/<agent>.yaml`
 * file may contain. Platform-specific agent files (.claude/agents/*.md, etc.)
 * are derived from validated instances of this schema — never authored directly.
 */
import { z } from "zod";
export declare const MODEL_TIERS: readonly ["fast", "reasoning", "deep", "inherit"];
export type ModelTier = (typeof MODEL_TIERS)[number];
export declare const CAPABILITIES: readonly ["read", "write", "exec", "web_search", "web_fetch"];
export type Capability = (typeof CAPABILITIES)[number];
export declare const AGENT_TYPES: readonly ["on-demand", "continuous"];
export declare const TRIGGERS: readonly ["on_commit", "on_check", "on_demand", "on_init"];
export type Trigger = (typeof TRIGGERS)[number];
/**
 * Invocation surfaces an agent can be exposed on, in addition to the
 * always-generated sub-agent file:
 *   - `subagent` — orchestrator/main-agent dispatch (the default).
 *   - `skill`    — a decision-routable skill the main agent can choose to run.
 *   - `command`  — a manual slash command the developer invokes directly.
 */
export declare const EXPOSURES: readonly ["subagent", "skill", "command"];
export type Exposure = (typeof EXPOSURES)[number];
export declare const subagentSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodDefault<z.ZodString>;
    description: z.ZodString;
    goal: z.ZodString;
    type: z.ZodEnum<["on-demand", "continuous"]>;
    triggers: z.ZodDefault<z.ZodArray<z.ZodEnum<["on_commit", "on_check", "on_demand", "on_init"]>, "many">>;
    expose_as: z.ZodDefault<z.ZodArray<z.ZodEnum<["subagent", "skill", "command"]>, "many">>;
    /** Explicit slash/skill command name; defaults to the de-suffixed name. */
    command: z.ZodOptional<z.ZodString>;
    model_tier: z.ZodEnum<["fast", "reasoning", "deep", "inherit"]>;
    model_overrides: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    capabilities: z.ZodArray<z.ZodEnum<["read", "write", "exec", "web_search", "web_fetch"]>, "many">;
    requires_fresh_context: z.ZodDefault<z.ZodBoolean>;
    skills: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        path: string;
    }, {
        name: string;
        path: string;
    }>, "many">>;
    mcp_servers: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        mode: z.ZodEnum<["url", "npx", "stdio"]>;
        url: z.ZodOptional<z.ZodString>;
        package: z.ZodOptional<z.ZodString>;
        command: z.ZodOptional<z.ZodString>;
        auth: z.ZodDefault<z.ZodEnum<["none", "env", "oauth"]>>;
        env_var: z.ZodOptional<z.ZodString>;
        base: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        mode: "url" | "npx" | "stdio";
        auth: "none" | "env" | "oauth";
        command?: string | undefined;
        url?: string | undefined;
        package?: string | undefined;
        env_var?: string | undefined;
        base?: boolean | undefined;
    }, {
        name: string;
        mode: "url" | "npx" | "stdio";
        command?: string | undefined;
        url?: string | undefined;
        package?: string | undefined;
        auth?: "none" | "env" | "oauth" | undefined;
        env_var?: string | undefined;
        base?: boolean | undefined;
    }>, {
        name: string;
        mode: "url" | "npx" | "stdio";
        auth: "none" | "env" | "oauth";
        command?: string | undefined;
        url?: string | undefined;
        package?: string | undefined;
        env_var?: string | undefined;
        base?: boolean | undefined;
    }, {
        name: string;
        mode: "url" | "npx" | "stdio";
        command?: string | undefined;
        url?: string | undefined;
        package?: string | undefined;
        auth?: "none" | "env" | "oauth" | undefined;
        env_var?: string | undefined;
        base?: boolean | undefined;
    }>, "many">>;
    parallelizable: z.ZodDefault<z.ZodBoolean>;
    resource_hint: z.ZodDefault<z.ZodObject<{
        priority: z.ZodDefault<z.ZodEnum<["high", "normal", "low"]>>;
        max_memory_mb: z.ZodOptional<z.ZodNumber>;
        estimated_duration: z.ZodOptional<z.ZodEnum<["fast", "medium", "slow"]>>;
    }, "strip", z.ZodTypeAny, {
        priority: "high" | "normal" | "low";
        max_memory_mb?: number | undefined;
        estimated_duration?: "fast" | "medium" | "slow" | undefined;
    }, {
        priority?: "high" | "normal" | "low" | undefined;
        max_memory_mb?: number | undefined;
        estimated_duration?: "fast" | "medium" | "slow" | undefined;
    }>>;
    memory_scope: z.ZodDefault<z.ZodEnum<["project", "user", "none"]>>;
    prompt: z.ZodString;
}, "strict", z.ZodTypeAny, {
    name: string;
    type: "on-demand" | "continuous";
    version: string;
    description: string;
    goal: string;
    triggers: ("on_commit" | "on_check" | "on_demand" | "on_init")[];
    expose_as: ("subagent" | "skill" | "command")[];
    model_tier: "fast" | "reasoning" | "deep" | "inherit";
    model_overrides: Record<string, string>;
    capabilities: ("read" | "write" | "exec" | "web_search" | "web_fetch")[];
    requires_fresh_context: boolean;
    skills: {
        name: string;
        path: string;
    }[];
    mcp_servers: {
        name: string;
        mode: "url" | "npx" | "stdio";
        auth: "none" | "env" | "oauth";
        command?: string | undefined;
        url?: string | undefined;
        package?: string | undefined;
        env_var?: string | undefined;
        base?: boolean | undefined;
    }[];
    parallelizable: boolean;
    resource_hint: {
        priority: "high" | "normal" | "low";
        max_memory_mb?: number | undefined;
        estimated_duration?: "fast" | "medium" | "slow" | undefined;
    };
    memory_scope: "none" | "project" | "user";
    prompt: string;
    command?: string | undefined;
}, {
    name: string;
    type: "on-demand" | "continuous";
    description: string;
    goal: string;
    model_tier: "fast" | "reasoning" | "deep" | "inherit";
    capabilities: ("read" | "write" | "exec" | "web_search" | "web_fetch")[];
    prompt: string;
    command?: string | undefined;
    version?: string | undefined;
    triggers?: ("on_commit" | "on_check" | "on_demand" | "on_init")[] | undefined;
    expose_as?: ("subagent" | "skill" | "command")[] | undefined;
    model_overrides?: Record<string, string> | undefined;
    requires_fresh_context?: boolean | undefined;
    skills?: {
        name: string;
        path: string;
    }[] | undefined;
    mcp_servers?: {
        name: string;
        mode: "url" | "npx" | "stdio";
        command?: string | undefined;
        url?: string | undefined;
        package?: string | undefined;
        auth?: "none" | "env" | "oauth" | undefined;
        env_var?: string | undefined;
        base?: boolean | undefined;
    }[] | undefined;
    parallelizable?: boolean | undefined;
    resource_hint?: {
        priority?: "high" | "normal" | "low" | undefined;
        max_memory_mb?: number | undefined;
        estimated_duration?: "fast" | "medium" | "slow" | undefined;
    } | undefined;
    memory_scope?: "none" | "project" | "user" | undefined;
}>;
export type Subagent = z.infer<typeof subagentSchema>;
/**
 * The slash/skill command name for an agent: the explicit `command` when set,
 * otherwise the agent name with a trailing `-agent` stripped
 * (e.g. `commit-brain-agent` → `commit-brain`).
 */
export declare function commandName(agent: Pick<Subagent, "name" | "command">): string;
/** Does this agent want a decision-routable skill surface? */
export declare function exposesSkill(agent: Pick<Subagent, "expose_as">): boolean;
/** Does this agent want a manual slash-command surface? */
export declare function exposesCommand(agent: Pick<Subagent, "expose_as">): boolean;
/** A validation failure with a human-friendly, source-located message. */
export declare class SubagentValidationError extends Error {
    readonly file: string;
    readonly issues: string[];
    constructor(file: string, issues: string[]);
}
/**
 * Parse + validate a raw object into a Subagent. Throws
 * SubagentValidationError with a flat list of readable issues on failure.
 */
export declare function parseSubagent(raw: unknown, file?: string): Subagent;
//# sourceMappingURL=schema.d.ts.map
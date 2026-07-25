#!/usr/bin/env node
/** Harness CLI entrypoint. */
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runBuildAgents } from "./commands/build-agents.js";
import { runAgentList, runAgentCreate } from "./commands/agent.js";
import { runCheck } from "./commands/check.js";
import { runHooks } from "./commands/hooks.js";
import { runSkills } from "./commands/skills.js";
import { runSeed } from "./commands/seed.js";
import { loadPlatforms } from "./project.js";
import { listPlatforms } from "./adapters/registry.js";
import { log } from "./util/log.js";
const DEFAULT_PLATFORM = process.env.HARNESS_PLATFORM ?? "claude-code";
const program = new Command();
program
    .name("harness")
    .description("AI-native, platform-agnostic engineering harness. Spec-driven sub-agents " +
    "you can drop into any project and run on any agentic coding platform.")
    .version("0.1.0");
program
    .command("init")
    .description("Scaffold .subagents/, .harness/ config, and the foundation.")
    .option("-p, --platform <platforms>", `target platform(s), comma-separated (${listPlatforms().join("|")}); omit to be asked`)
    .option("-y, --yes", "assume yes for all consent prompts", false)
    .option("--skip-foundation", "skip Spec Kit + Superpowers install", false)
    .option("--dry-run-foundation", "print foundation/brain commands without running", false)
    .option("--brain <path>", "set up harness-brain commit-memory at <path>")
    .option("--brain-source <mode>", "harness-brain source: clone | scaffold (default clone)")
    .option("--brain-repo <url>", "override the default harness-brain repo to clone")
    .option("--skip-brain", "skip harness-brain setup", false)
    .action(async (o) => {
    const raw = o.platform ?? process.env.HARNESS_PLATFORM;
    const platforms = raw
        ? String(raw).split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    await runInit({
        root: process.cwd(),
        platforms,
        assumeYes: o.yes,
        skipFoundation: o.skipFoundation,
        dryRunFoundation: o.dryRunFoundation,
        brainPath: o.brain,
        brainSource: o.brainSource,
        brainRepo: o.brainRepo,
        skipBrain: o.skipBrain,
    });
});
program
    .command("build-agents")
    .description("Generate platform-native agent files from .subagents/*.yaml.")
    .option("-p, --platform <platform>", `target one platform (${listPlatforms().join("|")}); default: all configured`)
    .action(async (o) => {
    const root = process.cwd();
    const platforms = o.platform
        ? [o.platform]
        : await loadPlatforms(root, DEFAULT_PLATFORM);
    for (const platform of platforms) {
        await runBuildAgents({ root, platform });
    }
});
const agent = program.command("agent").description("Manage sub-agents.");
agent
    .command("list")
    .description("Print (and refresh) the .subagents/README.md index.")
    .action(async () => {
    await runAgentList(process.cwd());
});
agent
    .command("create <task...>")
    .description("Discover-or-create an agent for a task (consent-gated).")
    .option("-g, --goal <goal>", "single-sentence goal for the agent")
    .option("-y, --yes", "assume yes for all consent prompts", false)
    .action(async (taskParts, o) => {
    await runAgentCreate({
        root: process.cwd(),
        task: taskParts.join(" "),
        goal: o.goal,
        assumeYes: o.yes,
    });
});
program
    .command("check")
    .description("Compute the resource-aware orchestration plan for checks.")
    .option("--all", "include all on_check + on_demand reviewers", false)
    .action(async (o) => {
    await runCheck({ root: process.cwd(), all: o.all });
});
program
    .command("hooks")
    .description("Show how agent triggers resolve to native event hooks.")
    .option("-p, --platform <platform>", `target one platform (${listPlatforms().join("|")}); default: all configured`)
    .action(async (o) => {
    const root = process.cwd();
    const platforms = o.platform
        ? [o.platform]
        : await loadPlatforms(root, DEFAULT_PLATFORM);
    for (const platform of platforms) {
        await runHooks({ root, platform });
    }
});
program
    .command("skills")
    .description("Show how agents are exposed as skills / slash commands.")
    .option("-p, --platform <platform>", `target one platform (${listPlatforms().join("|")}); default: all configured`)
    .action(async (o) => {
    const root = process.cwd();
    const platforms = o.platform
        ? [o.platform]
        : await loadPlatforms(root, DEFAULT_PLATFORM);
    for (const platform of platforms) {
        await runSkills({ root, platform });
    }
});
program
    .command("seed")
    .description("Print the iteration seed (north-star + brain state) for loop/context-reset.")
    .option("--repo <name>", "repo name used to locate the brain folder; default: cwd basename")
    .action(async (o) => {
    await runSeed({ root: process.cwd(), repoName: o.repo });
});
program.parseAsync(process.argv).catch((err) => {
    log.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map
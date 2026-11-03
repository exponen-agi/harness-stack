/**
 * `harness explain` — one plain-English card per agent: what it does, WHEN it
 * runs (trigger -> real hook on your platform), HOW to run it by hand, and
 * what it is allowed to do. It only reads files and changes nothing.
 *
 * It joins what `harness hooks` and `harness skills` show separately, so a
 * developer can answer "who runs, and when?" with a single command.
 */
import { loadSubagents, loadTriggerMap } from "../project.js";
import { commandName, exposesCommand, exposesSkill } from "../schema.js";
import type { Subagent, Trigger } from "../schema.js";
import {
  describeBinding,
  resolveAgentTriggers,
  type TriggerMap,
} from "../resolution/trigger-resolver.js";
import { log } from "../util/log.js";

export interface ExplainOptions {
  root: string;
  platform: string;
  /** Show only this agent (exact name, or name without "-agent"). */
  agent?: string;
}

/** Plain-English meaning of each abstract trigger. */
export const TRIGGER_MEANING: Record<Trigger, string> = {
  on_init: "when a session or project starts",
  on_commit: "after you make a git commit",
  on_check: "when you run `harness check` (or CI runs it)",
  on_demand: "only when you or another agent asks for it",
};

/** Plain-English meaning of each capability. */
export const CAPABILITY_MEANING: Record<string, string> = {
  read: "read files",
  write: "change files",
  exec: "run commands",
  web_search: "search the web",
  web_fetch: "open web pages",
};

/** Pick agents by name. Accepts "verifier" as a short form of "verifier-agent". */
export function selectAgents(agents: Subagent[], wanted?: string): Subagent[] {
  if (!wanted) return agents;
  const w = wanted.trim().toLowerCase();
  return agents.filter(
    (a) => a.name === w || a.name === `${w}-agent` || commandName(a) === w,
  );
}

/** Build the card for one agent as plain lines of text (easy to unit-test). */
export function renderAgentCard(
  agent: Subagent,
  platform: string,
  map: TriggerMap,
): string[] {
  const lines: string[] = [];
  lines.push(`${agent.name}  (v${agent.version})`);
  lines.push(`  Goal:       ${agent.goal}`);

  const runs = resolveAgentTriggers(agent.triggers, platform, map).map(
    (r) => `${TRIGGER_MEANING[r.trigger]} -> ${describeBinding(r.binding)}`,
  );
  lines.push(`  Runs:       ${runs.join("\n              ")}`);

  const how: string[] = [];
  if (exposesCommand(agent)) how.push(`type /${commandName(agent)}`);
  if (exposesSkill(agent)) how.push("ask in plain words (your AI tool picks it)");
  how.push("or let the orchestrator call it");
  lines.push(`  Run by hand: ${how.join("; ")}`);

  const can = agent.capabilities.map((c) => CAPABILITY_MEANING[c] ?? c);
  lines.push(`  Can:        ${can.join(", ")}`);
  if (!agent.capabilities.includes("write")) {
    lines.push("  Safe:       cannot change your files");
  }
  lines.push(
    `  Model:      ${agent.model_tier} tier` +
      (agent.parallelizable ? ", can run in parallel" : ""),
  );
  return lines;
}

export async function runExplain(opts: ExplainOptions): Promise<void> {
  const all = await loadSubagents(opts.root);
  if (all.length === 0) {
    log.warn("No .subagents/*.yaml found. Run `harness init` first.");
    return;
  }
  const picked = selectAgents(all, opts.agent);
  if (picked.length === 0) {
    log.error(
      `No agent named "${opts.agent}". Known agents: ${all.map((a) => a.name).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }
  const map = await loadTriggerMap(opts.root);
  log.step(`Who runs, and when — platform=${opts.platform}`);
  for (const agent of picked) {
    console.log("");
    for (const line of renderAgentCard(agent, opts.platform, map)) {
      console.log(line);
    }
  }
  log.detail("\nTip: `harness hooks` shows the raw wiring; `harness skills` shows the files.");
}

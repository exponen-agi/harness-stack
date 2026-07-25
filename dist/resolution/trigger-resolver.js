/** The Harness-managed fallback used when a platform has no binding. */
export function harnessFallback(trigger) {
    const mechanism = trigger === "on_commit"
        ? "Harness-installed git post-commit hook"
        : trigger === "on_check"
            ? "`harness check` (manual or CI)"
            : trigger === "on_init"
                ? "`harness init` / first-run bootstrap"
                : "direct invocation by the orchestrator";
    return { kind: "harness", mechanism, verified: true };
}
/** Resolve a single trigger for a platform. */
export function resolveTrigger(platform, trigger, map) {
    const platformMap = map[platform];
    if (!platformMap) {
        throw new Error(`No trigger map entry for platform "${platform}". ` +
            `Add a "${platform}:" block to .harness/trigger-map.yaml.`);
    }
    const binding = platformMap[trigger];
    // Absent, or explicitly marked unsupported (kind "harness" with no detail) => fallback.
    if (!binding) {
        return { trigger, binding: harnessFallback(trigger), fellBack: true };
    }
    return { trigger, binding, fellBack: binding.kind === "harness" };
}
/** Resolve every trigger declared by an agent, de-duplicated. */
export function resolveAgentTriggers(triggers, platform, map) {
    const seen = new Set();
    const out = [];
    for (const t of triggers) {
        if (seen.has(t))
            continue;
        seen.add(t);
        out.push(resolveTrigger(platform, t, map));
    }
    return out;
}
export function describeBinding(b) {
    const base = b.kind === "native"
        ? `native hook: ${b.hook}`
        : b.kind === "git-hook"
            ? `git hook: ${b.hook}`
            : `Harness fallback: ${b.mechanism}`;
    const flag = b.verified === false ? " (unverified — confirm via research)" : "";
    return base + flag;
}
//# sourceMappingURL=trigger-resolver.js.map
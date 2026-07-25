/**
 * Spec Kit foundation installer (spec R8).
 *
 * Installs github/spec-kit in skills mode via `uvx`, choosing the init variant
 * by project type: greenfield → `specify init <project>`, brownfield →
 * `specify init --here`. Both pass `--integration <platform> --skills`.
 *
 * Spec Kit is a Python CLI, so this is the one place Harness shells out to
 * Python; `uv` presence is part of the init dependency check.
 */
import { run, which } from "./exec.js";
const SPEC_KIT_GIT = "git+https://github.com/github/spec-kit.git";
/** Map Harness platform ids → Spec Kit `--integration` values. */
const INTEGRATION = {
    "claude-code": "claude",
    codex: "codex",
    antigravity: "gemini",
};
export async function ensureUv() {
    return (await which("uvx")) || (await which("uv"));
}
export function specifyArgs(projectType, platform, projectName) {
    const integration = INTEGRATION[platform] ?? "claude";
    const base = ["--from", SPEC_KIT_GIT, "specify", "init"];
    const target = projectType === "greenfield" ? [projectName] : ["--here"];
    return [
        ...base,
        ...target,
        "--integration",
        integration,
        '--integration-options=--skills',
    ];
}
export async function installSpecKit(projectType, platform, opts) {
    if (!(await ensureUv())) {
        return {
            ok: false,
            skipped: true,
            message: "Spec Kit needs `uv`/`uvx` (https://docs.astral.sh/uv). Install it, " +
                "then re-run `harness init`. Skipping Spec Kit for now.",
        };
    }
    const args = specifyArgs(projectType, platform, opts.projectName);
    if (opts.dryRun) {
        return { ok: true, message: `would run: uvx ${args.join(" ")}` };
    }
    const res = await run("uvx", args, { cwd: opts.cwd, timeoutMs: 180_000 });
    if (res.code !== 0) {
        return {
            ok: false,
            message: `spec-kit init failed (exit ${res.code}): ${res.stderr.trim() || res.stdout.trim()}`,
        };
    }
    return { ok: true, message: "Spec Kit installed in skills mode." };
}
//# sourceMappingURL=spec-kit.js.map
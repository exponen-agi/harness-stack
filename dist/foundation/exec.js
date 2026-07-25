/** Subprocess helper for foundation installers (Spec Kit, Superpowers). */
import { spawn } from "node:child_process";
export function run(command, args, opts = {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: opts.cwd ?? process.cwd(),
            shell: false,
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = opts.timeoutMs
            ? setTimeout(() => {
                timedOut = true;
                child.kill("SIGKILL");
            }, opts.timeoutMs)
            : undefined;
        child.stdout?.on("data", (d) => (stdout += d.toString()));
        child.stderr?.on("data", (d) => (stderr += d.toString()));
        child.on("error", (err) => {
            if (timer)
                clearTimeout(timer);
            resolve({ code: 127, stdout, stderr: stderr + String(err) });
        });
        child.on("close", (code, signal) => {
            if (timer)
                clearTimeout(timer);
            // A process killed by a signal reports code === null. Never coerce that to
            // success (0) — a timed-out or killed installer must surface as failure so
            // `harness init` doesn't report a half-configured project as done.
            if (code === null) {
                const note = timedOut
                    ? `\n[harness] command timed out after ${opts.timeoutMs}ms and was killed (${signal})`
                    : `\n[harness] command killed by signal ${signal}`;
                resolve({ code: timedOut ? 124 : 137, stdout, stderr: stderr + note });
                return;
            }
            resolve({ code, stdout, stderr });
        });
    });
}
/** Is a command available on PATH? */
export async function which(cmd) {
    const probe = process.platform === "win32" ? "where" : "which";
    const { code } = await run(probe, [cmd]);
    return code === 0;
}
//# sourceMappingURL=exec.js.map
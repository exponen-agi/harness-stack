/** Minimal, dependency-free console logging with consistent prefixes. */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => useColor ? `[${code}m${s}[0m` : s;
export const log = {
    info: (msg) => console.log(`${c("36", "›")} ${msg}`),
    ok: (msg) => console.log(`${c("32", "✓")} ${msg}`),
    warn: (msg) => console.warn(`${c("33", "!")} ${msg}`),
    error: (msg) => console.error(`${c("31", "✗")} ${msg}`),
    step: (msg) => console.log(`\n${c("1", msg)}`),
    detail: (msg) => console.log(`  ${c("90", msg)}`),
};
//# sourceMappingURL=log.js.map
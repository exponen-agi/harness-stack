/** Built-in maps for the platforms shipped in v1. */
export const CAPABILITY_MAPS = {
    "claude-code": {
        read: ["Read", "Grep", "Glob"],
        write: ["Write", "Edit"],
        exec: ["Bash"],
        web_search: ["WebSearch"],
        web_fetch: ["WebFetch"],
    },
    antigravity: {
        read: ["read_file", "search"],
        write: ["write_file", "edit_file"],
        exec: ["run_command"],
        // Antigravity gets fresh context via Gemini search grounding, exposed
        // here as an explicit capability the adapter can assert on.
        web_search: ["google_search_grounding"],
        web_fetch: ["fetch_url"],
    },
    codex: {
        read: ["read_file", "grep"],
        write: ["apply_patch"],
        exec: ["shell"],
        web_search: ["web_search"],
        web_fetch: ["web_fetch"],
    },
    // Cursor / Copilot tool names are approximate defaults; the init agent
    // confirms them against current platform docs (fresh-context mandate).
    cursor: {
        read: ["read_file", "codebase_search"],
        write: ["edit_file"],
        exec: ["run_terminal_cmd"],
        web_search: ["web_search"],
        web_fetch: ["fetch"],
    },
    copilot: {
        read: ["read"],
        write: ["editFiles"],
        exec: ["runInTerminal"],
        web_search: ["websearch"],
        web_fetch: ["fetch"],
    },
};
export function resolveCapabilities(capabilities, platform) {
    const map = CAPABILITY_MAPS[platform];
    if (!map) {
        throw new Error(`No capability map for platform "${platform}". ` +
            `Register one in capability-resolver.ts or via an adapter.`);
    }
    const tools = [];
    const unsupported = [];
    for (const cap of capabilities) {
        const native = map[cap];
        if (native && native.length > 0) {
            tools.push(...native);
        }
        else {
            unsupported.push(cap);
        }
    }
    return { tools: [...new Set(tools)], unsupported };
}
/** Does the platform expose any web-search capability for this agent? */
export function hasResolvableSearch(platform) {
    const map = CAPABILITY_MAPS[platform];
    return Boolean(map && map.web_search && map.web_search.length > 0);
}
//# sourceMappingURL=capability-resolver.js.map
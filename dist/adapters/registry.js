import { claudeCodeAdapter } from "./claude-code.js";
import { antigravityAdapter } from "./antigravity.js";
import { codexAdapter } from "./codex.js";
import { cursorAdapter } from "./cursor.js";
import { copilotAdapter } from "./copilot.js";
const ADAPTERS = {
    [claudeCodeAdapter.id]: claudeCodeAdapter,
    [antigravityAdapter.id]: antigravityAdapter,
    [codexAdapter.id]: codexAdapter,
    [cursorAdapter.id]: cursorAdapter,
    [copilotAdapter.id]: copilotAdapter,
};
export function getAdapter(platform) {
    const adapter = ADAPTERS[platform];
    if (!adapter) {
        throw new Error(`Unknown platform "${platform}". Known: ${Object.keys(ADAPTERS).join(", ")}.`);
    }
    return adapter;
}
export function listPlatforms() {
    return Object.keys(ADAPTERS);
}
export function listAdapters() {
    return Object.values(ADAPTERS).map((a) => ({
        id: a.id,
        displayName: a.displayName,
    }));
}
//# sourceMappingURL=registry.js.map
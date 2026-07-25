/** Registry of known platform adapters. */
import type { PlatformAdapter } from "./types.js";
export declare function getAdapter(platform: string): PlatformAdapter;
export declare function listPlatforms(): string[];
export declare function listAdapters(): {
    id: string;
    displayName: string;
}[];
//# sourceMappingURL=registry.d.ts.map
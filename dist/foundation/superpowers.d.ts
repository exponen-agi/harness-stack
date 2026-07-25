export type SuperpowersSupport = "full" | "subset" | "skip";
export interface PlatformSupport {
    level: SuperpowersSupport;
    note: string;
}
export declare function supportFor(platform: string): PlatformSupport;
export interface SuperpowersInstallResult {
    ok: boolean;
    level: SuperpowersSupport;
    message: string;
}
export declare function installSuperpowers(platform: string, opts: {
    cwd: string;
    dryRun?: boolean;
}): Promise<SuperpowersInstallResult>;
//# sourceMappingURL=superpowers.d.ts.map
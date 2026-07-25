export interface BuildAgentsOptions {
    root: string;
    platform: string;
}
export declare function runBuildAgents(opts: BuildAgentsOptions): Promise<{
    written: number;
    manual: number;
}>;
//# sourceMappingURL=build-agents.d.ts.map
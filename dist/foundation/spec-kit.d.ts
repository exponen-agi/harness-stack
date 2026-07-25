export interface SpecKitInstallResult {
    ok: boolean;
    skipped?: boolean;
    message: string;
}
export declare function ensureUv(): Promise<boolean>;
export declare function specifyArgs(projectType: "greenfield" | "brownfield", platform: string, projectName: string): string[];
export declare function installSpecKit(projectType: "greenfield" | "brownfield", platform: string, opts: {
    cwd: string;
    projectName: string;
    dryRun?: boolean;
}): Promise<SpecKitInstallResult>;
//# sourceMappingURL=spec-kit.d.ts.map
import type { GeneratedFile } from "../adapters/types.js";
import type { TriggerMap } from "../resolution/trigger-resolver.js";
export type Severity = "ok" | "warn" | "fail";
export interface Finding {
    severity: Severity;
    /** What was checked, in plain English. */
    message: string;
    /** What the developer should do, when severity is not "ok". */
    fix?: string;
}
export declare const MIN_NODE: {
    major: number;
    minor: number;
};
/** Check the running Node.js version. `version` looks like "22.4.0". */
export declare function checkNodeVersion(version: string): Finding;
/** Check that the configured platform names are ones Harness knows. */
export declare function checkPlatforms(platforms: readonly string[], known?: readonly string[]): Finding;
export interface GeneratedState {
    missing: string[];
    stale: string[];
}
/**
 * Compare freshly generated files with what is on disk.
 * `readExisting` returns the file text, or `undefined` when it does not exist.
 */
export declare function compareGenerated(expected: readonly GeneratedFile[], readExisting: (relPath: string) => Promise<string | undefined>): Promise<GeneratedState>;
export declare function checkGenerated(platform: string, state: GeneratedState): Finding;
/** Count trigger bindings that are still unconfirmed best-guess defaults. */
export declare function countUnverified(map: TriggerMap, platforms: readonly string[]): number;
export declare function checkUnverifiedTriggers(count: number): Finding;
/** Worst severity wins: fail > warn > ok. */
export declare function overallSeverity(findings: readonly Finding[]): Severity;
export interface DoctorOptions {
    root: string;
}
export declare function runDoctor(opts: DoctorOptions): Promise<Severity>;
//# sourceMappingURL=doctor.d.ts.map
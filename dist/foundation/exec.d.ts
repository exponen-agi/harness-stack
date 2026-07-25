export interface RunResult {
    code: number;
    stdout: string;
    stderr: string;
}
export declare function run(command: string, args: string[], opts?: {
    cwd?: string;
    timeoutMs?: number;
}): Promise<RunResult>;
/** Is a command available on PATH? */
export declare function which(cmd: string): Promise<boolean>;
//# sourceMappingURL=exec.d.ts.map
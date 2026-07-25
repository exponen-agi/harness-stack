export declare function pathExists(p: string): Promise<boolean>;
export declare function ensureDir(dir: string): Promise<void>;
export declare function readYaml<T = unknown>(file: string): Promise<T>;
export declare function dumpYaml(value: unknown): string;
export declare function writeYaml(file: string, value: unknown): Promise<void>;
export declare function listFiles(dir: string, ext: string): Promise<string[]>;
/** Write a file only if it does not already exist. Returns true if written. */
export declare function writeIfAbsent(file: string, contents: string): Promise<boolean>;
//# sourceMappingURL=fsx.d.ts.map
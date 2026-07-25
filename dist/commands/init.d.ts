export interface InitOptions {
    root: string;
    /** Explicit platform(s); when omitted, init asks (TTY) or defaults. */
    platforms?: string[];
    assumeYes?: boolean;
    /** Skip the Spec Kit / Superpowers subprocess installs. */
    skipFoundation?: boolean;
    dryRunFoundation?: boolean;
    /** harness-brain: target path (presence enables it non-interactively). */
    brainPath?: string;
    /** harness-brain source: clone | scaffold (default clone). */
    brainSource?: string;
    /** Override the default harness-brain repo to clone. */
    brainRepo?: string;
    /** Skip harness-brain setup entirely. */
    skipBrain?: boolean;
}
export declare function runInit(opts: InitOptions): Promise<void>;
//# sourceMappingURL=init.d.ts.map
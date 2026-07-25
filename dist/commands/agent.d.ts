export declare function runAgentList(root: string): Promise<void>;
export interface AgentCreateOptions {
    root: string;
    task: string;
    goal?: string;
    assumeYes?: boolean;
}
export declare function runAgentCreate(opts: AgentCreateOptions): Promise<void>;
//# sourceMappingURL=agent.d.ts.map
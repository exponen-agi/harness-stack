import { scoreSimilarity } from "./similarity.js";
export const SIMILARITY_THRESHOLD = 0.75;
export function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
export function discover(task, existing) {
    // 1. Exact match by name.
    const exact = existing.find((a) => a.name === task.slug);
    if (exact)
        return { kind: "exact", agent: exact };
    // 2. Similarity over description + goal.
    const taskText = `${task.description} ${task.goal ?? ""}`;
    const matches = existing
        .map((agent) => ({
        agent,
        score: scoreSimilarity(taskText, `${agent.description} ${agent.goal} ${agent.name}`),
    }))
        .filter((h) => h.score >= SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    if (matches.length > 0)
        return { kind: "similar", matches };
    // 3. Nothing close enough — caller should create.
    return { kind: "none" };
}
//# sourceMappingURL=discover.js.map
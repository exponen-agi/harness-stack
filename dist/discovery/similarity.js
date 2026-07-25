/**
 * Lightweight, dependency-free similarity scoring for agent discovery.
 *
 * The spec's Open Questions flag the choice of embeddings vs. keyword overlap
 * vs. an LLM call. v1 ships a fast, deterministic token-overlap scorer so reuse
 * decisions add no latency and no network dependency. The scorer is isolated
 * behind `scoreSimilarity` so it can be swapped for embeddings later without
 * touching the discovery flow.
 *
 * We use the overlap (Szymkiewicz–Simpson) coefficient — intersection over the
 * smaller token set — rather than Jaccard. This matches the spec's "covers
 * ~80%" framing: a focused task that is a near-subset of a broader agent's
 * concept scores high, which is exactly the reuse signal we want.
 */
const STOP = new Set([
    "a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "by",
    "is", "are", "be", "this", "that", "it", "as", "at", "from", "into", "via",
    "agent", "harness", "task", "given", "use", "uses", "using", "runs", "run",
]);
function tokenize(text) {
    return new Set(text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOP.has(t))
        // crude singularisation so "reviews"/"review" match
        .map((t) => (t.endsWith("s") && t.length > 4 ? t.slice(0, -1) : t)));
}
/** Overlap coefficient of two token sets, in [0, 1]. */
export function scoreSimilarity(a, b) {
    const sa = tokenize(a);
    const sb = tokenize(b);
    if (sa.size === 0 || sb.size === 0)
        return 0;
    let inter = 0;
    for (const t of sa)
        if (sb.has(t))
            inter++;
    return inter / Math.min(sa.size, sb.size);
}
//# sourceMappingURL=similarity.js.map
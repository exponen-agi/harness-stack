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
/** Overlap coefficient of two token sets, in [0, 1]. */
export declare function scoreSimilarity(a: string, b: string): number;
//# sourceMappingURL=similarity.d.ts.map
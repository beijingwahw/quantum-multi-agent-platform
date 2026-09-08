/** Replay-stream seed derivation (single source, v0.3.0 face C): bank seed -> stream seed.
 *  Previously the literal 0x5f356495 appeared independently in matching.ts and
 *  kv-tight.ts (byte-identical copies); the replay referee and the replayed
 *  kernels must share ONE convention, so the constant lives here and callers
 *  import it. */
export declare const REPLAY_SEED_XOR = 1597334677;
export declare class Rng {
    readonly seed: number;
    private state;
    constructor(seed: number);
    /** Uniform in [0, 1). */
    next(): number;
    /** Uniform integer in [0, n). */
    int(n: number): number;
    bernoulli(p: number): boolean;
    /** Uniform pick from a non-empty array. */
    pick<T>(items: readonly T[]): T;
    /** In-place Fisher-Yates; returns the same array for chaining. */
    shuffle<T>(items: T[]): T[];
}

/**
 * Deterministic seeded RNG (mulberry32). Every experiment and every stochastic
 * referee in this repository draws randomness exclusively from instances of
 * this class, so any reported number can be regenerated bit-for-bit from a seed.
 */
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

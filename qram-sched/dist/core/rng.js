/**
 * Deterministic seeded RNG (mulberry32). Every experiment and every stochastic
 * referee in this repository draws randomness exclusively from instances of
 * this class, so any reported number can be regenerated bit-for-bit from a seed.
 */
import { reject } from "./errors.js";
/** Replay-stream seed derivation (single source, v0.3.0 face C): bank seed -> stream seed.
 *  Previously the literal 0x5f356495 appeared independently in matching.ts and
 *  kv-tight.ts (byte-identical copies); the replay referee and the replayed
 *  kernels must share ONE convention, so the constant lives here and callers
 *  import it. */
export const REPLAY_SEED_XOR = 0x5f356495;
export class Rng {
    seed;
    state;
    constructor(seed) {
        this.seed = seed;
        this.state = seed >>> 0;
        if (this.state === 0)
            this.state = 0x9e3779b9;
    }
    /** Uniform in [0, 1). */
    next() {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Uniform integer in [0, n). */
    int(n) {
        if (!(n >= 1))
            reject("RNG_INT_RANGE", "int(n) draws from [0, n): n >= 1 required");
        return Math.floor(this.next() * n);
    }
    bernoulli(p) {
        if (!(p >= 0 && p <= 1))
            reject("RNG_BERNOULLI_RANGE", "bernoulli(p) needs p in [0,1]");
        return this.next() < p;
    }
    /** Uniform pick from a non-empty array. */
    pick(items) {
        // v0.3.0: an empty array used to return `undefined as T` — a fabricated
        // value flowing into numeric kernels. Named rejection instead.
        if (items.length === 0)
            reject("RNG_EMPTY_PICK", "pick from an empty array");
        const v = items[this.int(items.length)];
        if (v === undefined)
            reject("RNG_EMPTY_PICK", "pick drew outside the array (int() contract broken)");
        return v;
    }
    /** In-place Fisher-Yates; returns the same array for chaining. */
    shuffle(items) {
        for (let i = items.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            const tmp = items[i];
            items[i] = items[j];
            items[j] = tmp;
        }
        return items;
    }
}

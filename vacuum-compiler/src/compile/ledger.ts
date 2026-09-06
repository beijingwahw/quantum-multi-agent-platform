/**
 * The energy ledger — where the "zero-energy" claim is audited, not asserted.
 *
 * Static mode: storage costs nothing (an eigenstate in a closed system does
 * no work), but reading the clock costs erasing the record of a uniform
 * T+1-outcome measurement: log2(T+1) bits per attempt, expected (T+1)
 * attempts to land on step T. The expected clock-record erasure is therefore
 * (T+1)·log2(T+1) bits = (T+1)·log2(T+1)·kT·ln2 in joules at temperature T.
 *
 * Landauer's constant appears symbolically; the ledger unit is BITS —
 * multiply by kT ln2 for energy (LAND61, citation verified in-house).
 */
import type { Rng } from "./rng.js";

/** Shannon entropy of a uniform distribution on N outcomes, in bits. */
export function uniformEntropyBits(n: number): number {
  return Math.log2(n);
}

/** Expected number of attempts to hit "success" with probability p per try
 * (geometric), plus a seeded Monte-Carlo cross-check. */
export function geometricAttempts(p: number, rng: Rng, trials = 10000): { mean: number; mc: number } {
  const mean = 1 / p;
  let total = 0;
  for (let i = 0; i < trials; i++) {
    let attempts = 1;
    while (!rng.bernoulli(p)) attempts++;
    total += attempts;
  }
  return { mean, mc: total / trials };
}

/** Expected clock-record erasure, static mode, in bits. */
export function staticExpectedErasureBits(clockStates: number): number {
  return clockStates * uniformEntropyBits(clockStates);
}

/** Expected clock-record erasure for an arbitrary per-attempt success
 * probability p (fueled / walk modes): (1/p)·log2(T+1) bits. */
export function expectedErasureBits(probSuccess: number, clockStates: number): number {
  return expectedErasureBitsRaw(probSuccess, uniformEntropyBits(clockStates));
}

function expectedErasureBitsRaw(p: number, entropyBits: number): number {
  return entropyBits / p;
}

/** Direct comparison baseline: running the circuit costs T unitary gates and
 * ZERO erasure — unitary evolution is reversible. This is the wall the README
 * states plainly: the vacuum never beats running the program. */
export function directExecutionErasureBits(): number {
  return 0;
}

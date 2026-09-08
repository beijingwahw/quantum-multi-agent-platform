/**
 * The graduated-boundary tariff cross-check (the dtc-clock face, third path).
 *
 * dtc-clock TC14 legislated a per-run erasure tariff at matched depth 11:
 *   DTC-clocked Bennett 0 < DTC as-built 5 < irreversible Boolean 9
 *   < FK spectral clock 43.02 (QUOTED from this repo's T4 static mode,
 *   (T+1)·log2(T+1) bits at T = 11),
 * and route-price W-E receipted the ordering on its own netlist. Those two
 * repos own the 0/5/9 entries (their wire counts, cited read-only here).
 * What THIS module contributes — the independent third path — is exact
 * INTEGER arithmetic on our own conventions:
 *
 *   every comparison against (T+1)·log2(T+1) is decided by
 *   (T+1)^(T+1)  vs  2^c   (BigInt), because
 *   (T+1)·log2(T+1) < c  ⟺  log2((T+1)^(T+1)) < c  ⟺  (T+1)^(T+1) < 2^c.
 *
 * No floats enter any ordering decision below; float values are computed only
 * for display, after the exact verdict is already on record.
 */

/** The T4 static-mode tariff in bits (float, display only). */
export function fkStaticBits(clockStates: number): number {
  return clockStates * Math.log2(clockStates);
}

function bigPow(base: bigint, exp: number): bigint {
  let out = 1n;
  for (let i = 0; i < exp; i++) out *= base;
  return out;
}

/** Exact: is (T+1)·log2(T+1) < c ? — decided as (T+1)^(T+1) < 2^c. */
export function fkStaticUndercuts(clockStates: number, rivalUnits: number): boolean {
  if (!Number.isInteger(clockStates) || clockStates < 2) {
    throw new Error(`fkStaticUndercuts: clockStates ${clockStates} out of domain`);
  }
  if (!Number.isInteger(rivalUnits) || rivalUnits < 0) {
    throw new Error(`fkStaticUndercuts: rivalUnits ${rivalUnits} out of domain`);
  }
  return bigPow(BigInt(clockStates), clockStates) < bigPow(2n, rivalUnits);
}

/** Exact three-way comparison of (T+1)·log2(T+1) against the integer c:
 * -1 (x < c), 0 (x = c), +1 (x > c) — decided as (T+1)^(T+1) vs 2^c. */
export function fkStaticCompare(clockStates: number, rivalUnits: number): -1 | 0 | 1 {
  if (!Number.isInteger(clockStates) || clockStates < 2) {
    throw new Error(`fkStaticCompare: clockStates ${clockStates} out of domain`);
  }
  if (!Number.isInteger(rivalUnits) || rivalUnits < 0) {
    throw new Error(`fkStaticCompare: rivalUnits ${rivalUnits} out of domain`);
  }
  const lhs = bigPow(BigInt(clockStates), clockStates);
  const rhs = bigPow(2n, rivalUnits);
  return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
}

/** The exact integer bracket [lo, hi) of (T+1)·log2(T+1): lo ≤ x < lo+1. */
export function fkStaticIntegerBracket(clockStates: number): { lo: bigint; hi: bigint } {
  let lo = 0n;
  // lo ≤ x < lo+1 ⟺ x does NOT undercut lo+1
  while (!fkStaticUndercuts(clockStates, Number(lo) + 1)) lo += 1n;
  return { lo, hi: lo + 1n };
}

/** Exact: does the 2-decimal rendering `quotedHundredths` (e.g. 4302 for
 * 43.02) round (T+1)·log2(T+1) correctly? Rounding-to-nearest means
 * |100·x − q| ≤ ½, i.e. 2·100·x ∈ [2q−1, 2q+1), decided exactly as
 * (T+1)^(200(T+1)) vs 2^(2q∓1). */
export function fkStaticRoundsTo(clockStates: number, quotedHundredths: number): boolean {
  if (!Number.isInteger(quotedHundredths) || quotedHundredths < 0) {
    throw new Error(`fkStaticRoundsTo: quotedHundredths ${quotedHundredths} out of domain`);
  }
  const lhs = bigPow(BigInt(clockStates), 200 * clockStates);
  const low = bigPow(2n, 2 * quotedHundredths - 1);
  const high = bigPow(2n, 2 * quotedHundredths + 1);
  return lhs >= low && lhs < high;
}

/** The tariff ordering on OUR conventions at matched depth T (exact): the
 * quoted sibling entries 5 and 9 (their wire counts, cited read-only)
 * against our static-mode formula — the legislated table requires
 * 5 < 9 < (T+1)·log2(T+1). Returns exact verdicts plus the
 * (display-only) float. */
export function tariffOrderingAtDepth(depth: number): {
  fkExceedsFive: boolean;
  fkExceedsNine: boolean;
  fkBits: number;
} {
  const clockStates = depth + 1;
  return {
    fkExceedsFive: fkStaticCompare(clockStates, 5) > 0,
    fkExceedsNine: fkStaticCompare(clockStates, 9) > 0,
    fkBits: fkStaticBits(clockStates),
  };
}

/** The crossover depth: the SMALLEST depth at which the FK static entry no
 * longer undercuts `rivalUnits` (below it, (T+1)·log2(T+1) < rivalUnits;
 * from it on, the rival wins the tariff). 0 when it never undercuts. */
export function tariffCrossoverDepth(rivalUnits: number): number {
  if (!fkStaticUndercuts(3, rivalUnits)) return 0; // depth 2 is the smallest T we price
  for (let depth = 2; depth <= 64; depth++) {
    if (!fkStaticUndercuts(depth + 1, rivalUnits)) return depth;
  }
  throw new Error(`tariffCrossoverDepth: no crossover up to depth 64 for rival ${rivalUnits}`);
}

/**
 * THE k-WORLD INCLUSION–EXCLUSION (AT18's kernel) — one law, k marked worlds.
 *
 * Register w1 ⊗ … ⊗ w_k ⊗ cargo (dim 2^{k+1}); the law damps EVERY world bit
 * into its world (the same product channel on k bits, identity on the cargo).
 * THE THEOREM (pure geometry, exact for arbitrary — entangled — starts):
 *
 *   For every subset S ⊆ [k] of world bits, the mass of the sector "every
 *   bit of S is OUTSIDE its world (w_i = 0 for i ∈ S)" obeys
 *
 *        q_S(t) = (1−γ)^{|S|·t} · c_S(0),      c_S(0) = Tr[Π_S ρ_0],
 *
 *   because the Heisenberg face of one step multiplies the projector by its
 *   own damping factor: Φ†(Π_S) = (1−γ)^{|S|} Π_S (each bit contributes
 *   K0†|0⟩⟨0|K0 = (1−γ)|0⟩⟨0| and K1†|0⟩⟨0|K1 = 0 — the jump never leaves
 *   the complement). The joint leakage — SOME world bit still outside — is
 *   then the 2^k-term inclusion–exclusion over the nonempty subsets:
 *
 *        jointLeak(t) = Σ_{∅≠S⊆[k]} (−1)^{|S|+1} · (1−γ)^{|S|·t} · c_S(0).
 *
 *   k = 1 collapses to AT2's single geometric; k = 2 to AT16's
 *   union-with-intersection qA + qB − qAB (qAB = the S = {1,2} term) — both
 *   reproduced BIT-LEVEL by the tests (kWorldKraus(1) === lawKraus,
 *   kWorldKraus(2) === twoWorldLawKraus, and the leakage identities to the
 *   rounding floor on entangled starts). Beyond two worlds the sum is
 *   genuinely multi-scale: a single geometric NEVER fits it outside the
 *   trivial case (the SW8 counterfeit, generalized — checked here by name).
 *
 * Boundaries: the dense Kraus census runs to k ≤ KWORLD_MAX (dim 2^{k+1} =
 * 32); the CLOSED FORM holds for every k (the algebra has no dimension in
 * it) and is anchored at any k by the nested-binomial identity below. The
 * theorem covers ONE law, SAME damping on every bit — inhomogeneous or
 * coupled markings are outside the claim (AT16's boundary, verbatim).
 */
import {
  type CMat,
  identity,
  kron,
  mat,
  matEq,
  mAdd,
  mDagger,
  mMul,
  basisVec,
  vKron,
  vec,
} from "../core/cmat.js";
import { applyKraus } from "../core/channels.js";
import { makeRng } from "../core/rng.js";
import { randomStateVec, vecToRho } from "../core/states.js";
import { DomainError, requireGamma, requireStep } from "../core/errors.js";
import { GAMMA, lawKraus, twoWorldLawKraus } from "./law.js";
import type { WitnessResult } from "./audit.js";

/** The dense-census horizon: 2^{k+1} ≤ 32 (the closed form itself is any-k). */
export const KWORLD_MAX = 4;

function requireK(entry: string, k: number): void {
  if (!Number.isInteger(k) || k < 1 || k > KWORLD_MAX) {
    throw new DomainError(
      `${entry}:k-range`,
      `${entry}: k must be an integer in [1, ${String(KWORLD_MAX)}] (dim 2^(k+1) <= 32 — the closed form itself is any-k), got ${String(k)}`,
    );
  }
}

/** The world-bit damping pair (2x2), damped INTO the bit value 1 — the same
 * formula law.ts single-sources (worldKrausPair); this file builds it by
 * hand and the tests pin the identity BIT-EXACTLY at k=1 (lawKraus) and
 * k=2 (twoWorldLawKraus), the T11 independent-hand-build discipline. */
function worldPair(gamma: number): CMat[] {
  requireGamma("kWorldKraus", gamma);
  const k0 = mat(2, 2);
  k0.re[0] = Math.sqrt(1 - gamma);
  k0.re[3] = 1;
  const k1 = mat(2, 2);
  k1.re[2] = Math.sqrt(gamma);
  return [k0, k1];
}

/** The k-world law's Kraus set: one choice of (K0|K1) per world bit, tensored
 * over the k bits, identity on the cargo — 2^k operators, dim 2^{k+1}.
 * Ordering matches twoWorldLawKraus exactly (outer bit = w1). */
export function kWorldKraus(k: number, gamma: number = GAMMA): CMat[] {
  requireK("kWorldKraus", k);
  const pair = worldPair(gamma);
  let ops: CMat[] = pair.slice();
  for (let bit = 1; bit < k; bit++) {
    const next: CMat[] = [];
    for (const acc of ops) {
      for (const p of pair) next.push(kron(acc, p));
    }
    ops = next;
  }
  return ops.map((op) => kron(op, identity(2)));
}

export function kWorldDim(k: number): number {
  return 2 ** (k + 1);
}

/** Same Kraus-set hoist as iterateLaw (pure construction, identical channel). */
export function iterateKWorldLaw(
  rho: CMat,
  steps: number,
  k: number,
  gamma: number = GAMMA,
): CMat {
  requireStep("iterateKWorldLaw", steps);
  const kraus = kWorldKraus(k, gamma);
  let cur = rho;
  for (let t = 0; t < steps; t++) cur = applyKraus(cur, kraus);
  return cur;
}

function requireMask(entry: string, mask: number, k: number): void {
  if (!Number.isInteger(mask) || mask < 0 || mask >= 2 ** k) {
    throw new DomainError(
      `${entry}:mask-range`,
      `${entry}: mask must be an integer in [0, 2^k), got ${String(mask)}`,
    );
  }
}

function requireKWorldState(entry: string, rho: CMat, k: number): void {
  if (rho.rows !== kWorldDim(k)) {
    throw new DomainError(
      `${entry}:dim`,
      `${entry}: state dimension ${String(rho.rows)} is not the k-world register's ${String(kWorldDim(k))} (w1 x ... x w_k x cargo)`,
    );
  }
}

/** c_S(rho): the mass of the sector where every bit of S is OUTSIDE its
 * world (digit 0). S is a bitmask over the k world bits (bit 0 = w1, the
 * leading tensor factor; the cargo rides at stride 1, untouched). */
export function kWorldSectorMass(rho: CMat, mask: number, k: number): number {
  requireKWorldState("kWorldSectorMass", rho, k);
  requireMask("kWorldSectorMass", mask, k);
  const d = kWorldDim(k);
  let v = 0;
  for (let idx = 0; idx < d; idx++) {
    let ok = true;
    for (let bit = 0; bit < k; bit++) {
      // idx = w1·2^k + … + w_k·2 + x: bit 0 (w1) rides at stride 2^k, the
      // cargo at stride 1 — the k=2 face is symmetric under the a0/b0 swap,
      // so only an asymmetric k >= 3 witnesses this digit map (the tests'
      // GHZ-vs-product split pins it)
      const stride = 2 ** (k - bit);
      if ((mask & (1 << bit)) !== 0 && Math.floor(idx / stride) % 2 === 1) {
        ok = false;
        break;
      }
    }
    if (ok) v += rho.re[idx * d + idx]!;
  }
  return v;
}

/** The full mask table c_S(rho), S = 0..2^k−1 (index 0 = the empty subset —
 * the always-true event, mass 1). */
export function kWorldSectorMassTable(rho: CMat, k: number): number[] {
  requireKWorldState("kWorldSectorMassTable", rho, k);
  return Array.from({ length: 2 ** k }, (_, mask) =>
    kWorldSectorMass(rho, mask, k),
  );
}

/** q_S(t) = (1−γ)^{|S|·t} c_S(0) — the theorem's per-subset closed form. */
export function kWorldOutsideMass(
  steps: number,
  cS0: number,
  mask: number,
  gamma: number = GAMMA,
): number {
  requireStep("kWorldOutsideMass", steps);
  requireGamma("kWorldOutsideMass", gamma);
  const size = popcount(mask);
  if (!Number.isFinite(cS0) || cS0 < 0) {
    throw new DomainError(
      "kWorldOutsideMass:cS0-range",
      `kWorldOutsideMass: the sector mass must be finite and non-negative, got ${String(cS0)}`,
    );
  }
  return Math.pow(1 - gamma, size * steps) * cS0;
}

function popcount(x: number): number {
  let n = 0;
  let v = x;
  while (v > 0) {
    n += v & 1;
    v >>>= 1;
  }
  return n;
}

/** The 2^k-term inclusion–exclusion for the joint leakage, from the t=0
 * mask table: Σ_{∅≠S} (−1)^{|S|+1} (1−γ)^{|S|·t} c_S(0). Valid for ANY k
 * (the algebra carries no dimension); masses must be a full 2^k table. */
export function kWorldInclusionExclusion(
  steps: number,
  masses: readonly number[],
  gamma: number = GAMMA,
): number {
  requireStep("kWorldInclusionExclusion", steps);
  requireGamma("kWorldInclusionExclusion", gamma);
  const k = Math.log2(masses.length);
  if (!Number.isInteger(k) || masses.length < 2) {
    throw new DomainError(
      "kWorldInclusionExclusion:table-shape",
      `kWorldInclusionExclusion: the mask table must have 2^k entries (k >= 1), got ${String(masses.length)}`,
    );
  }
  let sum = 0;
  for (let mask = 1; mask < masses.length; mask++) {
    sum +=
      (popcount(mask) % 2 === 1 ? 1 : -1) *
      Math.pow(1 - gamma, popcount(mask) * steps) *
      masses[mask]!;
  }
  return sum;
}

/** The joint leakage's closed form straight from the start state. */
export function kWorldJointLeakage(
  rho: CMat,
  steps: number,
  k: number,
  gamma: number = GAMMA,
): number {
  requireStep("kWorldJointLeakage", steps);
  requireK("kWorldJointLeakage", k);
  return kWorldInclusionExclusion(steps, kWorldSectorMassTable(rho, k), gamma);
}

/** The join charge: the mass with EVERY world bit inside its world — the
 * machine face the closed form must complement (1 − this = the leak). */
export function kWorldJoinCharge(rho: CMat, k: number): number {
  requireKWorldState("kWorldJoinCharge", rho, k);
  const d = kWorldDim(k);
  const allInside = d - 2; // the all-ones world bits, cargo digit 0
  let v = 0;
  for (let x = 0; x < 2; x++) {
    const idx = allInside + x;
    v += rho.re[idx * d + idx]!;
  }
  return v;
}

// ---------------------------------------------------------------------------
// The SW8 generalization — the multi-world absorption CERTIFICATE. A k-world
// absorption claim must carry its mask table and its leak; the checker
// re-derives the inclusion–exclusion from the table and names every
// counterfeit by hand (a nudged leak, a shape lie, a table that is not a
// nested family of sector masses).
// ---------------------------------------------------------------------------

export interface KWorldCertificate {
  readonly k: number;
  readonly gamma: number;
  readonly steps: number;
  /** the t=0 mask table c_S(0), mask-indexed, length 2^k (entry 0 unused/1) */
  readonly cS0: readonly number[];
  readonly leak: number;
}

export function checkKWorldCertificate(cert: KWorldCertificate): string[] {
  const out: string[] = [];
  const name = `k=${String(cert.k)} steps=${String(cert.steps)}`;
  if (!Number.isInteger(cert.k) || cert.k < 1) {
    out.push(`${name}: k must be a positive integer, got ${String(cert.k)}`);
    return out;
  }
  if (!(cert.gamma >= 0 && cert.gamma <= 1)) {
    out.push(`${name}: gamma must lie in [0,1], got ${String(cert.gamma)}`);
    return out;
  }
  if (!Number.isInteger(cert.steps) || cert.steps < 0) {
    out.push(
      `${name}: steps must be a non-negative integer, got ${String(cert.steps)}`,
    );
    return out;
  }
  if (cert.cS0.length !== 2 ** cert.k) {
    out.push(
      `${name}: the mask table must have 2^k = ${String(2 ** cert.k)} entries, got ${String(cert.cS0.length)}`,
    );
    return out;
  }
  // the nested-sector legality: S ⊆ T forces c_T <= c_S (the event "T all
  // outside" is contained in "S all outside") — a table violating it is not
  // any state's sector family, whatever number it claims
  for (let s = 1; s < cert.cS0.length; s++) {
    const cs = cert.cS0[s]!;
    if (!Number.isFinite(cs) || cs < 0) {
      out.push(
        `${name}: sector mass at mask ${String(s)} must be finite and non-negative, got ${String(cs)}`,
      );
    }
    for (let t = 1; t < cert.cS0.length; t++) {
      if ((s & t) === s && t !== s && cert.cS0[t]! > cs + 1e-12) {
        out.push(
          `${name}: nested-sector violation — mask ${String(t)} ⊇ ${String(s)} carries ${cert.cS0[t]!.toPrecision(6)} > ${cs.toPrecision(6)}: no state has this sector family`,
        );
      }
    }
  }
  const exact = kWorldInclusionExclusion(cert.steps, cert.cS0, cert.gamma);
  if (Math.abs(cert.leak - exact) > 1e-12) {
    out.push(
      `${name}: fake multi-world absorption certificate: the inclusion–exclusion over the table gives ${exact.toPrecision(12)}, the certificate claims ${cert.leak.toPrecision(12)} — the k-world face is the 2^k-term sum, never a single geometric`,
    );
  }
  return out;
}

/** The SW8 counterfeit, generalized: price the joint leak as the SINGLE
 * geometric leak(0)·(1−γ)^t and report the worst drift over t = 1..horizon.
 * Genuine multi-scale tables (any c_S > 0 with |S| ≥ 2) drift by O(1). */
export function singleGeometricCounterfeitDrift(
  masses: readonly number[],
  gamma: number,
  horizon: number,
): { drift: number; worstStep: number } {
  const leak0 = kWorldInclusionExclusion(0, masses, gamma);
  let drift = 0;
  let worstStep = 0;
  for (let t = 1; t <= horizon; t++) {
    const gap = Math.abs(
      kWorldInclusionExclusion(t, masses, gamma) -
        leak0 * Math.pow(1 - gamma, t),
    );
    if (gap > drift) {
      drift = gap;
      worstStep = t;
    }
  }
  return { drift, worstStep };
}

// ---------------------------------------------------------------------------
// W-R — the k-world witness (the audit face; registered by the new tests,
// the audit roll itself stays byte-frozen).
// ---------------------------------------------------------------------------

/** W-R: the k-world inclusion–exclusion — one law, k marked worlds. */
export function witnessKWorlds(): WitnessResult {
  const rng = makeRng(1616);
  // CPTP over the 2^k Kraus operators, k = 3 and k = 4 (Sigma K†K vs I)
  let worstCptp = 0;
  for (const k of [3, 4]) {
    const d = kWorldDim(k);
    let completeness = mat(d, d);
    for (const op of kWorldKraus(k, GAMMA))
      completeness = mAdd(completeness, mMul(mDagger(op), op));
    const eye = identity(d);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        worstCptp = Math.max(
          worstCptp,
          Math.abs(completeness.re[i * d + j]! - eye.re[i * d + j]!),
        );
      }
    }
  }
  // the starts: k=3 GHZ (every c_S = 1/2), a product all-in-world, random pure
  const ghz3 = vec(8);
  ghz3.re[0] = 1 / Math.SQRT2;
  ghz3.re[7] = 1 / Math.SQRT2;
  const ghz3Rho = vecToRho(vKron(ghz3, randomStateVec(rng, 2)));
  const pureIn = vKron(
    vKron(vKron(basisVec(2, 1), basisVec(2, 1)), basisVec(2, 1)),
    randomStateVec(rng, 2),
  );
  const starts3 = [
    ghz3Rho,
    vecToRho(pureIn),
    vecToRho(randomStateVec(rng, 16)),
  ];
  // the per-subset theorem and the joint leak, k = 3 (16-dim, entangled starts)
  let worstSubset = 0;
  let worstJoint = 0;
  for (const rho of starts3) {
    const table = kWorldSectorMassTable(rho, 3);
    for (let mask = 1; mask < 8; mask++) {
      for (const t of [1, 5, 17]) {
        const evolved = kWorldSectorMass(
          iterateKWorldLaw(rho, t, 3, GAMMA),
          mask,
          3,
        );
        worstSubset = Math.max(
          worstSubset,
          Math.abs(evolved - kWorldOutsideMass(t, table[mask]!, mask, GAMMA)),
        );
      }
    }
    for (const t of [1, 5, 17]) {
      worstJoint = Math.max(
        worstJoint,
        Math.abs(
          1 -
            kWorldJoinCharge(iterateKWorldLaw(rho, t, 3, GAMMA), 3) -
            kWorldInclusionExclusion(t, table, GAMMA),
        ),
      );
    }
  }
  // the census horizon k = 4 (32-dim): the joint closed form on random pure starts
  let worstJoint4 = 0;
  for (let trial = 0; trial < 4; trial++) {
    const rho = vecToRho(randomStateVec(rng, 32));
    worstJoint4 = Math.max(
      worstJoint4,
      Math.abs(
        1 -
          kWorldJoinCharge(iterateKWorldLaw(rho, 6, 4, GAMMA), 4) -
          kWorldJointLeakage(rho, 6, 4, GAMMA),
      ),
    );
  }
  // the ANY-k anchor (no Kraus, pure algebra): with every c_S = 1/2 (the GHZ
  // family) the sum collapses to [1 − (1 − (1−γ)^t)^k] / 2, k beyond the census
  let worstAnyK = 0;
  for (let k = 5; k <= 12; k++) {
    const table = Array.from({ length: 2 ** k }, (_, i) => (i === 0 ? 1 : 0.5));
    const t = 4;
    const closedForm = kWorldInclusionExclusion(t, table, GAMMA);
    const nested = (1 - Math.pow(1 - Math.pow(1 - GAMMA, t), k)) / 2;
    worstAnyK = Math.max(worstAnyK, Math.abs(closedForm - nested));
  }
  // the counterfeit: k = 3 GHZ priced as one geometric drifts by O(1)
  const ghzTable = kWorldSectorMassTable(ghz3Rho, 3);
  const { drift } = singleGeometricCounterfeitDrift(ghzTable, GAMMA, 30);
  // k=1 and k=2 reproduce the earlier theorems from the SAME sum
  let worst12 = 0;
  const rho1 = vecToRho(vKron(basisVec(2, 0), randomStateVec(rng, 2)));
  worst12 = Math.max(
    worst12,
    Math.abs(
      kWorldJointLeakage(rho1, 7, 1, GAMMA) -
        Math.pow(1 - GAMMA, 7) * kWorldSectorMass(rho1, 1, 1),
    ),
  );
  const rho2 = vecToRho(
    vKron(vKron(basisVec(2, 1), basisVec(2, 0)), randomStateVec(rng, 2)),
  );
  worst12 = Math.max(
    worst12,
    Math.abs(kWorldJointLeakage(rho2, 7, 2, GAMMA) - lawKraus2Leak(rho2, 7)),
  );
  const ok =
    worstCptp <= 1e-14 &&
    worstSubset <= 1e-15 &&
    worstJoint <= 1e-15 &&
    worstJoint4 <= 1e-14 &&
    worstAnyK <= 1e-13 &&
    drift > 0.1 &&
    worst12 <= 1e-15;
  return {
    name: "W-R the k-world inclusion-exclusion",
    pass: ok,
    detail: `the product law is CPTP on k=3,4 (worst completeness deviation ${worstCptp.toExponential(2)}); the per-subset geometry q_S(t) = (1-gamma)^{|S|t} c_S(0) is exact on entangled 16-dim starts over all 7 nonempty subsets (worst ${worstSubset.toExponential(2)}); the joint leak is the 2^k-term inclusion-exclusion (worst ${worstJoint.toExponential(2)} at k=3, ${worstJoint4.toExponential(2)} at the 32-dim census horizon k=4); the closed form carries NO dimension — with c_S = 1/2 it collapses to [1-(1-(1-gamma)^t)^k]/2 to ${worstAnyK.toExponential(2)} for k = 5..12; k=1 and k=2 reproduce AT2's geometric and AT16's union-with-intersection from the same sum (${worst12.toExponential(2)}); the single-geometric counterfeit drifts by ${drift.toPrecision(3)} on the k=3 GHZ face — the SW8 law generalized`,
  };
}

/** AT16's join leakage, via the (2-world) inclusion–exclusion with the
 * checker's own hands — the k=2 reproduction road (independent of
 * joinLeakage, called out for the witness only). */
function lawKraus2Leak(rho: CMat, steps: number): number {
  const table = kWorldSectorMassTable(rho, 2);
  return (
    Math.pow(1 - GAMMA, steps) * table[1]! +
    Math.pow(1 - GAMMA, steps) * table[2]! -
    Math.pow(1 - GAMMA, 2 * steps) * table[3]!
  );
}

/** Re-exported for the tests' bit-exact identity pins (kWorldKraus(1) vs
 * lawKraus, kWorldKraus(2) vs twoWorldLawKraus) — no second construction,
 * just the comparison surface. */
export function kWorldKrausIdentity(k: number, gamma: number = GAMMA): boolean {
  const mine = kWorldKraus(k, gamma);
  const theirs =
    k === 1 ? lawKraus(gamma) : k === 2 ? twoWorldLawKraus(gamma) : undefined;
  if (theirs === undefined) {
    throw new DomainError(
      "kWorldKrausIdentity:k-range",
      `kWorldKrausIdentity: the identity pin exists at k=1 (lawKraus) and k=2 (twoWorldLawKraus), got k=${String(k)}`,
    );
  }
  if (mine.length !== theirs.length) return false;
  return mine.every((op, i) => matEq(op, theirs[i]!, 0));
}

/**
 * G6-b (v0.6.0) — the dilution family law D_k: the source of sqrt(10)/6.
 *
 * The scheduling contact surfaces (sched3 at k = 3, sched4 at k = 4) measured
 * the switch's distinguishability constant: D = 1/2 at k = 3 (the "halving
 * law" D(switch) = D(fixed)/sqrt(2)) and D = sqrt(10)/6 at k = 4 — the
 * halving law BREAKS there. This file is the family behind both numbers:
 * the single-erasure k-level chain, closed-form.
 *
 * THE FAMILY. k stage-boxes: k-1 single-qubit WRITE boxes drawn from the
 * plane-preserving Pauli writes {X, Z, Y} (X fixes |+>/|-> up to phase, Z and
 * Y exchange the two rays up to phase) plus one ERASE box (gamma: with
 * probability gamma the register resets to |0><0|, else identity — sched3's
 * erase). The switch is the uniform mixture over all k! orders of the k
 * DISTINCT boxes (two boxes may implement the same Pauli — they remain
 * distinct stages); D_k is the register trace distance between the gamma = 1
 * and gamma = 0 instances, input |+><+| (sched3's plusPlus).
 *
 * (DL-a) ERASURE-POSITION DECOMPOSITION (exact).
 *   - gamma = 0 side: every order applies ALL writes; the final ray depends
 *     only on the PARITY of the exchangers {Z, Y} among them (X only
 *     phases) — so ALL k! branches end in the SAME pure state (machine:
 *     max pairwise trace distance 0). The mixture cannot disperse.
 *   - gamma = 1 side: the branch output depends only on the write SUFFIX
 *     after the erasure; X and Y flip |0><0| <-> |1><1| (FLIPPERS), Z keeps
 *     both (KEEPER), so every branch output is one of the two diagonal pure
 *     states |0><0| / |1><1|, and the mixture is sigma_1 =
 *     diag(N0/k!, N1/k!). Counting orders by the erasure position j (suffix
 *     size s = k-1-j, a chosen suffix SET S of s boxes arranged s! ways with
 *     the complement arranged j! ways):
 *
 *       N1 = SUM_{s=0..k-1}  s! (k-1-s)!  *  O(s),
 *       O(s) = SUM_{f odd} C(F, f) C(K, s-f)   (F flippers, K keepers),
 *
 *     the flipper/keeper census of the write family. (k=4, XZY: N1 = 8,
 *     N0 = 16 — the 2/3 : 1/3 mixture of theory.md §6, re-derived.)
 *
 * (DL-b) CLOSED FORM. sigma_1 = diag(1-q, q) against the pure plane state
 *   gives the exact 2x2 eigenvalue pair +-sqrt(1/4 + (q-1/2)^2), so
 *
 *       D_k = sqrt( 1/4 + (q_k - 1/2)^2 ),   q_k = N1/k!  (exact rational).
 *
 *   Anchors: k=2 [X] -> 1/2; k=3 [X,Z] -> 1/2 (the halving law);
 *   k=4 [X,Z,Y] -> sqrt(10)/6 EXACTLY (q = 1/3: 1/4 + 1/36 = 10/36) —
 *   the v0.2.0 census value, now derived rather than measured.
 *
 * (DL-c) THE TRICHOTOMY (machine-discovered, exact on every (F, K) cell of
 *   the F=0..7 x K=0..6 grid): the erasure-position sum COLLAPSES — q_k
 *   depends on the write census only through F, the flipper count:
 *
 *       F = 0    ->  q = 0        -> D_k = 1/sqrt(2)  (the switch gains
 *                                                    NOTHING: every gamma=1
 *                                                    branch is |0><0|, and
 *                                                    T(|0>, plane) = 1/sqrt2
 *                                                    is the fixed-order wall)
 *       F odd    ->  q = 1/2      -> D_k = 1/2        (the halving law holds
 *                                                    EXACTLY; proof: suffix
 *                                                    complementation S -> S^c
 *                                                    is a size-pairing
 *                                                    involution that flips
 *                                                    the bit iff F is odd,
 *                                                    so N1 = N0 = k!/2)
 *       F = 2m   ->  q = m/(2m+1) -> D_k = sqrt((2m+1)^2 + 1) / (2(2m+1))
 *                                                    (m = 1: sqrt(10)/6 —
 *                                                     the k = 4 constant;
 *                                                     m = 2: sqrt(26)/10 —
 *                                                     the k = 7 cycling row)
 *
 *   The keeper count K cancels identically in all three branches.
 *
 * (DL-d) THE FIXED-ORDER WALL. Every fixed order carries D = 1/sqrt(2)
 *   EXACTLY at every k in scope: the write prefix keeps the state on the
 *   |+/-> plane, the erasure sets T = T(|0><0|, plane) = 1/sqrt(2), and the
 *   unitary suffix cannot move a trace distance (machine: max deviation 0
 *   over all k! orders, k = 2..5). Hence D(switch) < D(fixed) strictly for
 *   every family member with F >= 1 — order superposition never beats ANY
 *   definite order on this primitive, whatever k.
 *
 * Audit face (verdict style, verify.ts family — errors.ts frozen): the
 * halving-law counterfeit at k = 4 (claims 1/2 where the machine says
 * sqrt(10)/6), the swapped-mixture counterfeit (claims q = 2/3 at k = 4),
 * a closed-form lie (a wrong (F, K) census), and an off-family write (H
 * leaves the |+/-> plane: the gamma=0 dispersion check catches it by name)
 * are each NAMED and REJECTED against the machine-recomputed truth.
 *
 * Honest boundaries: single-erasure chains of plane-preserving writes only
 * (a Hadamard write exits the family — caught by the dispersion check);
 * general channels, multiple erasures, and d > 2 registers are out; the
 * trichotomy is machine-verified over the swept (F, K) grid with the
 * F-odd branch proven by the complement involution, the F = 2m branch
 * machine-established (no closed-form proof shipped — honest DATA law);
 * the executor is run at k <= 6 (k! branch evolutions), the closed form
 * carries the family to any k.
 */
import { cmatZero, type CMat } from "../core/cmat.js";
import { X2, Y2, Z2 } from "./promise.js";
import { erase, plusPlus, traceDistance, unitaryOnRho } from "./sched3.js";

/** The plane-preserving write family member. */
export type PlaneWrite = "X" | "Z" | "Y";

/** The cycling family writes[j] = {X, Z, Y}[j mod 3] — sched3/sched4's
 * continuation (k = 2..5: [X], [X,Z], [X,Z,Y], [X,Z,Y,X]). */
export function cyclingWrites(k: number): PlaneWrite[] {
  if (!Number.isInteger(k) || k < 2 || k > 12) {
    throw new Error(
      `[DILUTION-K-OUT-OF-DOMAIN] k = ${String(k)}, expected an integer in [2, 12] (the closed form carries any k; the executor is priced for k <= 6)`,
    );
  }
  const cycle: PlaneWrite[] = ["X", "Z", "Y"];
  const out: PlaneWrite[] = [];
  for (let j = 0; j < k - 1; j++) out.push(cycle[j % 3] as PlaneWrite);
  return out;
}

// ---------------------------------------------------------------------------
// The executor: the machine truth the closed form must reproduce.
// ---------------------------------------------------------------------------

export interface DilutionExecution {
  readonly k: number;
  /** trace distance per fixed order (all k! of them, stage slots distinct). */
  readonly fixedD: readonly number[];
  /** max |D - 1/sqrt(2)| over fixed orders — the wall check. */
  readonly fixedWallDev: number;
  /** the switch mixture's trace distance. */
  readonly switchD: number;
  /** max pairwise trace distance among the gamma=0 branch outputs (0 in-family). */
  readonly gamma0Dispersion: number;
  /** number of distinct gamma=1 branch outputs (exactly 2 in-family). */
  readonly gamma1Distinct: number;
  /** branch census [#ending |0><0|, #ending |1><1|] at gamma=1. */
  readonly counts: readonly [number, number];
}

function permutations(k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const used: boolean[] = Array.from({ length: k }, () => false);
  const rec = (): void => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = 0; i < k; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      rec();
      used[i] = false;
      cur.pop();
    }
  };
  rec();
  return out;
}

/** Execute the whole k!-order surface for a write family (k <= 6 priced).
 * The negative-control hook: `replaceWrite` lets a test swap ONE write box
 * for an off-family unitary (e.g. Hadamard) — the dispersion and wall checks
 * then NAME the family violation (replacing every write could cancel
 * itself, e.g. H·H = I, and hide the crime). */
export function dilutionExecutor(
  writes: readonly PlaneWrite[],
  replaceWrite: { readonly index: number; readonly matrix: CMat } | null = null,
): DilutionExecution {
  const k = writes.length + 1;
  if (!Number.isInteger(k) || k < 2 || k > 6) {
    throw new Error(
      `[DILUTION-K-OUT-OF-DOMAIN] executor priced for k in [2, 6], got ${String(k)}`,
    );
  }
  if (
    replaceWrite !== null &&
    (replaceWrite.index < 0 || replaceWrite.index >= writes.length)
  ) {
    throw new Error(
      `[DILUTION-REPLACE-INDEX-OUT-OF-RANGE] replaceWrite.index ${String(replaceWrite.index)} outside the ${writes.length} write boxes`,
    );
  }
  const stages: Array<PlaneWrite | "E"> = [...writes, "E"];
  const outs = (gamma: number, order: readonly number[]): CMat => {
    let rho = plusPlus();
    for (const s of order) {
      const st = stages[s] as PlaneWrite | "E";
      if (st === "E") {
        rho = erase(gamma, rho);
      } else if (replaceWrite !== null && s === replaceWrite.index) {
        rho = unitaryOnRho(replaceWrite.matrix, rho);
      } else {
        rho = unitaryOnRho(st === "X" ? X2 : st === "Z" ? Z2 : Y2, rho);
      }
    }
    return rho;
  };
  const orders = permutations(k);
  const fixedD = orders.map((o) => traceDistance(outs(1, o), outs(0, o)));
  const fixedWallDev = Math.max(
    ...fixedD.map((d) => Math.abs(d - Math.SQRT1_2)),
  );
  const zeroBranches = orders.map((o) => outs(0, o));
  let disp = 0;
  for (let a = 0; a < zeroBranches.length; a++) {
    for (let b = a + 1; b < zeroBranches.length; b++) {
      disp = Math.max(disp, traceDistance(zeroBranches[a]!, zeroBranches[b]!));
    }
  }
  let n0 = 0;
  let n1 = 0;
  const seen: CMat[] = [];
  for (const o of orders) {
    const out = outs(1, o);
    if (Math.abs(out.re[1]![1]! - 1) < 1e-12) n1++;
    else n0++;
    if (!seen.some((s) => traceDistance(s, out) < 1e-12)) seen.push(out);
  }
  const mix = (gamma: number): CMat => {
    const m = cmatZero(2);
    for (const o of orders) {
      const out = outs(gamma, o);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          m.re[i]![j] = m.re[i]![j]! + out.re[i]![j]! / orders.length;
          m.im[i]![j] = m.im[i]![j]! + out.im[i]![j]! / orders.length;
        }
      }
    }
    return m;
  };
  return {
    k,
    fixedD,
    fixedWallDev,
    switchD: traceDistance(mix(1), mix(0)),
    gamma0Dispersion: disp,
    gamma1Distinct: seen.length,
    counts: [n0, n1],
  };
}

// ---------------------------------------------------------------------------
// The closed form: exact BigInt rationals.
// ---------------------------------------------------------------------------

function bigFactorial(n: number): bigint {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r;
}

function bigBinomial(n: number, kk: number): bigint {
  if (kk < 0 || kk > n) return 0n;
  let r = 1n;
  for (let i = 0; i < kk; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
  return r;
}

export interface DilutionClosedForm {
  readonly k: number;
  /** the write census: F flippers (X, Y), K keepers (Z). */
  readonly F: number;
  readonly K: number;
  /** N1 (exact) and k! (exact): q = N1/k! in lowest terms is qNum/qDen. */
  readonly N1: bigint;
  readonly kFact: bigint;
  readonly qNum: bigint;
  readonly qDen: bigint;
  /** D_k^2 = 1/4 + (q-1/2)^2 as an exact rational num/den. */
  readonly dSqNum: bigint;
  readonly dSqDen: bigint;
  /** the float face of D_k (for anchors and the executor cross-check). */
  readonly dFloat: number;
  /** which trichotomy branch the census lands in. */
  readonly law: "no-flippers" | "halving" | "even-flippers";
}

/** The plane-preserving writes {X, Z, Y} — the runtime membership guard
 * (a JS caller can bypass the PlaneWrite type; the guard stays). */
function isPlaneWrite(w: string): w is PlaneWrite {
  return w === "X" || w === "Z" || w === "Y";
}

/** The erasure-position sum and the closed form for a write family. */
export function dilutionClosedForm(
  writes: readonly PlaneWrite[],
): DilutionClosedForm {
  const k = writes.length + 1;
  if (!Number.isInteger(k) || k < 2) {
    throw new Error(
      `[DILUTION-K-OUT-OF-DOMAIN] k = ${String(k)}, expected an integer >= 2`,
    );
  }
  for (const w of writes) {
    if (!isPlaneWrite(w)) {
      throw new Error(
        `[DILUTION-WRITE-OFF-FAMILY] write "${String(w)}" is not one of the plane-preserving writes {X, Z, Y}`,
      );
    }
  }
  const F = writes.filter((w) => w === "X" || w === "Y").length;
  const K = writes.filter((w) => w === "Z").length;
  let N1 = 0n;
  for (let s = 0; s <= k - 1; s++) {
    let O = 0n;
    for (let f = 1; f <= Math.min(F, s); f += 2)
      O += bigBinomial(F, f) * bigBinomial(K, s - f);
    N1 += bigFactorial(s) * bigFactorial(k - 1 - s) * O;
  }
  const kFact = bigFactorial(k);
  // q = N1/k!; D^2 = 1/4 + (q-1/2)^2 = (2N1-k!)^2 + k!^2) / (4 k!^2)
  const diff = 2n * N1 - kFact;
  const dSqNum = diff * diff + kFact * kFact;
  const dSqDen = 4n * kFact * kFact;
  const q = Number(N1) / Number(kFact);
  return {
    k,
    F,
    K,
    N1,
    kFact,
    qNum: N1,
    qDen: kFact,
    dSqNum,
    dSqDen,
    dFloat: Math.sqrt(0.25 + (q - 0.5) ** 2),
    law: F === 0 ? "no-flippers" : F % 2 === 1 ? "halving" : "even-flippers",
  };
}

// ---------------------------------------------------------------------------
// (DL-c) The trichotomy, exact rational form.
// ---------------------------------------------------------------------------

export interface LawRow {
  readonly F: number;
  readonly K: number;
  /** exact q from the erasure-position sum (N1/k! reduced). */
  readonly qNum: bigint;
  readonly qDen: bigint;
  /** the trichotomy's predicted q, exact. */
  readonly lawNum: bigint;
  readonly lawDen: bigint;
  readonly agrees: boolean;
}

/** One (F, K) cell: the sum vs the trichotomy, exact BigInt. */
export function trichotomyCell(F: number, K: number): LawRow {
  if (
    !Number.isInteger(F) ||
    !Number.isInteger(K) ||
    F < 0 ||
    K < 0 ||
    F + K < 1
  ) {
    throw new Error(
      `[DILUTION-CENSUS-OUT-OF-DOMAIN] F = ${String(F)}, K = ${String(K)}, expected non-negative integers with F + K >= 1`,
    );
  }
  const writes: PlaneWrite[] = [];
  for (let i = 0; i < F; i++) writes.push(i % 2 === 0 ? "X" : "Y");
  for (let i = 0; i < K; i++) writes.push("Z");
  const cf = dilutionClosedForm(writes);
  let lawNum: bigint;
  let lawDen: bigint;
  if (F === 0) {
    lawNum = 0n;
    lawDen = 1n;
  } else if (F % 2 === 1) {
    lawNum = 1n;
    lawDen = 2n;
  } else {
    const m = BigInt(F / 2);
    lawNum = m;
    lawDen = 2n * m + 1n;
  }
  return {
    F,
    K,
    qNum: cf.N1,
    qDen: cf.kFact,
    lawNum,
    lawDen,
    agrees: cf.N1 * lawDen === lawNum * cf.kFact,
  };
}

/** The swept grid F = 0..Fmax x K = 0..Kmax, every cell exact. */
export function trichotomyGrid(FMax = 7, KMax = 6): readonly LawRow[] {
  const rows: LawRow[] = [];
  for (let F = 0; F <= FMax; F++) {
    for (let K = 0; K <= KMax; K++) {
      if (F + K < 1) continue;
      rows.push(trichotomyCell(F, K));
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// (DL-d)-adjacent: the cycling-family table (closed form to any k).
// ---------------------------------------------------------------------------

export interface CyclingRow {
  readonly k: number;
  readonly writes: string;
  readonly F: number;
  readonly K: number;
  readonly law: DilutionClosedForm["law"];
  readonly dFloat: number;
  /** dilution ratio D_k / (1/sqrt2), the constant the README tracks. */
  readonly ratio: number;
}

/** Closed-form rows for the cycling family, k = 2..kMax (executor-free). */
export function cyclingFamilyTable(kMax = 9): readonly CyclingRow[] {
  const rows: CyclingRow[] = [];
  for (let k = 2; k <= kMax; k++) {
    const writes = cyclingWrites(k);
    const cf = dilutionClosedForm(writes);
    rows.push({
      k,
      writes: writes.join(","),
      F: cf.F,
      K: cf.K,
      law: cf.law,
      dFloat: cf.dFloat,
      ratio: cf.dFloat * Math.SQRT2,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Smuggling trials (verdict style — the verify.ts family; errors.ts frozen).
// ---------------------------------------------------------------------------

export interface DilutionClaim {
  readonly writes: readonly PlaneWrite[];
  /** the claimed switch constant D_k. */
  readonly claimedD: number;
}

/** A counterfeit dilution constant is recomputed from the census and NAMED:
 * the closed form AND (k <= 6) the full k!-order executor both get a vote. */
export function verifyDilutionClaim(c: DilutionClaim): {
  ok: boolean;
  reason: string;
} {
  const cf = dilutionClosedForm(c.writes);
  if (Math.abs(c.claimedD - cf.dFloat) > 1e-12) {
    return {
      ok: false,
      reason: `DILUTION-COUNTERFEIT: claimed D = ${c.claimedD.toFixed(12)} for [${c.writes.join(",")}] (F = ${cf.F}, K = ${cf.K}), the closed form gives sqrt(${cf.dSqNum}/${cf.dSqDen}) = ${cf.dFloat.toFixed(12)}${cf.law === "halving" ? " — an ODD flipper count pins the halving law q = 1/2 exactly" : cf.law === "even-flippers" ? ` — an EVEN flipper count F = ${cf.F} = 2m pins q = m/(2m+1) exactly (the sqrt(10)/6 law at m = 1)` : " — no flippers pins q = 0 (the switch gains nothing)"}`,
    };
  }
  if (cf.k <= 6) {
    const ex = dilutionExecutor(c.writes);
    if (Math.abs(ex.switchD - cf.dFloat) > 1e-12) {
      return {
        ok: false,
        reason: `DILUTION-COUNTERFEIT: closed form says ${cf.dFloat.toFixed(12)} but the ${bigFactorial(cf.k)}-order executor measures ${ex.switchD.toFixed(12)}`,
      };
    }
  }
  return {
    ok: true,
    reason: `dilution certificate verified: [${c.writes.join(",")}] F = ${cf.F}, K = ${cf.K}, q = ${cf.N1}/${cf.kFact}, D = ${cf.dFloat.toFixed(12)} (${cf.law})`,
  };
}

export interface FamilyClaim {
  /** the write multiset a third party claims is in the family. */
  readonly writes: readonly PlaneWrite[];
  /** claimed: every gamma=0 branch ends on one ray, every fixed order on the wall. */
  readonly claim: "plane-family";
}

/** An off-family surface is caught by the STRUCTURE, not the constant: the
 * gamma=0 branches must all land on one ray. (The executor's replaceWrite
 * hook carries the off-family unitary for the Hadamard trial.) */
export function verifyPlaneFamily(
  c: FamilyClaim,
  execution: DilutionExecution,
): { ok: boolean; reason: string } {
  if (execution.gamma0Dispersion > 1e-9) {
    return {
      ok: false,
      reason: `FAMILY-COUNTERFEIT: the gamma=0 branches disperse (max pairwise trace distance ${execution.gamma0Dispersion.toFixed(6)} != 0) — some write leaves the |+>/|-> plane and the closed form's single-ray premise is dead`,
    };
  }
  if (execution.fixedWallDev > 1e-9) {
    return {
      ok: false,
      reason: `FAMILY-COUNTERFEIT: a fixed order leaves the 1/sqrt(2) wall (max deviation ${execution.fixedWallDev.toFixed(6)}) — the erasure no longer meets a plane state`,
    };
  }
  if (execution.gamma1Distinct !== 2) {
    return {
      ok: false,
      reason: `FAMILY-COUNTERFEIT: the gamma=1 branches take ${execution.gamma1Distinct} distinct outputs, not the two diagonal pure states the flipper/keeper census counts`,
    };
  }
  const cf = dilutionClosedForm(c.writes);
  if (BigInt(execution.counts[1]) !== cf.N1) {
    return {
      ok: false,
      reason: `FAMILY-COUNTERFEIT: executor census [${execution.counts[0]}, ${execution.counts[1]}] vs erasure-position sum N1 = ${cf.N1}/${cf.kFact}`,
    };
  }
  return {
    ok: true,
    reason: `plane family verified: dispersion 0, wall exact, census ${cf.N1}/${cf.kFact}`,
  };
}

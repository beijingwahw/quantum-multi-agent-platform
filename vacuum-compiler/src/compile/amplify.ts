/**
 * The amplification face: repeating the witness check k times.
 *
 * T1 stamped the witness semantics as a binary: accepting program ⇒ ground
 * energy exactly 0; rejecting program ⇒ lifted. The soundness gap this
 * leaves open is the PARTIAL regime and its decay under repetition — the
 * standard QMA amplification face. Literature anchors (docs/citations.md):
 * JW25 proves QMA = QMA_1 only WITH an infinite counter, and its finite
 * truncation is a COMPLETENESS-only amplifier (completeness 1−2^(−q) with
 * O(1) verifier calls, soundness untouched); AHW25 proves the black-box
 * ceiling — no poly-resource QMA verifier gets super-exponentially small
 * soundness — so the plain repetition census below is the standard route
 * and its exponential decay is near the best black-box can do; MN25 shows
 * FK-style constructions admit perfect completeness natively (QMA_1).
 * Our toy-scale completeness is exact for free: the honest accepting
 * witness passes EVERY delivered round with probability exactly 1 (the T3
 * conditional-fidelity-1 certificate), so 1^k = 1 — all decay work below
 * lives on the soundness side.
 *
 * The verifier round, in the clock-readout form of the FK witness check:
 * condition on clock = T (delivery), then measure the accept projector on
 * the data register. For an H_prop-ground-state witness the trajectory law
 * (the dressing identity of T2) forces the conditional data state to be
 * U_T...U_1|phi_0>, so a cheater's per-round false-acceptance probability is
 * exactly the circuit's own acceptance probability on its best valid input:
 *
 *   epsilon = <phi_0| U† Π_acc U |phi_0>   (max over valid inputs).
 *
 * k independent rounds with the AND-accept rule: soundness error epsilon^k
 * (exact rational arithmetic below). The OR-detect rule — reject the moment
 * any round catches the witness — leaves surviving-cheater probability
 * (1-eps)^k: the (1-eps)^k law, verified exactly against the
 * binomial-theorem identity
 *   sum_j C(k,j) eps^j (1-eps)^{k-j} = 1.
 *
 * Completeness: 1^k = 1 exactly (above). The price column lands in the T4
 * ledger: k rounds of static readout erase k·(T+1)·log2(T+1) bits —
 * amplification is priced, not free (the wall again).
 */
import { type CVec, cvecZero, VacuumError } from "../core/cmat.js";
import { type Circuit, type CompiledProgram, program, runCircuit } from "./circuit.js";
import { GATES, embedSingle } from "./gates.js";
import { staticExpectedErasureBits } from "./ledger.js";
import { bigPow } from "./tariff.js";
import type { Rng } from "./rng.js";

// ---------------------------------------------------------------------------
// Exact rational decay
// ---------------------------------------------------------------------------

export interface ExactRational {
  readonly num: bigint; // nonnegative
  readonly den: bigint; // positive
}

/** Interface-contract check: num >= 0, den > 0 (the class of inputs every
 * exact-rational kernel below names before touching). */
function requireRational(r: ExactRational, what: string): void {
  if (r.num < 0n || r.den <= 0n) {
    throw new VacuumError("amplify/malformed-rational", `${what}: num ${r.num}, den ${r.den} (need num >= 0, den > 0)`);
  }
}

/** A probability-valued rational: 0 <= num <= den (den > 0). */
function requireProbabilityRational(r: ExactRational, what: string): void {
  requireRational(r, what);
  if (r.num > r.den) {
    throw new VacuumError("amplify/epsilon-out-of-domain", `${what}: ${r.num}/${r.den} exceeds 1 — not a probability`);
  }
}

/** (num/den)^k in exact integer arithmetic. */
export function exactRationalPower(r: ExactRational, k: number): ExactRational {
  requireRational(r, "exactRationalPower");
  if (!Number.isInteger(k) || k < 0) {
    throw new VacuumError("amplify/rounds-out-of-domain", `exactRationalPower: k = ${k}, expected a nonnegative integer`);
  }
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < k; i++) {
    num *= r.num;
    den *= r.den;
  }
  return { num, den };
}

/** Float rendering of an exact rational (the census table's display column).
 * Correctly rounded whenever num, den fit in 2^53 — always true at the
 * bounded k this census runs; bit-exact when the rational is dyadic. */
export function rationalToFloat(r: ExactRational): number {
  requireRational(r, "rationalToFloat");
  return Number(r.num) / Number(r.den);
}

/** The binomial-theorem amplification identity, exact: for per-round catch
 * probability eps = num/den, sum_{j=0..k} C(k,j) eps^j (1-eps)^{k-j} = 1,
 * i.e. sum_j C(k,j) num^j (den-num)^{k-j} = den^k. Returns the BigInt
 * residue (0 when the identity holds exactly). */
export function binomialAmplificationResidue(r: ExactRational, k: number): bigint {
  requireRational(r, "binomialAmplificationResidue");
  if (!Number.isInteger(k) || k < 0) {
    throw new VacuumError("amplify/rounds-out-of-domain", `binomialAmplificationResidue: k = ${k}, expected a nonnegative integer`);
  }
  let sum = 0n;
  let choose = 1n; // C(k, 0)
  for (let j = 0; j <= k; j++) {
    const epsPow = bigPow(r.num, j);
    const restPow = bigPow(r.den - r.num, k - j);
    sum += choose * epsPow * restPow;
    // C(k, j+1) = C(k, j) * (k-j) / (j+1)
    choose = (choose * BigInt(k - j)) / BigInt(j + 1);
  }
  return sum - bigPow(r.den, k);
}

// ---------------------------------------------------------------------------
// The per-round soundness of a partially-accepting program
// ---------------------------------------------------------------------------

/** Acceptance probability of the output state against the program's accept
 * pattern (the AND of the per-qubit bits): |<acc|psi>|^2 summed. */
export function acceptanceProbability(output: CVec, nQubits: number, acceptPattern: ReadonlyMap<number, 0 | 1>): number {
  if (output.dim !== 2 ** nQubits) {
    throw new VacuumError("amplify/qubit-count-mismatch", `acceptanceProbability: output dim ${output.dim}, expected ${2 ** nQubits} = 2^${nQubits}`);
  }
  let p = 0;
  for (let d = 0; d < output.dim; d++) {
    let accepting = true;
    for (const [q, bit] of acceptPattern) {
      const observed = (d >> (nQubits - 1 - q)) & 1;
      if (observed !== bit) accepting = false;
    }
    if (accepting) p += (output.re[d] as number) ** 2 + (output.im[d] as number) ** 2;
  }
  return p;
}

/** The per-round soundness epsilon of a program with a UNIQUE valid input:
 * the trajectory law pins every H_prop-ground witness to the circuit's own
 * output on that input, so epsilon is the output's acceptance probability. */
export function perRoundSoundness(prog: CompiledProgram, input: CVec): number {
  const output = runCircuit(prog.circuit, input);
  return acceptanceProbability(output, prog.circuit.nQubits, prog.acceptPattern);
}

/** The demo family with EXACTLY KNOWN per-round soundness (dyadic, so the
 * exact rational, the float, and the census all live on the same numbers):
 * - eps = 1/2: H on q0, identity on q1; accept q0 = 1 → |00> → (|00>+|10>)/√2.
 * - eps = 1/4: H⊗H; accept q0 = 1 AND q1 = 1 → uniform → exactly 1/4.
 * Both check both qubits at clock 0 (unique valid input |00>), T = 2. */
export function partialDemoPrograms(): ReadonlyArray<{ name: string; prog: CompiledProgram; eps: ExactRational; input: CVec }> {
  const i2 = GATES[0]!.m;
  const h = GATES[4]!.m;
  const eyeLayer = embedSingle([i2, i2], 2);
  const hOnQ0 = embedSingle([h, i2], 2);
  const hh = embedSingle([h, h], 2);
  const input = cvecZero(4);
  input.re[0] = 1; // |00>

  const half: Circuit = { nQubits: 2, steps: [
    { name: "H@0", matrix: hOnQ0 },
    { name: "I", matrix: eyeLayer },
  ] };
  const quarter: Circuit = { nQubits: 2, steps: [
    { name: "HH", matrix: hh },
    { name: "I", matrix: eyeLayer },
  ] };
  return [
    { name: "eps=1/2 (H@0, accept q0=1)", prog: program(half, [0, 1], new Map([[0, 1]])), eps: { num: 1n, den: 2n }, input },
    { name: "eps=1/4 (HH, accept q0q1=11)", prog: program(quarter, [0, 1], new Map([[0, 1], [1, 1]])), eps: { num: 1n, den: 4n }, input },
  ];
}

// ---------------------------------------------------------------------------
// The decay census
// ---------------------------------------------------------------------------

export interface DecayRow {
  readonly k: number;
  /** epsilon^k, exact */
  readonly exact: ExactRational;
  /** epsilon^k as float (correctly rounded; bit-exact for dyadic eps) */
  readonly float: number;
  /** (1-eps)^k — the OR-detect rule's surviving-cheater law, exact */
  readonly survival: ExactRational;
  /** Monte-Carlo estimate of epsilon^k (k-round AND rule), NaN when the
   * expectation is below the census's resolution (trials·exact < 10) */
  readonly mc: number;
  /** resolvable rows carry an honest 5-sigma tolerance band */
  readonly sigma: number;
  readonly resolvable: boolean;
}

/** The k = 1..kMax census of the AND-rule decay epsilon^k with a seeded
 * Monte-Carlo cross-check (trials cheating witnesses, k Bernoulli(eps)
 * rounds each, fraction passing all k). Rows with expected pass count below
 * 10 are reported exact-only — no tolerance is stretched to cover a census
 * that cannot resolve them. */
export function decayCensus(eps: ExactRational, kMax: number, rng: Rng, trials = 20000): readonly DecayRow[] {
  requireProbabilityRational(eps, "decayCensus");
  if (!Number.isInteger(kMax) || kMax < 1) {
    throw new VacuumError("amplify/rounds-out-of-domain", `decayCensus: kMax = ${kMax}, expected a positive integer`);
  }
  if (!Number.isInteger(trials) || trials < 1) {
    throw new VacuumError("amplify/trials-out-of-domain", `decayCensus: trials = ${trials}, expected a positive integer`);
  }
  const p = rationalToFloat(eps);
  const rows: DecayRow[] = [];
  for (let k = 1; k <= kMax; k++) {
    const exact = exactRationalPower(eps, k);
    const f = rationalToFloat(exact);
    const expected = trials * f;
    const resolvable = expected >= 10;
    let mc = Number.NaN;
    let sigma = Number.NaN;
    if (resolvable) {
      let pass = 0;
      for (let t = 0; t < trials; t++) {
        let ok = true;
        for (let j = 0; j < k; j++) {
          if (!rng.bernoulli(p)) {
            ok = false;
            break;
          }
        }
        if (ok) pass++;
      }
      mc = pass / trials;
      sigma = Math.sqrt(Math.max(f * (1 - f), 0) / trials);
    }
    rows.push({
      k,
      exact,
      float: f,
      survival: exactRationalPower({ num: eps.den - eps.num, den: eps.den }, k),
      mc,
      sigma,
      resolvable,
    });
  }
  return rows;
}

/** Worst census deviation |mc − epsilon^k| in 5-sigma units over the
 * resolvable rows (the honest acceptance statistic: every resolvable row
 * must sit inside 5 sigma). */
export function worstSigmaUnits(rows: readonly DecayRow[]): number {
  let worst = 0;
  for (const r of rows) {
    if (!r.resolvable) continue;
    worst = Math.max(worst, Math.abs(r.mc - r.float) / r.sigma);
  }
  return worst;
}

/** The amplification ledger: k delivered rounds of the static readout
 * protocol erase k·(T+1)·log2(T+1) bits — amplification is priced, not
 * free (the wall again). */
export function amplifiedStaticBits(clockStates: number, k: number): number {
  return k * staticExpectedErasureBits(clockStates);
}

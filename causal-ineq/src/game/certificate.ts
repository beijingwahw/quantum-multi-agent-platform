/**
 * T4 certificate — the qubit-lab relaxation bound, executable.
 *
 * THE CLAIM ON TRIAL: within family F_q (all binary-outcome TPCP instruments
 * on qubit in/out per lab — arbitrary local-input dependence, entangled CJ
 * elements allowed, shared ancillas reduced to PSD+TP by the OCB12 reduction)
 * no strategy beats cos²(π/8) on the process W*(c1, c2) = (1/4)[1 + c1 T1 +
 * c2 T2], and the maximum ½(1+c) is attained by the OCB z/x protocol.
 *
 * THE DERIVATION (auditable here, stated in docs/theory.md):
 * Expand the Born rule with T1 = Z^A2 Z^B1, T2 = Z^A1 X^B1 Z^B2:
 *   Tr[W(M^A ⊗ M^B)] = (1/4)[ m(M^A) m(M^B) + c1 α(M^A) γ(M^B) + c2 β(M^A) δ(M^B) ],
 *   m = Tr,  α = Tr[(1⊗Z)·],  β = Tr[(Z⊗1)·],  γ = Tr[(Z⊗1)·],  δ = Tr[(X⊗Z)·].
 * Marginalising the branch-irrelevant party kills the cross terms:
 *   b'=1:  P(y=a|a,b) = (1/4)[ 2 m^B_{y=a} + c1 α^A(a) γ^B_{y=a} ]   (Σx β = 0),
 *   b'=0:  P(x=b|a,b) = (1/4)[ 2 m^A_{x=b} + c2 β^A_{x=b} δ^B(b,0) ] (Σy γ = 0),
 * where the zero-sums are TP constraints (Tr[(Z⊗1) Σx M^A_x] = Tr Z = 0).
 * Every quantity then obeys PSD/TP lemmas, nothing else:
 *   L1  Σx m_x = 2,  Σx β_x = 0,  Σy m_y = 2,  Σy γ_y = 0;
 *   L2  |β_x| ≤ m_x  and  |γ_y| ≤ m_y        (-1 ⪯ Z⊗1 ⪯ 1, M ⪰ 0);
 *   L3  |α^A| ≤ 2                              (α = Tr[Z σ], σ ⪰ 0, Tr σ = 2);
 *   L4  |δ^B| ≤ 2                              (|Tr[(X⊗Z)M_tot]| ≤ Tr M_tot = 2).
 * Chaining (γ1 = -γ0, β1 = -β0 force |γ|, |β| ≤ 1 at the active element):
 *   P_B ≤ (1/16)(8 + 8 c1) = ½(1+c1),   P_A ≤ (1/16)(8 + 8 c2) = ½(1+c2),
 * independently per branch, so p_success ≤ ½(1 + (c1+c2)/2); at c1 = c2 = 1/√2
 * this is exactly cos²(π/8), attained by the OCB protocol (both bounds tight).
 *
 * This module executes every step: the functional identity against the full
 * Born rule on random instruments (including entangled elements), the lemmas
 * on arbitrary F_q instruments, and the bound chain. It also carries the
 * claim adjudicator used by the smuggling trials — a "violation" without a
 * certificate is NAMED and REJECTED, never silently averaged in.
 */
import { cmatAdd, cmatKron, cmatTraceProd, cmatEye, NamedError, type CMat } from "../core/cmat.js";
import { PAULI, pauliCoefficients, checkValidity } from "../process/validity.js";
import { instrumentTP, type Axis, type InstrumentBuilder, type InstrumentPair, type StrategyParams } from "./strategy.js";
import { pSuccessOf } from "./quantum.js";

const I = PAULI[0] as CMat;
const X = PAULI[1] as CMat;
const Z = PAULI[3] as CMat;

/** W* coefficient pair (c1 on T1 = Z^A2 Z^B1, c2 on T2 = Z^A1 X^B1 Z^B2). */
export interface WStarCoefficients {
  readonly c1: number;
  readonly c2: number;
  /** max |Pauli coefficient| on any OTHER nontrivial pattern (0 iff W ∈ span{1,T1,T2}) */
  readonly offSpan: number;
}

/** Extract (c1, c2) and the off-span residue from the Pauli expansion of W. */
export function wStarCoefficients(w: CMat): WStarCoefficients {
  // Pauli expansion W = Σ c_P P has c_{T1} = c1/4 (the bracket carries the 1/4
  // overall: W = (1/4)[1 + c1 T1 + c2 T2]) — rescale to the bracket form.
  let c1 = 0;
  let c2 = 0;
  let offSpan = 0;
  for (const p of pauliCoefficients(w)) {
    if (p.j === 0 && p.k === 3 && p.l === 3 && p.m === 0) c1 = 4 * p.c;
    else if (p.j === 3 && p.k === 0 && p.l === 1 && p.m === 3) c2 = 4 * p.c;
    else if (p.j + p.k + p.l + p.m > 0) offSpan = Math.max(offSpan, 4 * Math.abs(p.c));
  }
  return { c1, c2, offSpan };
}

// local functionals of a 4-dim CJ element (spaces: input ⊗ output, qubit 0 = input)
function fTrace(m: CMat): number {
  return cmatTraceProd(m, cmatEye(4)).re;
}
const OP_A2 = (): CMat => cmatKron(I, Z); // 1 ⊗ Z on (A1, A2)
const OP_A1 = (): CMat => cmatKron(Z, I); // Z ⊗ 1 on (A1, A2)
const OP_B1 = (): CMat => cmatKron(Z, I); // Z ⊗ 1 on (B1, B2)
const OP_B1B2 = (): CMat => cmatKron(X, Z); // X ⊗ Z on (B1, B2)

export interface AliceFunctionals {
  readonly m: readonly number[]; // per outcome
  readonly beta: readonly number[]; // per outcome
  readonly alphaTot: number; // Σx Tr[(1⊗Z) M_x]
  readonly tp: number; // ||Σx Tr_A2[M_x] − 1||_max
}

export interface BobFunctionals {
  readonly m: readonly number[];
  readonly gamma: readonly number[];
  readonly deltaTot: number; // Σy Tr[(X⊗Z) M_y]
  readonly tp: number;
}

function aliceFunctionalsOf(pair: InstrumentPair): AliceFunctionals {
  const [m0, m1] = pair;
  const tot = cmatAdd(m0, m1);
  return {
    m: [fTrace(m0), fTrace(m1)],
    beta: [cmatTraceProd(m0, OP_A1()).re, cmatTraceProd(m1, OP_A1()).re],
    alphaTot: cmatTraceProd(tot, OP_A2()).re,
    tp: instrumentTP(pair),
  };
}

function bobFunctionalsOf(pair: InstrumentPair): BobFunctionals {
  const [m0, m1] = pair;
  const tot = cmatAdd(m0, m1);
  return {
    m: [fTrace(m0), fTrace(m1)],
    gamma: [cmatTraceProd(m0, OP_B1()).re, cmatTraceProd(m1, OP_B1()).re],
    deltaTot: cmatTraceProd(tot, OP_B1B2()).re,
    tp: instrumentTP(pair),
  };
}

function aliceFunctionals(builder: InstrumentBuilder, a: number): AliceFunctionals {
  return aliceFunctionalsOf(builder.alice(a));
}

function bobFunctionals(builder: InstrumentBuilder, b: number, bp: number): BobFunctionals {
  return bobFunctionalsOf(builder.bob(b, bp));
}

export interface FunctionalPayoff {
  readonly pAliceGuesses: number;
  readonly pBobGuesses: number;
  readonly pSuccess: number;
}

/** Payoff from the functional decomposition ONLY (no 16-dim products). */
export function functionalPayoff(coeff: WStarCoefficients, builder: InstrumentBuilder): FunctionalPayoff {
  const af = [aliceFunctionals(builder, 0), aliceFunctionals(builder, 1)];
  const bf10 = [bobFunctionals(builder, 0, 1), bobFunctionals(builder, 1, 1)]; // b'=1
  const bf00 = [bobFunctionals(builder, 0, 0), bobFunctionals(builder, 1, 0)]; // b'=0
  let pA = 0;
  let pB = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      pA += 2 * ((af[a]!.m)[b] as number) + coeff.c2 * ((af[a]!.beta)[b] as number) * (bf00[b]!.deltaTot);
      pB += 2 * ((bf10[b]!.m)[a] as number) + coeff.c1 * (af[a]!.alphaTot) * ((bf10[b]!.gamma)[a] as number);
    }
  }
  const pAlice = pA / 16;
  const pBob = pB / 16;
  return { pAliceGuesses: pAlice, pBobGuesses: pBob, pSuccess: pSuccessOf(pAlice, pBob) };
}

export interface LemmaReport {
  readonly worstTP: number; // ||Σ Tr_out[M] − 1||_max over all instruments
  readonly worstBetaSum: number; // max |Σx βx| (must be 0)
  readonly worstGammaSum: number; // max |Σy γy| (must be 0)
  readonly worstBetaTrace: number; // max (|βx| − m_x)^+ (must be ≤ 0)
  readonly worstGammaTrace: number; // max (|γy| − m_y)^+ (must be ≤ 0)
  readonly worstAlpha: number; // max (|α| − 2)^+ (must be ≤ 0)
  readonly worstDelta: number; // max (|δ| − 2)^+ (must be ≤ 0)
  readonly worst: number; // max of all violations (positive = a lemma failed)
}

/** Evaluate L1-L4 on every instrument of the strategy; 0 = all lemmas hold. */
export function lemmaViolations(builder: InstrumentBuilder): LemmaReport {
  let worstTP = 0;
  let worstBetaSum = 0;
  let worstGammaSum = 0;
  let worstBetaTrace = 0;
  let worstGammaTrace = 0;
  let worstAlpha = 0;
  let worstDelta = 0;
  for (let a = 0; a < 2; a++) {
    const f = aliceFunctionals(builder, a);
    worstTP = Math.max(worstTP, f.tp);
    worstBetaSum = Math.max(worstBetaSum, Math.abs((f.beta[0] as number) + (f.beta[1] as number)));
    for (let x = 0; x < 2; x++) {
      worstBetaTrace = Math.max(worstBetaTrace, Math.abs((f.beta)[x] as number) - ((f.m)[x] as number));
    }
    worstAlpha = Math.max(worstAlpha, Math.abs(f.alphaTot) - 2);
  }
  for (let k = 0; k < 4; k++) {
    const f = bobFunctionals(builder, k >> 1, k & 1);
    worstTP = Math.max(worstTP, f.tp);
    worstGammaSum = Math.max(worstGammaSum, Math.abs((f.gamma[0] as number) + (f.gamma[1] as number)));
    for (let y = 0; y < 2; y++) {
      worstGammaTrace = Math.max(worstGammaTrace, Math.abs((f.gamma)[y] as number) - ((f.m)[y] as number));
    }
    worstDelta = Math.max(worstDelta, Math.abs(f.deltaTot) - 2);
  }
  const worst = Math.max(worstTP, worstBetaSum, worstGammaSum, worstBetaTrace, worstGammaTrace, worstAlpha, worstDelta);
  return { worstTP, worstBetaSum, worstGammaSum, worstBetaTrace, worstGammaTrace, worstAlpha, worstDelta, worst };
}

export interface BoundReport {
  readonly pABound: number; // ½(1+c2)
  readonly pBBound: number; // ½(1+c1)
  readonly pSuccessBound: number; // ½ + (c1+c2)/4
  readonly pAExecuted: number;
  readonly pBExecuted: number;
  readonly pSuccessExecuted: number;
  readonly slack: number; // bound − executed (≥ −tol when all is well)
}

/** The bound chain vs the executed (functional) payoff. */
export function boundReport(coeff: WStarCoefficients, builder: InstrumentBuilder): BoundReport {
  const fp = functionalPayoff(coeff, builder);
  const pABound = 0.5 * (1 + coeff.c2);
  const pBBound = 0.5 * (1 + coeff.c1);
  return {
    pABound,
    pBBound,
    pSuccessBound: pSuccessOf(pABound, pBBound),
    pAExecuted: fp.pAliceGuesses,
    pBExecuted: fp.pBobGuesses,
    pSuccessExecuted: fp.pSuccess,
    slack: pSuccessOf(pABound, pBBound) - fp.pSuccess,
  };
}

/** Identity check: full Born-rule payoff vs functional decomposition. */
export function decompositionIdentity(w: CMat, builder: InstrumentBuilder, fullPayoff: { pAliceGuesses: number; pBobGuesses: number }): number {
  const coeff = wStarCoefficients(w);
  if (coeff.offSpan > 1e-12) throw new NamedError("certificate/off-span-process", `decompositionIdentity: W not in span{1,T1,T2} (off-span ${coeff.offSpan})`);
  const fp = functionalPayoff(coeff, builder);
  return Math.max(Math.abs(fp.pAliceGuesses - fullPayoff.pAliceGuesses), Math.abs(fp.pBobGuesses - fullPayoff.pBobGuesses));
}

/**
 * The functional decomposition collapsed for the detect-prepare product
 * family, where every 4-dim trace collapses to 2-dim data (Tr[A_x] = 1,
 * Tr[Z A_x] = s (-1)^x n_z, Tr[X A_x] = s n_x):
 *   beta_x(a)    = s_A(a) (-1)^x n_z^A(a),
 *   alpha(a)     = r_z^{a}(0) + r_z^{a}(1),
 *   gamma_y(b,1) = s_B(b,1) (-1)^y n_z^B(b,1),
 *   delta(b,0)   = s_B(b,0) n_x^B(b,0) (r_z^{b,0}(0) - r_z^{b,0}(1)),
 * and the payoff is assembled from exactly the functionalPayoff formulas.
 * This is the sweep's fast path; exp4 pins it to the matrix path (and hence
 * to the Born rule) by sampling — the certificate chain stays unbroken.
 */
export function closedFormProductPayoff(coeff: WStarCoefficients, params: StrategyParams): FunctionalPayoff {
  const bA = (a: number, x: number): number => (params.alice.sharp[a] as number) * (x === 0 ? 1 : -1) * ((params.alice.axis[a] as Axis)[2]);
  const alpha = (a: number): number => (((params.alice.prep[a] as readonly Axis[])[0] as Axis)[2]) + (((params.alice.prep[a] as readonly Axis[])[1] as Axis)[2]);
  const gB = (k: number, y: number): number => (params.bob.sharp[k] as number) * (y === 0 ? 1 : -1) * ((params.bob.axis[k] as Axis)[2]);
  const dB = (k: number): number =>
    (params.bob.sharp[k] as number) *
    ((params.bob.axis[k] as Axis)[0]) *
    ((((params.bob.prep[k] as readonly Axis[])[0] as Axis)[2]) - (((params.bob.prep[k] as readonly Axis[])[1] as Axis)[2]));
  let pA = 0;
  let pB = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      pA += 2 + coeff.c2 * bA(a, b) * dB(2 * b); // slot 2b = (b, b'=0); m_x = 1 in this family
      pB += 2 + coeff.c1 * alpha(a) * gB(2 * b + 1, a); // slot 2b+1 = (b, b'=1)
    }
  }
  const pAlice = pA / 16;
  const pBob = pB / 16;
  return { pAliceGuesses: pAlice, pBobGuesses: pBob, pSuccess: pSuccessOf(pAlice, pBob) };
}

// ---------------------------------------------------------------------------
// the claim adjudicator (smuggling trials): a number without a certificate is
// NAMED and REJECTED. accepted iff every gate passes on the executed values.
// ---------------------------------------------------------------------------

export interface Claim {
  readonly name: string;
  readonly claimedValue: number;
  readonly w: CMat;
  readonly builder: InstrumentBuilder;
  /** the full Born-rule payoff (executed), supplied by the caller so the
   *  adjudicator never trusts the claimant's own arithmetic */
  readonly executedPayoff: { pAliceGuesses: number; pBobGuesses: number; pSuccess: number };
}

export interface ClaimVerdict {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly executedValue: number;
}

export function adjudicate(claim: Claim, tol = 1e-9): ClaimVerdict {
  const reasons: string[] = [];
  const v = checkValidity(claim.w);
  if (!v.valid) reasons.push(`REJECT[invalid-process]: ${claim.name} — process fails validity (${v.violations.join("; ")})`);
  let worstTP = 0;
  for (let a = 0; a < 2; a++) worstTP = Math.max(worstTP, instrumentTP(claim.builder.alice(a)));
  for (let k = 0; k < 4; k++) worstTP = Math.max(worstTP, instrumentTP(claim.builder.bob(k >> 1, k & 1)));
  if (worstTP > 1e-9) reasons.push(`REJECT[instrument-not-TP]: ${claim.name} — instrument normalization off by ${worstTP.toExponential(2)}`);
  if (Math.abs(claim.claimedValue - claim.executedPayoff.pSuccess) > tol) {
    reasons.push(`REJECT[claim-vs-execution]: ${claim.name} — claimed ${claim.claimedValue}, executed ${claim.executedPayoff.pSuccess}`);
  }
  const coeff = wStarCoefficients(claim.w);
  if (coeff.offSpan <= 1e-12) {
    const br = boundReport(coeff, claim.builder);
    if (br.pSuccessExecuted > br.pSuccessBound + tol) {
      reasons.push(`REJECT[exceeds-qubit-family-bound]: ${claim.name} — executed ${br.pSuccessExecuted} > bound ${br.pSuccessBound}`);
    }
  }
  return { accepted: reasons.length === 0, reasons, executedValue: claim.executedPayoff.pSuccess };
}

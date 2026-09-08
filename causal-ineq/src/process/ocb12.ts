/**
 * The OCB12 equivalence face (v0.1.0 boundary 1, retired here).
 *
 * TRANSCRIPTION PROVENANCE — Oreshkov, Costa, Brukner, "Quantum correlations
 * with no causal order", arXiv:1105.4464v3 (Nat. Commun. 3:1092), Methods:
 *
 *   their eq. (7):
 *     W^{A1A2B1B2} = 1/4 [ 1^(A1A2B1B2)
 *                          + (1/sqrt2)( sigma_z^{A2} sigma_z^{B1}
 *                                       + sigma_z^{A1} sigma_x^{B1} sigma_z^{B2} ) ],
 *   their eq. (26) (reduced probabilities of their protocol, c=1/sqrt2):
 *     P(y | a, b, b'=1) = 1/2 [ 1 + (-1)^{y+a} / sqrt2 ],
 *     P(x | a, b, b'=0) = 1/2 [ 1 + (-1)^{x+b} / sqrt2 ]   (symmetric case).
 *
 * LC25 — Liu & Chiribella, arXiv:2403.02749v3 (Nat. Commun. 16, 3314),
 * their eq. (41): the attaining family
 *   S_{OCB,alpha} = 1/4 1 + alpha/(4 sqrt(1+alpha^2)) (1⊗Z⊗Z⊗1)
 *                              + 1/(4 sqrt(1+alpha^2)) (Z⊗1⊗X⊗Z),
 * whose alpha = 1 element is the same operator again.
 *
 * This module transcribes eq. (7) and eq. (26) as INDEPENDENT code paths
 * (built from the transcribed coefficients, not from the repo's own wStar
 * construction) and reports the elementwise / entrywise deviations. If the
 * machine-derived W* and the literature matrices agree to solver precision,
 * boundary 1 ("not transcribed, equivalence not claimed") is retired with a
 * certificate; any tampered transcription is caught by the same deviation
 * check (see the smuggling trials).
 */
import { cmatAdd, cmatEye, cmatMaxAbsDiff, cmatScale, cmatKron4, type CMat } from "../core/cmat.js";
import { PAULI, checkValidity, type ValidityReport } from "./validity.js";
import { wStar } from "./construct.js";
import { ocbStrategy, strategyBranchTables, type BranchTables } from "../game/strategy.js";

const SIG_X = PAULI[1] as CMat;
const SIG_Z = PAULI[3] as CMat;
const ID2 = PAULI[0] as CMat;

/** OCB12 eq. (7), transcribed literally: (1/4)[1 + (1/√2)(Z^{A2}Z^{B1} + Z^{A1}X^{B1}Z^{B2})]. */
export function wOCB12(): CMat {
  const term1 = cmatKron4(ID2, SIG_Z, SIG_Z, ID2); // sigma_z^{A2} sigma_z^{B1}
  const term2 = cmatKron4(SIG_Z, ID2, SIG_X, SIG_Z); // sigma_z^{A1} sigma_x^{B1} sigma_z^{B2}
  return cmatScale(
    cmatAdd(cmatEye(16, 1), cmatScale(cmatAdd(term1, term2), 1 / Math.sqrt(2))),
    0.25,
  );
}

/** Tamper control A: sigma_x^{B1} mistranscribed as sigma_y^{B1} in term 2.
 *  Still an ALLOWED pattern (3,0,2,3) and still PSD — validity alone cannot
 *  catch it; only the elementwise/entrywise comparison can. */
export function wOCB12TamperedPauli(): CMat {
  const term1 = cmatKron4(ID2, SIG_Z, SIG_Z, ID2);
  const term2 = cmatKron4(SIG_Z, ID2, PAULI[2] as CMat, SIG_Z);
  return cmatScale(
    cmatAdd(cmatEye(16, 1), cmatScale(cmatAdd(term1, term2), 1 / Math.sqrt(2))),
    0.25,
  );
}

/** Tamper control B: the 1/√2 on term 2 mistranscribed as 0.69. Valid process
 *  (c1² + c2² < 1, inside the PSD window) with a slightly different payoff —
 *  again only the deviation checks expose it. */
export function wOCB12TamperedCoeff(): CMat {
  const term1 = cmatKron4(ID2, SIG_Z, SIG_Z, ID2);
  const term2 = cmatKron4(SIG_Z, ID2, SIG_X, SIG_Z);
  return cmatScale(
    cmatAdd(cmatEye(16, 1), cmatAdd(cmatScale(term1, 1 / Math.sqrt(2)), cmatScale(term2, 0.69))),
    0.25,
  );
}

/** LC25 eq. (41): S_{OCB,alpha} = 1/4·1 + α/(4√(1+α²))·(1⊗Z⊗Z⊗1) + 1/(4√(1+α²))·(Z⊗1⊗X⊗Z). */
export function wLC25(alpha: number): CMat {
  const n = Math.sqrt(1 + alpha * alpha);
  const term1 = cmatKron4(ID2, SIG_Z, SIG_Z, ID2);
  const term2 = cmatKron4(SIG_Z, ID2, SIG_X, SIG_Z);
  return cmatAdd(
    cmatScale(cmatEye(16, 0.25), 1),
    cmatAdd(cmatScale(term1, alpha / (4 * n)), cmatScale(term2, 1 / (4 * n))),
  );
}

/** The W*-form with free (c1, c2): (1/4)[1 + c1 T1 + c2 T2]; PSD iff c1² + c2² ≤ 1. */
export function wStarFree(c1: number, c2: number): CMat {
  const term1 = cmatKron4(ID2, SIG_Z, SIG_Z, ID2);
  const term2 = cmatKron4(SIG_Z, ID2, SIG_X, SIG_Z);
  return cmatScale(cmatAdd(cmatEye(16, 1), cmatAdd(cmatScale(term1, c1), cmatScale(term2, c2))), 0.25);
}

/** LC25's attaining curve as a function of α (their normalisation): equals wStarFree(α/√(1+α²), 1/√(1+α²)). */
export function wBiased(alpha: number): CMat {
  const n = Math.sqrt(1 + alpha * alpha);
  return wStarFree(alpha / n, 1 / n);
}

/** OCB12 eq. (26) closed-form branch tables: ½[1 + (−1)^{x+b}/√2], ½[1 + (−1)^{y+a}/√2]. */
export function ocb12ClosedFormTables(): BranchTables {
  const f = (s: number): number => 0.5 * (1 + s / Math.sqrt(2));
  const pAlice = [
    [[f(1), f(-1)], [f(1), f(-1)]], // b = 0: P(x|a, b) depends on x+b only
    [[f(-1), f(1)], [f(-1), f(1)]], // b = 1
  ];
  const pBob = [
    [[f(1), f(-1)], [f(-1), f(1)]], // b = 0: P(y|a, b) depends on y+a only
    [[f(1), f(-1)], [f(-1), f(1)]], // b = 1
  ];
  return { pAlice, pBob };
}

/** Max entrywise deviation between two branch-table triples. */
export function branchTableDeviation(a: BranchTables, b: BranchTables): number {
  const entry = (t: readonly number[][][], i: number, j: number, k: number): number => {
    const row = (t[i] as number[][])[j] as number[];
    return row[k] as number;
  };
  let d = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        d = Math.max(d, Math.abs(entry(a.pAlice, i, j, k) - entry(b.pAlice, i, j, k)));
        d = Math.max(d, Math.abs(entry(a.pBob, i, j, k) - entry(b.pBob, i, j, k)));
      }
    }
  }
  return d;
}

export interface EquivalenceReport {
  /** max |W_OCB12 − W*(1/√2)| entrywise (the elementwise identity certificate) */
  readonly wVsOCB12: number;
  /** max |S_OCB,1 (LC25 eq. 41) − W*(1/√2)| entrywise */
  readonly wVsLC25: number;
  /** max entrywise deviation of executed OCB-protocol branch tables vs eq. (26) */
  readonly tablesVsClosedForm: number;
  readonly ocb12Validity: ValidityReport;
  readonly starValidity: ValidityReport;
}

/**
 * The full machine-check: (i) the transcribed eq. (7) equals the repo's
 * machine-derived W* elementwise; (ii) the same for LC25's S_OCB,1; (iii) the
 * OCB protocol executed on W* reproduces the eq. (26) closed-form branch
 * probabilities entry by entry; (iv) both processes pass the validity checker.
 */
export function equivalenceReport(): EquivalenceReport {
  const wStarMat = wStar(Math.SQRT1_2);
  const wOcb = wOCB12();
  const executed = strategyBranchTables(wStarMat, ocbStrategy());
  return {
    wVsOCB12: cmatMaxAbsDiff(wOcb, wStarMat),
    wVsLC25: cmatMaxAbsDiff(wLC25(1), wStarMat),
    tablesVsClosedForm: branchTableDeviation(executed, ocb12ClosedFormTables()),
    ocb12Validity: checkValidity(wOcb),
    starValidity: checkValidity(wStarMat),
  };
}

/** The equivalence verdict: PASS iff every deviation is at solver precision and both processes valid. */
export function equivalenceVerdict(rep: EquivalenceReport, tol = 1e-12): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (rep.wVsOCB12 > tol) problems.push(`REJECT[elementwise-vs-OCB12]: max deviation ${rep.wVsOCB12.toExponential(3)} > ${tol.toExponential(0)}`);
  if (rep.wVsLC25 > tol) problems.push(`REJECT[elementwise-vs-LC25]: max deviation ${rep.wVsLC25.toExponential(3)}`);
  if (rep.tablesVsClosedForm > tol) problems.push(`REJECT[tables-vs-eq26]: max deviation ${rep.tablesVsClosedForm.toExponential(3)}`);
  if (!rep.ocb12Validity.valid) problems.push(`REJECT[ocb12-invalid]: ${rep.ocb12Validity.violations.join("; ")}`);
  if (!rep.starValidity.valid) problems.push(`REJECT[wstar-invalid]: ${rep.starValidity.violations.join("; ")}`);
  return { ok: problems.length === 0, problems };
}

/**
 * Adjudicate an ARBITRARY process claiming to be the OCB12 process (the
 * fake-equivalence smuggling trial): named rejection for elementwise
 * deviation from the transcribed eq. (7), for branch-table deviation from
 * the eq. (26) closed forms, or for invalidity. A tampered-but-valid
 * transcription is caught here by comparison, not by validity.
 */
export function compareWithOCB12(w: CMat, tol = 1e-12): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const star = wStar(Math.SQRT1_2);
  const dev = cmatMaxAbsDiff(w, star);
  if (dev > tol) problems.push(`REJECT[elementwise-vs-OCB12]: max deviation ${dev.toExponential(3)} from the transcribed eq. (7)`);
  const tbl = branchTableDeviation(strategyBranchTables(w, ocbStrategy()), ocb12ClosedFormTables());
  if (tbl > tol) problems.push(`REJECT[tables-vs-eq26]: max deviation ${tbl.toExponential(3)} from the eq. (26) closed forms`);
  const val = checkValidity(w);
  if (!val.valid) problems.push(`REJECT[invalid-process]: ${val.violations.join("; ")}`);
  return { ok: problems.length === 0, problems };
}

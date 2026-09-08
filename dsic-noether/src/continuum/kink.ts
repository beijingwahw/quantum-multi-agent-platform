/**
 * The kink locus as piecewise-smooth Noether (v0.3.0): K4 executed.
 *
 * v0.2.0 stopped at the kink ("the general measurable-space theorem takes
 * over"). v0.3.0 treats the kink itself as a PIECEWISE-SMOOTH mechanism:
 * the chain runs exactly on each smooth piece, and the GLUING at the kink is
 * priced exactly. Two regimes:
 *
 * JUMP REGIME — the second-price kink (indivisible item, v = t*a). The
 * mechanism is two polynomial patches over Q[s, t, w] (s own report, t own
 * true type, w the other's report): winning patch {x = 1, p = w}, losing
 * patch {x = 0, p = 0}. On EACH patch the chain closes (the patch rules are
 * constant, so per-patch links are trivially zero — labelled honestly; the
 * content is at the kink): [E] zero polynomial per patch; [G] p + W_-i(x) = w
 * on BOTH patches — the same gauge h = w = the Clarke pivot: second price is
 * Groves piecewise with a COMMON gauge. The gluing, priced exactly:
 *     [x] = 1,   [p] = w,   [u] = t - w,   [u] = t*[x] - [p]   (exact),
 * the charge's one-sided limits at the kink (0 and -(t-w) for a true winner)
 * and the across-kink integration step — the piecewise FTC
 *     U(t1) - U(t0) = |[t0,t1] intersect (w, inf)|   (exact rationals),
 * which is the Milgrom-Segal envelope (MS02) for arbitrary choice sets,
 * executed on rational pairs that cross and do not cross the kink. The
 * mechanism's utility JUMPS at the kink by exactly the true-type gap, and
 * DSIC across the kink is the sign table of that jump.
 *
 * CONTINUITY REGIME — the capacity wall of the quadratic family (divisible
 * good, v = theta*a - a^2/2, sum a = 1, types widened to [1/2, 5/2]^2 so the
 * wall binds — the region v0.2.0's interior guard was built to avoid). The
 * efficient allocation is the clamp x1 = max(0, (s - w + 1)/2): interior
 * patch (NONCONSTANT rule — the chain runs nontrivially) and wall patch
 * x = 0, both Groves under the same pivot h = w - 1/2. Here the allocation,
 * payment, and CHARGE are CONTINUOUS at the kink (verified as polynomial
 * identities at the kink point s* = w - 1, w symbolic), and what jumps is the
 * charge's FLUX: dG/ds one-sided limits differ by exactly (t - w + 1)/2 =
 * x(t), the true allocation — the surface term the piecewise Noether
 * conservation carries at the interface. The charge is the same -(s-t)^2/4
 * on the interior patch, 0 on the wall-to-wall block (a WEAK-DSIC flat: every
 * walled report is as good as truth — ties are the kink's indifference faces),
 * and -(t-w+1)^2/4 on the cross block.
 *
 * Negative controls (the smuggling trials the tests run): FIRST PRICE
 * (p = s on the winning patch) satisfies the kink gluing identity
 * ([p] = w at s = w!) yet is convicted ON THE PATCH by [E] with residual
 * exactly -1 — the counterfeit certificate "gluing holds => DSIC" is named
 * and rejected: the checker demands per-patch [E] AND gluing. ALL-PAY
 * (p = s on both patches) is convicted on the LOSING patch the same way.
 */

import {
  pAdd,
  pConst,
  pDeriv,
  pEval,
  pInteg,
  pIsZero,
  pMonomialsUsing,
  pMul,
  pScale,
  pSub,
  pSubst,
  pSubstRat,
  pVar,
  pZero,
  rAdd,
  rCmp,
  rMul,
  rSub,
  rat,
  R0,
  R1,
  type Poly,
  type Rat,
} from "./poly.js";

export const KINK_VARS: readonly string[] = ["s", "t", "w"];

// ---------------------------------------------------------------------------
// the jump regime: the second-price patches
// ---------------------------------------------------------------------------

export interface Patch {
  readonly name: string;
  readonly x: Poly;
  readonly p: Poly;
}

export function secondPricePatches(): { win: Patch; lose: Patch } {
  return {
    win: { name: "win (s > w)", x: pConst(KINK_VARS, R1), p: pVar(KINK_VARS, 2) },
    lose: { name: "lose (s < w)", x: pZero(KINK_VARS), p: pZero(KINK_VARS) },
  };
}

/** Binary-good utility of the patch: u = t*x - p. */
export function patchUtility(patch: Patch): Poly {
  return pSub(pMul(pVar(KINK_VARS, 1), patch.x), patch.p);
}

/** [E] per patch: dp/ds = t * dx/ds on the truthful diagonal (zero polynomial
 * required — computed, never asserted). */
export function patchEnvelopeResidual(patch: Patch): Poly {
  const t = pVar(KINK_VARS, 1);
  const field = pSub(pMul(t, pDeriv(patch.x, 0)), pDeriv(patch.p, 0));
  return pSubst(field, 1, pVar(KINK_VARS, 0));
}

/** Others' (agent 2's) welfare at the patch allocation: w*(1 - x). */
export function patchW2(patch: Patch): Poly {
  const w = pVar(KINK_VARS, 2);
  return pMul(w, pSub(pConst(KINK_VARS, R1), patch.x));
}

/** The Clarke pivot for the indivisible item: agent 2 alone gets it, h = w. */
export function secondPricePivot(): Poly {
  return pVar(KINK_VARS, 2);
}

/** [G] per patch: p + W_-i(x) - h — the zero polynomial iff the patch is
 * Groves under the pivot. BOTH second-price patches carry the SAME gauge. */
export function patchGrovesResidual(patch: Patch): Poly {
  return pSub(pAdd(patch.p, patchW2(patch)), secondPricePivot());
}

/** [I] per patch: the gauge readoff p - (fiber integral of the envelope
 * integrand) — the integrand is 0 on constant-rule patches, so the readoff is
 * p itself; clean iff p carries no own-report monomial. The clean check is
 * the KERNEL's monomial census (pMonomialsUsing on the own-report index) —
 * single-sourced with the classifier's conviction channel, never re-rolled
 * per file. */
export function patchReadoff(patch: Patch): { readoff: Poly; clean: boolean } {
  const integrand = pSubst(pMul(pVar(KINK_VARS, 1), pDeriv(patch.x, 0)), 1, pVar(KINK_VARS, 0));
  const integ = pInteg(integrand, 0);
  const readoff = pSub(patch.p, integ);
  return { readoff, clean: pMonomialsUsing(readoff, 0) === 0 };
}

/** The exact jumps at the kink s = w, evaluated from the patch polynomials. */
export function kinkJumps(t: Rat, w: Rat): {
  jumpX: Rat;
  jumpP: Rat;
  jumpU: Rat;
  gluingResidual: Rat;
  ok: boolean;
} {
  const { win, lose } = secondPricePatches();
  const at = (q: Poly): Rat => pEval(pSubstRat(q, 0, w), [w, t, w]);
  const jumpX = rSub(at(win.x), at(lose.x));
  const jumpP = rSub(at(win.p), at(lose.p));
  const jumpU = rSub(at(patchUtility(win)), at(patchUtility(lose)));
  // the gluing identity: [u] = t*[x] - [p]
  const gluingResidual = rSub(jumpU, rSub(rMul(t, jumpX), jumpP));
  return { jumpX, jumpP, jumpU, gluingResidual, ok: rCmp(gluingResidual, R0) === 0 };
}

/** The indirect utility U(t) = max(0, t - w) (rational, no floats). */
export function secondPriceIndirectU(t: Rat, w: Rat): Rat {
  return rCmp(t, w) > 0 ? rSub(t, w) : R0;
}

/** The across-kink [I] step (the Milgrom-Segal envelope executed):
 * U(t1) - U(t0) must equal the SIGNED exact measure of [t0, t1] above w
 * (orientation carried — reversed pairs integrate negatively). */
export function acrossKinkEnvelope(t0: Rat, t1: Rat, w: Rat): { uDiff: Rat; integral: Rat; ok: boolean } {
  const uDiff = rSub(secondPriceIndirectU(t1, w), secondPriceIndirectU(t0, w));
  const lo = rCmp(t0, t1) < 0 ? t0 : t1;
  const hi = rCmp(t0, t1) < 0 ? t1 : t0;
  const aboveLo = rCmp(lo, w) > 0 ? lo : w;
  const raw = rSub(hi, aboveLo);
  const magnitude = rCmp(raw, R0) > 0 ? raw : R0;
  const sign = rCmp(t1, t0) > 0 ? R1 : rat(-1);
  const integral = rMul(magnitude, sign);
  return { uDiff, integral, ok: rCmp(uDiff, integral) === 0 };
}

/** The charge's one-sided limits at the kink, priced exactly. The win-side
 * limit is the SIGNED t - w (a loser can force a win by reporting past the
 * kink and pays for it); the lose-side limit is 0. */
export function chargeOneSided(t: Rat, w: Rat): {
  uTruth: Rat;
  fromWin: Rat;
  fromLose: Rat;
  jump: Rat;
  dsicAcross: boolean;
} {
  const win = rSub(t, w); // u at s -> w+ : t*1 - w, signed
  const lose = R0; // u at s -> w- : 0
  const uTruth = secondPriceIndirectU(t, w);
  const fromWin = rSub(win, uTruth);
  const fromLose = rSub(lose, uTruth);
  return {
    uTruth,
    fromWin,
    fromLose,
    jump: rSub(fromLose, fromWin),
    dsicAcross: rCmp(fromWin, R0) <= 0 && rCmp(fromLose, R0) <= 0,
  };
}

// ---------------------------------------------------------------------------
// negative controls: first price and all-pay
// ---------------------------------------------------------------------------

export function firstPricePatches(): { win: Patch; lose: Patch } {
  return {
    win: { name: "first-price win (s > w)", x: pConst(KINK_VARS, R1), p: pVar(KINK_VARS, 0) },
    lose: { name: "first-price lose (s < w)", x: pZero(KINK_VARS), p: pZero(KINK_VARS) },
  };
}

export function allPayPatches(): { win: Patch; lose: Patch } {
  return {
    win: { name: "all-pay win (s > w)", x: pConst(KINK_VARS, R1), p: pVar(KINK_VARS, 0) },
    lose: { name: "all-pay lose (s < w)", x: pZero(KINK_VARS), p: pVar(KINK_VARS, 0) },
  };
}

/** The composite checker: per-patch [E] AND the gluing identity together.
 * First price PASSES the gluing at the kink ([p] = w at s = w) and FAILS the
 * winning patch by exactly -1: the counterfeit "gluing => DSIC" is rejected. */
export function firstPriceComposite(t: Rat, w: Rat): {
  gluingResidual: Rat;
  winPatchResidual: Poly;
  convicted: boolean;
} {
  const { win, lose } = firstPricePatches();
  const at = (q: Poly): Rat => pEval(pSubstRat(q, 0, w), [w, t, w]);
  const jumpX = rSub(at(win.x), at(lose.x));
  const jumpP = rSub(at(win.p), at(lose.p));
  const jumpU = rSub(rSub(t, at(win.p)), at(lose.p));
  const gluingResidual = rSub(jumpU, rSub(rMul(t, jumpX), jumpP));
  const winPatchResidual = patchEnvelopeResidual(win);
  return { gluingResidual, winPatchResidual, convicted: !pIsZero(winPatchResidual) };
}

// ---------------------------------------------------------------------------
// the continuity regime: the capacity wall of the quadratic family
// ---------------------------------------------------------------------------

export const WALL_LO = rat(1, 2);
export const WALL_HI = rat(5, 2);

/** The wall kink location: x1(s; w) = (s - w + 1)/2 hits 0 at s* = w - 1. */
export function wallKinkS(): Poly {
  return pSub(pVar(KINK_VARS, 2), pConst(KINK_VARS, R1));
}

export function wallInteriorPatch(): Patch {
  const s = pVar(KINK_VARS, 0);
  const w = pVar(KINK_VARS, 2);
  const x = pScale(pAdd(pSub(s, w), pConst(KINK_VARS, R1)), rat(1, 2));
  const oneMinusX = pSub(pConst(KINK_VARS, R1), x);
  const w2 = pSub(pMul(w, oneMinusX), pScale(pMul(oneMinusX, oneMinusX), rat(1, 2)));
  const h = pSub(w, pConst(KINK_VARS, rat(1, 2)));
  return { name: "interior (s > w - 1)", x, p: pSub(h, w2) };
}

export function wallWallPatch(): Patch {
  const w = pVar(KINK_VARS, 2);
  const w2 = pSub(w, pConst(KINK_VARS, rat(1, 2)));
  const h = pSub(w, pConst(KINK_VARS, rat(1, 2)));
  return { name: "wall (s < w - 1)", x: pZero(KINK_VARS), p: pSub(h, w2) };
}

/** [E] for the wall patches (quadratic utilities): (t - x)*dx/ds - dp/ds. */
export function wallEnvelopeResidual(patch: Patch): Poly {
  const t = pVar(KINK_VARS, 1);
  const field = pSub(pMul(pSub(t, patch.x), pDeriv(patch.x, 0)), pDeriv(patch.p, 0));
  return pSubst(field, 1, pVar(KINK_VARS, 0));
}

/** Others' (agent 2's) welfare at the wall allocation and the pivot h = w - 1/2. */
export function wallW2(patch: Patch): Poly {
  const w = pVar(KINK_VARS, 2);
  const oneMinusX = pSub(pConst(KINK_VARS, R1), patch.x);
  return pSub(pMul(w, oneMinusX), pScale(pMul(oneMinusX, oneMinusX), rat(1, 2)));
}

export function wallPivot(): Poly {
  return pSub(pVar(KINK_VARS, 2), pConst(KINK_VARS, rat(1, 2)));
}

export function wallGrovesResidual(patch: Patch): Poly {
  return pSub(pAdd(patch.p, wallW2(patch)), wallPivot());
}

/** The welfare (own + others) at a wall allocation — the charge's potential. */
export function wallPhi(patch: Patch): Poly {
  const t = pVar(KINK_VARS, 1);
  return pAdd(pSub(pMul(t, patch.x), pScale(pMul(patch.x, patch.x), rat(1, 2))), wallW2(patch));
}

/** Gluing at the wall kink s* = w - 1, w SYMBOLIC: x, p, and the charge are
 * continuous (all differences the zero polynomial); the charge's flux jumps. */
export function wallGluing(): {
  xJump: Poly;
  pJump: Poly;
  chargeJump: Poly;
  continuous: boolean;
} {
  const sStar = wallKinkS();
  const inside = wallInteriorPatch();
  const walled = wallWallPatch();
  const xJump = pSubst(pSub(inside.x, walled.x), 0, sStar);
  const pJump = pSubst(pSub(inside.p, walled.p), 0, sStar);
  const chargeJump = pSubst(pSub(wallPhi(inside), wallPhi(walled)), 0, sStar);
  return { xJump, pJump, chargeJump, continuous: pIsZero(xJump) && pIsZero(pJump) && pIsZero(chargeJump) };
}

/** The flux jump dG/ds at the kink: interior limit minus wall limit —
 * exactly (t - w + 1)/2, which equals x(t), the truthful allocation. */
export function wallFluxJump(): { jump: Poly; expected: Poly; ok: boolean } {
  const inside = wallInteriorPatch();
  const walled = wallWallPatch();
  const sStar = wallKinkS();
  const dInside = pSubst(pDeriv(wallPhi(inside), 0), 0, sStar);
  const dWalled = pSubst(pDeriv(wallPhi(walled), 0), 0, sStar);
  const jump = pSub(dInside, dWalled);
  const t = pVar(KINK_VARS, 1);
  const w = pVar(KINK_VARS, 2);
  const expected = pScale(pAdd(pSub(t, w), pConst(KINK_VARS, R1)), rat(1, 2));
  return { jump, expected, ok: pIsZero(pSub(jump, expected)) };
}

/** The piecewise charge: interior block -(s-t)^2/4, wall-to-wall block 0,
 * cross block (true type interior, report walled) -(t-w+1)^2/4. */
export function wallChargeBlocks(): {
  interior: Poly;
  interiorClosedForm: Poly;
  wallBlock: Poly;
  crossBlock: Poly;
  crossClosedForm: Poly;
  allOk: boolean;
} {
  const inside = wallInteriorPatch();
  const walled = wallWallPatch();
  const s = pVar(KINK_VARS, 0);
  const t = pVar(KINK_VARS, 1);
  const w = pVar(KINK_VARS, 2);
  const phiInside = wallPhi(inside);
  const interior = pSub(phiInside, pSubst(phiInside, 0, t));
  const d = pSub(s, t);
  const interiorClosedForm = pScale(pMul(d, d), rat(-1, 4));
  const wallBlock = pSub(wallPhi(walled), pSubst(wallPhi(walled), 0, t));
  const crossBlock = pSub(wallPhi(walled), pSubst(phiInside, 0, t));
  const m = pAdd(pSub(t, w), pConst(KINK_VARS, R1));
  const crossClosedForm = pScale(pMul(m, m), rat(-1, 4));
  return {
    interior,
    interiorClosedForm,
    wallBlock,
    crossBlock,
    crossClosedForm,
    allOk:
      pIsZero(pSub(interior, interiorClosedForm)) &&
      pIsZero(wallBlock) &&
      pIsZero(pSub(crossBlock, crossClosedForm)),
  };
}

/** Grid witness on the widened box [1/2, 5/2]^2 with the other at wVal,
 * honest about the wall's weak-DSIC flat: the piecewise charge is NEVER
 * positive; it is 0 on the diagonal AND on the wall-to-wall block (every
 * walled report is as good as truth for a walled type — the indifference
 * flat, counted); strictly negative on both off-diagonal strict blocks
 * (interior-interior and cross). */
export function wallGridWitness(wVal: Rat, steps: number): {
  worst: Rat;
  worstInteriorOff: Rat;
  worstCross: Rat;
  flatPairs: number;
} {
  const blocks = wallChargeBlocks();
  const interior = blocks.interior;
  const crossBlock = blocks.crossBlock;
  const walledPhi = wallPhi(wallWallPatch());
  const walledBlock = pSub(walledPhi, pSubst(walledPhi, 0, pVar(KINK_VARS, 1)));
  let worst = R0;
  let worstInteriorOff = rat(-1);
  let worstCross = rat(-1);
  let flatPairs = 0;
  const point: Rat[] = [R0, R0, wVal];
  const width = rSub(WALL_HI, WALL_LO);
  const sStar = rSub(wVal, R1);
  for (let i = 0; i <= steps; i++) {
    for (let kk = 0; kk <= steps; kk++) {
      const sv = rAdd(WALL_LO, rMul(rat(i, steps), width));
      const tv = rAdd(WALL_LO, rMul(rat(kk, steps), width));
      point[0] = sv;
      point[1] = tv;
      const sInside = rCmp(sv, sStar) > 0;
      const tInside = rCmp(tv, sStar) > 0;
      let g: Rat;
      if (sInside) {
        g = pEval(interior, point);
      } else if (tInside) {
        g = pEval(crossBlock, point);
      } else {
        g = pEval(walledBlock, point);
      }
      if (rCmp(g, worst) > 0) worst = g;
      if (sInside && tInside && i !== kk && rCmp(g, worstInteriorOff) > 0) worstInteriorOff = g;
      if (!sInside && tInside && rCmp(tv, sStar) !== 0 && rCmp(g, worstCross) > 0) worstCross = g;
      if (i !== kk && !sInside && !tInside && rCmp(g, R0) === 0) flatPairs++;
    }
  }
  return { worst, worstInteriorOff, worstCross, flatPairs };
}

/** Interior-patch [I] readoff for the wall family: the integrand
 * (s - x)*dx/ds integrated in s — the nontrivial Poincare step this regime
 * contributes (the jump regime's patches were constant). Clean check as
 * above: the kernel's monomial census on the own-report index. */
export function wallGaugeReadoff(): { readoff: Poly; clean: boolean } {
  const patch = wallInteriorPatch();
  const t = pVar(KINK_VARS, 1);
  const integrand = pSubst(pMul(pSub(t, patch.x), pDeriv(patch.x, 0)), 1, pVar(KINK_VARS, 0));
  const integ = pInteg(integrand, 0);
  const readoff = pSub(patch.p, integ);
  return { readoff, clean: pMonomialsUsing(readoff, 0) === 0 };
}

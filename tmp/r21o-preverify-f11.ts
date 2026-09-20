/**
 * R21 agent omicron — F11 spec-as-assumption pre-verification (OUTSIDE the repos).
 * The task sheet's claims, verified by machine BEFORE any repo code:
 *
 *  (1) Term-wise differentiation of net(p) = sum p^{2k}/(4 ln2 k(2k-1)) gives
 *      net'(p) = sum_{k>=1} p^{2k-1}/(2 ln2 (2k-1)) — ALL-POSITIVE coefficients.
 *      Enclosure via exact partial sum + geometric tail; cross-checked as data
 *      against the T7 citation formula net'(p) = log2((1+p)/(1-p))/4.
 *  (2) THEOREM margins (exact BigInt algebra):
 *      net'(p2) - net'(p1) >= (p2-p1)/(2 ln2_hi) > 0   (k=1 term + nonneg remainder)
 *      net(p2) - 2 net(m) + net(p1) >= (p2-p1)^2/(8 ln2_hi) > 0  (k=1 term of p^2:
 *      second difference of p^2 is (p2-p1)^2/2, times 1/(4 ln2); remainder
 *      nonnegative by the EXACT binomial identity
 *      (m+h)^{2k}+(m-h)^{2k}-2m^{2k} = 2 sum_{j>=1} C(2k,2j) m^{2k-2j} h^{2j} >= 2h^{2k}.)
 *      The spec's stated bound ((p2-p1)/2)^2/(4 ln2) = (p2-p1)^2/(16 ln2) is implied.
 *  (3) Anti-inflation data gates: each margin stays under the enclosures' upper
 *      bound on the true quantity (cross-path power-hi vs closed-lo).
 *  (4) Grid second differences of T6 re-derived under the new theorem margin.
 */
import {
  type Frac,
  F_ONE,
  F_ZERO,
  fAdd,
  fCmp,
  fDiv,
  fMul,
  fSub,
  fr,
  iDivPos,
  iOf,
  iScaleNonneg,
  iSub,
  iAdd,
  iOverlap,
  iWidth,
  fDecimal,
  frDec,
  negLn,
  LN2,
} from "../nosignal-tariff/src/kernel/rational.js";
import { netClosedIvl, netSeriesIvl, monoGridPoints } from "../nosignal-tariff/src/kernel/theorem.js";

const K = 512;

/** net'(p) enclosure: sum_{k>=1} p^{2k-1}/(2k-1) with tail <= p^{2K+1}/(1-p^2), over 2 ln2. */
function netPrimeSeriesIvl(p: Frac): { s: ReturnType<typeof iOf> } | { lo: Frac; hi: Frac } {
  // partial sum exact by BigInt accumulation with reduction-free fraction adds is
  // quadratic; use the same common-denominator integer layout as h2Series but
  // simplified: denominators (2k-1) vary; pre-verify uses plain fraction sum (slow
  // but exact) with fReduce-like gcd via fCmp-free accumulation — fine for samples.
  let s = F_ZERO;
  let pk = p; // p^{2k-1} at k=1
  for (let k = 1; k <= 32; k++) {
    // pre-verify uses 32 terms: for p <= 19/20 tail <= p^65/(1-p^2) < 1e-5 — enough
    // for overlap checks at 1e-6; the repo build uses the integer layout with 512.
    s = fAdd(s, fDiv(pk, fr(2 * k - 1)));
    pk = fMul(pk, p);
    pk = fMul(pk, p);
  }
  const u = fMul(p, p);
  const tail = fDiv(fMul(pk, p), fSub(F_ONE, u)); // p^{2*32+1}/(1-p^2) — pk is p^{2*32-1} after loop? tracked below
  return iDivPos({ lo: s, hi: fAdd(s, tail) }, iScaleNonneg(LN2, fr(2)));
}

// careful tail bookkeeping: recompute cleanly
function primeIvl(p: Frac): { lo: Frac; hi: Frac } {
  let s = F_ZERO;
  let pk = p; // p^{2k-1} at k=1
  for (let k = 1; k <= 64; k++) {
    s = fAdd(s, fDiv(pk, fr(2 * k - 1)));
    pk = fMul(fMul(pk, p), p); // now p^{2(k+1)-1}
  }
  // pk = p^{129}; tail = sum_{k>64} p^{2k-1}/(2k-1) <= sum p^{2k-1} = p^{129}/(1-p^2)
  const tail = fDiv(pk, fSub(F_ONE, fMul(p, p)));
  return iDivPos({ lo: s, hi: fAdd(s, tail) }, iScaleNonneg(LN2, fr(2)));
}

// (1) overlap with the citation formula
{
  let allOK = true;
  let maxW = F_ZERO;
  for (const p of [...monoGridPoints().filter((x) => fCmp(x, F_ONE) !== 0 && fCmp(x, F_ZERO) !== 0), fr(1, 7), fr(13, 40)]) {
    const series = primeIvl(p);
    const ratio = fDiv(fSub(F_ONE, p), fAdd(F_ONE, p)); // (1-p)/(1+p) in (0,1)
    const citation = iDivPos(negLn(ratio), iScaleNonneg(LN2, fr(4)));
    if (!iOverlap(series, citation)) {
      allOK = false;
      console.log(`(1) DISJOINT at p = ${fDecimal(p, 6)}`);
    }
    const w = iWidth(series);
    if (fCmp(w, maxW) > 0) maxW = w;
  }
  console.log(`(1) net' series vs citation formula overlap at all shared points: ${allOK}; max series width ${fDecimal(maxW, 8)}`);
}

// (2a) prime increment margin + anti-inflation
function primeMargin(p1: Frac, p2: Frac): Frac {
  return fDiv(fSub(p2, p1), fMul(fr(2), LN2.hi));
}

{
  let minM: Frac | null = null;
  let gateOK = true;
  for (let i = 0; i < 19; i++) {
    const p1 = fr(i, 20);
    const p2 = fr(i + 1, 20);
    const m = primeMargin(p1, p2);
    if (minM === null || fCmp(m, minM) < 0) minM = m;
    const upper = fSub(primeIvl(p2).hi, primeIvl(p1).lo);
    if (fCmp(m, upper) > 0) gateOK = false;
  }
  const tiny = primeMargin(F_ZERO, frDec("1e-12"));
  console.log(`(2a) net' increments: min cell margin ${fDecimal(minM!, 9)} (quote floor); anti-inflation gate ${gateOK}; tiny pair (0,1e-12) margin ${fDecimal(tiny, 12)} > 0: ${fCmp(tiny, F_ZERO) > 0}`);
}

// (2b) second-difference margin + the binomial identity + anti-inflation
function ddMargin(p1: Frac, p2: Frac): Frac {
  const h = fDiv(fSub(p2, p1), fr(2));
  return fDiv(fMul(h, h), fMul(fr(2), LN2.hi));
}

{
  // the binomial identity, exact BigInt, for k = 1..8 and rational (m, h)
  let identOK = true;
  for (const [mn, hn] of [
    [3n, 5n],
    [7n, 1n],
    [0n, 3n],
    [11n, 13n],
  ] as const) {
    for (let k = 1; k <= 8; k++) {
      const m = fr(mn, 17n);
      const h = fr(hn, 23n);
      const lhsNum = (mn * 17n) ** BigInt(2 * k) * (23n * 17n + hn * 17n) ** BigInt(2 * k); // placeholder — recompute properly below
      void lhsNum;
      // direct: (m+h)^{2k} + (m-h)^{2k} - 2 m^{2k} over common denominator
      const D = 17n ** BigInt(2 * k) * 23n ** BigInt(2 * k);
      const num =
        (mn * 23n + hn * 17n) ** BigInt(2 * k) +
        (mn * 23n - hn * 17n) ** BigInt(2 * k) -
        2n * (mn * 23n) ** BigInt(2 * k);
      // rhs: 2 sum_{j>=1} C(2k,2j) m^{2k-2j} h^{2j} over the same D
      let rhs = 0n;
      const C = (n: number, r: number): bigint => {
        let c = 1n;
        for (let i = 0; i < r; i++) c = (c * BigInt(n - i)) / BigInt(i + 1);
        return c;
      };
      for (let j = 1; j <= k; j++)
        rhs +=
          2n *
          C(2 * k, 2 * j) *
          (mn * 23n) ** BigInt(2 * k - 2 * j) *
          (hn * 17n) ** BigInt(2 * j);
      if (num !== rhs) identOK = false;
      if (num < 2n * (hn * 17n) ** BigInt(2 * k)) identOK = false;
    }
  }
  console.log(`(2b) binomial identity (m+h)^2k+(m-h)^2k-2m^2k = 2 sum C(2k,2j) m^{2k-2j} h^{2j} >= 2h^{2k}: ${identOK}`);

  let minM: Frac | null = null;
  let gateOK = true;
  for (let i = 0; i + 2 <= 20; i++) {
    const p1 = fr(i, 20);
    const p2 = fr(i + 2, 20);
    const m = fDiv(fAdd(p1, p2), fr(2));
    const marg = ddMargin(p1, p2);
    if (minM === null || fCmp(marg, minM) < 0) minM = marg;
    const upper = fSub(fAdd(netClosedIvl(p2).hi, netClosedIvl(p1).hi), fMul(netSeriesIvl(m).lo, fr(2)));
    if (fCmp(marg, upper) > 0) gateOK = false;
  }
  const tiny = ddMargin(F_ZERO, frDec("1e-12"));
  console.log(`(2b) net second differences: min grid margin ${fDecimal(minM!, 9)} (quote floor); anti-inflation gate ${gateOK}; tiny triple (0,1e-12) margin > 0: ${fCmp(tiny, F_ZERO) > 0} (${fDecimal(tiny, 14)})`);
}

// (3) grid second differences (T6-style) dominate the theorem margin — data agreement
{
  let dominates = true;
  let minSlack: Frac | null = null;
  for (let i = 0; i + 2 <= 20; i++) {
    const p1 = fr(i, 20);
    const pm = fr(i + 1, 20);
    const p2 = fr(i + 2, 20);
    const dd = iSub(iAdd(netClosedIvl(p1), netClosedIvl(p2)), iAdd(netClosedIvl(pm), netClosedIvl(pm)));
    const marg = ddMargin(p1, p2);
    const slack = fSub(dd.lo, marg);
    if (fCmp(slack, F_ZERO) < 0) dominates = false;
    if (minSlack === null || fCmp(slack, minSlack) < 0) minSlack = slack;
  }
  console.log(`(3) enclosure dd.lo >= theorem margin on every grid triple: ${dominates}; min slack ${fDecimal(minSlack!, 9)}`);
}

// (4) net'' citation formula vs the all-positive series sum p^{2j}/(2 ln2) — data
{
  let allOK = true;
  for (const p of [fr(1, 4), fr(1, 2), fr(7, 10)]) {
    let s = F_ZERO;
    let pj = F_ONE;
    for (let j = 0; j < 64; j++) {
      s = fAdd(s, pj);
      pj = fMul(pj, fMul(p, p));
    }
    const tail = fDiv(pj, fSub(F_ONE, fMul(p, p)));
    const series = iDivPos({ lo: s, hi: fAdd(s, tail) }, iScaleNonneg(LN2, fr(2)));
    const citation = iDivPos(
      iOf(F_ONE),
      iScaleNonneg(LN2, fMul(fr(2), fSub(F_ONE, fMul(p, p)))),
    );
    if (!iOverlap(series, citation)) allOK = false;
  }
  console.log(`(4) net'' = sum p^{2j}/(2 ln2) vs 1/(2 ln2 (1-p^2)) overlap at samples: ${allOK}`);
}

// (5) p=0 anchor: net'(0) = [0,0] exact; p >= 1 refused by the series (1-p^2 = 0)
{
  const z = primeIvl(F_ZERO);
  console.log(`(5) net'(0) = [0,0]: ${fCmp(z.lo, F_ZERO) === 0 && fCmp(z.hi, F_ZERO) === 0}`);
}

console.log("PREVERIFY_F11_DONE");

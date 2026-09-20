import { F_ZERO, fCmp, fDecimal, fr, fAdd, fSub, fMul, fDiv, frDec, iWidth } from "../nosignal-tariff/src/kernel/rational.js";
import { netPrimeSeriesIvl, certifyGlobalConvexity, QUOTED_MAX_PRIME_WIDTH } from "../nosignal-tariff/src/kernel/convexity.js";

for (const [n, d] of [[1, 10], [1, 20], [1, 4], [19, 20]] as const) {
  const p = fr(n, d);
  const iv = netPrimeSeriesIvl(p);
  console.log(`p=${n}/${d}: lo=${fDecimal(iv.lo, 12)} hi=${fDecimal(iv.hi, 12)} width=${fDecimal(fSub(iv.hi, iv.lo), 24)}`);
}
const p1 = netPrimeSeriesIvl(fr(1, 10));
const p2 = netPrimeSeriesIvl(fr(1, 20));
console.log(`increment upper = ${fDecimal(fSub(p1.hi, p2.lo), 12)} (want ~0.036281)`);
const c = certifyGlobalConvexity();
console.log(`ok=${c.ok} minPrime=${fDecimal(c.minPrimeMargin, 9)} minDD=${fDecimal(c.minDDMargin, 9)} primeW=${fDecimal(c.maxPrimeWidth, 24)} (ceiling ${QUOTED_MAX_PRIME_WIDTH})`);
console.log(`primeGates=${c.primeCells.every(x => x.marginOk)} ddGates=${c.ddTriples.every(x => x.marginOk && x.dominatesEnclosure)}`);
console.log(`primeCite=${c.primeCitationOverlap} secondCite=${c.secondSeriesOverlap} closePair>0=${fCmp(c.closePairMargin, F_ZERO) > 0} tiny>0=${fCmp(c.tinyTripleMargin, F_ZERO) > 0}`);

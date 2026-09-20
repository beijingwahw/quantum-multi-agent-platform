import test from "node:test";
import assert from "node:assert/strict";

/**
 * R20 (agent γ, spec memory/r18/agentF.md F5-b — "候选 9") — the W-E h₂
 * anchor at 1/40, upgraded from the float witness (audit.ts, 1e-6) to a
 * strict BigInt rational interval certificate (kernel/h2certificate.ts).
 * New-file route: ledger.ts, audit.ts, runWitnesses (exactly five), and the
 * frozen the-ledger.md are untouched — the float witness keeps running.
 */
import {
  artanhInterval,
  certifyH2AtOneFortieth,
  fr,
  fAdd,
  fCmp,
  fMul,
  fSub,
  ln1pAlternatingInterval,
  negLn1mInterval,
  partialSumOnly,
  type Frac,
} from "../src/kernel/h2certificate.js";

const asFloat = (a: Frac): number => Number(a.n) / Number(a.d);
const widthLeq = (w: Frac, pow10: bigint): boolean =>
  fCmp(w, fr(1n, 10n ** pow10)) <= 0;

test("HC1: every log has TWO independent strict intervals that overlap at ≤1e-20 width", () => {
  const cert = certifyH2AtOneFortieth();
  for (const row of cert.logs) {
    assert.equal(row.overlap, true, row.detail);
    assert.ok(
      widthLeq(row.widthRoute1, 20n),
      `${row.name}: route-1 width too wide (${row.detail})`,
    );
    assert.ok(
      widthLeq(row.widthRoute2, 20n),
      `${row.name}: route-2 width too wide (${row.detail})`,
    );
  }
  assert.equal(cert.logs.length, 4);
  assert.deepEqual(
    cert.logs.map((r) => r.name),
    ["ln2", "ln(5/4)", "ln(40/39)", "ln(41/40)"],
  );
});

test("HC2: the combined h2(1/40) interval is strictly narrower than 1e-15 (BigInt-exact verdict)", () => {
  const cert = certifyH2AtOneFortieth();
  assert.ok(
    fCmp(cert.h2.combinedWidth, fr(1n, 10n ** 15n)) < 0,
    `combined width must be < 1e-15 in exact BigInt arithmetic`,
  );
  assert.ok(
    fCmp(cert.h2.combinedWidth, fr(1n, 10n ** 20n)) < 0,
    `the machine does far better than the spec bound: width < 1e-20`,
  );
  // the intersection is honest: both routes contain it
  assert.ok(fCmp(cert.h2.route1.lo, cert.h2.combined.lo) <= 0);
  assert.ok(fCmp(cert.h2.combined.hi, cert.h2.route1.hi) <= 0);
  assert.ok(fCmp(cert.h2.route2.lo, cert.h2.combined.lo) <= 0);
  assert.ok(fCmp(cert.h2.combined.hi, cert.h2.route2.hi) <= 0);
});

test("HC3: the float double agrees with the certificate within float noise (5e-16)", () => {
  const cert = certifyH2AtOneFortieth();
  const mid = (asFloat(cert.h2.combined.lo) + asFloat(cert.h2.combined.hi)) / 2;
  const floatH2 =
    -(1 / 40) * Math.log2(1 / 40) - (39 / 40) * Math.log2(39 / 40);
  assert.ok(
    Math.abs(mid - floatH2) <= 5e-16,
    `float ${floatH2.toPrecision(18)} vs certificate ${mid.toPrecision(18)}`,
  );
  // honest note carried by the certificate itself: the double is NOT claimed
  // INSIDE the strict interval (it carries ~1 ulp of its own rounding)
  assert.equal(cert.h2.floatNote.includes("ulp"), true);
});

test("HC4: the ledger row's six-digit number 0.168661 is bracketed exactly (BigInt)", () => {
  const cert = certifyH2AtOneFortieth();
  // the 6th-decimal rounding window of 0.168661: [1686605, 1686615]·10^-7
  const wLo = fr(1686605n, 10n ** 7n);
  const wHi = fr(1686615n, 10n ** 7n);
  assert.ok(
    fCmp(cert.h2.combined.lo, wLo) >= 0,
    "lower end inside the rounding window",
  );
  assert.ok(
    fCmp(cert.h2.combined.hi, wHi) <= 0,
    "upper end inside the rounding window",
  );
});

test("HC5a: negative control — the tail-omitted partial sum is convicted, not blessed", () => {
  // artanh(1/3) at K=2 without the geometric tail: claims to BE the value
  const fake = fMul(fr(2n), partialSumOnly(1n, 3n, 2)); // "ln2"
  const trueLn2Lo = fMul(fr(2n), artanhInterval(1n, 3n, 30).lo);
  // convicted by the strict interval: the fake point lies BELOW the true lo
  assert.ok(
    fCmp(fake, trueLn2Lo) < 0,
    "the tail-omitted sum undershoots the certified lower bound",
  );
  const miss =
    Number(fSub(trueLn2Lo, fake).n) / Number(fSub(trueLn2Lo, fake).d);
  assert.ok(
    miss > 1e-4,
    `the miss must be visible, got ${miss.toExponential(2)}`,
  );
});

test("HC5b: negative control — a forged shifted interval fails the float agreement face", () => {
  const cert = certifyH2AtOneFortieth();
  const shift = fr(1n, 10n ** 13n);
  const forged = {
    lo: fAdd(cert.h2.combined.lo, shift),
    hi: fAdd(cert.h2.combined.hi, shift),
  };
  const mid = (asFloat(forged.lo) + asFloat(forged.hi)) / 2;
  const floatH2 =
    -(1 / 40) * Math.log2(1 / 40) - (39 / 40) * Math.log2(39 / 40);
  assert.ok(
    Math.abs(mid - floatH2) > 5e-16,
    `forged interval must fail the agreement face (shift 1e-13 ≫ width)`,
  );
});

test("HC5c: negative control — a different point is not covered by this certificate", () => {
  const cert = certifyH2AtOneFortieth();
  const mid = (asFloat(cert.h2.combined.lo) + asFloat(cert.h2.combined.hi)) / 2;
  const h2At41 = -(1 / 41) * Math.log2(1 / 41) - (40 / 41) * Math.log2(40 / 41);
  assert.ok(
    Math.abs(mid - h2At41) > 1e-3,
    `h2(1/41) = ${h2At41.toPrecision(8)} is a different point — the certificate is point-tight`,
  );
});

test("HC6: the geometric tail bound genuinely DOMINATES the true remainder (brute BigInt)", () => {
  // at K=2 the true remainder of artanh(1/3) is brute-summed over 60 more
  // terms and must be ≤ the geometric bound the certificate uses
  const x = fr(1n, 3n);
  let trueRem = fr(0n);
  let term = fMul(fMul(fMul(fMul(x, x), x), fMul(x, x)), fMul(x, x)); // x^7
  for (let k = 3; k <= 62; k++) {
    trueRem = fAdd(trueRem, fr(term.n, term.d * BigInt(2 * k + 1)));
    term = fMul(term, fMul(x, x));
  }
  // bound: x^{2K+3}/((2K+3)(1−x²)) at K=2 → x^7/(7·(8/9))
  const bound = fMul(fr(1n, 3n ** 7n), fr(9n, 7n * 8n));
  assert.ok(
    fCmp(trueRem, bound) <= 0,
    `true remainder ≤ geometric bound (${trueRem.n}/${trueRem.d} vs ${bound.n}/${bound.d})`,
  );
  assert.ok(
    fCmp(trueRem, fr(0n)) > 0,
    "positive-term series: the remainder is strictly positive",
  );
});

test("HC7: argument-domain refusals are named, and the interval ops carry exactness", () => {
  assert.throws(() => artanhInterval(3n, 2n, 10), /H2_SERIES_DOMAIN/);
  assert.throws(() => artanhInterval(1n, 1n, 10), /H2_SERIES_DOMAIN/);
  assert.throws(() => artanhInterval(0n, 5n, 10), /H2_SERIES_DOMAIN/);
  assert.throws(() => negLn1mInterval(2n, 2n, 10), /H2_SERIES_DOMAIN/);
  assert.throws(() => ln1pAlternatingInterval(5n, 4n, 10), /H2_SERIES_DOMAIN/);
  // the interval order is law: lo ≤ hi for every series face
  assert.ok(
    fCmp(artanhInterval(1n, 3n, 5).lo, artanhInterval(1n, 3n, 5).hi) <= 0,
  );
  assert.ok(
    fCmp(
      ln1pAlternatingInterval(1n, 4n, 5).lo,
      ln1pAlternatingInterval(1n, 4n, 5).hi,
    ) <= 0,
  );
  assert.ok(
    fCmp(negLn1mInterval(1n, 2n, 30).lo, negLn1mInterval(1n, 2n, 30).hi) <= 0,
  );
});

test("HC8: determinism — the certificate is a pure function of nothing", () => {
  assert.deepEqual(certifyH2AtOneFortieth(), certifyH2AtOneFortieth());
});

test("HC9: the certificate's own claim rows all hold, ids exact", () => {
  const cert = certifyH2AtOneFortieth();
  assert.deepEqual(
    cert.claims.map((r) => r.id),
    ["HC1", "HC2", "HC3", "HC4"],
  );
  for (const row of cert.claims) {
    assert.equal(row.pass, true, `${row.id}: ${row.detail}`);
  }
  assert.match(cert.summary, /0\.168661/);
});

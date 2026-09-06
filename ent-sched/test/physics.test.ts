import { deepStrictEqual, ok } from "node:assert";
import { describe, it } from "node:test";

import { Rng } from "../src/core/rng.js";
import { bellVec, cloneVec, werner, wernerFidelity } from "../src/physics/bell.js";
import {
  agePair,
  concurrence,
  depol,
  depolP,
  keyFraction,
  purify2to1,
  purifyWerner,
  swapBell,
  wernerSwapChainVec,
  wernerSwapF,
} from "../src/physics/ops.js";
import {
  bellBasisCoherence,
  bellDiagonalDM,
  bellVectorOf,
  refereeDepol,
  refereePurify,
  refereePurifyTwirled,
  refereeSwap,
  refereeSwapPhiMinus,
  refereeTwirl,
  wernerDM,
} from "../src/physics/referee.js";

const EPS = 1e-12;

function assertVecClose(a: Float64Array, b: Float64Array, tol: number, msg: string): void {
  ok(a.length === b.length, `${msg}: length mismatch`);
  for (let i = 0; i < a.length; i++)
    ok(
      Math.abs(a[i]! - b[i]!) < tol, // i < a.length = b.length (asserted above)
      `${msg}: [${i}] ${a[i]!} vs ${b[i]!} (diff ${Math.abs(a[i]! - b[i]!)})`
    );
}

describe("werner + bell basics", () => {
  it("werner vectors are normalized and F-extracted", () => {
    for (const f of [0.25, 0.5, 0.8, 0.99, 1]) {
      const v = werner(f);
      const s = v[0]! + v[1]! + v[2]! + v[3]!; // BellVec is length 4
      ok(Math.abs(s - 1) < EPS, `sum ${s}`);
      ok(Math.abs(v[0]! - f) < EPS);
      ok(Math.abs(wernerFidelity(v) - f) < EPS);
    }
  });

  it("referee Bell extraction of a Werner density matrix is exact and diagonal in Bell basis", () => {
    for (const f of [0.4, 0.8]) {
      const rho = wernerDM(f);
      ok(bellBasisCoherence(rho) < 1e-14, "off-diagonal in Bell basis");
      assertVecClose(bellVectorOf(rho), werner(f), 1e-14, "bellVectorOf(wernerDM)");
    }
  });
});

describe("swap algebra vs density-matrix referee", () => {
  it("XOR convolution === referee Φ+ branch, over random fidelity grid", () => {
    const rng = new Rng(12345);
    for (let trial = 0; trial < 20; trial++) {
      const fa = rng.range(0.3, 1);
      const fb = rng.range(0.3, 1);
      const ref = refereeSwap(fa, fb);
      const ana = swapBell(werner(fa), werner(fb));
      assertVecClose(ref.vec, ana, 1e-12, `swap(${fa.toFixed(3)},${fb.toFixed(3)})`);
      ok(ref.p > 0 && ref.p <= 1, `p=${ref.p}`);
      const s = ref.vec[0]! + ref.vec[1]! + ref.vec[2]! + ref.vec[3]!;
      ok(Math.abs(s - 1) < EPS, `norm ${s}`);
    }
  });

  it("Werner class is closed under swap with closed form F' = F₁F₂ + (1−F₁)(1−F₂)/3", () => {
    const rng = new Rng(777);
    for (let trial = 0; trial < 20; trial++) {
      const fa = rng.range(0.4, 1);
      const fb = rng.range(0.4, 1);
      const out = swapBell(werner(fa), werner(fb));
      const f = wernerSwapF(fa, fb);
      const w = (1 - f) / 3;
      assertVecClose(out, bellVec(f, w, w, w), 1e-14, "closure");
    }
  });

  it("Φ− BSM outcome with Z frame fix === Φ+ outcome (frame-correction equivalence)", () => {
    const rng = new Rng(4242);
    for (let trial = 0; trial < 10; trial++) {
      const fa = rng.range(0.4, 1);
      const fb = rng.range(0.4, 1);
      assertVecClose(
        refereeSwapPhiMinus(fa, fb),
        swapBell(werner(fa), werner(fb)),
        1e-12,
        "Φ− branch"
      );
    }
  });

  it("chain of k fresh links matches product formula and stays Werner", () => {
    const f0 = 0.99;
    for (const hops of [1, 2, 4, 8]) {
      const v = wernerSwapChainVec(f0, hops);
      let f = f0;
      for (let k = 1; k < hops; k++) f = wernerSwapF(f, f0);
      assertVecClose(v, werner(f), 1e-14, `chain hops=${hops}`);
    }
  });
});

describe("purification (BBPSSW) vs density-matrix referee", () => {
  it("2→1 recurrence formulas === twirled referee circuit (prob and vector)", () => {
    const rng = new Rng(999);
    for (let trial = 0; trial < 20; trial++) {
      const f1 = rng.range(0.55, 1);
      const f2 = rng.range(0.55, 1);
      const ref = refereePurifyTwirled(werner(f1), werner(f2));
      const ana = purify2to1(werner(f1), werner(f2));
      ok(Math.abs(ref.p - ana.p) < 1e-12, `p ${ref.p} vs ${ana.p} at (${f1},${f2})`);
      assertVecClose(ref.vec, ana.out, 1e-12, `purify(${f1.toFixed(3)},${f2.toFixed(3)})`);
    }
  });

  it("untwirled circuit output, twirled post-hoc, equals the protocol formula", () => {
    const rng = new Rng(555);
    for (let trial = 0; trial < 10; trial++) {
      const f1 = rng.range(0.6, 1);
      const f2 = rng.range(0.6, 1);
      const raw = refereePurify(f1, f2);
      const viaTwirl = bellVectorOf(refereeTwirl(bellDiagonalDM(raw.vec)));
      const ana = purify2to1(werner(f1), werner(f2));
      assertVecClose(viaTwirl, ana.out, 1e-12, "post-hoc twirl");
      ok(Math.abs(raw.p - ana.p) < 1e-12);
    }
  });

  it("general (non-Werner) inputs: algebra stays normalized with valid probability", () => {
    const a = bellVec(0.8, 0.1, 0.06, 0.04);
    const b = bellVec(0.7, 0.1, 0.1, 0.1);
    const ana = purify2to1(a, b);
      const s = ana.out[0]! + ana.out[1]! + ana.out[2]! + ana.out[3]!;
    ok(Math.abs(s - 1) < 1e-14, `norm ${s}`);
    ok(ana.p > 0 && ana.p <= 1);
  });

  it("twirled purification: circuit referee agrees on non-Werner inputs (regression guard)", () => {
    // the exact distribution left behind by a first purification round
    const once = purify2to1(werner(0.85), werner(0.85)).out;
    ok(Math.abs(once[0]! - 0.8841) < 1e-3, `once ${once[0]!}`);
    ok(Math.abs(once[1]! - 0.1037) > 1e-4, `non-Werner λ1 ${once[1]!}`);
    // without twirl this pairing regressed F 0.884 → 0.850; with the protocol
    // twirl on both sides it must improve
    const ref = refereePurifyTwirled(once, werner(0.85));
    const ana = purify2to1(once, werner(0.85));
    ok(Math.abs(ref.p - ana.p) < 1e-12, `p ${ref.p} vs ${ana.p}`);
    assertVecClose(ref.vec, ana.out, 1e-12, "twirled purify");
    ok(ana.out[0]! > once[0]!, `F ${ana.out[0]!} must exceed ${once[0]!}`);
  });

  it("fidelity improves exactly above the entanglement threshold F = 1/2", () => {
    for (const f of [0.3, 0.4, 0.49]) {
      const { fOut } = purifyWerner(f);
      ok(fOut < f, `F=${f}: ${fOut} should be < ${f}`);
    }
    for (const f of [0.51, 0.6, 0.75, 0.9]) {
      const { fOut } = purifyWerner(f);
      ok(fOut > f, `F=${f}: ${fOut} should be > ${f}`);
    }
    const { fOut } = purifyWerner(0.5);
    ok(Math.abs(fOut - 0.5) < 1e-14, `fixed point ${fOut}`);
    let f = 0.55;
    for (let k = 0; k < 200; k++) f = purifyWerner(f).fOut;
    ok(f > 0.999999, `iterated ${f}`);
  });

  it("ladder projection is monotone in rounds", () => {
    let prev = 0.7;
    for (let k = 0; k < 50; k++) {
      const nxt = purifyWerner(prev).fOut;
      ok(nxt >= prev - 1e-15);
      prev = nxt;
    }
    ok(prev > 0.99);
  });
});

describe("decoherence (depolarizing storage)", () => {
  it("per-qubit depol formula === referee replace-channel on either qubit", () => {
    const rng = new Rng(31337);
    for (let trial = 0; trial < 10; trial++) {
      const f = rng.range(0.5, 1);
      const p = rng.range(0.01, 0.9);
      for (const q of [0, 1] as const) {
        assertVecClose(refereeDepol(f, p, q), depol(werner(f), p), 1e-13, `q=${q}`);
      }
    }
  });

  it("agePair composes two depol steps; T₂=∞ is identity; saturation → 1/4", () => {
    const v = werner(0.95);
    ok(Math.abs(agePair(v, 100, 100, Number.POSITIVE_INFINITY)[0]! - 0.95) < EPS);
    ok(Math.abs(agePair(v, 1e9, 1e9, 1)[0]! - 0.25) < 1e-9);
    const twoStep = depol(depol(v, depolP(3, 10)), depolP(5, 10));
    assertVecClose(twoStep, agePair(v, 3, 5, 10), 1e-15, "composition");
  });

  it("depolP saturates in [0,1) and is monotone", () => {
    ok(depolP(0, 10) === 0);
    ok(depolP(5, 10) < depolP(6, 10));
    ok(depolP(1e9, 1) > 0.999999);
  });
});

describe("resource measures", () => {
  it("key fraction: perfect pair → 1 bit; threshold F* ≈ 0.8108", () => {
    ok(Math.abs(keyFraction(werner(1)) - 1) < EPS);
    let lo = 0.7;
    let hi = 0.9;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (keyFraction(werner(mid)) > 0) hi = mid;
      else lo = mid;
    }
    const fStar = (lo + hi) / 2;
    ok(Math.abs(fStar - 0.8108) < 5e-4, `F* = ${fStar}`);
    ok(keyFraction(werner(0.85)) > 0);
    ok(keyFraction(werner(0.79)) < 0);
  });

  it("concurrence: 2 max(0, F − 1/2), zero at and below threshold", () => {
    for (const f of [0.25, 0.5]) ok(concurrence(werner(f)) === 0);
    for (const f of [0.75, 0.9]) ok(Math.abs(concurrence(werner(f)) - (2 * f - 1)) < EPS);
    ok(Math.abs(concurrence(werner(1)) - 1) < EPS);
  });
});

describe("determinism of the noise source", () => {
  it("same seed → same stream; different seed → different stream", () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const c = new Rng(8);
    const sa = Array.from({ length: 100 }, () => a.next());
    const sb = Array.from({ length: 100 }, () => b.next());
    const sc = Array.from({ length: 100 }, () => c.next());
    deepStrictEqual(sa, sb);
    ok(sa.some((x, i) => Math.abs(x - sc[i]!) > 1e-9)); // sa and sc are both length 100
  });

  it("cloneVec isolates mutations", () => {
    const v = werner(0.9);
    const c = cloneVec(v);
    c[0] = 0;
    ok(v[0] === 0.9);
  });
});

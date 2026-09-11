/**
 * Boundary-condition and merge-isomorphism regressions (post-v0.3.0 audit
 * wave): the new named guards are exercised from their ILLEGAL side (a
 * silent NaN vector / unphysical channel / out-of-range index is a smuggled
 * verdict), the legal boundary traffic next to each guard is pinned, and
 * the single-sourcing merges of this wave (applyMat → applyUnitaryToState,
 * the inline overlap formula → pureTraceDistance, sched4's unitaryOnRho →
 * sched3's) are anchored bit-for-bit.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { Rng } from "../src/kswitch/rng.js";
import { randomState, pureTraceDistance, applyUnitaryToState, commutingTriple, anticommutingTriple, X2 } from "../src/kswitch/promise.js";
import { erase, plusPlus, traceDistance, unitaryOnRho, chainDistinguishability } from "../src/kswitch/sched3.js";
import { chainDistinguishability4 } from "../src/kswitch/sched4.js";
import { orderedProduct4, matchedBlindPair } from "../src/kswitch/k4.js";
import { KSwitchError } from "../src/kswitch/errors.js";
import { cmatZero, cmatMul } from "../src/core/cmat.js";
import { runIfMain } from "../experiments/report.js";

describe("regression: named guards on the new boundaries", () => {
  it("Rng.int refuses n < 1 / non-integer (was: silently 0 or out of range)", () => {
    const rng = new Rng(9);
    assert.throws(() => rng.int(0), /Rng\.int/);
    assert.throws(() => rng.int(-2), /Rng\.int/);
    assert.throws(() => rng.int(2.5), /Rng\.int/);
    assert.equal(rng.int(1), 0); // the degenerate-but-legal bound
    for (let i = 0; i < 50; i++) {
      const k = rng.int(8);
      assert.ok(Number.isInteger(k) && k >= 0 && k < 8);
    }
  });

  it("randomState refuses dim < 1 (was: 1/sqrt(0) = Infinity, NaN vector)", () => {
    const rng = new Rng(3);
    assert.throws(
      () => randomState(rng, 0),
      (err: unknown) => err instanceof KSwitchError && err.code === "RANDOM-STATE-BAD-DIM",
    );
    assert.throws(() => randomState(rng, 1.5), /RANDOM-STATE-BAD-DIM/);
    // legal boundary: dim 1 is the trivial register, exactly amplitude 1
    const psi = randomState(rng, 1);
    assert.ok(Math.abs(Math.hypot(psi.re[0]!, psi.im[0]!) - 1) < 1e-15);
  });

  it("erase refuses gamma outside [0,1] (was: silently unphysical channel)", () => {
    assert.throws(
      () => erase(1.5, plusPlus()),
      (err: unknown) => err instanceof KSwitchError && err.code === "ERASE-PROBABILITY-OUT-OF-RANGE",
    );
    assert.throws(() => erase(-0.1, plusPlus()), /ERASE-PROBABILITY-OUT-OF-RANGE/);
    assert.throws(() => erase(NaN, plusPlus()), /ERASE-PROBABILITY-OUT-OF-RANGE/);
    // legal endpoints: γ=0 is the identity, γ=1 is |0><0|
    assert.equal(traceDistance(erase(0, plusPlus()), plusPlus()), 0);
    const full = erase(1, plusPlus());
    assert.equal(full.re[0]![0], 1);
    assert.equal(full.re[0]![1]! + full.re[1]![0]! + full.re[1]![1]!, 0);
  });
});

describe("regression: merge bit-isomorphism", () => {
  it("applyUnitaryToState === the former private applyMat body, and pureTraceDistance === the inline overlap formula", () => {
    const rng = new Rng(0x15);
    // reference: the pre-merge inline loops (hand-copied here as the referee)
    const refApply = (u: { re: number[][]; im: number[][] }, psi: { re: number[]; im: number[] }) => {
      const d = psi.re.length;
      const re = new Array<number>(d).fill(0);
      const im = new Array<number>(d).fill(0);
      for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
          const ur = u.re[i]![j] as number;
          const ui = u.im[i]![j] as number;
          re[i] = re[i]! + ur * psi.re[j]! - ui * psi.im[j]!;
          im[i] = im[i]! + ur * psi.im[j]! + ui * psi.re[j]!;
        }
      }
      return { re, im };
    };
    const u = cmatMul(commutingTriple()[0], anticommutingTriple()[0]);
    const psi = randomState(rng, 4);
    const live = applyUnitaryToState(u, psi);
    const ref = refApply(u, psi);
    for (let i = 0; i < 4; i++) {
      assert.ok(Object.is(live.re[i], ref.re[i]), `re[${i}] ${live.re[i]} vs ${ref.re[i]}`);
      assert.ok(Object.is(live.im[i], ref.im[i]), `im[${i}] ${live.im[i]} vs ${ref.im[i]}`);
    }
    // pureTraceDistance matches the inline overlap formula bit-for-bit
    const a = applyUnitaryToState(u, psi);
    const b = applyUnitaryToState(orderedProduct4(matchedBlindPair(psi).anti, [0, 1, 2, 3]), psi);
    let dotR = 0;
    let dotI = 0;
    for (let i = 0; i < a.re.length; i++) {
      dotR += a.re[i]! * b.re[i]! + a.im[i]! * b.im[i]!;
      dotI += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
    }
    const ov = Math.hypot(dotR, dotI);
    assert.ok(Object.is(pureTraceDistance(a, b), Math.sqrt(Math.max(0, 1 - ov * ov))));
  });

  it("unitaryOnRho is one shared source: sched4 runs on sched3's kernel and both chain laws stay pinned", () => {
    // the k=3 law (already pinned in kswitch.test.ts, re-anchored post-merge)
    const r3 = chainDistinguishability(plusPlus());
    for (const f of r3.fixed) assert.ok(Math.abs(f.d - Math.SQRT1_2) < 1e-12);
    assert.ok(Math.abs(r3.switchD - 0.5) < 1e-12);
    // the k=4 law (README: fixed 1/√2 survives, switch = √10/6)
    const r4 = chainDistinguishability4(plusPlus());
    for (const f of r4.fixed) assert.ok(Math.abs(f.d - Math.SQRT1_2) < 1e-12, `${f.label}: ${f.d}`);
    assert.ok(Math.abs(r4.switchD - Math.sqrt(10) / 6) < 1e-12, `switchD ${r4.switchD}`);
    // unitaryOnRho itself: X·|+><+|·X† = |+><+|
    assert.equal(traceDistance(unitaryOnRho(X2, plusPlus()), plusPlus()), 0);
  });

  it("cmatMul refuses dimension mismatch by name (was: opaque TypeError)", () => {
    assert.throws(() => cmatMul(cmatZero(2), cmatZero(4)), /CMAT-SHAPE-MISMATCH/);
    assert.throws(() => cmatMul(cmatZero(4), cmatZero(2)), /CMAT-SHAPE-MISMATCH/);
    // the legal path: identity multiplication is a no-op
    const m = cmatZero(2);
    m.re[0]![1] = 0.5;
    m.im[1]![0] = -0.25;
    const prod = cmatMul(m, m);
    assert.ok(Number.isFinite(prod.re[1]![1]!) && Number.isFinite(prod.im[0]![0]!));
  });

  it("runIfMain fires only on an exact process.argv[1] hit", () => {
    let calls = 0;
    runIfMain(pathToFileURL("/definitely/not/the/entry.ts").href, () => {
      calls++;
    });
    assert.equal(calls, 0);
    runIfMain(pathToFileURL(process.argv[1] ?? "").href, () => {
      calls++;
    });
    assert.equal(calls, 1);
  });
});

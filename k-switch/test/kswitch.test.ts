import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/kswitch/rng.js";
import {
  S3,
  controlInner,
  controlFidelity,
  parityControl,
  orderedProduct,
  switchIsometry,
  switchedControlState,
  uniformControl,
} from "../src/kswitch/switch.js";
import { anticommutingTriple, applyUnitaryToState, commutingTriple, commutatorDev, pureTraceDistance, randomState } from "../src/kswitch/promise.js";
import { chainDistinguishability, plusPlus, traceDistance } from "../src/kswitch/sched3.js";
import { cmatDagger, cmatEye, cmatMul, cmatZero } from "../src/core/cmat.js";
import { KSwitchError } from "../src/kswitch/errors.js";
import { gatesByIndices, shortestSupersequence } from "../src/kswitch/hadamard4.js";
import { dag, maxDevFrom, mul } from "../experiments/kernels.js";

describe("T1 the 3-switch", () => {
  it("S3 has 3 even and 3 odd permutations — the orthogonality precondition", () => {
    assert.equal(S3.length, 6);
    assert.equal(S3.filter((p) => p.even).length, 3);
    assert.equal(S3.filter((p) => !p.even).length, 3);
  });

  it("<u|u_par> = 0 exactly and M†M = I for both promise instances", () => {
    const inner = controlInner(uniformControl(), parityControl());
    assert.ok(Math.hypot(inner.re, inner.im) < 1e-15);
    for (const boxes of [commutingTriple(), anticommutingTriple()]) {
      const m = switchIsometry(boxes, 4);
      // block-diagonal with unitary blocks: check M†M = I via block structure
      let dev = 0;
      for (let p = 0; p < 6; p++) {
        const prod = orderedProduct(boxes, S3[p]!.seq);
        // P†P = I (unitary boxes) plus zero off-block entries by construction
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            let accR = 0;
            let accI = 0;
            for (let k = 0; k < 4; k++) {
              // (P†P)_{ij} = sum_k conj(P_ki) P_kj
              accR += prod.re[k]![i]! * prod.re[k]![j]! + prod.im[k]![i]! * prod.im[k]![j]!;
              accI += prod.re[k]![i]! * prod.im[k]![j]! - prod.im[k]![i]! * prod.re[k]![j]!;
            }
            dev = Math.max(dev, Math.hypot(accR - (i === j ? 1 : 0), accI));
          }
        }
        // off-block entries of M are exactly zero by construction (skipped writes)
      }
      assert.ok(dev < 1e-13, `block unitarity dev ${dev}`);
      // off-block entries of M are exactly zero by construction (skipped
      // writes) — checked, not assumed: dim 6·4 and zero outside the blocks
      assert.equal(m.dim, 6 * 4);
      let offBlock = 0;
      for (let p = 0; p < 6; p++) {
        for (let q = 0; q < 6; q++) {
          if (p === q) continue;
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              offBlock = Math.max(offBlock, Math.abs(m.re[p * 4 + i]![q * 4 + j]!), Math.abs(m.im[p * 4 + i]![q * 4 + j]!));
            }
          }
        }
      }
      assert.ok(offBlock === 0, `off-block entries nonzero: ${offBlock}`);
    }
  });

  it("deterministic promise readout: control ends exactly in |u> vs |u_par>", () => {
    const rng = new Rng(7);
    for (let t = 0; t < 3; t++) {
      const psi = randomState(rng, 4);
      const fC = controlFidelity(switchedControlState(commutingTriple(), psi), uniformControl());
      const fA = controlFidelity(switchedControlState(anticommutingTriple(), psi), parityControl());
      assert.ok(Math.abs(fC - 1) < 1e-12, `fC ${fC}`);
      assert.ok(Math.abs(fA - 1) < 1e-12, `fA ${fA}`);
    }
  });

  it("plain fixed orders are structurally blind on the promise class", () => {
    const rng = new Rng(11);
    const psi = randomState(rng, 4);
    for (const boxes of [commutingTriple(), anticommutingTriple()]) {
      for (let p = 0; p < 6; p++) {
        const out = applyUnitaryToState(orderedProduct(boxes, S3[p]!.seq), psi);
        // tolerance 1e-7: the sqrt formula amplifies the float floor to ~2e-8
        assert.ok(pureTraceDistance(out, psi) < 1e-7);
      }
    }
    assert.ok(commutatorDev(anticommutingTriple()[0], anticommutingTriple()[1]) > 2 - 1e-12);
  });
});

describe("T2 the scheduling contact surface", () => {
  it("all six fixed orders D = 1/sqrt(2); six-order switch D = 1/2", () => {
    // the shared |+><+| input — the same single source exp2 uses
    const r = chainDistinguishability(plusPlus());
    for (const f of r.fixed) assert.ok(Math.abs(f.d - Math.SQRT1_2) < 1e-12, `${f.label}: ${f.d}`);
    assert.ok(Math.abs(r.switchD - 0.5) < 1e-12);
  });
});

describe("T8 wave-2 quality anchors (v0.3.0)", () => {
  it("plusPlus() is exactly the |+><+| scheduling input: dim 2, all real entries 0.5, zero imaginary, trace 1", () => {
    const p = plusPlus();
    assert.equal(p.dim, 2);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        assert.equal(p.re[i]![j], 0.5);
        assert.equal(p.im[i]![j], 0);
      }
    }
    assert.equal(p.re[0]![0]! + p.re[1]![1]!, 1);
  });

  it("the shared cmat kernels are exact: dagger round-trips and identity multiplication is a no-op (the single source sched3/sched4 now run on)", () => {
    const m = cmatMul(cmatMul(cmatEye(4), cmatDagger(cmatEye(4))), cmatEye(4));
    assert.equal(maxDevFrom(m, cmatEye(4)), 0);
    // a non-trivial complex matrix through the same kernels
    const a = cmatZero(2);
    a.re[0]![0] = 1;
    a.re[0]![1] = -2;
    a.re[1]![0] = 3;
    a.re[1]![1] = 0.5;
    a.im[0]![1] = 1.5;
    a.im[1]![0] = -0.25;
    assert.equal(maxDevFrom(cmatDagger(cmatDagger(a)), a), 0);
    assert.equal(maxDevFrom(cmatMul(cmatEye(2), a), a), 0);
    assert.equal(maxDevFrom(mul(dag(a), dag(a)), dag(mul(a, a))), 0); // (A·A)† = A†·A† — the algebraic-object law
  });

  it("traceDistance closed form: T(|0><0|, |+><+|) = 1/sqrt(2) exactly", () => {
    const zero = cmatZero(2);
    zero.re[0]![0] = 1;
    const t = traceDistance(zero, plusPlus());
    assert.ok(Math.abs(t - Math.SQRT1_2) < 1e-15, `T = ${t}`);
    assert.equal(traceDistance(plusPlus(), plusPlus()), 0);
  });

  it("SMUGGLING TRIAL: an out-of-range or non-integer gate index is NAMED and rejected by gatesByIndices (no silent undefined gate)", () => {
    for (const bad of [[0, 1, 2, 4], [-1], [0.5], [NaN]]) {
      assert.throws(
        () => gatesByIndices(bad),
        (err: unknown) => {
          assert.ok(err instanceof KSwitchError, `not a KSwitchError: ${String(err)}`);
          assert.equal(err.code, "GATE-INDEX-OUT-OF-RANGE");
          assert.match(err.message, /\[GATE-INDEX-OUT-OF-RANGE\]/);
          return true;
        },
        `index set ${bad.join(",")} must be rejected`,
      );
    }
    // the honest path: the full alphabet passes and yields 4 gates
    const gates = gatesByIndices([0, 1, 2, 3]);
    assert.equal(gates.length, 4);
  });

  it("SMUGGLING TRIAL: shortestSupersequence below the quartet size is NAMED and rejected (no silent null)", () => {
    for (const bad of [3, 0, -1, 2.5]) {
      assert.throws(
        () => shortestSupersequence(bad),
        (err: unknown) => {
          assert.ok(err instanceof KSwitchError, `not a KSwitchError: ${String(err)}`);
          assert.equal(err.code, "SUPERSEQUENCE-LIMIT-BELOW-QUARTET");
          assert.match(err.message, /below the quartet size 4/);
          return true;
        },
        `limit ${String(bad)} must be rejected`,
      );
    }
    // the honest boundary: at the quartet size itself the search runs and
    // correctly finds NOTHING (a 4-letter word cannot contain 4 distinct
    // orders) — the null floor is reachable, not the throw
    assert.equal(shortestSupersequence(4), null);
  });

  it("the deleted dead exports stay deleted: cmatAdd/cmatScale/hermitianExtremeEig and friends have no import path (module surface regression)", async () => {
    const cmat = (await import("../src/core/cmat.js")) as Record<string, unknown>;
    const live = ["CMat", "cmatZero", "cmatEye", "cmatKron", "cmatMul", "cmatDagger"];
    for (const k of Object.keys(cmat)) assert.ok(live.includes(k), `unexpected export ${k} surfaced in cmat.js`);
    const rngMod = (await import("../src/kswitch/rng.js")) as Record<string, unknown>;
    assert.ok(typeof rngMod.Rng === "function");
    assert.equal(Object.keys(rngMod).length, 1);
    const rng = new Rng(1);
    // the surviving surface is deterministic: same seed, same stream
    const again = new Rng(1);
    for (let i = 0; i < 100; i++) assert.equal(rng.next(), again.next());
  });
});

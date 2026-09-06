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
import { chainDistinguishability } from "../src/kswitch/sched3.js";

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
    // reuse the experiment's input
    const input = { dim: 2, re: [[0.5, 0.5], [0.5, 0.5]], im: [[0, 0], [0, 0]] } as const;
    const r = chainDistinguishability(input as never);
    for (const f of r.fixed) assert.ok(Math.abs(f.d - Math.SQRT1_2) < 1e-12, `${f.label}: ${f.d}`);
    assert.ok(Math.abs(r.switchD - 0.5) < 1e-12);
  });
});

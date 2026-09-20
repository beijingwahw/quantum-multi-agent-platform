import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cmatKron } from "../src/core/cmat.js";
import {
  I2,
  X2,
  Y2,
  Z2,
  commutatorDev,
  randomState,
} from "../src/kswitch/promise.js";
import {
  S5,
  majoranaPentad,
  orderedProduct5,
  uniformControl5,
  sgnControl5,
  controlInner5,
  switchedControlState5,
  controlFidelity5,
  verificationState5,
  pauliPentadCensus,
  anticommutingSextupleCount,
  censusReconciliation,
  dimensionLadder,
  dOf,
  d2AnticommutingCeiling,
  verifyPentadCertificate,
  verifyPentadCensus,
  verifyLadderClaim,
} from "../src/kswitch/k5.js";
import {
  anticommutingQuad,
  PAULIS4,
  pauliReference,
} from "../src/kswitch/k4.js";
import { Rng } from "../src/kswitch/rng.js";

describe("T7 the k=5 Majorana ladder (G6-a)", () => {
  it("S5 has 60 even and 60 odd permutations — the orthogonality precondition at k=5", () => {
    assert.equal(S5.length, 120);
    assert.equal(S5.filter((p) => p.even).length, 60);
    assert.equal(S5.filter((p) => !p.even).length, 60);
  });

  it("(K5-a) gamma5 = gamma1·gamma2·gamma3·gamma4 is the Pauli Z⊗Y EXACTLY, squares to I, and anticommutes with the quadruple", () => {
    const pentad = majoranaPentad();
    const gamma5 = pentad[4];
    const ref = pauliReference(gamma5);
    assert.ok(ref !== null, "the volume element stays on the Pauli rays");
    assert.equal(ref.name, "Z⊗Y");
    const zy = cmatKron(Z2, Y2);
    let devZY = 0;
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        devZY = Math.max(
          devZY,
          Math.hypot(
            gamma5.re[a]![b]! - zy.re[a]![b]!,
            gamma5.im[a]![b]! - zy.im[a]![b]!,
          ),
        );
    assert.equal(devZY, 0);
    // squared to I (independent double-factor product, the matSqr second path)
    for (const m of pentad) {
      const m2 = matSqr(m);
      let dev = 0;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
          dev = Math.max(
            dev,
            Math.hypot(m2.re[i]![j]! - (i === j ? 1 : 0), m2.im[i]![j]!),
          );
      assert.ok(
        dev < 1e-12,
        `box squares to I only up to ${dev.toExponential(3)}`,
      );
    }
    // Hermitian
    for (const m of pentad) {
      let dev = 0;
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
          dev = Math.max(
            dev,
            Math.hypot(
              m.re[i]![j]! - m.re[j]![i]!,
              m.im[i]![j]! + m.im[j]![i]!,
            ),
          );
      assert.ok(dev < 1e-12, "Hermiticity");
    }
    // pairwise anticommuting over all 10 pairs
    for (let a = 0; a < 5; a++)
      for (let b = a + 1; b < 5; b++)
        assert.ok(
          commutatorDev(pentad[a]!, pentad[b]!) > 2 - 1e-12,
          `pair (${a},${b})`,
        );
  });

  it("(K5-b) the sign law: every one of the 120 orders multiplies to sgn(pi)·P exactly", () => {
    const pentad = majoranaPentad();
    const base = orderedProduct5(pentad, [0, 1, 2, 3, 4]);
    let dev = 0;
    for (const p of S5) {
      const prod = orderedProduct5(pentad, p.seq);
      const target = p.even ? 1 : -1;
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          dev = Math.max(
            dev,
            Math.hypot(
              prod.re[a]![b]! - target * base.re[a]![b]!,
              prod.im[a]![b]! - target * base.im[a]![b]!,
            ),
          );
        }
      }
    }
    assert.ok(dev <= 1e-13, `sign law dev ${dev}`);
  });

  it("(K5-b) <u|u_sgn> = (60-60)/120 = 0 exactly on the 120-dim order register", () => {
    const inner = controlInner5(uniformControl5(), sgnControl5());
    assert.ok(Math.hypot(inner.re, inner.im) < 1e-15);
    // both control states normalized
    const uu = controlInner5(uniformControl5(), uniformControl5());
    const ss = controlInner5(sgnControl5(), sgnControl5());
    assert.ok(Math.abs(uu.re - 1) < 1e-12);
    assert.ok(Math.abs(ss.re - 1) < 1e-12);
  });

  it("(K5-b) deterministic promise readout at k=5: the control ends exactly in |u_sgn>", () => {
    const rng = new Rng(11);
    for (let t = 0; t < 3; t++) {
      const psi = t === 0 ? verificationState5() : randomState(rng, 4);
      const f = controlFidelity5(
        switchedControlState5(majoranaPentad(), psi),
        sgnControl5(),
      );
      assert.ok(Math.abs(f - 1) < 1e-11, `fidelity ${f}`);
    }
  });

  it("(K5-c) pentad census over C(15,5)=3003: 6 anticommuting, 0 commuting, 2997 mixed (machine numbers)", () => {
    const census = pauliPentadCensus();
    assert.equal(census.total, 3003);
    assert.equal(census.anticommutingCount, 6);
    assert.equal(census.commutingCount, 0);
    assert.equal(census.mixedCount, 2997);
    assert.equal(census.anticommuting.length, 6);
    // the constructed pentad's Pauli names appear among the census hits
    const zyName = PAULIS4.findIndex((p) => p.name === "Z⊗Y");
    assert.ok(zyName > 0, "Z⊗Y is a non-identity Pauli");
    const antiNames = census.anticommuting.map((e) =>
      e.names.slice().sort().join(","),
    );
    assert.ok(
      antiNames.includes("X⊗I,Y⊗I,Z⊗X,Z⊗Y,Z⊗Z"),
      `the constructed pentad is one of the six: ${antiNames.join(" | ")}`,
    );
  });

  it("(K5-c) reconciliation identity: #quintuples x 5 = Σ extensions = 30, and every quadruple extends by exactly one Pauli", () => {
    const rec = censusReconciliation();
    assert.equal(rec.pentadCount, 6);
    assert.equal(rec.quadExtensionSum, 30);
    assert.equal(rec.extensionMin, 1);
    assert.equal(rec.extensionMax, 1);
    assert.equal(rec.identityHolds, true);
  });

  it("(K5-c) symplectic maximality: C(15,6)=5005 sextuples contain ZERO anticommuting ones — 2n+1=5 is maximal at n=2", () => {
    assert.equal(anticommutingSextupleCount(), 0);
  });

  it("(K5-d) the dimension staircase d(k)=2^ceil((k-1)/2) fits k=1..5 and the witnesses verify", () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(dOf), [1, 2, 2, 4, 4]);
    const ladder = dimensionLadder();
    assert.equal(ladder.length, 5);
    for (const row of ladder) {
      assert.equal(row.witnesses.length, row.k);
      assert.equal(row.d, dOf(row.k), `d(${row.k})`);
      assert.ok(row.squareDev < 1e-12, `k=${row.k} squares to I`);
      assert.ok(
        row.minAnticommuting > 2 - 1e-12,
        `k=${row.k} pairwise anticommuting (min dev ${row.minAnticommuting})`,
      );
    }
    // the k=4 row IS the existing anticommutingQuad (element-wise — the ladder
    // builds its own instances), the k=5 row closes with the volume element
    const quad = anticommutingQuad();
    const matDev = (a: typeof X2, b: typeof X2): number => {
      let dev = 0;
      for (let i = 0; i < a.dim; i++)
        for (let j = 0; j < a.dim; j++)
          dev = Math.max(
            dev,
            Math.hypot(
              a.re[i]![j]! - b.re[i]![j]!,
              a.im[i]![j]! - b.im[i]![j]!,
            ),
          );
      return dev;
    };
    for (let i = 0; i < 4; i++) {
      assert.ok(
        matDev(ladder[3]!.witnesses[i]!, quad[i]!) === 0,
        `k=4 witness ${i} differs from the canonical quadruple`,
      );
      assert.ok(
        matDev(ladder[4]!.witnesses[i]!, quad[i]!) === 0,
        `k=5 base witness ${i} differs from the canonical quadruple`,
      );
    }
  });

  it("(K5-d) the d=2 ceiling: orthonormal triples are nonsingular (worst |det| ~ 1), so a fourth anticommuting Bloch vector is forced to zero", () => {
    const cert = d2AnticommutingCeiling();
    assert.equal(cert.maxOrthogonalSet, 3);
    assert.ok(cert.worstDet > 0.99, `worst |det| ${cert.worstDet}`);
    // the Bloch face: X, Z anticommute and their Bloch vectors are orthogonal; X, X commute (parallel)
    assert.ok(commutatorDev(X2, Z2) > 2 - 1e-12);
    assert.ok(commutatorDev(X2, X2) < 1e-12);
  });

  it("SMUGGLING TRIAL: a commuting element smuggled into the pentad is NAMED and rejected", () => {
    // I⊗X commutes with X⊗I — the forged fifth element
    const forged = [...anticommutingQuad(), cmatKron(I2, X2)];
    const v = verifyPentadCertificate({
      boxes: forged,
      claim: "anticommuting-pentad",
    });
    assert.equal(v.ok, false);
    assert.match(v.reason, /PENTAD-COUNTERFEIT/);
    assert.match(v.reason, /commute/);
    // the genuine pentad passes
    const good = verifyPentadCertificate({
      boxes: majoranaPentad(),
      claim: "anticommuting-pentad",
    });
    assert.equal(good.ok, true);
    assert.match(good.reason, /verified/);
    // a repeated element is also caught (self-commuting)
    const repeated = [...anticommutingQuad(), anticommutingQuad()[0]];
    const v2 = verifyPentadCertificate({
      boxes: repeated,
      claim: "anticommuting-pentad",
    });
    assert.equal(v2.ok, false);
    assert.match(v2.reason, /PENTAD-COUNTERFEIT/);
  });

  it("SMUGGLING TRIAL: a counterfeit census count is recomputed and NAMED; the honest one passes", () => {
    const cheat = verifyPentadCensus({ claimedAnticommutingCount: 7 });
    assert.equal(cheat.ok, false);
    assert.match(cheat.reason, /CENSUS-COUNTERFEIT/);
    assert.match(cheat.reason, /machine census/);
    const honest = verifyPentadCensus({ claimedAnticommutingCount: 6 });
    assert.equal(honest.ok, true);
  });

  it("SMUGGLING TRIAL: the ladder lie d(4)=2 is rejected with the d=2 ceiling evidence; d(4)=4 passes", () => {
    const lie = verifyLadderClaim({ k: 4, claimedD: 2 });
    assert.equal(lie.ok, false);
    assert.match(lie.reason, /LADDER-COUNTERFEIT/);
    assert.match(lie.reason, /ceiling/);
    const truth = verifyLadderClaim({ k: 4, claimedD: 4 });
    assert.equal(truth.ok, true);
    const truth5 = verifyLadderClaim({ k: 5, claimedD: 4 });
    assert.equal(truth5.ok, true);
    assert.throws(() => dOf(0), /K5-LADDER-K/);
  });
});

/** m·m helper (the squared-to-I check needs exactly two factors). */
function matSqr(m: { dim: number; re: number[][]; im: number[][] }): {
  re: number[][];
  im: number[][];
} {
  const re = Array.from({ length: m.dim }, () =>
    new Array<number>(m.dim).fill(0),
  );
  const im = Array.from({ length: m.dim }, () =>
    new Array<number>(m.dim).fill(0),
  );
  for (let i = 0; i < m.dim; i++) {
    for (let j = 0; j < m.dim; j++) {
      for (let k = 0; k < m.dim; k++) {
        re[i]![j] =
          re[i]![j]! +
          m.re[i]![k]! * m.re[k]![j]! -
          m.im[i]![k]! * m.im[k]![j]!;
        im[i]![j] =
          im[i]![j]! +
          m.re[i]![k]! * m.im[k]![j]! +
          m.im[i]![k]! * m.re[k]![j]!;
      }
    }
  }
  return { re, im };
}

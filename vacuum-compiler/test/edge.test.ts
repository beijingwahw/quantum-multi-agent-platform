import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CVec,
  cmatEye,
  cmatMul,
  cvecZero,
  VacuumError,
} from "../src/core/cmat.js";
import { randomCircuit, program } from "../src/compile/circuit.js";
import { assemble, buildPropagation } from "../src/compile/hamiltonian.js";
import { energySpread } from "../src/compile/ledger.js";
import { Rng } from "../src/compile/rng.js";
import {
  auditEdgeIdentity,
  clockSectorBlock,
  clockSectorEmbed,
  cycleClosedPropagation,
  edgeIdentity,
  inputViolationMass,
  sectorBandwidth,
} from "../src/compile/edge.js";

function throwsCode(code: string): (err: unknown) => boolean {
  return (err: unknown): boolean =>
    err instanceof VacuumError && err.code === code;
}

/** A random normalized data-space vector (real amplitudes — the corollary
 * holds for every superposition; complex faces add nothing to the blocks). */
function randomDataVec(dim: number, rng: Rng): CVec {
  const v = cvecZero(dim);
  let nrm = 0;
  for (let i = 0; i < dim; i++) {
    const a = rng.next() * 2 - 1;
    v.re[i] = a;
    nrm += a * a;
  }
  for (let i = 0; i < dim; i++) v.re[i] = (v.re[i] as number) / Math.sqrt(nrm);
  return v;
}

describe("F17 the sigma_E edge-block operator identity (v0.4.0)", () => {
  it("P0 H_prop P0 = 1/2 P0 BIT-EXACT and P0 H^2 P0 = 1/2 P0 to the rounding floor, T = 2..12", () => {
    for (const T of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      for (const seed of [601, 909]) {
        const circuit = randomCircuit(2, T, new Rng(seed + T));
        const h = buildPropagation(2, circuit.steps);
        const cert = edgeIdentity(h, T + 1, circuit.steps[0]);
        assert.equal(
          cert.diagonalDev,
          0,
          `T=${T} seed=${seed}: diagonal dev ${cert.diagonalDev} (must be BIT-EXACT)`,
        );
        assert.ok(
          cert.secondMomentDev < 1e-15,
          `T=${T} seed=${seed}: second moment dev ${cert.secondMomentDev}`,
        );
      }
    }
  });

  it("the structure: clock-0 touches ONE edge — far blocks exactly zero, the 2x2 edge block is -1/2 U1 (and its adjoint) bit-exact", () => {
    for (const T of [2, 5, 12]) {
      const circuit = randomCircuit(2, T, new Rng(601 + T));
      const h = buildPropagation(2, circuit.steps);
      const cert = edgeIdentity(h, T + 1, circuit.steps[0]);
      assert.equal(
        cert.farBlockDev,
        0,
        `T=${T}: far block dev (must be exactly 0)`,
      );
      assert.equal(cert.edgeBlockDev, 0, `T=${T}: edge block dev`);
      assert.equal(
        cert.edgeBlockAdjointDev,
        0,
        `T=${T}: edge block adjoint dev`,
      );
    }
  });

  it("the corollary: sigma_E = 1/2 EXACTLY for every clock-0-supported state, prop-only and prop+in on the valid sector", () => {
    for (const T of [2, 6, 10]) {
      const circuit = randomCircuit(2, T, new Rng(707 + T));
      const propOnly = buildPropagation(2, circuit.steps);
      let worst = 0;
      for (let trial = 0; trial < 12; trial++) {
        const psi = clockSectorEmbed(
          randomDataVec(4, new Rng(3000 + trial)),
          T + 1,
          0,
        );
        worst = Math.max(worst, Math.abs(energySpread(propOnly, psi) - 0.5));
      }
      assert.ok(worst < 1e-14, `T=${T}: prop-only sigma_E worst dev ${worst}`);
      // prop+in: only the valid data states (checked [0,1] all zero -> d = 0)
      const prog = program(circuit, [0, 1], new Map());
      const comp = assemble(prog, { output: false });
      const valid = cvecZero(4);
      valid.re[0] = 1;
      const psiValid = clockSectorEmbed(valid, T + 1, 0);
      assert.ok(
        Math.abs(energySpread(comp.h, psiValid) - 0.5) < 1e-14,
        `T=${T}: prop+in valid-sector sigma_E`,
      );
    }
  });

  it("the variance law: on the FULL clock-0 sector sigma_E^2 = 1/4 + p(1-p) with p the violation mass — the bandwidth is minimal exactly on the valid sector", () => {
    const T = 6;
    const circuit = randomCircuit(2, T, new Rng(808));
    const prog = program(circuit, [0, 1], new Map());
    const comp = assemble(prog, { output: false });
    let worst = 0;
    let worstDip = Infinity;
    for (let trial = 0; trial < 24; trial++) {
      const data = randomDataVec(4, new Rng(4000 + trial));
      const p = inputViolationMass(data, 2, [0, 1]);
      const psi = clockSectorEmbed(data, T + 1, 0);
      const sig = energySpread(comp.h, psi);
      worst = Math.max(worst, Math.abs(sig * sig - (0.25 + p * (1 - p))));
      worstDip = Math.min(worstDip, sig * sig - 0.25); // sigma^2 >= 1/4 always
    }
    assert.ok(worst < 1e-14, `variance law worst dev ${worst}`);
    assert.ok(
      worstDip >= -1e-15,
      `sigma_E dipped below 1/2 (worst dip ${worstDip})`,
    );
  });

  it("the assembled engines leave every P0 block untouched: output at clock T, fuel clock-diagonal at -eps*0 — the identity survives both forms exactly", () => {
    const T = 6;
    const circuit = randomCircuit(2, T, new Rng(919));
    const prog = program(circuit, [0, 1], new Map([[0, 1]]));
    const comp = assemble(prog, { output: true, epsilon: 0.37 });
    const diag = clockSectorBlock(comp.h, T + 1, 0, 0);
    const secondMoment = clockSectorBlock(cmatMul(comp.h, comp.h), T + 1, 0, 0);
    // valid-sector entries only (d = 0): the identity's assembled face
    assert.ok(
      Math.abs((diag.re[0]![0] as number) - 0.5) < 1e-15,
      `fueled diagonal ${diag.re[0]![0]}`,
    );
    assert.ok(
      Math.abs((secondMoment.re[0]![0] as number) - 0.5) < 1e-15,
      `fueled second moment ${secondMoment.re[0]![0]}`,
    );
    // and the violated entry is lifted to exactly 3/2: the honest boundary
    assert.ok(
      Math.abs((diag.re[3]![3] as number) - 1.5) < 1e-15,
      `violated diagonal ${diag.re[3]![3]}`,
    );
  });

  it("the far end mirrors the edge and the interior is wider: sectors {0, T} at (1/2, 1/2), interior at (1, 3/2) — bandwidth 1/sqrt(2)", () => {
    const T = 8;
    const circuit = randomCircuit(2, T, new Rng(515));
    const h = buildPropagation(2, circuit.steps);
    for (const s of [0, T]) {
      const bw = sectorBandwidth(h, T + 1, s);
      assert.ok(bw.scalarDev < 1e-15, `sector ${s} not scalar`);
      assert.ok(
        Math.abs(bw.diagonal - 0.5) < 1e-15,
        `sector ${s} diagonal ${bw.diagonal}`,
      );
      assert.ok(
        Math.abs(bw.secondMoment - 0.5) < 1e-15,
        `sector ${s} second moment ${bw.secondMoment}`,
      );
    }
    for (const s of [1, 4, 7]) {
      const bw = sectorBandwidth(h, T + 1, s);
      assert.ok(
        Math.abs(bw.diagonal - 1) < 1e-15,
        `interior ${s} diagonal ${bw.diagonal}`,
      );
      assert.ok(
        Math.abs(bw.secondMoment - 1.5) < 1e-15,
        `interior ${s} second moment ${bw.secondMoment}`,
      );
      const sigmaSq = bw.secondMoment - bw.diagonal * bw.diagonal;
      assert.ok(
        Math.abs(sigmaSq - 0.5) < 1e-15,
        `interior ${s} bandwidth squared ${sigmaSq} (1/sqrt2 face)`,
      );
    }
  });

  it("SMUGGLING TRIAL: the double-edge counterfeit dies with its exact 1/4 — and the auditor names every lie", () => {
    const T = 5;
    const circuit = randomCircuit(2, T, new Rng(909));
    const h = buildPropagation(2, circuit.steps);
    // the honest certificate passes clean
    assert.deepEqual(
      auditEdgeIdentity(h, T + 1, {
        sector: 0,
        claimedDiagonal: 0.5,
        claimedSecondMoment: 0.5,
      }),
      [],
    );
    // the cycle-closed counterfeit: (a) intact, (b) off by EXACTLY 1/4
    const hc = cycleClosedPropagation(2, circuit.steps);
    const cert = edgeIdentity(hc, T + 1);
    assert.equal(
      cert.diagonalDev,
      0,
      "the closure never touches the clock-0 diagonal",
    );
    assert.ok(
      Math.abs(cert.secondMomentDev - 0.25) < 1e-15,
      `cycle second-moment dev ${cert.secondMomentDev} (exactly 0.25)`,
    );
    const v = auditEdgeIdentity(hc, T + 1, {
      sector: 0,
      claimedDiagonal: 0.5,
      claimedSecondMoment: 0.5,
    });
    assert.ok(
      v.some(
        (x) =>
          x.crime === "counterfeit second-moment block (the double edge)" &&
          x.detail.includes("0.75"),
      ),
      JSON.stringify(v),
    );
    // an interior-sector claim of the edge identity: the block is 1, not 1/2
    const vi = auditEdgeIdentity(h, T + 1, {
      sector: 2,
      claimedDiagonal: 0.5,
      claimedSecondMoment: 0.5,
    });
    assert.ok(
      vi.some((x) => x.crime === "counterfeit diagonal block"),
      JSON.stringify(vi),
    );
    assert.ok(
      vi.some(
        (x) => x.crime === "counterfeit second-moment block (the double edge)",
      ),
      JSON.stringify(vi),
    );
    // the input-penalty face: claiming the identity for the FULL space with the
    // input check on is convicted — the block lifts to 3/2 on violated states
    const prog = program(circuit, [0, 1], new Map());
    const comp = assemble(prog, { output: false });
    const vf = auditEdgeIdentity(comp.h, T + 1, {
      sector: 0,
      claimedDiagonal: 0.5,
      claimedSecondMoment: 0.5,
    });
    assert.ok(
      vf.some((x) => x.crime === "counterfeit diagonal block"),
      JSON.stringify(vf),
    );
    // sigma_E on the cycle chain: sqrt(1/2), not 1/2 — the operator root moved
    const psi = cvecZero(hc.dim);
    psi.re[0] = 1;
    assert.ok(
      Math.abs(energySpread(hc, psi) - Math.sqrt(0.5)) < 1e-14,
      "cycle sigma_E",
    );
  });

  it("domain rejections are named: short chains, non-divisor clocks, out-of-range sectors and qubits", () => {
    const circuit = randomCircuit(2, 3, new Rng(11));
    const h = buildPropagation(2, circuit.steps);
    assert.throws(
      () => edgeIdentity(h, 2),
      throwsCode("edge/clock-states-out-of-domain"),
    );
    assert.throws(
      () => clockSectorBlock(h, 5, 0, 0),
      throwsCode("edge/clock-not-divisor"),
    );
    assert.throws(
      () => clockSectorBlock(h, 4, 0, 4),
      throwsCode("edge/sector-out-of-range"),
    );
    assert.throws(
      () => sectorBandwidth(h, 4, -1),
      throwsCode("edge/sector-out-of-range"),
    );
    assert.throws(
      () => inputViolationMass(cvecZero(4), 1, [0]),
      throwsCode("edge/data-dim-mismatch"),
    );
    assert.throws(
      () => inputViolationMass(cvecZero(4), 2, [2]),
      throwsCode("edge/checked-qubit-out-of-range"),
    );
    assert.throws(
      () => cycleClosedPropagation(2, circuit.steps.slice(0, 1)),
      throwsCode("edge/cycle-needs-interior"),
    );
    assert.throws(
      () => edgeIdentity(h, 4, { matrix: cmatEye(2) }),
      throwsCode("edge/step-dim-mismatch"),
    );
  });
});

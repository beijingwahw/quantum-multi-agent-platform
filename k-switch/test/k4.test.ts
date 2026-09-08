import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  S4,
  anticommutingQuad,
  commutingQuad,
  controlFidelity4,
  controlInner4,
  interleavedDistinguishability4,
  matchedBlindPair,
  matchedBlindPairs,
  orderedProduct4,
  pauliName,
  pauliQuadCensus,
  rotationsOf,
  switchIsometry4,
  sgnControl4,
  switchedControlState4,
  uniformControl4,
  verificationState4,
} from "../src/kswitch/k4.js";
import { commutatorDev, randomState } from "../src/kswitch/promise.js";
import { Rng } from "../src/kswitch/rng.js";
import { chainDistinguishability4 } from "../src/kswitch/sched4.js";
import {
  algorithm1,
  distinguishabilityMatrix,
  gatesByIndices,
  hadamardCensus,
  shortestSupersequence,
  ORDERS4,
} from "../src/kswitch/hadamard4.js";
import { verifyDistinguishabilityMatrix, verifyParityCertificate, verifyQuadCensus, verifySupersequenceClaim } from "../src/kswitch/verify.js";

describe("T3 the 4-switch: the parity law generalizes", () => {
  it("S4 has 12 even and 12 odd permutations — the orthogonality precondition", () => {
    assert.equal(S4.length, 24);
    assert.equal(S4.filter((p) => p.even).length, 12);
    assert.equal(S4.filter((p) => !p.even).length, 12);
  });

  it("<u|u_sgn> = 0 exactly and the canonical instances keep their promise", () => {
    const inner = controlInner4(uniformControl4(), sgnControl4());
    assert.ok(Math.hypot(inner.re, inner.im) < 1e-15);
    const comm = commutingQuad();
    const anti = anticommutingQuad();
    let devC = 0;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) devC = Math.max(devC, commutatorDev(comm[a]!, comm[b]!));
    let devA = Number.POSITIVE_INFINITY;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) devA = Math.min(devA, commutatorDev(anti[a]!, anti[b]!));
    assert.ok(devC < 1e-13, `commuting dev ${devC}`);
    assert.ok(devA > 2 - 1e-12, `anticommuting dev ${devA}`);
  });

  it("the sign law: every order's product = sgn(pi)·P exactly, all 24 orders", () => {
    const anti = anticommutingQuad();
    const base = orderedProduct4(anti, [0, 1, 2, 3]);
    let dev = 0;
    for (let p = 0; p < 24; p++) {
      const prod = orderedProduct4(anti, S4[p]!.seq);
      const target = S4[p]!.even ? 1 : -1;
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          dev = Math.max(dev, Math.hypot(prod.re[a]![b]! - target * base.re[a]![b]!, prod.im[a]![b]! - target * base.im[a]![b]!));
        }
      }
    }
    assert.ok(dev < 1e-13, `sign law dev ${dev}`);
  });

  it("deterministic promise readout at k=4: control ends exactly in |u> vs |u_sgn>", () => {
    const rng = new Rng(5);
    for (let t = 0; t < 3; t++) {
      const psi = randomState(rng, 4);
      const fC = controlFidelity4(switchedControlState4(commutingQuad(), psi), uniformControl4());
      const fA = controlFidelity4(switchedControlState4(anticommutingQuad(), psi), sgnControl4());
      assert.ok(Math.abs(fC - 1) < 1e-11, `fC ${fC}`);
      assert.ok(Math.abs(fA - 1) < 1e-11, `fA ${fA}`);
    }
  });

  it("the 4-switch is an isometry (96-dim, M†M = I) for both instances", () => {
    // block-diagonal with unitary blocks; off-block entries exactly zero
    for (const boxes of [commutingQuad(), anticommutingQuad()]) {
      const m = switchIsometry4(boxes, 4);
      assert.equal(m.dim, 96);
      let offBlock = 0;
      for (let p = 0; p < 24; p++) {
        for (let q = 0; q < 24; q++) {
          if (p === q) continue;
          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              offBlock = Math.max(offBlock, Math.abs(m.re[p * 4 + i]![q * 4 + j]!), Math.abs(m.im[p * 4 + i]![q * 4 + j]!));
            }
          }
        }
      }
      assert.ok(offBlock === 0);
    }
  });

  it("single-order readout is 1/24 on both classes; control-state readout is deterministic", () => {
    const psi = verificationState4();
    for (const rho of [switchedControlState4(commutingQuad(), psi), switchedControlState4(anticommutingQuad(), psi)]) {
      for (let p = 0; p < 24; p++) {
        const v = { re: new Array<number>(24).fill(0), im: new Array<number>(24).fill(0) };
        v.re[p] = 1;
        assert.ok(Math.abs(controlFidelity4(rho, v) - 1 / 24) < 1e-12);
      }
    }
  });
});

describe("T4 the Pauli census and blindness at k=4", () => {
  it("ZERO commuting Pauli quadruples exist at d=4; exactly 30 anticommuting; sign law exact on all", () => {
    const census = pauliQuadCensus();
    assert.equal(census.commuting.length, 0);
    assert.equal(census.anticommuting.length, 30);
    assert.equal(census.mixed, 1335);
    for (const e of census.anticommuting) assert.ok(e.signLawDev < 1e-13);
  });

  it("matched blindness pairs inside the Pauli universe: NONE (the honest no-go)", () => {
    const census = pauliQuadCensus();
    assert.equal(matchedBlindPairs(census).length, 0);
  });

  it("constructed matched pair outside the Pauli universe: all 24 plain orders blind", () => {
    const cert = matchedBlindPair(verificationState4());
    assert.equal(cert.commProduct, cert.antiProduct);
    assert.ok(cert.maxTraceDistance < 1e-7, `max T ${cert.maxTraceDistance}`);
    // the commuting side is really commuting
    let dev = 0;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) dev = Math.max(dev, commutatorDev(cert.comm[a]!, cert.comm[b]!));
    assert.ok(dev < 1e-13);
  });

  it("interleaved sampling probe: random interleaving DOES distinguish the canonical pair", () => {
    const rng = new Rng(9);
    let maxD = 0;
    for (let t = 0; t < 4; t++) {
      maxD = Math.max(maxD, interleavedDistinguishability4(commutingQuad(), anticommutingQuad(), S4[t % 24]!.seq, rng));
    }
    assert.ok(maxD > 0.9, `expected near-1 interleaved distinguishability, got ${maxD}`);
  });

  it("rotationsOf product lands on the generator's Pauli ray (the matched-pair contract)", () => {
    const cert = matchedBlindPair(verificationState4());
    const gen = orderedProduct4(cert.anti, [0, 1, 2, 3]);
    const prod = orderedProduct4(rotationsOf(gen), [0, 1, 2, 3]);
    assert.equal(pauliName(prod), cert.antiProduct);
    // and the product is phase-only off the generator: diagonal exactly 0 (sum of angles = pi/2)
    for (let a = 0; a < 4; a++) assert.ok(Math.abs(prod.re[a]![a]!) < 1e-12 && Math.abs(prod.im[a]![a]!) < 1e-12);
  });
});

describe("T5 the TCA+21 Hadamard face at d=2", () => {
  it("the census: 136 of 256 ordered {I,X,Y,Z}^4 sets satisfy the promise, per column 52/36/24/24", () => {
    const census = hadamardCensus();
    assert.equal(census.sets.length, 136);
    assert.deepEqual(census.byColumn.map((l) => l.length), [52, 36, 24, 24]);
    assert.equal(census.failing, 120);
  });

  it("Algorithm 1 reads the promise column with probability 1 exactly, on every promising set", () => {
    const psi = { re: [0.6, 0.8], im: [0, 0] };
    for (const s of hadamardCensus().sets) {
      const p = algorithm1(gatesByIndices(s.gates), psi);
      assert.ok(Math.abs(p[s.column]! - 1) < 1e-12, `${s.names.join("")}: p(y=${s.column}) = ${p[s.column]}`);
    }
  });

  it("the fixed-order supersequence minimum is 9; TCA+21's ACBADACDB is a valid witness", () => {
    const sup = shortestSupersequence(9);
    assert.ok(sup !== null);
    assert.equal(sup.minLength, 9);
    const their = [..."ACBADACDB"].map((ch) => "ABCD".indexOf(ch));
    for (const p of ORDERS4) {
      let i = 0;
      for (const c of their) {
        if (c === p[i]) i++;
      }
      assert.equal(i, p.length, `ACBADACDB misses ${p.join("")}`);
    }
  });

  it("the exact game matrix: NO plain order separates ANY column pair (all 144 entries 0)", () => {
    const dm = distinguishabilityMatrix(hadamardCensus());
    assert.equal(dm.pairs.length, 6);
    for (let pi = 0; pi < 24; pi++) {
      for (const v of dm.gameMatrix[pi]!) assert.equal(v, 0, `order ${pi} claimed separable`);
    }
  });
});

describe("T6 the k=4 scheduling contact surface", () => {
  it("all 24 fixed orders D = 1/sqrt(2) (survives); switch D = sqrt(10)/6 != 1/2 (halving breaks)", () => {
    const input = { dim: 2, re: [[0.5, 0.5], [0.5, 0.5]], im: [[0, 0], [0, 0]] } as const;
    const r = chainDistinguishability4(input as never);
    for (const f of r.fixed) assert.ok(Math.abs(f.d - Math.SQRT1_2) < 1e-12, `${f.label}: ${f.d}`);
    assert.ok(Math.abs(r.switchD - Math.sqrt(10) / 6) < 1e-12, `switch D ${r.switchD}`);
    assert.ok(Math.abs(r.switchD - 0.5) > 1e-9, "halving law must NOT hold at k=4");
    assert.ok(r.switchD < Math.SQRT1_2 - 1e-9, "switch must stay below every fixed order");
  });
});

// ---------------------------------------------------------------------------
// Smuggling trials — counterfeit numbers and structures are NAMED and REJECTED.
// ---------------------------------------------------------------------------

describe("T7 smuggling trials (v0.2.0)", () => {
  it("the honest k=4 parity certificate passes its own trial (guard against an over-strict judge)", () => {
    const psi = verificationState4();
    const v = verifyParityCertificate({
      k: 4,
      evenCount: 12,
      oddCount: 12,
      innerAbs: Math.hypot(controlInner4(uniformControl4(), sgnControl4()).re, controlInner4(uniformControl4(), sgnControl4()).im),
      fCommuting: controlFidelity4(switchedControlState4(commutingQuad(), psi), uniformControl4()),
      fAnticommuting: controlFidelity4(switchedControlState4(anticommutingQuad(), psi), sgnControl4()),
    });
    assert.equal(v.ok, true, v.reason);
  });

  it("SMUGGLING TRIAL: a counterfeit parity split claiming 13 even / 11 odd is named and rejected", () => {
    // a forged certificate that would make <u|u_sgn> = (13-11)/24 != 0 look structural
    const v = verifyParityCertificate({ k: 4, evenCount: 13, oddCount: 11, innerAbs: 0, fCommuting: 1, fAnticommuting: 1 });
    assert.equal(v.ok, false);
    assert.match(v.reason, /PARITY-COUNTERFEIT/);
    assert.match(v.reason, /13 even \/ 11 odd/);
    assert.match(v.reason, /12\/12/);
  });

  it("SMUGGLING TRIAL: a counterfeit fidelity table claiming readouts that are not there is named and rejected", () => {
    // claims the anticommuting class reads out in |u> (uniform) with fidelity 1 —
    // the truth is fidelity 0 there (it reads out in |u_sgn>)
    const v = verifyParityCertificate({
      k: 4,
      evenCount: 12,
      oddCount: 12,
      innerAbs: 0,
      fCommuting: 1,
      fAnticommuting: controlFidelity4(switchedControlState4(anticommutingQuad(), verificationState4()), uniformControl4()),
    });
    assert.equal(v.ok, false);
    assert.match(v.reason, /PARITY-COUNTERFEIT/);
    assert.match(v.reason, /machine recomputes/);
  });

  it("SMUGGLING TRIAL: a fake distinguishability matrix claiming a separating order is named and rejected cell-by-cell", () => {
    const truth = distinguishabilityMatrix(hadamardCensus());
    // the counterfeit flips order #7 on pair (0,1) from 0 to 1: "some plain order
    // separates the promise columns" — the orthogonality that isn't there
    const fake = truth.gameMatrix.map((row, pi) => (pi === 7 ? row.map((v, q) => (q === 0 ? 1 : v)) : [...row]));
    const v = verifyDistinguishabilityMatrix({ gameMatrix: fake });
    assert.equal(v.ok, false);
    assert.match(v.reason, /DISTINGUISHABILITY-COUNTERFEIT/);
    assert.match(v.reason, /order #7/);
    assert.match(v.reason, /column pair \(0,1\)/);
    assert.match(v.reason, /claimed 1, machine recomputes 0/);
  });

  it("SMUGGLING TRIAL: a truncated distinguishability matrix is named and rejected", () => {
    const truth = distinguishabilityMatrix(hadamardCensus());
    const v = verifyDistinguishabilityMatrix({ gameMatrix: truth.gameMatrix.slice(0, 6) });
    assert.equal(v.ok, false);
    assert.match(v.reason, /DISTINGUISHABILITY-COUNTERFEIT/);
    assert.match(v.reason, /6 rows/);
  });

  it("SMUGGLING TRIAL: a counterfeit 8-query supersequence claim is named and rejected", () => {
    // claims the fixed-order simulation needs only 8 uses with some witness —
    // every 8-string misses at least one order (the machine minimum is 9)
    const v = verifySupersequenceClaim({ length: 8, witness: "ACBADACD" });
    assert.equal(v.ok, false);
    assert.match(v.reason, /SUPERSEQUENCE-COUNTERFEIT/);
    assert.match(v.reason, /misses order/);
    assert.match(v.reason, /3021/); // DACB — the missing quartet order, by name
    // and the length-mismatch path: valid 9-letter witness smuggled as length 8
    const v2 = verifySupersequenceClaim({ length: 8, witness: "ACBADACDB" });
    assert.equal(v2.ok, false);
    assert.match(v2.reason, /SUPERSEQUENCE-COUNTERFEIT/);
    assert.match(v2.reason, /claimed length 8, witness has 9/);
  });

  it("SMUGGLING TRIAL: an inflated Pauli census (a commuting quadruple that cannot exist) is named and rejected", () => {
    // claims 1 commuting Pauli quadruple — structurally impossible at d = 4
    const v = verifyQuadCensus({ commuting: 1, anticommuting: 30, mixed: 1334 });
    assert.equal(v.ok, false);
    assert.match(v.reason, /PAULI-CENSUS-COUNTERFEIT/);
    assert.match(v.reason, /machine census has \(0, 30, 1335\)/);
  });

  it("the honest supersequence and census certificates pass their own trials", () => {
    const sup = shortestSupersequence(9);
    assert.ok(sup !== null);
    const v = verifySupersequenceClaim({ length: sup.minLength, witness: "ACBADACDB" });
    assert.equal(v.ok, true, v.reason);
    const v2 = verifyQuadCensus({ commuting: 0, anticommuting: 30, mixed: 1335 });
    assert.equal(v2.ok, true, v2.reason);
    const truth = distinguishabilityMatrix(hadamardCensus());
    const v3 = verifyDistinguishabilityMatrix({ gameMatrix: truth.gameMatrix.map((r) => [...r]) });
    assert.equal(v3.ok, true, v3.reason);
  });
});

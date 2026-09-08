import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkBoard, runWitnesses } from "../src/kernel/audit.js";
import { BOARD, type BoardRow } from "../src/kernel/board.js";
import { makeRng } from "../src/core/rng.js";
import { maximallyMixed, randomStateVec, vecToRho } from "../src/core/states.js";
import { traceDistance, vonNeumannEntropy } from "../src/core/measures.js";
import { identity, kron, mat, matEq, mAdd, mDagger, mMul, mScale, basisVec, eigHermitian, vAdd, vKron, vScale, vec } from "../src/core/cmat.js";
import { applyUnitary, filterBasisDigit } from "../src/core/channels.js";
import {
  GAMMA,
  H_PLANCK,
  K_B,
  accumulatedLeakageBound,
  applyCollision,
  applyLaw,
  applyPerturbed,
  applyTwoWorldLaw,
  authoredHamiltonian,
  bathGibbs,
  betaGapOfFrequency,
  boltzmannOccupancy,
  bothOutside,
  catalystCap,
  chargeA,
  chargeB,
  coherenceBits,
  coherenceDecayRate,
  coherentShortcut,
  collisionBlockMixing,
  collapseIntoWorld,
  collisionRates,
  columnBasisSupport,
  diagonalExpectation,
  escapeAtHorizon,
  escapeDesignRuleBeta,
  alignedBank,
  exchangeUnitary,
  extractedGenerator,
  holderHarvest,
  holderJoint,
  joinCharge,
  joinLeakage,
  lindbladRhs,
  h2,
  inWorldState,
  iterateLaw,
  iterateTwoWorldLaw,
  lawKraus,
  leakage,
  membershipCharge,
  outOfWorldState,
  populationDecayRate,
  perturbedLeakageBound,
  randomBranchUnitary,
  randomCptpKraus,
  randomUnitary,
  schmidtPurification,
  sectorCoherence,
  sectorDephase,
  singleWorldLeak,
  stationaryInWorld,
  thermalUpRate,
  totalCoherenceBits,
  twoRateInWorld,
  twoRateRecursion,
  twoWorldLawKraus,
} from "../src/kernel/law.js";
import { partialTrace } from "../src/core/channels.js";
import { DomainError } from "../src/core/errors.js";

/** BoardRow with readonly stripped: smuggle deep-copies the board, so
 * in-place mutation of the copy is the whole point of the harness. */
type WritableBoardRow = { -readonly [K in keyof BoardRow]: BoardRow[K] };

function smuggle(mutate: (rows: BoardRow[]) => void): BoardRow[] {
  const copy = JSON.parse(JSON.stringify(BOARD)) as BoardRow[];
  mutate(copy);
  return copy;
}

describe("T1 the board stands", () => {
  it("the checker passes on the real board", () => {
    assert.deepEqual(checkBoard(), []);
  });

  it("all seventeen witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the law's machinery", () => {
  it("the law is a CPTP map: Kraus completeness to the rounding floor", () => {
    for (const gamma of [0.1, GAMMA, 0.6]) {
      let completeness = mat(4, 4);
      for (const k of lawKraus(gamma)) completeness = mAdd(completeness, mMul(mDagger(k), k));
      assert.ok(matEq(completeness, identity(4), 1e-14));
    }
  });

  it("random Stinespring channels are CPTP too (the census is fair)", () => {
    const rng = makeRng(77);
    for (let t = 0; t < 30; t++) {
      const kraus = randomCptpKraus(rng, 4, 2);
      let completeness = mat(4, 4);
      for (const k of kraus) completeness = mAdd(completeness, mMul(mDagger(k), k));
      assert.ok(matEq(completeness, identity(4), 1e-13));
    }
  });

  it("random unitaries are unitary (both generators)", () => {
    const rng = makeRng(78);
    for (let t = 0; t < 12; t++) {
      const u = randomUnitary(rng, 4);
      assert.ok(matEq(mMul(mDagger(u), u), identity(4), 1e-12));
      const b = randomBranchUnitary(rng);
      assert.ok(matEq(mMul(mDagger(b), b), identity(4), 1e-12));
    }
  });

  it("quiet on the world: the law is the identity map on in-world states", () => {
    const rng = makeRng(31);
    for (let t = 0; t < 20; t++) {
      const rho = inWorldState(vecToRho(randomStateVec(rng, 2)));
      const out = applyLaw(rho, GAMMA);
      assert.ok(traceDistance(out, rho) <= 1e-15);
    }
  });

  it("sector book: p' = p + γ(1−p) and leakage(k) = (1−γ)^k (1−p0) exact", () => {
    const rng = makeRng(32);
    for (let t = 0; t < 40; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      const p0 = membershipCharge(rho);
      assert.ok(Math.abs(membershipCharge(applyLaw(rho, GAMMA)) - (p0 + GAMMA * (1 - p0))) <= 1e-15);
      for (const k of [1, 4, 17, 50]) {
        assert.ok(Math.abs(leakage(iterateLaw(rho, k, GAMMA)) - Math.pow(1 - GAMMA, k) * (1 - p0)) <= 1e-14);
      }
    }
  });

  it("global attraction: k=200 equals the into-world collapse to 1e-12", () => {
    const rng = makeRng(33);
    for (let t = 0; t < 12; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      assert.ok(traceDistance(iterateLaw(rho, 200, GAMMA), collapseIntoWorld(rho)) <= 1e-12);
    }
    // the worst start: entirely outside the world, cargo intact after the ride in
    const cargo = vecToRho(randomStateVec(rng, 2));
    const outside = outOfWorldState(cargo);
    assert.ok(traceDistance(iterateLaw(outside, 200, GAMMA), inWorldState(cargo)) <= 1e-12);
    assert.ok(membershipCharge(iterateLaw(outside, 200, GAMMA)) >= 1 - 1e-12);
  });

  it("the Lyapunov increment: ΔV = γ(1−V) with equality exactly on-world", () => {
    const rng = makeRng(34);
    for (let t = 0; t < 50; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      const v = membershipCharge(rho);
      const dv = membershipCharge(applyLaw(rho, GAMMA)) - v;
      assert.ok(Math.abs(dv - GAMMA * (1 - v)) <= 1.5e-15);
      if (1 - v > 1e-12) assert.ok(dv > 1e-14, "strict increase off the world");
    }
    const onWorld = inWorldState(maximallyMixed(2));
    assert.ok(Math.abs(membershipCharge(applyLaw(onWorld, GAMMA)) - membershipCharge(onWorld)) <= 1e-15);
  });

  it("engineered branch programs conserve the charge; generic unitaries do not", () => {
    const rng = makeRng(35);
    for (let t = 0; t < 20; t++) {
      const u = randomBranchUnitary(rng);
      for (const rho of [inWorldState(maximallyMixed(2)), vecToRho(randomStateVec(rng, 4)), maximallyMixed(4)]) {
        assert.ok(Math.abs(membershipCharge(applyUnitary(rho, u)) - membershipCharge(rho)) <= 1.5e-15);
      }
    }
    let moved = 0;
    for (let t = 0; t < 10; t++) {
      const u = randomUnitary(rng, 4);
      const rho = vecToRho(randomStateVec(rng, 4));
      moved = Math.max(moved, Math.abs(membershipCharge(applyUnitary(rho, u)) - membershipCharge(rho)));
    }
    assert.ok(moved > 0.3, "a generic unitary must be able to move the charge");
  });

  it("perturbation: asymptotic leakage stays under the exact algebra bound", () => {
    const rng = makeRng(36);
    for (const eps of [0.002, 0.01, 0.05, 0.1]) {
      let worst = 0;
      for (let t = 0; t < 8; t++) {
        const nKraus = randomCptpKraus(rng, 4, 2);
        for (const rho0 of [outOfWorldState(vecToRho(randomStateVec(rng, 2))), maximallyMixed(4)]) {
          let cur = rho0;
          for (let k = 0; k < 400; k++) cur = applyPerturbed(cur, nKraus, eps, GAMMA);
          worst = Math.max(worst, leakage(cur));
        }
      }
      assert.ok(worst <= perturbedLeakageBound(eps, GAMMA) + 1e-12, `eps=${eps}: ${worst} > bound`);
    }
  });

  it("h2 anchors: h2(1/2)=1 exact, h2(0.025) matches the depreciation ledger's W-E", () => {
    assert.ok(Math.abs(h2(0.5) - 1) <= 1e-15);
    assert.ok(Math.abs(h2(0.025) - 0.168660931) <= 1e-9);
    assert.ok(Math.abs(h2(0.1) - 0.4689955935892812) <= 1e-12);
  });

  it("the two-rate escape chain: closed form = recursion, union bound holds", () => {
    for (const r of [0.01, 0.05, 0.2, 0.5]) {
      for (const k of [1, 3, 10, 40, 150]) {
        const closed = twoRateInWorld(k, r, GAMMA);
        assert.ok(Math.abs(closed - twoRateRecursion(k, r, GAMMA)) <= 1e-13);
        assert.ok(1 - closed <= k * r + 1e-12, "union bound");
      }
    }
    // the law's own face: r = 0 gives escape exactly 0 at every horizon
    for (const k of [1, 10, 100]) assert.ok(Math.abs(twoRateInWorld(k, 0, GAMMA) - 1) <= 1e-15);
  });
});

describe("T3 smuggling trials — the board rejects contraband by name", () => {
  it("SW1: naked stability without dynamics is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).dynamics = "miracle" as BoardRow["dynamics"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW1");
    assert.ok(hit, "expected an SW1 violation");
    assert.match(hit.detail, /marketing/);
  });

  it("SW2: an unwitnessed exactness is rejected as hearsay", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).witness = "W-∞";
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW2");
    assert.ok(hit, "expected an SW2 violation");
    assert.match(hit.detail, /hearsay/);
  });

  it("SW2: an illegal tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).exactness = "TRUST-ME" as BoardRow["exactness"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW2");
    assert.ok(hit, "expected an SW2 violation");
  });

  it("SW3: a quoted rate without its central bank is rejected", () => {
    const contraband = smuggle((rows) => {
      const at5 = rows.find((r) => r.id === "AT5") as WritableBoardRow;
      at5.anchors = ["vacuum-compiler", "depreciation-ledger"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW3");
    assert.ok(hit, "expected an SW3 violation");
    assert.match(hit.detail, /route-price/);
  });

  it("SW4: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).anchors = ["atlantis"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW4");
    assert.ok(hit, "expected an SW4 violation");
    assert.match(hit.detail, /atlantis/);
  });

  it("SW5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as WritableBoardRow).id = (rows[0] as BoardRow).id;
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW5");
    assert.ok(hit, "expected an SW5 violation");
  });

  it("SW6: a tariff row without its central bank is rejected", () => {
    const contraband = smuggle((rows) => {
      const at7 = rows.find((r) => r.id === "AT7") as WritableBoardRow;
      at7.anchors = ["vacuum-compiler", "depreciation-ledger"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW6");
    assert.ok(hit, "expected an SW6 violation");
    assert.match(hit.detail, /route-price/);
  });

  it("SW7: a counterfeit catalyst harvest beyond the bounded face is rejected", () => {
    // the smuggler claims one qubit catalyst recovers the full straddler bit
    // AND half the correlation term off a single shot — beyond log2(2) = 1
    const contraband = smuggle((rows) => {
      const at15 = rows.find((r) => r.id === "AT15") as WritableBoardRow;
      at15.claimedRecoveryBits = 1.5;
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW7");
    assert.ok(hit, "expected an SW7 violation");
    assert.match(hit.detail, /catalyst cap/);
  });

  it("SW7: an unbounded harvest claim with no declared catalyst is rejected", () => {
    const contraband = smuggle((rows) => {
      const at15 = rows.find((r) => r.id === "AT15") as WritableBoardRow;
      delete at15.catalystDim;
      delete at15.claimedRecoveryBits;
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW7");
    assert.ok(hit, "expected an SW7 violation");
    assert.match(hit.detail, /counterfeit/);
  });

  it("SW8: a fake multi-world absorption certificate (single geometric) is rejected", () => {
    // the smuggler prices the join leakage with the SINGLE-world closed form
    // (1-gamma)^k * leak0 — the union-with-intersection says otherwise
    const contraband = smuggle((rows) => {
      const at16 = rows.find((r) => r.id === "AT16") as WritableBoardRow;
      at16.joinCertificate = { a0: 0.5, b0: 0.5, c0: 0.5, k: 5, leak: Math.pow(1 - GAMMA, 5) * 0.5 };
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW8");
    assert.ok(hit, "expected an SW8 violation");
    assert.match(hit.detail, /union-with-intersection/);
  });

  it("SW8: a multi-world row without its certificate is rejected", () => {
    const contraband = smuggle((rows) => {
      const at16 = rows.find((r) => r.id === "AT16") as WritableBoardRow;
      delete at16.joinCertificate;
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW8");
    assert.ok(hit, "expected an SW8 violation");
    assert.match(hit.detail, /fake certificate/);
  });
});

describe("T4 the renderer refuses to print an illegal board", () => {
  it("the smuggled board fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      const at5 = rows.find((r) => r.id === "AT5") as WritableBoardRow;
      at5.anchors = [];
    });
    const violations = checkBoard(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[SW3\]/);
  });

  it("the entry guard: importing the renderer writes no report", async () => {
    const probe = resolve(process.cwd(), "out", "reports", "guard-probe-should-not-exist.md");
    await import("../src/experiments/render.js");
    assert.ok(!existsSync(probe), "importing the renderer must not execute the render");
  });
});

describe("T5 the sixty visit — the coherent face priced, the thermal reading shipped", () => {
  it("C_rel arithmetic: pure straddlers pay the full bit, unequal weights pay h2, diagonal pays 0", () => {
    const rng = makeRng(61);
    // equal-weight sector superposition (|0,a> + e^{i phi}|1,b>)/sqrt2: C_rel = 1 exactly
    for (let t = 0; t < 20; t++) {
      const phi = rng() * 2 * Math.PI;
      const a = randomStateVec(rng, 2);
      const b = randomStateVec(rng, 2);
      const ket = { n: 4, re: new Float64Array(4), im: new Float64Array(4) };
      for (let k = 0; k < 2; k++) {
        ket.re[k] = a.re[k]! / Math.SQRT2;
        ket.im[k] = a.im[k]! / Math.SQRT2;
        ket.re[2 + k] = (Math.cos(phi) * b.re[k]! - Math.sin(phi) * b.im[k]!) / Math.SQRT2;
        ket.im[2 + k] = (Math.cos(phi) * b.im[k]! + Math.sin(phi) * b.re[k]!) / Math.SQRT2;
      }
      assert.ok(Math.abs(coherenceBits(vecToRho(ket)) - 1) <= 1e-12, `equal-weight C_rel ${coherenceBits(vecToRho(ket))}`);
    }
    // unequal weights: C_rel = h2(|alpha|^2) exactly, whatever a and b
    for (const a2 of [0.05, 0.25, 0.5, 0.8]) {
      for (let t = 0; t < 8; t++) {
        const psi = vAdd(
          vScale(vKron(basisVec(2, 0), randomStateVec(rng, 2)), Math.sqrt(a2)),
          vScale(vKron(basisVec(2, 1), randomStateVec(rng, 2)), Math.sqrt(1 - a2)),
        );
        assert.ok(Math.abs(coherenceBits(vecToRho(psi)) - h2(a2)) <= 1e-12);
      }
    }
    // sector-diagonal states pay 0
    for (let t = 0; t < 15; t++) {
      assert.ok(Math.abs(coherenceBits(sectorDephase(vecToRho(randomStateVec(rng, 4))))) <= 1e-15);
    }
  });

  it("the incoherence probe separates: law Kraus 1, random unitaries 4", () => {
    for (const g of [0.1, GAMMA, 0.6]) {
      for (const k of lawKraus(g)) assert.ok(columnBasisSupport(k) <= 1);
    }
    const rng = makeRng(62);
    let worst = 0;
    for (let t = 0; t < 10; t++) worst = Math.max(worst, columnBasisSupport(randomUnitary(rng, 4)));
    assert.ok(worst >= 3, "a generic unitary must spread columns");
  });

  it("dephasing preserves <H> exactly — the free-energy identity's engine", () => {
    const rng = makeRng(63);
    const h = authoredHamiltonian(3.7);
    for (let t = 0; t < 40; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      assert.ok(Math.abs(diagonalExpectation(sectorDephase(rho), h) - diagonalExpectation(rho, h)) <= 1e-15);
    }
  });

  it("erasure is monotone along trajectories and complete at k=200", () => {
    const rng = makeRng(64);
    for (let t = 0; t < 25; t++) {
      const rho0 = vecToRho(randomStateVec(rng, 4));
      let prev = coherenceBits(rho0);
      let cur = rho0;
      for (let k = 0; k < 20; k++) {
        cur = applyLaw(cur, GAMMA);
        const now = coherenceBits(cur);
        assert.ok(now <= prev + 1e-12, "C_rel must not rise under the law");
        prev = now;
      }
      assert.ok(Math.abs(coherenceBits(iterateLaw(rho0, 200, GAMMA))) <= 1e-12);
    }
  });

  it("the coherent face settles at exactly twice the classical rate", () => {
    for (const g of [0.1, 0.25, 0.5, 0.75]) {
      assert.ok(Math.abs(populationDecayRate(g) / coherenceDecayRate(g) - 2) <= 1e-15);
    }
  });

  it("detailed balance: gamma/(gamma + gamma e^{-beta dE}) = 1/(1+e^{-beta dE}) exactly", () => {
    for (const beta of [0, 1, 2, 5, 10, 20, 40]) {
      for (const g of [0.1, GAMMA, 0.6]) {
        assert.ok(Math.abs(stationaryInWorld(thermalUpRate(beta, g), g) - boltzmannOccupancy(beta)) <= 1e-15);
      }
    }
    assert.ok(Math.abs(boltzmannOccupancy(0) - 0.5) <= 1e-16);
  });

  it("escape readings: closed form vs recursion, union bound, and the design rule", () => {
    for (const beta of [1, 5, 10, 20]) {
      const r = thermalUpRate(beta, GAMMA);
      for (const K of [1, 10, 100, 5000]) {
        assert.ok(Math.abs(escapeAtHorizon(K, r, GAMMA) - (1 - twoRateRecursion(K, r, GAMMA))) <= 1e-13);
        assert.ok(escapeAtHorizon(K, r, GAMMA) <= K * r * (1 + 1e-12), "union bound with thermal r");
      }
    }
    // the design rule: at beta dE = ln(K gamma/delta) escape <= delta
    for (const [K, delta] of [
      [1e2, 1e-6],
      [1e4, 1e-9],
      [1e6, 1e-9],
    ] as const) {
      const betaMin = escapeDesignRuleBeta(K, delta, GAMMA);
      assert.ok(escapeAtHorizon(K, thermalUpRate(betaMin, GAMMA), GAMMA) <= delta + 1e-15);
    }
  });

  it("physical anchors: exact SI arithmetic — kT table and the 5 GHz gap readings", () => {
    assert.ok(Math.abs(K_B * 0.01 - 1.380649e-25) <= 1e-40);
    assert.ok(Math.abs(H_PLANCK * 5e9 - 3.313035075e-24) <= 1e-38);
    const beta10mK = betaGapOfFrequency(5e9, 0.01);
    assert.ok(Math.abs(beta10mK - 23.9962) <= 5e-4);
    assert.ok(Math.abs(boltzmannOccupancy(beta10mK) - (1 - 3.79e-11)) <= 1e-11);
    const beta100mK = betaGapOfFrequency(5e9, 0.1);
    assert.ok(Math.abs(boltzmannOccupancy(beta100mK) - 0.916798439233) <= 1e-11);
    // every temperature decade costs exactly ln 10 in beta dE
    for (const T of [0.01, 0.1, 1, 10]) {
      assert.ok(Math.abs(betaGapOfFrequency(5e9, 10 * T) - betaGapOfFrequency(5e9, T) / 10) <= 1e-12);
    }
  });
});

describe("T6 the sixty-first visit — the microscopic bath derived, the coherent shortcut banked", () => {
  it("the exchange unitary is unitary and energy-conserving exactly", () => {
    for (const th of [0.3, 0.7, Math.asin(Math.sqrt(GAMMA)), Math.PI / 2]) {
      const u = exchangeUnitary(th);
      assert.ok(matEq(mMul(mDagger(u), u), identity(8), 1e-14));
    }
    const u = exchangeUnitary(0.7);
    const hS = mat(4, 4);
    hS.re[0] = 3.3;
    hS.re[5] = 3.3;
    const hB = mat(2, 2);
    hB.re[0] = 3.3;
    const hTot = mAdd(kron(hS, identity(2)), kron(identity(4), hB));
    const comm = mAdd(mMul(hTot, u), mScale(mMul(u, hTot), -1));
    let worst = 0;
    for (let i = 0; i < 64; i++) worst = Math.max(worst, Math.abs(comm.re[i]!), Math.abs(comm.im[i]!));
    assert.ok(worst <= 1e-15, `[U, H_tot] norm ${worst}`);
  });

  it("detailed balance emerges: r~/g~ = e^{-beta dE} whatever theta; populations = the two-rate chain", () => {
    const rng = makeRng(71);
    for (const beta of [0, 1, 3, 10, 30]) {
      for (const th of [0.3, Math.asin(Math.sqrt(GAMMA)), 1.0]) {
        const rates = collisionRates(th, beta);
        assert.ok(Math.abs(rates.outOf / rates.into - Math.exp(-beta)) <= 1e-15);
        for (let t = 0; t < 8; t++) {
          const rho = vecToRho(randomStateVec(rng, 4));
          const p = membershipCharge(rho);
          const pAfter = membershipCharge(applyCollision(rho, th, beta));
          assert.ok(Math.abs(pAfter - (p * (1 - rates.outOf) + (1 - p) * rates.into)) <= 1e-15);
        }
      }
    }
  });

  it("the stationary register is Gibbs-world x cargo; the law IS the T=0 collision", () => {
    const rng = makeRng(72);
    const th = Math.asin(Math.sqrt(GAMMA));
    for (const beta of [1, 3, 10]) {
      for (let t = 0; t < 5; t++) {
        const cargo = vecToRho(randomStateVec(rng, 2));
        const comp = mat(2, 2);
        comp.re[0] = 1;
        let rho = kron(comp, cargo);
        for (let k = 0; k < 400; k++) rho = applyCollision(rho, th, beta);
        assert.ok(Math.abs(membershipCharge(rho) - boltzmannOccupancy(beta)) <= 1e-12);
        assert.ok(traceDistance(rho, kron(bathGibbs(beta), cargo)) <= 1e-12);
      }
    }
    for (let t = 0; t < 10; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      assert.ok(traceDistance(applyCollision(rho, th, 30), applyLaw(rho, GAMMA)) <= 1e-13);
      assert.ok(traceDistance(applyCollision(rho, th, 40), applyLaw(rho, GAMMA)) <= 1e-16);
    }
  });

  it("the coherence factor is temperature-free: sector coherence decays at cos(theta)", () => {
    const rng = makeRng(73);
    for (const beta of [0, 1, 3, 10, 30]) {
      for (const angle of [0.4, 0.9]) {
        const phi = rng() * 2 * Math.PI;
        const w = vec(2);
        w.re[0] = 1 / Math.SQRT2;
        w.re[1] = Math.cos(phi) / Math.SQRT2;
        w.im[1] = Math.sin(phi) / Math.SQRT2;
        const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
        const c0 = sectorCoherence(rho);
        const c1 = sectorCoherence(applyCollision(rho, angle, beta));
        const f = Math.hypot(c1.re, c1.im) / Math.hypot(c0.re, c0.im);
        assert.ok(Math.abs(f - Math.cos(angle)) <= 1e-14, `beta=${beta} angle=${angle}: f=${f}`);
      }
    }
  });

  it("the coherent shortcut: one-step collapse, coherence conserved, the straddler's bit banked", () => {
    const rng = makeRng(74);
    let worstCollapse = 0;
    let worstConserved = 0;
    for (let t = 0; t < 20; t++) {
      const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorDephase(vecToRho(randomStateVec(rng, 4)));
      const sc = coherentShortcut(rho);
      worstCollapse = Math.max(worstCollapse, traceDistance(sc.register, collapseIntoWorld(rho)));
      const ground = mat(2, 2);
      ground.re[3] = 1;
      worstConserved = Math.max(worstConserved, Math.abs(totalCoherenceBits(sc.total) - totalCoherenceBits(kron(rho, ground))));
    }
    assert.ok(worstCollapse <= 1e-14);
    assert.ok(worstConserved <= 1e-13);
    let worstPurity = 0;
    let worstBanked = 0;
    for (let t = 0; t < 10; t++) {
      const phi = rng() * 2 * Math.PI;
      const w = vec(2);
      w.re[0] = 1 / Math.SQRT2;
      w.re[1] = Math.cos(phi) / Math.SQRT2;
      w.im[1] = Math.sin(phi) / Math.SQRT2;
      const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
      const sc = coherentShortcut(rho);
      worstPurity = Math.max(worstPurity, vonNeumannEntropy(sc.weight));
      worstBanked = Math.max(worstBanked, Math.abs(totalCoherenceBits(sc.weight) - 1));
    }
    assert.ok(worstPurity <= 1e-12, "the weight receives a pure straddler");
    assert.ok(worstBanked <= 1e-12, "the full sector bit is banked on the weight");
  });
});

describe("T7 the sixty-second visit — the continuum limit executed, the audit ledger closed", () => {
  it("finite coupling is exact: populations with no higher corrections, blocks follow the 2x2 closed form", () => {
    const rng = makeRng(81);
    const s2 = (th: number) => Math.sin(th) ** 2;
    for (const beta of [0, 1, 3, 10]) {
      const pB = 1 / (1 + Math.exp(-beta));
      for (const th of [0.5, 0.25]) {
        for (let t = 0; t < 6; t++) {
          const rho = vecToRho(randomStateVec(rng, 4));
          const p = membershipCharge(rho);
          assert.ok(Math.abs(membershipCharge(applyCollision(rho, th, beta)) - (p + s2(th) * (pB - p))) <= 1e-15);
        }
        const rho = vecToRho(randomStateVec(rng, 4));
        const ss0 = rho.re[1]!;
        const ww0 = rho.re[2 * 4 + 3]!;
        let cur = rho;
        for (let n = 1; n <= 6; n++) {
          cur = applyCollision(cur, th, beta);
          const exp = collisionBlockMixing(n, th, beta, ss0, ww0);
          assert.ok(Math.abs(cur.re[1]! - exp.ss) <= 1e-15);
          assert.ok(Math.abs(cur.re[2 * 4 + 3]! - exp.ww) <= 1e-15);
          assert.ok(Math.abs(cur.re[1]! + cur.re[2 * 4 + 3]! - (ss0 + ww0)) <= 1e-15, "coherence total conserved");
        }
      }
    }
  });

  it("the composition limit: error O(t s^2) — halving theta quarters it", () => {
    const rng = makeRng(82);
    const beta = 3;
    const pB = 1 / (1 + Math.exp(-beta));
    const errs: number[] = [];
    for (const th of [0.2, 0.1]) {
      const t = 1;
      const n = Math.round(t / Math.sin(th) ** 2);
      let worst = 0;
      for (let trial = 0; trial < 5; trial++) {
        const phi = rng() * 2 * Math.PI;
        const w = vec(2);
        w.re[0] = 1 / Math.SQRT2;
        w.re[1] = Math.cos(phi) / Math.SQRT2;
        w.im[1] = Math.sin(phi) / Math.SQRT2;
        const rho = vecToRho(vKron(w, randomStateVec(rng, 2)));
        let cur = rho;
        for (let k = 0; k < n; k++) cur = applyCollision(cur, th, beta);
        worst = Math.max(worst, Math.abs(membershipCharge(cur) - (pB + Math.exp(-t) * (membershipCharge(rho) - pB))));
        worst = Math.max(worst, Math.abs(sectorCoherence(cur).re - Math.exp(-t / 2) * sectorCoherence(rho).re));
      }
      errs.push(worst);
    }
    assert.ok(errs[0]! <= 5e-3 && errs[0]! > 1e-4, `sanity on magnitude (${errs[0]})`);
    const ratio = errs[0]! / errs[1]!;
    assert.ok(ratio >= 3.5 && ratio <= 4.5, `ratio ${ratio}`);
  });

  it("the Davies rate: (cos th - 1)/s^2 -> -1/2 at O(th^2), and 1/2 = (p_b + q_b)/2 exactly", () => {
    for (const th of [0.4, 0.2, 0.1, 0.05]) {
      const rate = (Math.cos(th) - 1) / Math.sin(th) ** 2;
      assert.ok(Math.abs(rate + 0.5) <= 0.14 * th * th);
    }
    for (const beta of [0, 1, 5, 40]) {
      const pB = 1 / (1 + Math.exp(-beta));
      assert.ok(Math.abs(0.5 - (pB + (1 - pB)) / 2) <= 1e-16);
    }
  });

  it("the audit ledger: three-term identity, nonnegativity, and the exact reversal", () => {
    const rng = makeRng(83);
    const ground = mat(2, 2);
    ground.re[3] = 1;
    const vDag = mDagger(exchangeUnitary(Math.PI / 2));
    let worstIdentity = 0;
    let worstNeg = 0;
    let worstReverse = 0;
    for (let t = 0; t < 15; t++) {
      const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorDephase(vecToRho(randomStateVec(rng, 4)));
      const sc = coherentShortcut(rho);
      const c8 = totalCoherenceBits(sc.total);
      const c4 = totalCoherenceBits(sc.register);
      const c2 = totalCoherenceBits(sc.weight);
      const d4 = mat(4, 4);
      for (let i = 0; i < 4; i++) d4.re[i * 4 + i] = sc.register.re[i * 4 + i]!;
      const d2 = mat(2, 2);
      d2.re[0] = sc.weight.re[0]!;
      d2.re[3] = sc.weight.re[3]!;
      const d8 = mat(8, 8);
      for (let i = 0; i < 8; i++) d8.re[i * 8 + i] = sc.total.re[i * 8 + i]!;
      const mutual = vonNeumannEntropy(sc.register) + vonNeumannEntropy(sc.weight) - vonNeumannEntropy(sc.total);
      const classical = vonNeumannEntropy(d4) + vonNeumannEntropy(d2) - vonNeumannEntropy(d8);
      worstIdentity = Math.max(worstIdentity, Math.abs(c8 - c4 - c2 - (mutual - classical)));
      worstNeg = Math.max(worstNeg, -(mutual - classical), -c2);
      worstReverse = Math.max(worstReverse, traceDistance(applyUnitary(sc.total, vDag), kron(rho, ground)));
    }
    assert.ok(worstIdentity <= 1e-14);
    assert.ok(worstNeg <= 0, "every term is nonnegative");
    assert.ok(worstReverse <= 1e-14, "the inverse permutation restores the input");
  });

  it("the extraction converges to the Lindblad operator at O(theta^2)", () => {
    const rng = makeRng(84);
    for (const beta of [0, 1, 3, 10]) {
      const pB = 1 / (1 + Math.exp(-beta));
      for (const th of [0.2, 0.1]) {
        for (let t = 0; t < 5; t++) {
          const rho = vecToRho(randomStateVec(rng, 4));
          const ext = extractedGenerator(rho, th, beta);
          const target = lindbladRhs(rho, pB, 1 - pB);
          let dev = 0;
          for (let i = 0; i < 16; i++) dev = Math.max(dev, Math.abs(ext.re[i]! - target.re[i]!));
          assert.ok(dev <= 0.06 * th * th, `beta=${beta} th=${th}: ${dev}`);
        }
      }
    }
  });

  it("the phase-alignment bank: the l1 optimum is attained exactly; straddlers are a no-op", () => {
    const rng = makeRng(85);
    let worstAlign = 0;
    let worstMonotone = 0;
    for (let t = 0; t < 15; t++) {
      const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : sectorDephase(vecToRho(randomStateVec(rng, 4)));
      const bank = alignedBank(coherentShortcut(rho).total);
      worstAlign = Math.max(worstAlign, Math.abs(bank.aligned - bank.l1));
      worstMonotone = Math.max(worstMonotone, bank.naive - bank.l1);
    }
    assert.ok(worstAlign <= 1e-14, "alignment attains the l1 optimum");
    assert.ok(worstMonotone <= 1e-15, "naive <= l1 always");
    let worstNoop = 0;
    for (let t = 0; t < 8; t++) {
      const phi = rng() * 2 * Math.PI;
      const w = vec(2);
      w.re[0] = 1 / Math.SQRT2;
      w.re[1] = Math.cos(phi) / Math.SQRT2;
      w.im[1] = Math.sin(phi) / Math.SQRT2;
      const bank = alignedBank(coherentShortcut(vecToRho(vKron(w, randomStateVec(rng, 2)))).total);
      worstNoop = Math.max(worstNoop, Math.abs(bank.aligned - bank.naive));
    }
    assert.ok(worstNoop <= 1e-14, "straddlers need no alignment");
  });
});

describe("T8 the sixty-fourth visit — the holder's bounded catalyst", () => {
  it("the Schmidt memory is honest: diagonal marginal, spectrum = the input's, rank = the state's", () => {
    const rng = makeRng(91);
    const rank = (rho: ReturnType<typeof vecToRho>): number => {
      let r = 0;
      for (const l of eigHermitian(rho).values) if (l > 1e-12) r++;
      return r;
    };
    const cases: Array<{ rho: ReturnType<typeof vecToRho>; mDim: number }> = [
      { rho: vecToRho(randomStateVec(rng, 4)), mDim: 1 }, // pure: trivial record
      { rho: maximallyMixed(4), mDim: 4 },
      { rho: sectorDephase(vecToRho(randomStateVec(rng, 4))), mDim: 2 },
    ];
    for (let t = 0; t < 6; t++) {
      const rho = iterateLaw(vecToRho(randomStateVec(rng, 4)), (t % 4) + 1, GAMMA);
      cases.push({ rho, mDim: rank(rho) }); // the law's trajectory rank, whatever it is
    }
    for (const { rho, mDim } of cases) {
      const { joint, mDim: got } = schmidtPurification(rho);
      assert.ok(got === mDim, `rank ${got}, expected ${mDim}`);
      const mem = partialTrace(joint, [4, got], [0]);
      for (let i = 0; i < got; i++) {
        for (let j = 0; j < got; j++) {
          if (i === j) continue;
          assert.ok(Math.abs(mem.re[i * got + j]!) <= 1e-12, "the Schmidt marginal is diagonal");
        }
      }
      assert.ok(Math.abs(vonNeumannEntropy(mem) - vonNeumannEntropy(rho)) <= 1e-9, "the memory's spectrum is the input's");
    }
  });

  it("the riding identity: the memory changes nothing on register x weight, and R0/R1 are AT14's banks", () => {
    const rng = makeRng(92);
    let worstRide = 0;
    let worstAlign = 0;
    let worstNaive = 0;
    for (let t = 0; t < 15; t++) {
      const rho = t % 2 === 0 ? vecToRho(randomStateVec(rng, 4)) : iterateLaw(vecToRho(randomStateVec(rng, 4)), t % 4 + 1, GAMMA);
      worstRide = Math.max(worstRide, traceDistance(holderJoint(rho).register, coherentShortcut(rho).register));
      const bank = alignedBank(coherentShortcut(rho).total);
      const rungs = holderHarvest(rho);
      worstAlign = Math.max(worstAlign, Math.abs(rungs.aligned - bank.l1));
      worstNaive = Math.max(worstNaive, Math.abs(rungs.naive - bank.naive));
    }
    assert.ok(worstRide <= 1e-13);
    assert.ok(worstAlign <= 1e-13, "rung R1 is AT14's l1 optimum");
    assert.ok(worstNaive <= 1e-13, "rung R0 is AT14's naive bank");
  });

  it("the nested triangle ladder: naive <= aligned <= conditional, with a real unlock on mixed states", () => {
    const rng = makeRng(93);
    let worstViolation = 0;
    let maxUnlock2 = 0;
    let pureUnlock = 0;
    for (let t = 0; t < 30; t++) {
      const rho = iterateLaw(vecToRho(randomStateVec(rng, 4)), (t % 5) + 1, GAMMA);
      const rungs = holderHarvest(rho);
      worstViolation = Math.max(worstViolation, rungs.naive - rungs.aligned, rungs.aligned - rungs.conditional);
      maxUnlock2 = Math.max(maxUnlock2, rungs.conditional - rungs.aligned);
    }
    for (let t = 0; t < 10; t++) {
      const rungs = holderHarvest(vecToRho(randomStateVec(rng, 4)));
      pureUnlock = Math.max(pureUnlock, rungs.conditional - rungs.aligned);
    }
    assert.ok(worstViolation <= 1e-12, "the ladder never inverts");
    assert.ok(maxUnlock2 > 1e-2, `the record unlocks beyond alignment (max ${maxUnlock2})`);
    assert.ok(pureUnlock <= 1e-12, "pure starts carry a trivial record — the unlock needs the law's mixing first");
  });

  it("the bit ladder rides C_rel convexity; the catalyst cap log2 d holds and is tight on straddlers", () => {
    const rng = makeRng(94);
    let worstConvex = 0;
    let maxBitBoost = 0;
    let worstCap = 0;
    for (let t = 0; t < 25; t++) {
      const rungs = holderHarvest(iterateLaw(vecToRho(randomStateVec(rng, 4)), (t % 4) + 1, GAMMA));
      worstConvex = Math.max(worstConvex, rungs.bitsUnconditional - rungs.bitsConditional);
      maxBitBoost = Math.max(maxBitBoost, rungs.bitsConditional - rungs.bitsUnconditional);
      worstCap = Math.max(worstCap, rungs.bitsConditional - catalystCap(2));
    }
    assert.ok(worstConvex <= 1e-9, "sum_m p_m C_rel(cond) >= C_rel(marginal) — the convexity ladder");
    assert.ok(maxBitBoost > 1e-2, `the record unlocks bits (max ${maxBitBoost})`);
    assert.ok(worstCap <= 1e-9, "no 2-dimensional bank exceeds 1 bit");
    assert.ok(Math.abs(catalystCap(2) - 1) <= 1e-15 && Math.abs(catalystCap(4) - 2) <= 1e-15);
    // tightness: the straddler banks the FULL bit on the 2-dimensional weight
    let worstTight = 0;
    for (let t = 0; t < 8; t++) {
      const phi = rng() * 2 * Math.PI;
      const w = vec(2);
      w.re[0] = 1 / Math.SQRT2;
      w.re[1] = Math.cos(phi) / Math.SQRT2;
      w.im[1] = Math.sin(phi) / Math.SQRT2;
      const rungs = holderHarvest(vecToRho(vKron(w, randomStateVec(rng, 2))));
      worstTight = Math.max(worstTight, Math.abs(rungs.bitsConditional - 1), rungs.mDim === 1 ? 0 : 1);
    }
    assert.ok(worstTight <= 1e-12, "the cap is attained: the straddler's full bit on a qubit catalyst");
  });
});

describe("T9 the second world — one law, two marked worlds", () => {
  it("the two-world law is CPTP and quiet on the join world", () => {
    let completeness = mat(8, 8);
    for (const k of twoWorldLawKraus(GAMMA)) completeness = mAdd(completeness, mMul(mDagger(k), k));
    assert.ok(matEq(completeness, identity(8), 1e-14));
    const rng = makeRng(95);
    const p1 = basisVec(2, 1);
    for (let t = 0; t < 12; t++) {
      const rho = vecToRho(vKron(vKron(p1, p1), randomStateVec(rng, 2)));
      const out = applyTwoWorldLaw(rho, GAMMA);
      assert.ok(traceDistance(out, rho) <= 1e-15, "both-in-world states are fixed");
    }
  });

  it("single-world faces keep exact geometrics on entangled starts, with the same increment identity", () => {
    const rng = makeRng(96);
    const ghz = vec(4);
    ghz.re[0] = 1 / Math.SQRT2;
    ghz.re[3] = 1 / Math.SQRT2;
    const anti = vec(4);
    anti.re[1] = 1 / Math.SQRT2;
    anti.re[2] = 1 / Math.SQRT2;
    const starts = [
      vecToRho(vKron(ghz, randomStateVec(rng, 2))),
      vecToRho(vKron(anti, randomStateVec(rng, 2))),
      vecToRho(randomStateVec(rng, 8)),
    ];
    let worstLeak = 0;
    let worstInc = 0;
    for (const rho of starts) {
      const a0 = 1 - chargeA(rho);
      const b0 = 1 - chargeB(rho);
      for (const k of [1, 5, 20]) {
        const cur = iterateTwoWorldLaw(rho, k, GAMMA);
        worstLeak = Math.max(worstLeak, Math.abs(1 - chargeA(cur) - singleWorldLeak(k, a0, GAMMA)));
        worstLeak = Math.max(worstLeak, Math.abs(1 - chargeB(cur) - singleWorldLeak(k, b0, GAMMA)));
      }
      const cur1 = applyTwoWorldLaw(rho, GAMMA);
      worstInc = Math.max(worstInc, Math.abs(chargeA(cur1) - (chargeA(rho) + GAMMA * (1 - chargeA(rho)))));
      worstInc = Math.max(worstInc, Math.abs(chargeB(cur1) - (chargeB(rho) + GAMMA * (1 - chargeB(rho)))));
    }
    assert.ok(worstLeak <= 1e-14, `single-world geometrics exact (${worstLeak})`);
    assert.ok(worstInc <= 1e-15, `increment identity dV = gamma(1-V) (${worstInc})`);
  });

  it("the join leakage is the exact union-with-intersection and never a single geometric when c0 > 0", () => {
    const rng = makeRng(97);
    const ghz = vec(4);
    ghz.re[0] = 1 / Math.SQRT2;
    ghz.re[3] = 1 / Math.SQRT2;
    const rho = vecToRho(vKron(ghz, randomStateVec(rng, 2))); // a0 = b0 = c0 = 1/2
    const a0 = 1 - chargeA(rho);
    const b0 = 1 - chargeB(rho);
    const c0 = bothOutside(rho);
    assert.ok(Math.abs(a0 - 0.5) <= 1e-15 && Math.abs(b0 - 0.5) <= 1e-15 && Math.abs(c0 - 0.5) <= 1e-15);
    let worst = 0;
    for (const k of [1, 2, 7, 30]) {
      worst = Math.max(worst, Math.abs(1 - joinCharge(iterateTwoWorldLaw(rho, k, GAMMA)) - joinLeakage(k, a0, b0, c0, GAMMA)));
    }
    assert.ok(worst <= 1e-14, `the join closed form is exact (${worst})`);
    // NOT a single geometric: joinLeak(k)/(1-gamma)^k = a0 + b0 - c0(1-gamma)^k drifts upward
    const face1 = joinLeakage(1, a0, b0, c0, GAMMA) / Math.pow(1 - GAMMA, 1);
    const face10 = joinLeakage(10, a0, b0, c0, GAMMA) / Math.pow(1 - GAMMA, 10);
    assert.ok(face10 - face1 > 1e-2, "the normalized join face drifts — no single geometric fits");
    // and the trivial case is the ONLY geometric one: a0 = b0 = 0 stays at 0
    assert.ok(Math.abs(joinLeakage(15, 0, 0, 0, GAMMA)) <= 1e-15);
  });

  it("escape impossible: charges monotone; join-block conservation splits by world", () => {
    const rng = makeRng(98);
    const ghz = vec(4);
    ghz.re[0] = 1 / Math.SQRT2;
    ghz.re[3] = 1 / Math.SQRT2;
    const rho = vecToRho(vKron(ghz, randomStateVec(rng, 2)));
    let cur = rho;
    let worstDrop = 0;
    for (let k = 0; k < 15; k++) {
      const a = chargeA(cur);
      const b = chargeB(cur);
      const j = joinCharge(cur);
      cur = applyTwoWorldLaw(cur, GAMMA);
      worstDrop = Math.max(worstDrop, a - chargeA(cur), b - chargeB(cur), j - joinCharge(cur));
    }
    assert.ok(worstDrop >= -1.5e-15, "all charges monotone");
    assert.ok(1 - joinCharge(iterateTwoWorldLaw(rho, 200, GAMMA)) <= 1e-12, "the join leak dies");
    // a join-block unitary (its own cargo unitary per (w1,w2) block) conserves all three charges
    let u = mat(8, 8);
    for (let block = 0; block < 4; block++) {
      const p = mat(4, 4);
      p.re[block * 4 + block] = 1;
      u = mAdd(u, kron(p, randomUnitary(rng, 2)));
    }
    const oj = applyUnitary(rho, u);
    assert.ok(Math.abs(chargeA(oj) - chargeA(rho)) <= 1.5e-15);
    assert.ok(Math.abs(chargeB(oj) - chargeB(rho)) <= 1.5e-15);
    assert.ok(Math.abs(joinCharge(oj) - joinCharge(rho)) <= 1.5e-15);
    // a one-bit-block unitary conserves ONLY its own world's charge
    const p1w = mat(2, 2);
    p1w.re[3] = 1;
    const p0w = mat(2, 2);
    p0w.re[0] = 1;
    const ua = mAdd(kron(p1w, randomUnitary(rng, 4)), kron(p0w, randomUnitary(rng, 4)));
    const oa = applyUnitary(rho, ua);
    assert.ok(Math.abs(chargeA(oa) - chargeA(rho)) <= 1.5e-15, "world A's charge conserved");
    assert.ok(Math.abs(chargeB(oa) - chargeB(rho)) > 0.1, "world B's charge moves — one world's symmetry is not the other's");
  });
});

describe("T10 the accumulated law-error — time-dependent eps_t", () => {
  it("constant eps reproduces AT4's bound; the contraction to the fixed point is exact", () => {
    for (const eps of [0.002, 0.01, 0.05, 0.1]) {
      const seq = new Array<number>(500).fill(eps);
      assert.ok(Math.abs(accumulatedLeakageBound(seq, 1, GAMMA) - perturbedLeakageBound(eps, GAMMA)) <= 1e-9);
      const fp = perturbedLeakageBound(eps, GAMMA);
      let b = 1;
      for (let t = 0; t < 6; t++) {
        const prev = Math.abs(b - fp);
        b = accumulatedLeakageBound([eps], b, GAMMA);
        assert.ok(Math.abs(Math.abs(b - fp) - (1 - eps) * (1 - GAMMA) * prev) <= 1e-15);
      }
    }
  });

  it("the census: random eps_t with FRESH channels every step stays under the recursion bound", () => {
    const rng = makeRng(99);
    let worstExcess = 0;
    for (let trial = 0; trial < 6; trial++) {
      const epsSeq: number[] = [];
      for (let t = 0; t < 200; t++) epsSeq.push(0.002 + 0.098 * rng());
      for (const rho0 of [vecToRho(randomStateVec(rng, 4)), outOfWorldState(vecToRho(randomStateVec(rng, 2)))]) {
        const leak0 = leakage(rho0);
        let cur = rho0;
        for (const eps of epsSeq) cur = applyPerturbed(cur, randomCptpKraus(rng, 4, 2), eps, GAMMA);
        worstExcess = Math.max(worstExcess, leakage(cur) - accumulatedLeakageBound(epsSeq, leak0, GAMMA));
      }
    }
    assert.ok(worstExcess <= 1e-12, `worst excess ${worstExcess}`);
  });

  it("an error schedule beats constant worst-case eps: exact arithmetic", () => {
    const alternating = Array.from({ length: 300 }, (_, i) => (i % 2 === 0 ? 0.1 : 0.002));
    const constant = new Array<number>(300).fill(0.1);
    const alt = accumulatedLeakageBound(alternating, 1, GAMMA);
    const con = accumulatedLeakageBound(constant, 1, GAMMA);
    assert.ok(alt < 0.51 * con, `alternating ${alt} vs constant ${con}`);
    assert.ok(Math.abs(con - perturbedLeakageBound(0.1, GAMMA)) <= 1e-9);
  });
});

describe("T11 the code-quality wave — kernel boundaries, single sources, honest books", () => {
  it("the kernel boundary refuses illegal gamma by name (no silent NaN channels)", () => {
    for (const bad of [2, -0.1, Number.NaN]) {
      assert.throws(
        () => lawKraus(bad),
        (err: unknown) => err instanceof DomainError && err.code === "worldKrausPair:gamma-range",
        `lawKraus(${bad}) must refuse by name`,
      );
      assert.throws(() => twoWorldLawKraus(bad), /gamma must lie in \[0,1\]/, `twoWorldLawKraus(${bad}) must refuse`);
      assert.throws(() => applyLaw(maximallyMixed(4), bad), /gamma must lie in \[0,1\]/);
    }
    // the boundary values are LEGAL channels: 0 (do-nothing) and 1 (full damping)
    for (const g of [0, 1]) {
      let completeness = mat(4, 4);
      for (const k of lawKraus(g)) completeness = mAdd(completeness, mMul(mDagger(k), k));
      assert.ok(matEq(completeness, identity(4), 1e-14), `gamma=${g} must stay CPTP`);
      let completeness8 = mat(8, 8);
      for (const k of twoWorldLawKraus(g)) completeness8 = mAdd(completeness8, mMul(mDagger(k), k));
      assert.ok(matEq(completeness8, identity(8), 1e-14), `two-world gamma=${g} must stay CPTP`);
    }
  });

  it("perturbation weights and escape pricers reject out-of-range inputs by name", () => {
    const rho = maximallyMixed(4);
    for (const badEps of [1.5, -0.01]) {
      assert.throws(() => applyPerturbed(rho, lawKraus(GAMMA), badEps), /eps must lie in \[0,1\)/);
      assert.throws(() => perturbedLeakageBound(badEps), /eps must lie in \[0,1\)/);
      assert.throws(() => accumulatedLeakageBound([badEps], 1, GAMMA), /eps must lie in \[0,1\)/);
    }
    assert.throws(() => escapeAtHorizon(-1, 0.1), /non-negative integer/);
    assert.throws(() => escapeAtHorizon(2.5, 0.1), /non-negative integer/);
    assert.throws(() => escapeAtHorizon(10, -0.2), /rate must be >= 0/);
    assert.throws(() => twoRateRecursion(1.5, 0.1), /non-negative integer/);
    assert.throws(() => twoRateInWorld(10, Number.NaN), /rate must be >= 0/);
    assert.throws(() => escapeDesignRuleBeta(1e6, -1), /must be positive/);
    assert.throws(() => singleWorldLeak(-2, 0.5), /non-negative integer/);
  });

  it("every kernel refusal is a DomainError with a stable greppable code", () => {
    const cases: Array<{ fire: () => void; code: string }> = [
      { fire: () => lawKraus(Number.NaN), code: "worldKrausPair:gamma-range" },
      { fire: () => mMul(mat(2, 2), mat(3, 3)), code: "mMul:shape" },
      {
        fire: () => partialTrace(mat(2, 2), [2, 2], [5]),
        code: "partialTrace:index",
      },
      {
        fire: () => filterBasisDigit(mat(4, 4), [2, 2], 0, 7),
        code: "filterBasisDigit:digit",
      },
      { fire: () => catalystCap(0), code: "catalystCap:dim-range" },
    ];
    for (const { fire, code } of cases) {
      assert.throws(
        fire,
        (err: unknown) => err instanceof DomainError && err.code === code && err.name === "DomainError",
        `expected a DomainError with code ${code}`,
      );
    }
  });

  it("lawKraus is the single-sourced world pair: an independent hand build matches bit-exactly", () => {
    // the dual-check discipline: rebuild the Kraus pair from scratch and
    // demand ZERO tolerance — the merge must be bit-isomorphic
    for (const g of [0, 0.25, 0.7, 1]) {
      const k0w = mat(2, 2);
      k0w.re[0 * 2 + 0] = Math.sqrt(1 - g);
      k0w.re[1 * 2 + 1] = 1;
      const k1w = mat(2, 2);
      k1w.re[1 * 2 + 0] = Math.sqrt(g);
      const pair = lawKraus(g);
      assert.ok(matEq(pair[0]!, kron(k0w, identity(2)), 0), `K0 bit-exact at gamma=${g}`);
      assert.ok(matEq(pair[1]!, kron(k1w, identity(2)), 0), `K1 bit-exact at gamma=${g}`);
    }
  });

  it("the logistic single source: boltzmannOccupancy is the block-mixing pB, bit for bit", () => {
    for (const b of [0, 1, 3, 10, 40, -2, 23.9962]) {
      assert.ok(boltzmannOccupancy(b) === 1 / (1 + Math.exp(-b)), `bit drift at betaGap=${b}`);
    }
    // and the merged closed form still tracks the machine trajectory exactly
    const rng = makeRng(111);
    for (const beta of [1, 5]) {
      for (const th of [0.6, 0.3]) {
        const rho = vecToRho(randomStateVec(rng, 4));
        const ss0 = rho.re[1]!;
        const ww0 = rho.re[2 * 4 + 3]!;
        let cur = rho;
        for (let n = 1; n <= 5; n++) {
          cur = applyCollision(cur, th, beta);
          const exp = collisionBlockMixing(n, th, beta, ss0, ww0);
          assert.ok(Math.abs(cur.re[1]! - exp.ss) <= 1e-15);
          assert.ok(Math.abs(cur.re[2 * 4 + 3]! - exp.ww) <= 1e-15);
        }
      }
    }
  });

  it("the books agree: package.json and package-lock.json carry one version", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      version: string;
      name: string;
    };
    const lock = JSON.parse(readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8")) as {
      version?: string;
      name?: string;
      packages?: Record<string, { version?: string }>;
    };
    assert.ok(typeof lock.version === "string" && lock.version === pkg.version, `lock root version ${String(lock.version)} != package.json ${pkg.version}`);
    const self = lock.packages?.[""]?.version;
    assert.ok(self === pkg.version, `lock self version ${String(self)} != package.json ${pkg.version}`);
  });

  it("the seeded RNG is bit-reproducible across instances, normals included", () => {
    const a = makeRng(4242);
    const b = makeRng(4242);
    for (let i = 0; i < 50; i++) assert.ok(a() === b(), `uniform stream drifted at ${i}`);
    for (let i = 0; i < 20; i++) assert.ok(a.normal() === b.normal(), `normal stream drifted at ${i}`);
    assert.ok(typeof a.normal() === "number");
  });
});

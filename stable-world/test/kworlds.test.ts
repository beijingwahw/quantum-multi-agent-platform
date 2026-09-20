import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeRng } from "../src/core/rng.js";
import { randomStateVec, vecToRho } from "../src/core/states.js";
import {
  basisVec,
  identity,
  mat,
  mAdd,
  mDagger,
  mMul,
  vKron,
  vec,
} from "../src/core/cmat.js";
import { DomainError } from "../src/core/errors.js";
import {
  GAMMA,
  iterateLaw,
  iterateTwoWorldLaw,
  joinCharge,
  joinLeakage,
  leakage,
} from "../src/kernel/law.js";
import {
  checkKWorldCertificate,
  iterateKWorldLaw,
  kWorldInclusionExclusion,
  kWorldJointLeakage,
  kWorldJoinCharge,
  kWorldKraus,
  kWorldKrausIdentity,
  kWorldOutsideMass,
  kWorldSectorMass,
  kWorldSectorMassTable,
  singleGeometricCounterfeitDrift,
  witnessKWorlds,
} from "../src/kernel/kworlds.js";

describe("T12 the k-world inclusion–exclusion — one law, k marked worlds", () => {
  it("the k-world law IS the family's law: bit-exact at k=1 (lawKraus) and k=2 (twoWorldLawKraus), CPTP at k=3", () => {
    assert.ok(
      kWorldKrausIdentity(1, GAMMA),
      "kWorldKraus(1) === lawKraus element for element",
    );
    assert.ok(
      kWorldKrausIdentity(2, GAMMA),
      "kWorldKraus(2) === twoWorldLawKraus element for element",
    );
    assert.ok(
      kWorldKrausIdentity(1, 0.6) && kWorldKrausIdentity(2, 0.6),
      "the identity holds at another gamma too",
    );
    assert.strictEqual(
      kWorldKraus(3, GAMMA).length,
      8,
      "eight Kraus operators at k=3",
    );
    // CPTP by hand (the witness also runs it; here it is the test's own hands)
    const d = 16;
    let acc = mat(d, d);
    for (const op of kWorldKraus(3, GAMMA))
      acc = mAdd(acc, mMul(mDagger(op), op));
    const eye = identity(d);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        assert.ok(
          Math.abs(acc.re[i * d + j]! - eye.re[i * d + j]!) <= 1e-14,
          "Sigma K-dagger K = I",
        );
      }
    }
  });

  it("k=1 reproduces AT2 and k=2 reproduces AT16 from the SAME sum", () => {
    const rng = makeRng(200);
    // k=1: the 2^1-term sum is AT2's single geometric, on the family register
    let worst1 = 0;
    for (let t = 0; t < 10; t++) {
      const rho = vecToRho(vKron(basisVec(2, 0), randomStateVec(rng, 2)));
      for (const k of [1, 5, 20]) {
        worst1 = Math.max(
          worst1,
          Math.abs(
            kWorldJointLeakage(rho, k, 1, GAMMA) -
              leakage(iterateLaw(rho, k, GAMMA)),
          ),
        );
      }
    }
    assert.ok(worst1 <= 1e-15, `k=1 is AT2's geometric (${worst1})`);
    // k=2: the 4-term sum is AT16's union-with-intersection, bit for bit
    const ghz2 = vec(4);
    ghz2.re[0] = 1 / Math.SQRT2;
    ghz2.re[3] = 1 / Math.SQRT2;
    let worst2 = 0;
    for (const rho of [
      vecToRho(vKron(ghz2, randomStateVec(rng, 2))),
      vecToRho(randomStateVec(rng, 8)),
    ]) {
      const table = kWorldSectorMassTable(rho, 2);
      const a0 = table[1]!;
      const b0 = table[2]!;
      const c0 = table[3]!;
      for (const k of [1, 7, 30]) {
        worst2 = Math.max(
          worst2,
          Math.abs(
            kWorldInclusionExclusion(k, table, GAMMA) -
              joinLeakage(k, a0, b0, c0, GAMMA),
          ),
          Math.abs(
            kWorldJointLeakage(rho, k, 2, GAMMA) -
              (1 - joinCharge(iterateTwoWorldLaw(rho, k, GAMMA))),
          ),
        );
      }
    }
    assert.ok(
      worst2 <= 1e-15,
      `k=2 is AT16's union-with-intersection (${worst2})`,
    );
  });

  it("the per-subset theorem q_S(t) = (1−γ)^{|S|t} c_S(0) and the joint inclusion–exclusion, k=3 entangled starts", () => {
    const rng = makeRng(201);
    const ghz3 = vec(8);
    ghz3.re[0] = 1 / Math.SQRT2;
    ghz3.re[7] = 1 / Math.SQRT2;
    const starts = [
      vecToRho(vKron(ghz3, randomStateVec(rng, 2))), // every c_S = 1/2
      vecToRho(randomStateVec(rng, 16)), // generic entangled
      vecToRho(
        vKron(
          vKron(vKron(basisVec(2, 0), basisVec(2, 0)), basisVec(2, 1)),
          randomStateVec(rng, 2),
        ),
      ),
    ];
    let worstSubset = 0;
    let worstJoint = 0;
    for (const rho of starts) {
      const table = kWorldSectorMassTable(rho, 3);
      for (let mask = 1; mask < 8; mask++) {
        for (const t of [1, 4, 15]) {
          const evolved = kWorldSectorMass(
            iterateKWorldLaw(rho, t, 3, GAMMA),
            mask,
            3,
          );
          worstSubset = Math.max(
            worstSubset,
            Math.abs(evolved - kWorldOutsideMass(t, table[mask]!, mask, GAMMA)),
          );
        }
      }
      for (const t of [1, 4, 15]) {
        worstJoint = Math.max(
          worstJoint,
          Math.abs(
            1 -
              kWorldJoinCharge(iterateKWorldLaw(rho, t, 3, GAMMA), 3) -
              kWorldJointLeakage(rho, t, 3, GAMMA),
          ),
        );
      }
    }
    assert.ok(
      worstSubset <= 1e-15,
      `all 7 nonempty subsets exact (${worstSubset})`,
    );
    assert.ok(
      worstJoint <= 1e-15,
      `the joint leak is the 8-term sum (${worstJoint})`,
    );
  });

  it("the census horizon k=4 (32-dim) and the any-k algebra anchor (no Kraus beyond it)", () => {
    const rng = makeRng(202);
    let worst4 = 0;
    for (let trial = 0; trial < 4; trial++) {
      const rho = vecToRho(randomStateVec(rng, 32));
      worst4 = Math.max(
        worst4,
        Math.abs(
          1 -
            kWorldJoinCharge(iterateKWorldLaw(rho, 6, 4, GAMMA), 4) -
            kWorldJointLeakage(rho, 6, 4, GAMMA),
        ),
      );
    }
    assert.ok(
      worst4 <= 1e-14,
      `k=4 closed form at the 32-dim census horizon (${worst4})`,
    );
    // c_S = 1/2 for every nonempty S collapses the sum to [1 − (1 − (1−γ)^t)^k]/2
    let worstAnyK = 0;
    for (let k = 5; k <= 12; k++) {
      const table = Array.from({ length: 2 ** k }, (_, i) =>
        i === 0 ? 1 : 0.5,
      );
      worstAnyK = Math.max(
        worstAnyK,
        Math.abs(
          kWorldInclusionExclusion(4, table, GAMMA) -
            (1 - Math.pow(1 - Math.pow(1 - GAMMA, 4), k)) / 2,
        ),
      );
    }
    assert.ok(
      worstAnyK <= 1e-13,
      `the closed form carries no dimension (${worstAnyK}, two Math.pow towers at k=12)`,
    );
  });

  it("smuggling trials — the single-geometric counterfeit and fake certificates are named, real ones pass", () => {
    const rng = makeRng(203);
    const ghz3 = vec(8);
    ghz3.re[0] = 1 / Math.SQRT2;
    ghz3.re[7] = 1 / Math.SQRT2;
    const ghz3Rho = vecToRho(vKron(ghz3, randomStateVec(rng, 2)));
    const table = kWorldSectorMassTable(ghz3Rho, 3);
    // SW8 generalized: pricing the k-world leak as ONE geometric drifts by O(1)
    const { drift, worstStep } = singleGeometricCounterfeitDrift(
      table,
      GAMMA,
      30,
    );
    assert.ok(
      drift > 0.1,
      `the counterfeit drifts (${drift} at t=${String(worstStep)})`,
    );
    // a true certificate passes clean
    const cert = {
      k: 3,
      gamma: GAMMA,
      steps: 5,
      cS0: table,
      leak: kWorldInclusionExclusion(5, table, GAMMA),
    };
    assert.deepStrictEqual(
      checkKWorldCertificate(cert),
      [],
      "the honest certificate has no violations",
    );
    // a nudged leak is named
    const nudged = checkKWorldCertificate({ ...cert, leak: cert.leak + 0.05 });
    assert.ok(
      nudged.some((v) => v.includes("fake multi-world absorption certificate")),
      `the nudged leak is named: ${nudged[0]}`,
    );
    // a table that is not a nested sector family is named: the SUPERSET mask 7
    // (⊇ every other mask) cannot carry more mass than its subsets
    const brokenTable = table.slice();
    brokenTable[7] = 0.9; // c_{123} > c_{1} = 0.5 — no state has this family
    const nested = checkKWorldCertificate({ ...cert, cS0: brokenTable });
    assert.ok(
      nested.some((v) => v.includes("nested-sector violation")),
      `the illegal table is named: ${nested[0]}`,
    );
    // a shape lie is named
    const shaped = checkKWorldCertificate({ ...cert, cS0: table.slice(0, 6) });
    assert.ok(
      shaped.some((v) => v.includes("2^k")),
      `the shape lie is named: ${shaped[0]}`,
    );
  });

  it("the kernel boundary refuses illegal k, steps, masks and tables by name", () => {
    assert.throws(
      () => kWorldKraus(0),
      (e: unknown) =>
        e instanceof DomainError && e.code === "kWorldKraus:k-range",
    );
    assert.throws(
      () => kWorldKraus(5),
      (e: unknown) =>
        e instanceof DomainError && e.code === "kWorldKraus:k-range",
    );
    assert.throws(
      () => iterateKWorldLaw(vecToRho(randomStateVec(makeRng(204), 16)), -1, 3),
      (e: unknown) =>
        e instanceof DomainError && e.code === "iterateKWorldLaw:step-range",
    );
    assert.throws(
      () => kWorldSectorMass(vecToRho(randomStateVec(makeRng(205), 16)), 9, 3),
      (e: unknown) =>
        e instanceof DomainError && e.code === "kWorldSectorMass:mask-range",
    );
    assert.throws(
      () => kWorldInclusionExclusion(3, [0.5, 0.5, 0.5]),
      (e: unknown) =>
        e instanceof DomainError &&
        e.code === "kWorldInclusionExclusion:table-shape",
    );
  });

  it("the W-R witness passes (the audit face, registered here — the audit roll itself is untouched)", () => {
    const w = witnessKWorlds();
    assert.ok(w.pass, w.detail);
  });
});

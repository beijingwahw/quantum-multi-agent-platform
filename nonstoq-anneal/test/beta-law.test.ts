import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Rng } from "../src/core/rng.js";
import { energies, randomIsing } from "../src/core/ising.js";
import { xBasisEnergies } from "../src/anneal/driver.js";
import { NonstoqError } from "../src/core/errors.js";
import { sseConfigFrom } from "../src/sse/sse.js";
import { exactSignAverage } from "../src/sse/enumerate.js";
import {
  auditSignLawTable,
  betaLaw,
  betaLawSpectra,
  denseH,
  type SignLawRow,
} from "../src/sse/beta-law.js";
import { jacobiEigenvalues } from "../src/core/jacobi.js";

function driverOf(model: ReturnType<typeof randomIsing>, kappa: number) {
  return { gamma: 1, couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })) };
}

/** The conviction reader: run `fn`, demand a NonstoqError, return its code. */
function codeOf(fn: () => unknown): NonstoqError["code"] {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof NonstoqError, `expected a NonstoqError, got ${String(e)}`);
    return e.code;
  }
  assert.fail("expected a refusal that never came");
}

const KAPPA = 0.8;

test("beta-law: the spectral referee is double-anchored (enumeration at small beta, dense-H endpoint limits)", () => {
  // anchor 1: SSE full enumeration (no Trotter error, no truncation at order 9) at beta = 0.25
  const model = randomIsing(new Rng(33), 2);
  const E = energies(model);
  const xp = xBasisEnergies(2, driverOf(model, KAPPA));
  const xm = xBasisEnergies(2, driverOf(model, -KAPPA));
  const law = betaLaw(2, E, xp, xm, 0.5, [0.25], 12);
  const enumerated = exactSignAverage(sseConfigFrom(model, driverOf(model, KAPPA), 0.5, 0.25), 9).signAvg;
  assert.ok(Math.abs(law.rows[0]!.signSpectral - enumerated) < 1e-9, `spectral ${law.rows[0]!.signSpectral} vs enum ${enumerated}`);
  // anchor 2: dense-H endpoint limits — s = 1 gives H = -C (eigen = sorted(-E)), s = 0 gives H = H_D (eigen = sorted(xE))
  const negE = [...E].map((x) => -x).sort((a, b) => a - b);
  const eigS1 = jacobiEigenvalues(denseH(2, E, xp, 1));
  assert.ok(Math.max(...eigS1.map((v, i) => Math.abs(v - negE[i]!))) < 1e-12);
  const sortedXp = [...xp].sort((a, b) => a - b);
  const eigS0 = jacobiEigenvalues(denseH(2, E, xp, 0));
  assert.ok(Math.max(...eigS0.map((v, i) => Math.abs(v - sortedXp[i]!))) < 1e-12);
});

test("beta-law: the finite-beta identity holds with ZERO residual (two float paths of one algebra)", () => {
  for (const n of [2, 3, 4, 5]) {
    const model = randomIsing(new Rng(31 + n), n);
    const E = energies(model);
    const xp = xBasisEnergies(n, driverOf(model, KAPPA));
    const xm = xBasisEnergies(n, driverOf(model, -KAPPA));
    const law = betaLaw(n, E, xp, xm, 0.5, [0.5, 1, 2, 4, 8], 12);
    for (const r of law.rows) {
      assert.ok(r.identityResidual < 1e-13, `n=${n} beta=${r.beta} identity residual ${r.identityResidual}`);
      assert.ok(r.correctionResidual < 1e-13, `n=${n} beta=${r.beta} correction residual ${r.correctionResidual}`);
    }
  }
});

test("beta-law: DeltaE0 >= 0 (the shadow is never worse) and the enumerable bound holds at every beta", () => {
  for (const n of [2, 3, 4, 5]) {
    const model = randomIsing(new Rng(31 + n), n);
    const E = energies(model);
    const xp = xBasisEnergies(n, driverOf(model, KAPPA));
    const xm = xBasisEnergies(n, driverOf(model, -KAPPA));
    const spec = betaLawSpectra(n, E, xp, xm, 0.5);
    assert.ok(spec.deltaE0 > 0, `n=${n}: expected a non-trivial shadow gap, got ${spec.deltaE0}`);
    assert.ok(spec.gapPlus > 0 && spec.gapMinus > 0);
    // imaginary-time projection third witness: E0 agreement within its own dtau^2 discipline
    assert.ok(spec.projectionResidual < 2e-2, `n=${n} projection residual ${spec.projectionResidual}`);
    const law = betaLaw(n, E, xp, xm, 0.5, [0.5, 1, 2, 4, 8], 12);
    for (const r of law.rows) {
      assert.ok(r.withinBound, `n=${n} beta=${r.beta}: |correction| ${Math.abs(r.correction)} exceeded the enumerable bound ${r.correctionBound}`);
      // the bound decays like e^{-beta*min-gap}: the correction cannot outrun it
      assert.ok(r.correctionBound < law.rows[0]!.correctionBound + 1);
    }
    // correction shrinks with beta (asymptotic convergence, data)
    const c2 = law.rows[2]!.correction;
    const c4 = law.rows[4]!.correction;
    assert.ok(Math.abs(c4) < Math.abs(c2), `n=${n}: correction must shrink from beta=2 to beta=8 (${c2} -> ${c4})`);
  }
});

test("beta-law: the Trotter cross-witness agrees at small beta (its in-repo domain), drift disclosed at large beta", () => {
  const model = randomIsing(new Rng(33), 2);
  const E = energies(model);
  const xp = xBasisEnergies(2, driverOf(model, KAPPA));
  const xm = xBasisEnergies(2, driverOf(model, -KAPPA));
  const law = betaLaw(2, E, xp, xm, 0.5, [0.25, 0.5, 2], 12);
  assert.ok(law.rows[0]!.trotterResidual < 2e-3, `beta=0.25 trotter residual ${law.rows[0]!.trotterResidual}`); // the sse.test discipline
  assert.ok(law.rows[1]!.trotterResidual < 8e-3, `beta=0.5 trotter residual ${law.rows[1]!.trotterResidual}`);
  // large beta: the matrix-squaring path drifts and does NOT converge with slices — disclosed, not asserted away
  assert.ok(law.rows[2]!.trotterResidual > 1e-2 && law.rows[2]!.trotterResidual < 0.5);
});

test("beta-law: an honest table passes the audit (EXACT rows carry the spectral value, ASYMPTOTE rows the asymptote)", () => {
  const model = randomIsing(new Rng(34), 3);
  const E = energies(model);
  const xp = xBasisEnergies(3, driverOf(model, KAPPA));
  const xm = xBasisEnergies(3, driverOf(model, -KAPPA));
  const law = betaLaw(3, E, xp, xm, 0.5, [1, 4], 12);
  const rows: SignLawRow[] = [
    { beta: 1, value: law.rows[0]!.signSpectral, exactness: "EXACT" },
    { beta: 4, value: law.rows[1]!.asymptote, exactness: "ASYMPTOTE" },
  ];
  auditSignLawTable(law, rows); // must not throw — honesty ships
});

test("beta-law smuggling trial: the asymptote masquerading as the exact value is convicted by code", () => {
  const model = randomIsing(new Rng(34), 3);
  const E = energies(model);
  const xp = xBasisEnergies(3, driverOf(model, KAPPA));
  const xm = xBasisEnergies(3, driverOf(model, -KAPPA));
  const law = betaLaw(3, E, xp, xm, 0.5, [1], 12);
  const r = law.rows[0]!;
  assert.ok(Math.abs(r.correction) > 1e-3, "the trial needs a beta where the asymptote is visibly wrong");
  const masquerade: SignLawRow[] = [{ beta: 1, value: r.asymptote, exactness: "EXACT" }];
  const err = codeOf(() => { auditSignLawTable(law, masquerade); });
  assert.equal(err, "CertificateVerificationFailed");
  // and the SAME value, honestly tagged, ships
  auditSignLawTable(law, [{ beta: 1, value: r.asymptote, exactness: "ASYMPTOTE" }]);
});

test("beta-law smuggling trial: a tampered exact row is convicted by code", () => {
  const model = randomIsing(new Rng(35), 3);
  const E = energies(model);
  const xp = xBasisEnergies(3, driverOf(model, KAPPA));
  const xm = xBasisEnergies(3, driverOf(model, -KAPPA));
  const law = betaLaw(3, E, xp, xm, 0.5, [1], 12);
  const tampered: SignLawRow[] = [{ beta: 1, value: law.rows[0]!.signSpectral + 1e-3, exactness: "EXACT" }];
  assert.equal(codeOf(() => { auditSignLawTable(law, tampered); }), "CertificateVerificationFailed");
});

test("beta-law smuggling trial: a beta with no data row is ReportRowMissing; degenerate inputs are refused by code", () => {
  const model = randomIsing(new Rng(36), 3);
  const E = energies(model);
  const xp = xBasisEnergies(3, driverOf(model, KAPPA));
  const xm = xBasisEnergies(3, driverOf(model, -KAPPA));
  const law = betaLaw(3, E, xp, xm, 0.5, [1], 12);
  assert.equal(
    codeOf(() => { auditSignLawTable(law, [{ beta: 2, value: 0.5, exactness: "EXACT" }]); }),
    "ReportRowMissing",
  );
  assert.equal(codeOf(() => betaLaw(3, E, xp, xm, 0.5, [])), "CertificateVerificationFailed"); // a law of no rows verifies nothing
  assert.equal(codeOf(() => betaLaw(3, E, xp, xm, 0.5, [0])), "CertificateVerificationFailed"); // beta <= 0
  assert.equal(codeOf(() => betaLaw(3, E, xp, xm, 1.5, [1])), "CertificateVerificationFailed"); // s outside [0,1]
  assert.equal(codeOf(() => betaLaw(11, E, xp, xm, 0.5, [1])), "DenseRefereeCap"); // dense 2^n referee cap
});

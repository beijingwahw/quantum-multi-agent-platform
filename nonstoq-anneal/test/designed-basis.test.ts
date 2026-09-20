import test from "node:test";
import assert from "node:assert/strict";
import {
  uniformChainTerms,
  isTranslationInvariantCertificate,
  liftChainCertificate,
  auditLiftClaim,
  amplitude64,
  rotateMpsSites,
  mpsNormSquared,
  designedBasisExecution,
} from "../src/anneal/designed-basis.js";
import {
  decideElementDesignable,
  denseRotatedMatrix,
  denseMaxPositiveOffdiag,
  denseGroundStateSignRatio,
} from "../src/anneal/designing-element.js";
import { dmrgGroundState } from "../src/tn/dmrg.js";
import { randomMps, mpsAmplitude, mpsFromDense } from "../src/tn/mps.js";
import { jacobiEigenWithVectors } from "../src/core/jacobi.js";

// The uniform translation-invariant family executed throughout. At the closed
// form angle psi = 3*pi/5 the elements read (a = cos psi, b = sin psi):
//   interior single-flip row  = g*a - p*b + 2*|a*b*(kappa - w)|
//   end single-flip row       = g*a - p*b +   |a*b*(kappa - w)|
//   double-flip element       = kappa*a^2 + w*b^2
// all strictly negative for (g,p,kappa,w) = (1,1,0.1,-0.1) — a non-vacuous YES.
const FAMILY = { g: 1, p: 1, kappa: 0.1, w: -0.1 };
const SEED = 20260920;

function closedFormRows(psi: number): {
  interior: number;
  end: number;
  doubleFlip: number;
} {
  const a = Math.cos(psi);
  const b = Math.sin(psi);
  const base = FAMILY.g * a - FAMILY.p * b;
  const t = Math.abs(a * b * (FAMILY.kappa - FAMILY.w));
  return {
    interior: base + 2 * t,
    end: base + t,
    doubleFlip: FAMILY.kappa * a * a + FAMILY.w * b * b,
  };
}

test("designed-basis: the decider returns a translation-invariant non-vacuous YES at n0 = 8", () => {
  const dec = decideElementDesignable(uniformChainTerms({ ...FAMILY, n: 8 }), {
    seed: SEED,
    starts: 200,
  });
  assert.equal(dec.verdict, "YES");
  assert.equal(dec.vacuous, false);
  assert.equal(dec.denseReferee, "pass");
  assert.ok(
    dec.bestMax < 0,
    `best max element ${dec.bestMax} strictly negative (non-vacuous)`,
  );
  // the machine fact the lift argument feeds on: the optimizer's certificate
  // is itself translation-invariant on the uniform family
  const cert = dec.certificate as {
    psi: readonly number[];
    d: readonly number[];
  };
  const invariance = isTranslationInvariantCertificate(cert);
  assert.ok(
    invariance.invariant,
    `psi spread ${invariance.psiSpread}, d [${invariance.dValues.join(",")}]`,
  );
  // and the optimizer beat (or matched) the closed-form hand angle
  assert.ok(
    dec.bestMax <= closedFormRows((3 * Math.PI) / 5).doubleFlip + 1e-12,
  );
});

test("designed-basis: the lift carries the YES certificate to every n >= n0 (DL-a)", () => {
  const psi = (3 * Math.PI) / 5;
  const expected = closedFormRows(psi);
  for (const baseN of [3, 8]) {
    const cert = {
      psi: new Array(baseN).fill(psi),
      d: new Array(baseN).fill(1),
    };
    for (const targetN of [baseN + 1, 10, 20, 64]) {
      const lift = liftChainCertificate({ ...FAMILY, n: baseN }, cert, targetN);
      assert.ok(
        lift.accepted,
        `base ${baseN} -> n=${targetN}: ${JSON.stringify(lift.violations)}`,
      );
      // the lifted max equals the closed-form double-flip element (the binding one)
      assert.ok(
        Math.abs((lift.maxOffDiagonal as number) - expected.doubleFlip) < 1e-12,
        `n=${targetN}: max ${lift.maxOffDiagonal} vs closed form ${expected.doubleFlip}`,
      );
      // pointwise identity: the two environment classes read their closed forms
      assert.ok(
        Math.abs((lift.interiorValue as number) - expected.interior) < 1e-12,
      );
      assert.ok(Math.abs((lift.endValue as number) - expected.end) < 1e-12);
      // the end row is a strict subset sum of the interior row (the lift's engine)
      assert.ok((lift.endValue as number) < (lift.interiorValue as number));
    }
  }
  // the decider's own (searched) certificate lifts identically
  const dec = decideElementDesignable(uniformChainTerms({ ...FAMILY, n: 8 }), {
    seed: SEED,
    starts: 200,
  });
  const cert = dec.certificate as {
    psi: readonly number[];
    d: readonly number[];
  };
  const expectedDec = closedFormRows(cert.psi[0] as number);
  for (const targetN of [9, 10, 12, 64]) {
    const lift = liftChainCertificate({ ...FAMILY, n: 8 }, cert, targetN);
    assert.ok(lift.accepted, `decider cert -> n=${targetN}`);
    assert.ok(
      Math.abs((lift.maxOffDiagonal as number) - expectedDec.doubleFlip) <
        1e-12,
    );
  }
  // dense 2^n referee re-verifies the lifted certificate at n = 10
  const lift10 = liftChainCertificate({ ...FAMILY, n: 8 }, cert, 10);
  const dense = denseRotatedMatrix(
    uniformChainTerms({ ...FAMILY, n: 10 }),
    lift10.certificate as { psi: readonly number[]; d: readonly number[] },
  );
  assert.ok(
    denseMaxPositiveOffdiag(dense) <= 1e-12,
    "n=10 dense referee on the lifted certificate",
  );
});

test("designed-basis audit: non-invariant certificates cannot claim the lift (DL-c)", () => {
  const psi = (3 * Math.PI) / 5;
  const forged = {
    psi: [psi, psi, psi + 0.5, psi, psi, psi, psi, psi],
    d: new Array(8).fill(1),
  };
  const verdict = auditLiftClaim({
    base: { ...FAMILY, n: 8 },
    certificate: forged,
    targetN: 64,
  });
  assert.ok(!verdict.accepted);
  assert.equal(verdict.violations[0]!.name, "non-invariant-certificate");
  // reflection-sign smearing is the twin face
  const forgedD = { psi: new Array(8).fill(psi), d: [1, 1, -1, 1, 1, 1, 1, 1] };
  const verdictD = auditLiftClaim({
    base: { ...FAMILY, n: 8 },
    certificate: forgedD,
    targetN: 32,
  });
  assert.ok(!verdictD.accepted);
  assert.equal(verdictD.violations[0]!.name, "non-invariant-certificate");
});

test("designed-basis audit: bases without an interior witness and downward targets die by name (DL-c)", () => {
  const psi = (3 * Math.PI) / 5;
  const cert2 = { psi: [psi, psi], d: [1, 1] };
  const noWitness = auditLiftClaim({
    base: { ...FAMILY, n: 2 },
    certificate: cert2,
    targetN: 64,
  });
  assert.ok(!noWitness.accepted);
  assert.equal(noWitness.violations[0]!.name, "missing-interior-witness");
  const downward = auditLiftClaim({
    base: { ...FAMILY, n: 8 },
    certificate: { psi: new Array(8).fill(psi), d: new Array(8).fill(1) },
    targetN: 5,
  });
  assert.ok(!downward.accepted);
  assert.equal(downward.violations[0]!.name, "target-below-base");
  // shape mismatch (certificate for a different chain length)
  const shape = auditLiftClaim({
    base: { ...FAMILY, n: 8 },
    certificate: cert2,
    targetN: 16,
  });
  assert.ok(!shape.accepted);
  assert.ok(shape.violations.some((v) => v.name === "certificate-shape"));
});

test("designed-basis audit: a certificate re-scanned to a POSITIVE element on the target dies by name (DL-c)", () => {
  // ferromagnetic-sign ZZ (w > 0) with no transverse fields: every uniform
  // rotation leaves the double-flip element kappa*a^2 + w*b^2 > 0 somewhere
  const noGoFamily = { n: 8, g: 0, p: 0, kappa: 0.1, w: 0.1 };
  const psi = (3 * Math.PI) / 5;
  const forged = { psi: new Array(8).fill(psi), d: new Array(8).fill(1) };
  const verdict = auditLiftClaim({
    base: noGoFamily,
    certificate: forged,
    targetN: 20,
  });
  assert.ok(!verdict.accepted);
  assert.equal(verdict.violations[0]!.name, "positive-element-in-target");
  assert.match(verdict.violations[0]!.detail, /double-flip/);
});

test("designed-basis: n=10 dense dual-basis anchor — computational P < 1, de-signed P = 1 exactly", () => {
  const terms = uniformChainTerms({ ...FAMILY, n: 10 });
  const psi = (3 * Math.PI) / 5;
  const cert = { psi: new Array(10).fill(psi), d: new Array(10).fill(1) };
  const hRot = denseRotatedMatrix(terms, cert);
  const hRaw = denseRotatedMatrix(terms, {
    psi: new Array(10).fill(0),
    d: new Array(10).fill(1),
  });
  const pRaw = denseGroundStateSignRatio(hRaw);
  const pRot = denseGroundStateSignRatio(hRot);
  assert.ok(
    pRaw > 0 && pRaw < 1,
    `computational P = ${pRaw} strictly inside (0,1)`,
  );
  assert.ok(
    Math.abs(pRot - 1) <= 1e-12,
    `de-signed P = ${pRot} = 1 exactly (Perron-Frobenius)`,
  );
  // and the collapse deepens with n (the sign barrier is real in this basis)
  const p8 = denseGroundStateSignRatio(
    denseRotatedMatrix(uniformChainTerms({ ...FAMILY, n: 8 }), {
      psi: new Array(8).fill(0),
      d: new Array(8).fill(1),
    }),
  );
  assert.ok(pRaw < p8, `P(10)=${pRaw} < P(8)=${p8}`);
});

test("designed-basis: the MPS site rotation is the dense conjugate, bit for bit (n = 8)", () => {
  const n = 8;
  const psi = (3 * Math.PI) / 5;
  const cert = { psi: new Array(n).fill(psi), d: new Array(n).fill(1) };
  // isolate rotation correctness from DMRG convergence: encode the Jacobi
  // ground state EXACTLY as an MPS (chi 48 >= 2^4 covers every bond), rotate
  // it, and compare with the dense U^T |GS> component by component
  const hDense = denseRotatedMatrix(uniformChainTerms({ ...FAMILY, n }), {
    psi: new Array(n).fill(0),
    d: new Array(n).fill(1),
  });
  const { eigenvalues, eigenvectors } = jacobiEigenWithVectors(
    hDense.map((r) => [...r]),
  );
  let i0 = 0;
  for (let i = 1; i < eigenvalues.length; i++)
    if (eigenvalues[i]! < eigenvalues[i0]!) i0 = i;
  const gs = eigenvectors[i0] as number[];
  const vec = Float64Array.from(gs);
  const exact = mpsFromDense(vec, n, 48);
  const rotated = rotateMpsSites(exact, conjugateForTest(cert));
  const c = Math.cos(psi / 2);
  const s = Math.sin(psi / 2);
  // phi[z] = sum_z' (U^T)[z][z'] * gs[z']  with U = kron_i R(psi/2), bit i = site i.
  // The per-site factor is U_i[z'][z] (row z', column z) — the TRANSPOSE of
  // the naive reading; writing U_i[z][z'] here silently computes U|GS>, a
  // sign-scrambled vector that matches nothing (caught on the record).
  const phi = new Float64Array(2 ** n);
  for (let z = 0; z < 2 ** n; z++) {
    let acc = 0;
    for (let zp = 0; zp < 2 ** n; zp++) {
      let u = 1;
      for (let i = 0; i < n; i++) {
        const zi = (z >>> i) & 1;
        const zpi = (zp >>> i) & 1;
        u *= zi === zpi ? c : zpi === 0 ? -s : s;
      }
      acc += u * gs[zp]!;
    }
    phi[z] = acc;
  }
  // the encoding carries its own arbitrary global sign: match up to ONE flip
  let maxSame = 0;
  let maxFlip = 0;
  for (let z = 0; z < 2 ** n; z++) {
    const amp = amplitude64(rotated, 0, z);
    maxSame = Math.max(maxSame, Math.abs(phi[z]! - amp));
    maxFlip = Math.max(maxFlip, Math.abs(-phi[z]! - amp));
  }
  const best = Math.min(maxSame, maxFlip);
  // tolerance note: mpsFromDense factors through (M^T M)'s Jacobi spectrum,
  // squaring the Schmidt condition number — the ENCODING itself sits at ~1e-9
  // (measured), so the rotation check inherits that floor, not 1e-15
  assert.ok(
    best <= 5e-8,
    `MPS rotation vs dense conjugate: max |diff| = ${best.toExponential(3)}`,
  );
  // DMRG testimony on the same instance: variational energy within 1e-9 of
  // the Jacobi eigenvalue and the census machinery reproduces the mixing
  const h = {
    n,
    alpha: Array(n).fill(FAMILY.p),
    beta: Array(n).fill(FAMILY.g),
    omega: Array(n - 1).fill(FAMILY.w),
    kappa: Array(n - 1).fill(FAMILY.kappa),
  };
  const dmrg = dmrgGroundState(h, { chiMax: 48, sweeps: 12, seed: 0x5eed64 });
  assert.ok(Math.abs(dmrg.energy - (eigenvalues[i0] as number)) <= 1e-9);
});

test("designed-basis: n=64 dual-basis execution — mixing witnesses below, single sign above (DL-b)", () => {
  const psi = (3 * Math.PI) / 5;
  const cert = { psi: new Array(64).fill(psi), d: new Array(64).fill(1) };
  const exec = designedBasisExecution({ ...FAMILY, n: 64 }, cert, {
    chiMax: 48,
    sweeps: 12,
    seed: 0x5eed64,
  });
  // DMRG convergence testimony: the discarded weight bounds the sign verdicts
  assert.ok(exec.maxDiscarded <= 1e-10, `discarded ${exec.maxDiscarded}`);
  // computational basis: sign MIXING is a constructive proof of P < 1 — the
  // census sees both signs through correct 64-bit addressing (sites 32..63
  // included; the 32-bit-shift path of tn/mps.ts cannot even address them)
  assert.ok(exec.computational.pos > 0 && exec.computational.neg > 0);
  assert.ok(
    exec.computational.witnessPos !== null &&
      exec.computational.witnessNeg !== null,
  );
  assert.notEqual(
    exec.computational.witnessNeg[0],
    exec.computational.witnessPos[0],
  );
  // de-signed basis: every sampled amplitude non-negative to 1e-12 (the P = 1
  // face; the all-configurations claim rides on the stoquastic certificate
  // of H' + Perron-Frobenius, with the census guarding the DMRG truncation)
  assert.ok(
    exec.designed.minAmplitude >= -1e-12,
    `min rotated amplitude ${exec.designed.minAmplitude.toExponential(3)}`,
  );
  assert.equal(exec.designed.neg, 0);
  // the rotation is an isometry: norm conserved to machine precision
  assert.ok(
    exec.normDrift <= 1e-12,
    `norm drift ${exec.normDrift.toExponential(3)}`,
  );
  // the H' stoquastic certificate holds exactly at n = 64 (formula path)
  assert.ok(exec.liftAccepted);
  assert.ok(
    exec.maxOffDiagonalRotated <= 0,
    `max off-diagonal of H' ${exec.maxOffDiagonalRotated}`,
  );
  // energy testimony: the variational bound the whole execution stands on
  assert.ok(exec.dmrgEnergy < 0);
});

test("designed-basis: amplitude64 addresses the high half that the 32-bit shift path cannot", () => {
  // mirror configs (the low half's bit pattern replicated to the high half)
  // are exactly what the naive (bits >>> i) & 1 addressing produces for ANY
  // 64-bit input — these faces pin that amplitude64 escapes the trap
  const mps64 = randomMps(64, 4, 0xabcd);
  const hi = 0x1b680f15;
  const lo = 0x8042cc16;
  const amp = amplitude64(mps64, hi, lo);
  // sensitivity: flipping a HIGH-half bit (site 32 + k) changes the amplitude
  const flippedHi = hi ^ (1 << 5); // site 37
  assert.notEqual(amplitude64(mps64, flippedHi, lo), amp);
  // consistency: below site 32 the addressing agrees with tn/mps.ts bit for bit
  const mps12 = randomMps(12, 4, 0xabce);
  for (let z = 0; z < 2 ** 12; z++) {
    assert.equal(amplitude64(mps12, 0, z), mpsAmplitude(mps12, z));
  }
  // the rotation is norm-preserving on the same deep bond structure (the
  // ratio is immune to the raw random MPS's ill-conditioned scale)
  const psi = Math.PI / 7;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  const rotated = rotateMpsSites(
    mps64,
    Array.from({ length: 64 }, () => [
      [c, -s],
      [s, c],
    ]),
  );
  const ratio = mpsNormSquared(rotated) / mpsNormSquared(mps64);
  assert.ok(
    Math.abs(ratio - 1) <= 1e-9,
    `norm ratio under orthogonal rotation: ${ratio.toPrecision(12)}`,
  );
});

/** 测试内参考：与模块私有 conjugateSites 同式的 U† 逐 site 矩阵（对拍用）。 */
function conjugateForTest(cert: {
  psi: readonly number[];
  d: readonly number[];
}): number[][][] {
  const out: number[][][] = [];
  for (let i = 0; i < cert.psi.length; i++) {
    const c = Math.cos((cert.psi[i] as number) / 2);
    const s = Math.sin((cert.psi[i] as number) / 2);
    const d = cert.d[i] as number;
    const u =
      d === 1
        ? [
            [c, -s],
            [s, c],
          ]
        : [
            [s, c],
            [c, -s],
          ];
    out.push([
      [u[0]![0] as number, u[1]![0] as number],
      [u[0]![1] as number, u[1]![1] as number],
    ]);
  }
  return out;
}

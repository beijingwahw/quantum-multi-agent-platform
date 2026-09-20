import test from "node:test";
import assert from "node:assert/strict";

/**
 * R20 (agent γ, spec memory/r18/agentF.md F4-a — "候选 7") — the W-B clone
 * gap upgraded to an algebraic certificate (kernel/covariance.ts). Every
 * asserted number is recomputed by the kernel from scratch here; the
 * negative controls convict by name. New-file route: witnesses.ts, the
 * dossier, and the frozen reports are untouched — this table upgrades W-B's
 * reading, it does not replace the gate.
 */
import {
  amplitudeDampingImages,
  applyBasisMap,
  bandLaunderedCloneProjection,
  bandViolations,
  certifyCloneGap,
  choiCommutatorNorm,
  cloneCensus,
  cnotPairImages,
  covarianceDeviation,
  dephasingImages,
  identityImages,
  pauliConjugatedImages,
  pinnedCloneImages,
  randomConjugatedImages,
  type BasisImages,
} from "../src/kernel/covariance.js";
import {
  c,
  dagger,
  kron2,
  matmul,
  type C,
  type Mat,
} from "../src/kernel/linalg.js";

const PHI_GRID: readonly number[] = [
  0,
  Math.PI / 12,
  Math.PI / 4,
  Math.PI / 3,
  Math.PI / 2,
];

const E2 = (i: number, j: number): Mat => {
  const m: C[][] = [
    [c(0), c(0)],
    [c(0), c(0)],
  ];
  m[i]![j] = c(1);
  return m;
};
const P_PLUS: Mat = [
  [c(0.5), c(0.5)],
  [c(0.5), c(0.5)],
];
const P_PLUS_I: Mat = [
  [c(0.5), c(0, -0.5)],
  [c(0, 0.5), c(0.5)],
];
const entryMax = (m: Mat): number => {
  let w = 0;
  for (const row of m)
    for (const z of row) w = Math.max(w, Math.hypot(z.re, z.im));
  return w;
};
const mSubEntry = (a: Mat, b: Mat): Mat =>
  a.map((row, r) =>
    row.map((z, q) => ({ re: z.re - b[r]![q]!.re, im: z.im - b[r]![q]!.im })),
  );

test("CV1: covariance ⟺ Choi commutant ⟺ band, on all eight channels of the table", () => {
  const table: ReadonlyArray<{
    name: string;
    images: BasisImages;
    covariant: boolean;
  }> = [
    { name: "identity", images: identityImages(), covariant: true },
    { name: "dephasing ½(ρ+ZρZ)", images: dephasingImages(), covariant: true },
    { name: "ZρZ", images: pauliConjugatedImages("Z"), covariant: true },
    {
      name: "amplitude damping γ=0.3",
      images: amplitudeDampingImages(0.3),
      covariant: true,
    },
    { name: "XρX", images: pauliConjugatedImages("X"), covariant: false },
    { name: "YρY", images: pauliConjugatedImages("Y"), covariant: false },
    {
      name: "random conj seed 20260921",
      images: randomConjugatedImages(20260921),
      covariant: false,
    },
    {
      name: "random conj seed 20260922",
      images: randomConjugatedImages(20260922),
      covariant: false,
    },
  ];
  for (const row of table) {
    const cov = covarianceDeviation(row.images, "same", PHI_GRID, 20260921);
    const comm = Math.max(
      ...PHI_GRID.map((phi) => choiCommutatorNorm(row.images, phi)),
    );
    const band = bandViolations(row.images, "same").count;
    assert.ok(
      cov < 1e-12 === row.covariant,
      `${row.name}: action deviation ${cov.toExponential(2)}`,
    );
    assert.ok(
      comm < 1e-12 === row.covariant,
      `${row.name}: commutator ${comm.toExponential(2)}`,
    );
    assert.equal(
      band === 0,
      row.covariant,
      `${row.name}: band violations ${band}`,
    );
  }
  // the machine's own two corrections to the spec-era expectation table:
  // ZρZ and amplitude damping ARE rephasing-covariant (diagonal Kraus pairs
  // commute with U_φ; the K1 phase cancels across the conjugate pair) —
  // pinned here so the table cannot silently drift back
  assert.ok(
    covarianceDeviation(pauliConjugatedImages("Z"), "same", PHI_GRID, 7) <
      1e-12,
  );
  assert.ok(
    covarianceDeviation(amplitudeDampingImages(0.3), "same", PHI_GRID, 7) <
      1e-12,
  );
});

test("CV2: the CNOT pair channel is one-wire covariant exactly, clones the diagonals, and is not a clone", () => {
  const images = cnotPairImages();
  const dev = covarianceDeviation(images, "one-wire", PHI_GRID, 20260921);
  assert.equal(
    dev,
    0,
    `one-wire action deviation must be machine zero, got ${dev.toExponential(2)}`,
  );
  assert.equal(bandViolations(images, "one-wire").count, 0);
  assert.ok(
    bandViolations(images, "two-wire").count > 0,
    "the CNOT pair is NOT two-wire covariant",
  );
  assert.equal(
    entryMax(
      mSubEntry(applyBasisMap(images, E2(0, 0)), kron2(E2(0, 0), E2(0, 0))),
    ),
    0,
  );
  assert.equal(
    entryMax(
      mSubEntry(applyBasisMap(images, E2(1, 1)), kron2(E2(1, 1), E2(1, 1))),
    ),
    0,
  );
  const plusGap = entryMax(
    mSubEntry(applyBasisMap(images, P_PLUS), kron2(P_PLUS, P_PLUS)),
  );
  assert.ok(
    plusGap > 0.1,
    `the CNOT pair must fail to clone |+>, gap ${plusGap}`,
  );
});

test("CV3: cloning the four seeds pins the images at exact dyadic-plus-i values", () => {
  const pinned = pinnedCloneImages();
  for (const rho of [E2(0, 0), E2(1, 1), P_PLUS, P_PLUS_I]) {
    const gap = entryMax(
      mSubEntry(applyBasisMap(pinned, rho), kron2(rho, rho)),
    );
    assert.ok(gap < 1e-15, `seed round-trip gap ${gap.toExponential(2)}`);
  }
  const b01 = pinned[0]![1]!;
  assert.equal(b01[0]![0]!.re, -0.25);
  assert.equal(b01[0]![0]!.im, -0.25);
  assert.equal(b01[1]![2]!.re, 0.25);
  assert.equal(b01[1]![2]!.im, 0.25);
  for (const row of pinned) {
    for (const m of row) {
      for (const r of m) {
        for (const z of r) {
          assert.ok(
            Number.isInteger(z.re * 4) && Number.isInteger(z.im * 4),
            "every pinned entry is a quarter of a Gaussian integer",
          );
        }
      }
    }
  }
});

test("CV4: the pinned clone images violate both rephasing bands — the conviction", () => {
  const pinned = pinnedCloneImages();
  const oneWire = bandViolations(pinned, "one-wire");
  const twoWire = bandViolations(pinned, "two-wire");
  assert.equal(
    oneWire.count,
    16,
    `one-wire off-band entries (8 on B01 + 8 on B10), got ${oneWire.count}`,
  );
  assert.equal(
    twoWire.count,
    16,
    `two-wire off-band entries, got ${twoWire.count}`,
  );
  assert.ok(
    oneWire.minMagnitude >= 0.25 - 1e-12,
    `smallest off-band magnitude ${oneWire.minMagnitude}`,
  );
});

test("CV5: the null-space census of the covariant subspaces", () => {
  const census = cloneCensus();
  assert.deepEqual(census.oneWire, { free: 24, forcedZero: 40 });
  assert.deepEqual(census.twoWire, { free: 20, forcedZero: 44 });
});

test("CV6: the clone face rotates at −2φ exactly; the channel face never matches", () => {
  const pinned = pinnedCloneImages();
  const rephase = (phi: number): Mat => [
    [c(1), c(0)],
    [c(0, 0), c(Math.cos(phi), Math.sin(phi))],
  ];
  const cloneFace = (phi: number): C => {
    const u = rephase(phi);
    const rho = matmul(u, matmul(P_PLUS, dagger(u)));
    return (kron2(rho, rho)[0] as readonly C[])[3] as C;
  };
  const chanFace = (phi: number): C => {
    const u = rephase(phi);
    const rho = matmul(u, matmul(P_PLUS, dagger(u)));
    return (applyBasisMap(pinned, rho)[0] as readonly C[])[3] as C;
  };
  const s0 = cloneFace(0);
  let worstRate = 0;
  let minGap = Number.POSITIVE_INFINITY;
  for (const phi of [Math.PI / 12, Math.PI / 6, Math.PI / 4, Math.PI / 3]) {
    const s = cloneFace(phi);
    const expect = {
      re: Math.cos(2 * phi) * s0.re + Math.sin(2 * phi) * s0.im,
      im: -Math.sin(2 * phi) * s0.re + Math.cos(2 * phi) * s0.im,
    };
    worstRate = Math.max(
      worstRate,
      Math.hypot(s.re - expect.re, s.im - expect.im),
    );
    const t = chanFace(phi);
    minGap = Math.min(minGap, Math.hypot(t.re - s.re, t.im - s.im));
  }
  assert.ok(
    worstRate < 1e-15,
    `clone face −2φ law, worst dev ${worstRate.toExponential(2)}`,
  );
  assert.ok(minGap > 0.1, `min channel-vs-clone face gap ${minGap}`);
  // and the kernel's own CV6 row agrees
  const cv6 = certifyCloneGap().claims.find((row) => row.id === "CV6");
  assert.ok(cv6);
  assert.equal(cv6.pass, true, cv6.detail);
});

test("NC3: band-laundering passes the band but breaks cloning — jointly infeasible", () => {
  const laundered = bandLaunderedCloneProjection();
  assert.equal(
    bandViolations(laundered, "one-wire").count,
    0,
    "laundered images are band-clean by construction",
  );
  let worstSeed = 0;
  for (const rho of [E2(0, 0), E2(1, 1), P_PLUS, P_PLUS_I]) {
    worstSeed = Math.max(
      worstSeed,
      entryMax(mSubEntry(applyBasisMap(laundered, rho), kron2(rho, rho))),
    );
  }
  assert.ok(
    worstSeed > 0.1,
    `laundered images must fail to clone a seed, worst gap ${worstSeed}`,
  );
});

test("the assembled certificate: all rows hold, ids exact, refusal face named", () => {
  const cert = certifyCloneGap();
  const ids = cert.claims.map((row) => row.id);
  assert.deepEqual(ids, ["CV1", "CV2", "CV3", "CV4", "CV5", "CV6", "NC3"]);
  for (const row of cert.claims) {
    assert.equal(row.pass, true, `${row.id}: ${row.detail}`);
  }
  assert.match(cert.summary, /commutant certificate/);
  // malformed images are refused by name, never normalized into NaN probes
  const bad = [[E2(0, 0)]] as unknown as BasisImages;
  assert.throws(
    () => covarianceDeviation(bad, "same", [0], 1),
    /COVARIANCE_SHAPE/,
  );
  const bad2 = [E2(0, 0), E2(1, 1)] as unknown as BasisImages;
  assert.throws(() => bandViolations(bad2, "one-wire"), /COVARIANCE_SHAPE/);
});

test("determinism: the certificate and census are pure functions of nothing", () => {
  assert.deepEqual(certifyCloneGap(), certifyCloneGap());
  assert.deepEqual(cloneCensus(), cloneCensus());
  assert.deepEqual(pinnedCloneImages(), pinnedCloneImages());
});

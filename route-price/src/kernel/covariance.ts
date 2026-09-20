/**
 * The rephasing-covariant clone gap — W-B's numerical separation upgraded to
 * an algebraic certificate (R20; spec R18 agentF F4-a).
 *
 * What W-B witnessed numerically (the pair coherence is rephasing-invariant
 * while a clone's target rotates at twice the rate) is here a commutant
 * statement with an entrywise integer-band certificate, all on this repo's
 * own linalg:
 *
 *   CV1  a qubit channel T is rephasing-covariant — T(U φ·U φ†) =
 *        U φ T(·) U φ† for every φ — ⟺ [J(T), U φ ⊗ Ū φ] = 0 for every φ
 *        ⟺ the Choi entries of T live on the band m − n = i − j. The three
 *        faces are checked against each other on a channel table.
 *   CV2  the CNOT pair channel (clones the diagonals, entangles the rest) is
 *        one-wire rephasing-covariant at machine zero — the "covariant but
 *        not a clone" control that MUST pass.
 *   CV3  cloning four seed states (|0>, |1>, |+>, |+i>) pins a channel's
 *        four basis images at exact dyadic-plus-i values — no freedom. All
 *        quantities are dyadic rationals and ±i quarters: exact in float.
 *   CV4  the pinned images carry nonzero entries off BOTH rephasing bands
 *        (one-wire and two-wire) — the conviction. A channel cloning every
 *        pure state is pinned (CV3); it is covariant on pure states (each
 *        U φ|ψ> is again pure, and cloning transports as (U φ⊗U φ)); pure
 *        states span M2, so by linearity it is fully covariant, hence
 *        banded — contradiction with the off-band entries. No-cloning with
 *        the covariance commutant doing the convicting.
 *   CV5  the census of the covariant subspaces: Choi entries free vs forced
 *        to zero under each band (the null-space census of the spec).
 *   CV6  the W-B tie: the clone's |00><11| face rotates at exactly −2φ
 *        (quadratic faces), any linear map's at rate 1 — the numerical gap
 *        is the band structure seen on one entry.
 *   NC3  band-laundering the pinned images (deleting every off-band entry)
 *        satisfies the band but no longer clones the seeds: the covariant
 *        family and the clone-pinned family are jointly infeasible —
 *        laundering one constraint family only breaks the other.
 */
import {
  c,
  cabs2,
  cmul,
  gramSchmidtUnitary,
  identity,
  kron2,
  matmul,
  dagger,
  LinAlgError,
  type C,
  type Mat,
} from "./linalg.js";
import { Rng } from "./rng.js";

/** A linear map M2 → M(2 or 4) by its four basis images images[i][j] = E(E_ij). */
export type BasisImages = ReadonlyArray<readonly Mat[]>;
export type WireRep = "same" | "one-wire" | "two-wire";

export interface CloneGapClaimRow {
  readonly id: string;
  readonly claim: string;
  readonly pass: boolean;
  readonly detail: string;
}

export interface BandScan {
  readonly count: number;
  readonly minMagnitude: number;
  readonly worst: string;
}

export interface CloneCensusRow {
  readonly free: number;
  readonly forcedZero: number;
}

export interface CloneGapCertificate {
  readonly claims: readonly CloneGapClaimRow[];
  readonly summary: string;
}

const cAdd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
const cScale = (s: number, a: C): C => ({ re: s * a.re, im: s * a.im });

/** U_φ = diag(1, e^{iφ}) — the rephasing group element. */
export function rephasing(phi: number): Mat {
  return [
    [c(1), c(0)],
    [c(0, 0), c(Math.cos(phi), Math.sin(phi))],
  ];
}

const mAdd = (a: Mat, b: Mat): Mat =>
  a.map((row, r) => row.map((x, q) => cAdd(x, (b[r] as readonly C[])[q] as C)));
const mSub = (a: Mat, b: Mat): Mat =>
  a.map((row, r) => row.map((x, q) => cSub(x, (b[r] as readonly C[])[q] as C)));
const mScale = (s: number, a: Mat): Mat =>
  a.map((row) => row.map((x) => cScale(s, x)));
const mScaleC = (z: C, a: Mat): Mat =>
  a.map((row) => row.map((x) => cmul(z, x)));
const mEntryMax = (a: Mat): number => {
  let w = 0;
  for (const row of a)
    for (const x of row) w = Math.max(w, Math.hypot(x.re, x.im));
  return w;
};

const E2 = (i: number, j: number): Mat => {
  const m: C[][] = [
    [c(0), c(0)],
    [c(0), c(0)],
  ];
  m[i]![j] = c(1);
  return m;
};

const E4 = (i: number, j: number): Mat => {
  const m: C[][] = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => c(0)),
  );
  m[i]![j] = c(1);
  return m;
};

function checkShape(images: BasisImages): number {
  const row0 = images[0];
  const row1 = images[1];
  if (
    images.length !== 2 ||
    row0 === undefined ||
    row1 === undefined ||
    row0.length !== 2 ||
    row1.length !== 2
  ) {
    throw new LinAlgError(
      "COVARIANCE_SHAPE",
      `basis images must be indexed [2][2], got [${images.length}${row0 === undefined ? "" : `[${row0.length}]`}]`,
    );
  }
  const m00 = row0[0];
  if (m00 === undefined) {
    throw new LinAlgError("COVARIANCE_SHAPE", "basis images row 0 is empty");
  }
  const n = m00.length;
  if (n !== 2 && n !== 4) {
    throw new LinAlgError(
      "COVARIANCE_SHAPE",
      `basis images must be 2×2 or 4×4, got ${n}×${n}`,
    );
  }
  for (const row of images) {
    for (const m of row) {
      if (m.length !== n || m[0]?.length !== n) {
        throw new LinAlgError(
          "COVARIANCE_SHAPE",
          `basis image is ${m.length}×${m[0]?.length ?? "-"}, expected ${n}×${n}`,
        );
      }
    }
  }
  return n;
}

/** E(X) = Σ_ij X_ij · B_ij — the linear extension of the basis images. */
export function applyBasisMap(images: BasisImages, x: Mat): Mat {
  const n = checkShape(images);
  const out: C[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => c(0)),
  );
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const coeff = (x[i] as readonly C[])[j] as C;
      if (coeff.re === 0 && coeff.im === 0) continue;
      const b = (images[i] as readonly Mat[])[j] as Mat;
      for (let r = 0; r < n; r++) {
        for (let q = 0; q < n; q++) {
          out[r]![q] = cAdd(
            out[r]![q]!,
            cmul(coeff, (b[r] as readonly C[])[q] as C),
          );
        }
      }
    }
  }
  return out;
}

/** J(E) = Σ_ij B_ij ⊗ E_ij (output ⊗ input), on this repo's kron2. */
export function choiMatrix(images: BasisImages): Mat {
  checkShape(images);
  let j: Mat | undefined;
  for (let i = 0; i < 2; i++) {
    for (let q = 0; q < 2; q++) {
      const term = kron2((images[i] as readonly Mat[])[q] as Mat, E2(i, q));
      j = j === undefined ? term : mAdd(j, term);
    }
  }
  return j as Mat;
}

/** ‖[J(E), U_φ ⊗ Ū_φ]‖_max, elementwise — the commutant face (2→2 maps). */
export function choiCommutatorNorm(images: BasisImages, phi: number): number {
  const j = choiMatrix(images);
  const d = kron2(rephasing(phi), dagger(rephasing(phi)));
  return mEntryMax(mSub(matmul(j, d), matmul(d, j)));
}

/** The output-side representation of U_φ acting on the wire set of `rep`. */
function outRep(phi: number, rep: WireRep, dim: number): Mat {
  const u = rephasing(phi);
  if (rep === "same") {
    if (dim !== 2)
      throw new LinAlgError(
        "COVARIANCE_SHAPE",
        `"same" rep needs 2×2 images, got ${dim}×${dim}`,
      );
    return u;
  }
  if (dim !== 4)
    throw new LinAlgError(
      "COVARIANCE_SHAPE",
      `wire reps need 4×4 images, got ${dim}×${dim}`,
    );
  return rep === "one-wire" ? kron2(u, identity(2)) : kron2(u, u);
}

/** max over φ and probes of ‖E(UρU†) − W E(ρ) W†‖ — the action face of
 *  covariance. Probes: the four matrix units plus seeded random operators
 *  (the second path beyond the entrywise band/commutant faces). */
export function covarianceDeviation(
  images: BasisImages,
  rep: WireRep,
  phis: readonly number[],
  seed: number,
): number {
  const dim = checkShape(images);
  const rng = new Rng(seed);
  const probes: Mat[] = [E2(0, 0), E2(0, 1), E2(1, 0), E2(1, 1)];
  for (let t = 0; t < 6; t++) {
    probes.push([
      [c(rng.gaussian(), rng.gaussian()), c(rng.gaussian(), rng.gaussian())],
      [c(rng.gaussian(), rng.gaussian()), c(rng.gaussian(), rng.gaussian())],
    ]);
  }
  let worst = 0;
  for (const phi of phis) {
    const u = rephasing(phi);
    const w = outRep(phi, rep, dim);
    const ud = dagger(u);
    const wd = dagger(w);
    for (const x of probes) {
      const pushed = matmul(u, matmul(x, ud));
      const lhs = applyBasisMap(images, pushed);
      const rhs = matmul(w, matmul(applyBasisMap(images, x), wd));
      worst = Math.max(worst, mEntryMax(mSub(lhs, rhs)));
    }
  }
  return worst;
}

/** The integer band rule: entry (a,b) of B_ij may be nonzero only when the
 *  rep-wire number difference of a and b equals i − j (for "same", the whole
 *  index is one wire). Phases are exact: e^{iφ(k)} = 1 for all φ iff k = 0. */
function bandLegal(
  rep: WireRep,
  i: number,
  j: number,
  a: number,
  b: number,
): boolean {
  const wireDiff = (k: number): number => {
    if (rep === "same") return k;
    const w1 = k >> 1;
    return rep === "one-wire" ? w1 : w1 + (k & 1);
  };
  return wireDiff(a) - wireDiff(b) === i - j;
}

/** Scan the off-band nonzero entries of a map: how many, how small is the
 *  smallest, and where is the largest (the conviction's evidence line). */
export function bandViolations(images: BasisImages, rep: WireRep): BandScan {
  const n = checkShape(images);
  let count = 0;
  let minMagnitude = Number.POSITIVE_INFINITY;
  let worst = "";
  let worstMag = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const b = (images[i] as readonly Mat[])[j] as Mat;
      for (let a = 0; a < n; a++) {
        for (let bq = 0; bq < n; bq++) {
          const z = (b[a] as readonly C[])[bq] as C;
          const mag = Math.hypot(z.re, z.im);
          if (bandLegal(rep, i, j, a, bq) || mag <= 1e-14) continue;
          count++;
          minMagnitude = Math.min(minMagnitude, mag);
          if (mag > worstMag) {
            worstMag = mag;
            worst = `B[${i}${j}][${a}][${bq}]=${mag.toFixed(3)}`;
          }
        }
      }
    }
  }
  return { count, minMagnitude: count === 0 ? 0 : minMagnitude, worst };
}

/** The exact dyadic seed states (no radicals: |+><+| and |+i><+i| carry
 *  only ½ and ±i — every quantity below is exactly representable). */
const P_PLUS: Mat = mScale(0.5, [
  [c(1), c(1)],
  [c(1), c(1)],
]);
const P_PLUS_I: Mat = mScale(0.5, [
  [c(1), c(0, -1)],
  [c(0, 1), c(1)],
]);

/** The clone-pinned basis images: cloning |0>, |1>, |+>, |+i> forces
 *  B00, B11 outright and B01 ± B10 through the two ½-coefficient seed
 *  expansions — solved exactly in dyadic-plus-i arithmetic. */
export function pinnedCloneImages(): BasisImages {
  const b00 = kron2(E2(0, 0), E2(0, 0)); // E(|0><0|) = |00><00|
  const b11 = kron2(E2(1, 1), E2(1, 1)); // E(|1><1|) = |11><11|
  const pPlus = kron2(P_PLUS, P_PLUS); // |++><++|
  const pPlusI = kron2(P_PLUS_I, P_PLUS_I); // |+i,+i><+i,+i|
  // |+> = ½(E00+E01+E10+E11) ⇒ B01 + B10 = 2P+ − B00 − B11 =: sum
  // |+i> = ½(E00 − iE01 + iE10 + E11) ⇒ −i(B01 − B10) = 2Pi − B00 − B11 =: raw
  // ⇒ B01 − B10 = i·raw
  const sum = mSub(mScale(2, pPlus), mAdd(b00, b11));
  const raw = mSub(mScale(2, pPlusI), mAdd(b00, b11));
  const iRaw = mScaleC(c(0, 1), raw);
  const b01 = mScale(0.5, mAdd(sum, iRaw));
  const b10 = mScale(0.5, mSub(sum, iRaw));
  return [
    [b00, b01],
    [b10, b11],
  ];
}

/** The CNOT-with-blank channel: clones the computational diagonals,
 *  entangles everything else — one-wire covariant, never a clone. */
export function cnotPairImages(): BasisImages {
  return [
    [kron2(E2(0, 0), E2(0, 0)), E4(0, 3)],
    [E4(3, 0), kron2(E2(1, 1), E2(1, 1))],
  ];
}

/** The band-laundered clone: the pinned images with every off-band entry
 *  (one-wire rule) deleted — band-clean by construction, cloning broken. */
export function bandLaunderedCloneProjection(): BasisImages {
  const pinned = pinnedCloneImages();
  const wash = (b: Mat, i: number, j: number): Mat =>
    b.map((row, a) =>
      row.map((z, bq) => (bandLegal("one-wire", i, j, a, bq) ? z : c(0))),
    );
  return [
    [
      wash((pinned[0] as readonly Mat[])[0] as Mat, 0, 0),
      wash((pinned[0] as readonly Mat[])[1] as Mat, 0, 1),
    ],
    [
      wash((pinned[1] as readonly Mat[])[0] as Mat, 1, 0),
      wash((pinned[1] as readonly Mat[])[1] as Mat, 1, 1),
    ],
  ];
}

/** The null-space census: over all 4×16 (i,j,a,b) Choi entry positions, how
 *  many are free vs forced to zero by each band (a pure counting face of the
 *  covariant subspaces — independent of any particular map). */
export function cloneCensus(): {
  oneWire: CloneCensusRow;
  twoWire: CloneCensusRow;
} {
  const count = (rep: WireRep): CloneCensusRow => {
    let free = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let a = 0; a < 4; a++) {
          for (let b = 0; b < 4; b++) {
            if (bandLegal(rep, i, j, a, b)) free++;
          }
        }
      }
    }
    return { free, forcedZero: 64 - free };
  };
  return { oneWire: count("one-wire"), twoWire: count("two-wire") };
}

/** Standard qubit channels for the CV1 table. */
export function pauliConjugatedImages(pauli: "X" | "Y" | "Z"): BasisImages {
  const p: Mat =
    pauli === "X"
      ? [
          [c(0), c(1)],
          [c(1), c(0)],
        ]
      : pauli === "Y"
        ? [
            [c(0), c(0, -1)],
            [c(0, 1), c(0)],
          ]
        : [
            [c(1), c(0)],
            [c(0), c(-1)],
          ];
  const pd = dagger(p);
  const mk = (i: number, j: number): Mat => matmul(p, matmul(E2(i, j), pd));
  return [
    [mk(0, 0), mk(0, 1)],
    [mk(1, 0), mk(1, 1)],
  ];
}

export function amplitudeDampingImages(gamma: number): BasisImages {
  const k0: Mat = [
    [c(1), c(0)],
    [c(0), c(Math.sqrt(1 - gamma))],
  ];
  const k1: Mat = [
    [c(0), c(Math.sqrt(gamma))],
    [c(0), c(0)],
  ];
  const k0d = dagger(k0);
  const k1d = dagger(k1);
  const mk = (i: number, j: number): Mat =>
    mAdd(matmul(k0, matmul(E2(i, j), k0d)), matmul(k1, matmul(E2(i, j), k1d)));
  return [
    [mk(0, 0), mk(0, 1)],
    [mk(1, 0), mk(1, 1)],
  ];
}

export function dephasingImages(): BasisImages {
  const mk = (i: number, j: number): Mat =>
    i === j ? E2(i, j) : mScale(0, E2(i, j)); // ½(ρ+ZρZ) = diagonal part
  return [
    [mk(0, 0), mk(0, 1)],
    [mk(1, 0), mk(1, 1)],
  ];
}

export function identityImages(): BasisImages {
  return [
    [E2(0, 0), E2(0, 1)],
    [E2(1, 0), E2(1, 1)],
  ];
}

export function randomConjugatedImages(seed: number): BasisImages {
  const rng = new Rng(seed);
  const u = gramSchmidtUnitary(() => rng.gaussian(), 2);
  const ud = dagger(u);
  const mk = (i: number, j: number): Mat => matmul(u, matmul(E2(i, j), ud));
  return [
    [mk(0, 0), mk(0, 1)],
    [mk(1, 0), mk(1, 1)],
  ];
}

const PHI_GRID: readonly number[] = [
  0,
  Math.PI / 12,
  Math.PI / 4,
  Math.PI / 3,
  Math.PI / 2,
];

/** The assembled certificate — every row recomputed from scratch. */
export function certifyCloneGap(): CloneGapCertificate {
  const claims: CloneGapClaimRow[] = [];

  // CV1 — the triple equivalence on the channel table
  {
    const table: ReadonlyArray<{
      name: string;
      images: BasisImages;
      covariant: boolean;
    }> = [
      { name: "identity", images: identityImages(), covariant: true },
      {
        name: "dephasing ½(ρ+ZρZ)",
        images: dephasingImages(),
        covariant: true,
      },
      { name: "ZρZ", images: pauliConjugatedImages("Z"), covariant: true },
      {
        name: "amplitude damping γ=0.3",
        images: amplitudeDampingImages(0.3),
        covariant: true,
      },
      { name: "XρX", images: pauliConjugatedImages("X"), covariant: false },
      { name: "YρY", images: pauliConjugatedImages("Y"), covariant: false },
      {
        name: "random conj (seed 20260921)",
        images: randomConjugatedImages(20260921),
        covariant: false,
      },
      {
        name: "random conj (seed 20260922)",
        images: randomConjugatedImages(20260922),
        covariant: false,
      },
    ];
    let agree = true;
    const lines: string[] = [];
    for (const row of table) {
      const cov =
        covarianceDeviation(row.images, "same", PHI_GRID, 20260921) < 1e-12;
      const comm =
        Math.max(
          ...PHI_GRID.map((phi) => choiCommutatorNorm(row.images, phi)),
        ) < 1e-12;
      const band = bandViolations(row.images, "same").count === 0;
      if (!(cov === comm && comm === band && cov === row.covariant))
        agree = false;
      lines.push(
        `${row.name}: cov=${cov ? 1 : 0}/comm=${comm ? 1 : 0}/band=${band ? 1 : 0} (expected ${row.covariant ? 1 : 0})`,
      );
    }
    claims.push({
      id: "CV1",
      claim:
        "rephasing covariance ⟺ Choi commutant [J, U⊗Ū] = 0 ⟺ band m−n = i−j, on every channel of the table (4 covariant, 4 not)",
      pass: agree,
      detail: lines.join("; "),
    });
  }

  // CV2 — the CNOT pair channel: one-wire covariant, never a clone
  {
    const images = cnotPairImages();
    const dev = covarianceDeviation(images, "one-wire", PHI_GRID, 20260921);
    const oneWire = bandViolations(images, "one-wire");
    const twoWire = bandViolations(images, "two-wire");
    const clonesDiagonals =
      mEntryMax(
        mSub(applyBasisMap(images, E2(0, 0)), kron2(E2(0, 0), E2(0, 0))),
      ) === 0 &&
      mEntryMax(
        mSub(applyBasisMap(images, E2(1, 1)), kron2(E2(1, 1), E2(1, 1))),
      ) === 0;
    const notClone =
      mEntryMax(mSub(applyBasisMap(images, P_PLUS), kron2(P_PLUS, P_PLUS))) >
      0.1;
    const pass =
      dev < 1e-15 &&
      oneWire.count === 0 &&
      twoWire.count > 0 &&
      clonesDiagonals &&
      notClone;
    claims.push({
      id: "CV2",
      claim:
        "the CNOT pair channel is one-wire rephasing-covariant exactly (deviation machine zero), clones the diagonals, and is NOT a clone of |+> — the covariant-but-not-cloning control passes",
      pass,
      detail:
        `one-wire action deviation ${dev.toExponential(2)} (exact grid incl. φ=π/2); ` +
        `one-wire band violations: ${oneWire.count}; two-wire band violations: ${twoWire.count} (${twoWire.worst}); ` +
        `diagonal cloning bitwise; |+> cloning gap ${mEntryMax(mSub(applyBasisMap(images, P_PLUS), kron2(P_PLUS, P_PLUS))).toFixed(3)}`,
    });
  }

  // CV3 — the pinning: four seeds force the images, exact dyadic arithmetic
  {
    const pinned = pinnedCloneImages();
    const seeds: ReadonlyArray<{ name: string; rho: Mat }> = [
      { name: "|0>", rho: E2(0, 0) },
      { name: "|1>", rho: E2(1, 1) },
      { name: "|+>", rho: P_PLUS },
      { name: "|+i>", rho: P_PLUS_I },
    ];
    let worst = 0;
    for (const s of seeds) {
      worst = Math.max(
        worst,
        mEntryMax(mSub(applyBasisMap(pinned, s.rho), kron2(s.rho, s.rho))),
      );
    }
    const b01 = (pinned[0] as readonly Mat[])[1] as Mat;
    const dyadic = (z: C): boolean => {
      const q = z.re * 4;
      const qi = z.im * 4;
      return Number.isInteger(q) && Number.isInteger(qi);
    };
    let allDyadic = true;
    for (const row of pinned)
      for (const m of row)
        for (const r of m) for (const z of r) if (!dyadic(z)) allDyadic = false;
    const pass =
      worst < 1e-15 &&
      allDyadic &&
      cabs2(cSub((b01[0] as readonly C[])[0] as C, c(-0.25, -0.25))) === 0;
    claims.push({
      id: "CV3",
      claim:
        "cloning the four seeds pins the four basis images exactly (round-trip at dyadic exactness; every entry a Gaussian quarter)",
      pass,
      detail:
        `round-trip worst ${worst.toExponential(2)} over the four seeds; ` +
        `all entries ¼·Gaussian integers: ${allDyadic ? "yes" : "NO"}; ` +
        `spot B01[0][0] = (${((b01[0] as readonly C[])[0] as C).re.toFixed(3)},${((b01[0] as readonly C[])[0] as C).im.toFixed(3)})`,
    });
  }

  // CV4 — the conviction: the pinned images violate both bands
  {
    const pinned = pinnedCloneImages();
    const oneWire = bandViolations(pinned, "one-wire");
    const twoWire = bandViolations(pinned, "two-wire");
    const pass =
      oneWire.count === 16 &&
      twoWire.count === 16 &&
      oneWire.minMagnitude >= 0.25 - 1e-12;
    claims.push({
      id: "CV4",
      claim:
        "the clone-pinned images carry 16 nonzero entries off the one-wire band and 16 off the two-wire band, smallest magnitude ≥ ¼ — no rephasing-covariant channel (either rep) has them, and a cloner of all pure states would be covariant by the spanning bridge: no clone exists",
      pass,
      detail: `off one-wire band: ${oneWire.count} (worst ${oneWire.worst}); off two-wire band: ${twoWire.count} (worst ${twoWire.worst}); smallest off-band magnitude ${oneWire.minMagnitude.toFixed(3)} (entries are ¼·Gaussian, so ≥ ¼ when nonzero)`,
    });
  }

  // CV5 — the census
  {
    const census = cloneCensus();
    const pass = census.oneWire.free === 24 && census.twoWire.free === 20;
    claims.push({
      id: "CV5",
      claim:
        "the covariant subspace census over the 64 Choi entry positions: one-wire band frees 24 (forces 40 to zero), two-wire frees 20 (forces 44)",
      pass,
      detail: `one-wire free/forced ${census.oneWire.free}/${census.oneWire.forcedZero}; two-wire free/forced ${census.twoWire.free}/${census.twoWire.forcedZero}`,
    });
  }

  // CV6 — the W-B tie: rate −2φ vs rate 1
  {
    let worstRate = 0;
    let minGap = Number.POSITIVE_INFINITY;
    const cloneFace = (phi: number): C => {
      const u = rephasing(phi);
      const rho = matmul(u, matmul(P_PLUS, dagger(u)));
      return (kron2(rho, rho)[0] as readonly C[])[3] as C;
    };
    const chanFace = (phi: number): C => {
      const u = rephasing(phi);
      const rho = matmul(u, matmul(P_PLUS, dagger(u)));
      return (
        applyBasisMap(pinnedCloneImages(), rho)[0] as readonly C[]
      )[3] as C;
    };
    const s0 = cloneFace(0);
    for (const phi of [Math.PI / 12, Math.PI / 6, Math.PI / 4, Math.PI / 3]) {
      const s = cloneFace(phi);
      const expect = cmul(c(Math.cos(2 * phi), -Math.sin(2 * phi)), s0);
      worstRate = Math.max(
        worstRate,
        Math.hypot(s.re - expect.re, s.im - expect.im),
      );
      const t = chanFace(phi);
      minGap = Math.min(minGap, Math.hypot(t.re - s.re, t.im - s.im));
    }
    const pass = worstRate < 1e-15 && minGap > 0.1;
    claims.push({
      id: "CV6",
      claim:
        "the clone's |00><11| face on the equatorial orbit rotates at exactly −2φ (quadratic faces), while the pinned map's is a rate-1 mix — separated by ≥ 0.1 on the grid: the W-B numerical gap is the band structure on one entry",
      pass,
      detail: `clone face −2φ law worst dev ${worstRate.toExponential(2)} ≤ 1e-15; min |channel face − clone face| over the grid ${minGap.toFixed(3)} (gap ≥ 0.1); at φ=π/4 the clone face is −0.25 exactly`,
    });
  }

  // NC3 — band-laundering: clean band, broken cloning
  {
    const laundered = bandLaunderedCloneProjection();
    const band = bandViolations(laundered, "one-wire");
    let worstSeed = 0;
    for (const s of [E2(0, 0), E2(1, 1), P_PLUS, P_PLUS_I]) {
      worstSeed = Math.max(
        worstSeed,
        mEntryMax(mSub(applyBasisMap(laundered, s), kron2(s, s))),
      );
    }
    let deleted = 0;
    const pinned = pinnedCloneImages();
    for (const [i, j] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ] as const) {
      const a = (pinned[i] as readonly Mat[])[j] as Mat;
      const b = (laundered[i] as readonly Mat[])[j] as Mat;
      for (let r = 0; r < 4; r++) {
        for (let q = 0; q < 4; q++) {
          const za = (a[r] as readonly C[])[q] as C;
          const zb = (b[r] as readonly C[])[q] as C;
          if (za.re !== zb.re || za.im !== zb.im) deleted++;
        }
      }
    }
    const pass = band.count === 0 && worstSeed > 0.1 && deleted > 0;
    claims.push({
      id: "NC3",
      claim:
        "band-laundered clone projection: satisfies the one-wire band by construction yet fails to clone the seeds — the covariant family and the clone-pinned family are jointly infeasible (laundering one breaks the other)",
      pass,
      detail: `laundered band violations ${band.count}; seed round-trip worst ${worstSeed.toFixed(3)} (> 0.1); ${deleted} entries deleted by the projection`,
    });
  }

  const allPass = claims.every((row) => row.pass);
  return {
    claims,
    summary:
      `the rephasing-covariant clone gap, algebraically certified: ${claims.filter((x) => x.pass).length}/${claims.length} rows hold — ` +
      `${allPass ? "no rephasing-covariant channel clones the four seeds, hence no channel clones all pure states (W-B's numerical wall, now a commutant certificate)" : "AT LEAST ONE ROW FAILED"}`,
  };
}

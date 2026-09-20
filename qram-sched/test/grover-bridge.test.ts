/**
 * G5-b tests — exact Szegedy↔Grover reduction on the two-state flip family
 * (src/walk/grover-bridge.ts). Every claim is closed-form and cross-checked
 * against the walk engine (SzegedyWalk) and the amplitude-estimation engine
 * (groverSuccessClosedForm) — the walk↔ampest anchor. Negative controls
 * convict the refuted literal spec form and a forged eigenangle.
 */
import { ok, strictEqual, throws } from "node:assert";
import { describe, it } from "node:test";

import {
  affineGroverForm,
  closedFormDetectionTime,
  detectionCoefficients,
  detectionClosedForm,
  detectionCurveClosedForm,
  flipWalkCharPoly,
  flipWalkEigenphases,
  numericFlipWalkOperator,
  twoStateFlipChain,
  twoStateFlipChainLazy,
} from "../src/walk/grover-bridge.js";
import { SzegedyWalk } from "../src/walk/szegedy.js";
import { groverSuccessClosedForm } from "../src/ae/ampest.js";
import { QramError } from "../src/core/errors.js";

const Q_GRID = [0.05, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.9] as const;

function engineCurve(q: number, steps: number): Float64Array {
  const walk = new SzegedyWalk(twoStateFlipChain(q), [1]);
  const mu = new Float64Array([1, 0]);
  return walk.detectionCurve(mu, steps).curve;
}

describe("G5-b SG1: palindromic spectrum of the flip walk operator", () => {
  it("tr U = 2−4q, tr U² = 0, det U = 1 against the numeric 4×4 operator", () => {
    const mul = (A: number[][], B: number[][]): number[][] =>
      A.map((r) =>
        B[0]!.map((_, j) => r.reduce((t, x, k) => t + x * B[k]![j]!, 0)),
      );
    const tr = (M: number[][]): number => M.reduce((t, r, i) => t + r[i]!, 0);
    for (const q of Q_GRID) {
      const U = numericFlipWalkOperator(q);
      const U2 = mul(U, U);
      const U3 = mul(U2, U);
      // det via the permutation expansion (Leibniz over all 24 permutations)
      const perms: Array<[number[], number]> = [
        [[0, 1, 2, 3], 1],
        [[0, 1, 3, 2], -1],
        [[0, 2, 1, 3], -1],
        [[0, 2, 3, 1], 1],
        [[0, 3, 1, 2], 1],
        [[0, 3, 2, 1], -1],
        [[1, 0, 2, 3], -1],
        [[1, 0, 3, 2], 1],
        [[1, 2, 0, 3], 1],
        [[1, 2, 3, 0], -1],
        [[1, 3, 0, 2], -1],
        [[1, 3, 2, 0], 1],
        [[2, 0, 1, 3], 1],
        [[2, 0, 3, 1], -1],
        [[2, 1, 0, 3], -1],
        [[2, 1, 3, 0], 1],
        [[2, 3, 0, 1], 1],
        [[2, 3, 1, 0], -1],
        [[3, 0, 1, 2], -1],
        [[3, 0, 2, 1], 1],
        [[3, 1, 0, 2], 1],
        [[3, 1, 2, 0], -1],
        [[3, 2, 0, 1], -1],
        [[3, 2, 1, 0], 1],
      ];
      let det = 0;
      for (const [p, sgn] of perms) {
        det +=
          sgn * U[0]![p[0]!]! * U[1]![p[1]!]! * U[2]![p[2]!]! * U[3]![p[3]!]!;
      }
      const cp = flipWalkCharPoly(q);
      ok(Math.abs(tr(U) - cp.tr) < 1e-12, `tr at q=${q}: ${tr(U)} vs ${cp.tr}`);
      ok(Math.abs(tr(U2) - cp.tr2) < 1e-12, `tr U^2 at q=${q}: ${tr(U2)}`);
      ok(Math.abs(det - cp.det) < 1e-12, `det at q=${q}: ${det}`);
      // Newton identity for the palindromic polynomial: tr U³ = c₁³ − 3c₁c₂ + 3c₁
      const expectTr3 = cp.c1 ** 3 - 3 * cp.c1 * cp.c2 + 3 * cp.c1;
      ok(
        Math.abs(tr(U3) - expectTr3) < 1e-10,
        `tr U^3 at q=${q}: ${tr(U3)} vs ${expectTr3}`,
      );
    }
  });

  it("phase-lock identity w₁ − w₂ ≡ π/2 and the product identities (machine zero)", () => {
    for (const q of Q_GRID) {
      const e = flipWalkEigenphases(q);
      ok(
        Math.abs(e.phaseLockResidual) < 1e-12,
        `w1−w2+π/2 at q=${q}: ${e.phaseLockResidual}`,
      );
      ok(Math.abs(e.doubleAngleResidual) < 1e-12, `cos2w1+cos2w2 at q=${q}`);
      ok(Math.abs(e.cosProductResidual) < 1e-12, `cos-prod at q=${q}`);
      ok(Math.abs(e.sinProductResidual) < 1e-12, `sin-prod at q=${q}`);
    }
  });

  it("q out of (0,1) and k < 1 are rejected by closed-union code (payback reuse precedent)", () => {
    throws(
      () => twoStateFlipChain(0),
      (err: unknown) =>
        err instanceof QramError && err.code === "WALK_CHAIN_SHAPE",
    );
    throws(
      () => detectionClosedForm(1.5, 3),
      (err: unknown) =>
        err instanceof QramError && err.code === "WALK_CHAIN_SHAPE",
    );
    throws(
      () => detectionClosedForm(0.25, 0),
      (err: unknown) => err instanceof QramError && err.code === "AE_K_RANGE",
    );
  });
});

describe("G5-b SG2: closed-form detection sequence vs the walk engine", () => {
  it("p_k formula matches SzegedyWalk.detectionCurve to ≤1e-13 over 60 steps", () => {
    for (const q of Q_GRID) {
      const engine = engineCurve(q, 60);
      const closed = detectionCurveClosedForm(q, 60);
      let maxDev = 0;
      for (let k = 0; k < 60; k++)
        maxDev = Math.max(
          maxDev,
          Math.abs((engine[k] as number) - (closed[k] as number)),
        );
      ok(maxDev < 1e-13, `q=${q}: max deviation ${maxDev.toExponential(2)}`);
    }
  });

  it("first three steps have the polynomial values q, 4q(1−q), q(1−2q)²+4(1−q)q²(3−4q)²", () => {
    for (const q of [0.125, 0.375, 0.75]) {
      ok(Math.abs(detectionClosedForm(q, 1) - q) < 1e-12);
      ok(Math.abs(detectionClosedForm(q, 2) - 4 * q * (1 - q)) < 1e-12);
      const p3 = q * (1 - 2 * q) ** 2 + 4 * (1 - q) * q * q * (3 - 4 * q) ** 2;
      ok(
        Math.abs(detectionClosedForm(q, 3) - p3) < 1e-12,
        `p3=${detectionClosedForm(q, 3)} vs ${p3}`,
      );
    }
  });

  it("closed-form detection time equals the engine's detectionTime (threshold 0.3, off sequence values)", () => {
    for (const q of [0.125, 0.25, 0.5, 0.75]) {
      const walk = new SzegedyWalk(twoStateFlipChain(q), [1]);
      const mu = new Float64Array([1, 0]);
      const engineStep = walk.detectionTime(mu, 0.3, 400).step;
      const closedStep = closedFormDetectionTime(q, 0.3, 400);
      strictEqual(closedStep, engineStep, `q=${q}`);
    }
  });
});

describe("G5-b SG3: the Grover degenerate point and the walk↔ampest bridge", () => {
  it("q = 1/2: sequence collapses to sin²(kπ/4) — pure equally-spaced-phase Grover form", () => {
    const engine = engineCurve(0.5, 24);
    for (let k = 1; k <= 24; k++) {
      ok(
        Math.abs((engine[k - 1] as number) - Math.sin((k * Math.PI) / 4) ** 2) <
          1e-13,
        `k=${k}`,
      );
    }
  });

  it("odd subsequence is an exact affine Grover sequence vs ampest's closed form (≤1e-13)", () => {
    for (const q of Q_GRID) {
      const { A, theta, B } = affineGroverForm(q);
      const p = Math.sin(theta) ** 2; // the Grover good-fraction at the walk's own angle
      const engine = engineCurve(q, 121);
      for (let m = 0; m < 60; m++) {
        const walkOdd = engine[2 * m] as number; // p_{2m+1}
        const grover = A * groverSuccessClosedForm(p, m) + B;
        ok(
          Math.abs(walkOdd - grover) < 1e-13,
          `q=${q} m=${m}: ${walkOdd} vs ${grover}`,
        );
      }
    }
  });

  it("even subsequence splits per half-parity into the same family (≤5e-12)", () => {
    for (const q of [0.125, 0.375, 0.75]) {
      const { evenStep, parityModulation, w1 } = detectionCoefficients(q);
      const engine = engineCurve(q, 121);
      for (let r = 0; r < 29; r++) {
        // k = 4r+4: 1/2 + D_e cos(8w₁(r+1)) + C ; k = 4r+2: 1/2 + D_e cos(8w₁ r + 4w₁) − C
        // (5e-12: the acos route to w₁ amplifies rounding at large phase 8w₁k)
        const k4 = engine[4 * (r + 1) - 1] as number; // curve index of p_{4r+4}
        const k42 = engine[4 * r + 1] as number; // curve index of p_{4r+2}
        ok(
          Math.abs(
            k4 -
              (0.5 + evenStep * Math.cos(8 * w1 * (r + 1)) + parityModulation),
          ) < 5e-12,
          `q=${q} r=${r} k=4r+4`,
        );
        ok(
          Math.abs(
            k42 -
              (0.5 +
                evenStep * Math.cos(8 * w1 * r + 4 * w1) -
                parityModulation),
          ) < 5e-12,
          `q=${q} r=${r} k=4r+2`,
        );
      }
    }
  });

  it("NEGATIVE CONTROL (a): the refuted literal spec form sin²((2k+1)θ) is convicted", () => {
    // any θ fit of sin²((2k+1)θ) to the full q=0.125 sequence misses by >0.05
    // (the sequence is two-phase); the best-fit residual is the conviction
    const engine = engineCurve(0.125, 40);
    let bestRms = Infinity;
    for (let i = 0; i <= 100000; i++) {
      const th = (i / 100000) * (Math.PI / 2);
      let e = 0;
      for (let k = 1; k <= 40; k++) {
        const d = (engine[k - 1] as number) - Math.sin((2 * k + 1) * th) ** 2;
        e += d * d;
      }
      bestRms = Math.min(bestRms, Math.sqrt(e / 40));
    }
    ok(
      bestRms > 0.05,
      `best single-Grover fit rms ${bestRms.toExponential(2)} — the literal form is refuted`,
    );
    // while the delivered closed form is exact
    const closed = detectionCurveClosedForm(0.125, 40);
    let dev = 0;
    for (let k = 1; k <= 40; k++)
      dev = Math.max(
        dev,
        Math.abs((engine[k - 1] as number) - (closed[k - 1] as number)),
      );
    ok(
      dev < 1e-13,
      "delivered two-phase form is exact where the literal form fails",
    );
  });

  it("NEGATIVE CONTROL (b): a forged eigenangle (asin√q, the naive guess) is convicted", () => {
    for (const q of [0.125, 0.75]) {
      const { w1 } = flipWalkEigenphases(q);
      const naive = Math.asin(Math.sqrt(q));
      ok(
        Math.abs(w1 - naive) > 1e-3,
        `true w1=${w1.toFixed(6)} differs from naive asin√q=${naive.toFixed(6)}`,
      );
      // a sequence built on the naive angle misses the engine curve wholesale
      const engine = engineCurve(q, 20);
      let dev = 0;
      for (let k = 1; k <= 20; k++)
        dev = Math.max(
          dev,
          Math.abs(
            (engine[k - 1] as number) - Math.sin((2 * k + 1) * naive) ** 2,
          ),
        );
      ok(
        dev > 0.2,
        `naive-angle sequence deviates by ${dev.toFixed(3)} — convicted at q=${q}`,
      );
    }
  });
});

describe("G5-b SG4: lazy spectrum and the √(1/q) detection scale", () => {
  it("lazy family: eigenphases from the invariant quadratic (tr = 1−2q, tr U² = 1)", () => {
    for (const q of [0.125, 0.25, 0.5, 0.75]) {
      const walk = new SzegedyWalk(twoStateFlipChainLazy(q), [1]);
      ok(
        Math.abs(
          walk.norm(
            new Float64Array(walk.numEdges),
            new Float64Array(walk.numEdges),
          ) - 0,
        ) < 1e-15,
      ); // trivial sanity
      const cs = (1 - 2 * q) / 2; // cos w1 + cos w2
      const csq = (1 + 4) / 4; // cos²w1 + cos²w2 from tr U'² = 1
      const prod = (cs * cs - csq) / 2;
      const disc = Math.max(0, (cs * cs) / 4 - prod);
      const cosW1 = cs / 2 + Math.sqrt(disc);
      const w1 = Math.acos(Math.min(1, Math.max(-1, cosW1)));
      // the closed-form curve on this angle must reproduce the lazy engine curve
      // via the two-phase structure (five-cosine form pinned numerically):
      // fit p_k = P0 + Σ_j Pj cos(freq_j k) with freqs from (w1, w2)
      const cosW2 = cs - cosW1;
      const w2 = Math.acos(Math.min(1, Math.max(-1, cosW2)));
      const mu = new Float64Array([1, 0]);
      const N = 120;
      const { curve } = walk.detectionCurve(mu, N);
      const freqs = [2 * w1, 2 * w2, w1 + w2, Math.abs(w1 - w2)];
      const basis = (k: number): number[] => [
        1,
        ...freqs.flatMap((f) => [Math.cos(f * k), Math.sin(f * k)]),
      ];
      const size = 9;
      const G: number[][] = Array.from({ length: size }, () =>
        new Array(size).fill(0),
      );
      const b = new Array(size).fill(0);
      for (let k = 1; k <= N; k++) {
        const f = basis(k);
        const y = curve[k - 1] as number;
        for (let i = 0; i < size; i++) {
          b[i]! += y * f[i]!;
          for (let j = 0; j < size; j++) G[i]![j]! += f[i]! * f[j]!;
        }
      }
      // Gaussian elimination
      for (let i = 0; i < size; i++) {
        let piv = i;
        for (let j = i + 1; j < size; j++)
          if (Math.abs(G[j]![i]!) > Math.abs(G[piv]![i]!)) piv = j;
        [G[i], G[piv]] = [G[piv]!, G[i]!];
        [b[i], b[piv]] = [b[piv]!, b[i]!];
        for (let j = i + 1; j < size; j++) {
          const fac = G[j]![i]! / G[i]![i]!;
          for (let l = i; l < size; l++) G[j]![l]! -= fac * G[i]![l]!;
          b[j]! -= fac * b[i]!;
        }
      }
      const x = new Array(size).fill(0);
      for (let i = size - 1; i >= 0; i--) {
        let t = b[i]!;
        for (let l = i + 1; l < size; l++) t -= G[i]![l]! * x[l]!;
        x[i] = t / G[i]![i]!;
      }
      let rms = 0;
      for (let k = 1; k <= N; k++) {
        const f = basis(k);
        let pred = 0;
        for (let i = 0; i < size; i++) pred += x[i]! * f[i]!;
        const d = (curve[k - 1] as number) - pred;
        rms += d * d;
      }
      ok(
        Math.sqrt(rms / N) < 1e-13,
        `lazy q=${q}: two-phase Fourier rms ${Math.sqrt(rms / N).toExponential(2)}`,
      );
    }
  });

  it("lazy detection scales as Θ(√(1/q)) while non-lazy is Θ(1/q) — lazification is the speedup", () => {
    const scale: Array<[number, number, number]> = [];
    for (const q of [0.03125, 0.0625, 0.125]) {
      const lazyWalk = new SzegedyWalk(twoStateFlipChainLazy(q), [1]);
      const mu = new Float64Array([1, 0]);
      const lazySteps = lazyWalk.detectionTime(
        mu,
        0.25,
        Math.ceil(600 / Math.sqrt(q)),
      ).step;
      const nonLazy = closedFormDetectionTime(q, 0.25, Math.ceil(200 / q));
      scale.push([q, lazySteps, nonLazy]);
    }
    // shrinking q by 4× must grow lazy steps ~2× and non-lazy ~4×
    const [qSmall, lazySmall, nlSmall] = scale[0]!;
    const [qBig, lazyBig, nlBig] = scale[2]!;
    strictEqual(qSmall * 4, qBig);
    const lazyGrowth = lazySmall / lazyBig;
    const nlGrowth = nlSmall / nlBig;
    ok(
      lazyGrowth > 1.4 && lazyGrowth < 3.2,
      `lazy steps grow ×${lazyGrowth.toFixed(2)} for q→q/4 (≈2× expected)`,
    );
    ok(
      nlGrowth > 2.8,
      `non-lazy steps grow ×${nlGrowth.toFixed(2)} for q→q/4 (≈4× expected)`,
    );
  });
});

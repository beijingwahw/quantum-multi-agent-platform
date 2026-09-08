/**
 * THE BEAT — board B1, the driven-echo family, exact layer.
 *
 * The drive: two strokes per period, exactly as the DTC echo literature
 * defines it (EBN16/KLS16/YAO17 — cited; MI22 for the hardware cells).
 *   stroke 1 (free):  H_z = -sum_i J_i Z_i Z_{i+1} + sum_i h_i Z_i
 *   stroke 2 (kick):  a global X-rotation exp(-i theta sum_i X_i)
 *   F = exp(-i theta SumX) . exp(-i H_z)        (period absorbed into J, h)
 *
 * At theta = pi/2 exactly and h = 0 (any J):
 *   exp(-i (pi/2) SumX) = (-i)^n Xbar,  Xbar = Prod_i X_i
 *   F = (-i)^n Xbar e^{-i H_zz}, and because Xbar H_zz Xbar = H_zz (every
 *   ZZ pair is flip-even), the following hold EXACTLY:
 *     (E1) F+ Z_i F = -Z_i for every site i          [the beat, operator form]
 *     (E2) tr(F^{2k+1}) = 0 for every k              [pi-pairing, odd powers]
 *     (E3) tr(F^{2k}) = (-1)^{nk} tr(B^{2k}),  B = e^{-i H_zz}
 *          (since G = i^n F = Xbar B satisfies G^2 = B^2 by flip-invariance,
 *          so spec(G) = {+-sqrt(beta_j)}, beta_j = eigenvalues of B^2:
 *          the quasi-energy spectrum is exactly pi-paired — the eigenstate-
 *          -order signature, here as trace identities, no eigensolver)
 *     (E4) from |0...0> (a ZZ eigenstate): m(k) = (-1)^k exactly, where
 *          m = (1/n) Sum_i <Z_i>                      [the beat, trajectory]
 * Every witness re-derives these from the matrices through the family
 * kernel; none is assumed, none hand-expanded.
 */
import {
  type CMat,
  basisVec,
  identity,
  kronAll,
  mat,
  mAdd,
  mDagger,
  mMul,
  mTrace,
} from "../core/cmat.js";
import { PAULI_X, PAULI_Y, PAULI_Z, vecToRho } from "../core/states.js";
import { applyUnitary } from "../core/channels.js";
import { type Rng } from "../core/rng.js";

export interface EchoParams {
  readonly n: number;
  readonly theta: number;
  readonly fields: readonly number[];
  readonly couplings: readonly number[];
}

/** Diagonal of H_z in the computational basis (closed form; bit i of z = qubit i). */
export function zzEnergies(p: EchoParams): Float64Array {
  const dim = 1 << p.n;
  const out = new Float64Array(dim);
  for (let z = 0; z < dim; z++) {
    let e = 0;
    for (let i = 0; i < p.n; i++) {
      const s = (z >> i) & 1 ? -1 : 1; // bit 0 -> +1 (the |0> eigenvalue of Z)
      e += p.fields[i]! * s;
      if (i + 1 < p.n) {
        const s2 = (z >> (i + 1)) & 1 ? -1 : 1;
        e -= p.couplings[i]! * s * s2; // ferromagnetic sign: aligned is the ground state
      }
    }
    out[z] = e;
  }
  return out;
}

/** exp(-i theta SumX) = kronAll of per-site exp(-i theta X) (all X_i commute). */
export function kickStroke(theta: number, n: number): CMat {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const block = mat(2, 2);
  block.re[0] = c;
  block.re[3] = c;
  block.im[1] = -s;
  block.im[2] = -s;
  return kronAll(Array.from({ length: n }, () => block));
}

/** exp(-i H_z): diagonal unitary from the closed-form energies. */
export function freeStroke(p: EchoParams): CMat {
  const dim = 1 << p.n;
  const energies = zzEnergies(p);
  const b = mat(dim, dim);
  for (let z = 0; z < dim; z++) {
    b.re[z * dim + z] = Math.cos(energies[z]!);
    b.im[z * dim + z] = -Math.sin(energies[z]!);
  }
  return b;
}

/** The one-period Floquet operator F = kick . free. */
export function echoFloquet(p: EchoParams): CMat {
  return mMul(kickStroke(p.theta, p.n), freeStroke(p));
}

/** One-site Pauli on an n chain: qubit k = bit k (low-order), the LAST tensor factor. */
function sitePauli(n: number, k: number, p: CMat): CMat {
  const factors: CMat[] = [];
  for (let i = n - 1; i >= 0; i--) factors.push(i === k ? p : identity(2));
  return kronAll(factors);
}

export function siteZ(n: number, i: number): CMat {
  return sitePauli(n, i, PAULI_Z);
}
export function siteX(n: number, i: number): CMat {
  return sitePauli(n, i, PAULI_X);
}
export function siteY(n: number, i: number): CMat {
  return sitePauli(n, i, PAULI_Y);
}

/** Xbar = Prod_i X_i (the global flip). */
export function globalFlip(n: number): CMat {
  return kronAll(Array.from({ length: n }, () => PAULI_X));
}

/** Max |entry| of a matrix — the deviation metric used across this repo. */
export function maxAbs(m: CMat): number {
  let w = 0;
  for (const v of m.re) w = Math.max(w, Math.abs(v));
  for (const v of m.im) w = Math.max(w, Math.abs(v));
  return w;
}

/** The polarized state |0...0> as a density matrix (basis state 0 of dim 2^n). */
export function polarizedRho(n: number): CMat {
  return vecToRho(basisVec(1 << n, 0));
}

/** <O> = Tr(rho O) through the family kernel — closed forms never hand-expanded. */
export function expectation(rho: CMat, o: CMat): number {
  const tr = mTrace(mMul(rho, o));
  if (Math.abs(tr.im) > 1e-12) {
    throw new Error(`imaginary expectation ${tr.im} beyond rounding — wrong physical object`);
  }
  return tr.re;
}

/** m = (1/n) Sum_i <Z_i>. */
export function magnetization(rho: CMat, n: number): number {
  let acc = 0;
  for (let i = 0; i < n; i++) acc += expectation(rho, siteZ(n, i));
  return acc / n;
}

/** Evolve rho through k drive periods: rho_k = F^k rho F^+. */
export function strobedRho(rho: CMat, f: CMat, k: number): CMat {
  let out = rho;
  for (let t = 0; t < k; t++) out = applyUnitary(out, f);
  return out;
}

// ---------------------------------------------------------------------------
// Witnesses for the exact layer (re-derive E1-E4; nothing is copied).
// ---------------------------------------------------------------------------

/** E1: worst_i max|F+ Z_i F + Z_i| at theta=pi/2, h=0, random couplings. */
export function flipIdentityDeviation(rng: Rng, n: number, trials: number): number {
  let worst = 0;
  for (let t = 0; t < trials; t++) {
    const couplings = Array.from({ length: n - 1 }, () => rng() * 2);
    const p: EchoParams = { n, theta: Math.PI / 2, fields: Array(n).fill(0), couplings };
    const f = echoFloquet(p);
    for (let i = 0; i < n; i++) {
      const conj = mMul(mMul(mDagger(f), siteZ(n, i)), f); // F+ Z_i F
      worst = Math.max(worst, maxAbs(mAdd(conj, siteZ(n, i)))); // + Z_i must vanish
    }
  }
  return worst;
}

/** E4: worst_k |m(k) - (-1)^k| from |0...0>, at theta=pi/2, h=0, random J. */
export function alternationDeviation(rng: Rng, n: number, trials: number, kMax: number): number {
  let worst = 0;
  for (let t = 0; t < trials; t++) {
    const couplings = Array.from({ length: n - 1 }, () => rng() * 2);
    const p: EchoParams = { n, theta: Math.PI / 2, fields: Array(n).fill(0), couplings };
    const f = echoFloquet(p);
    let rho = polarizedRho(n);
    for (let k = 0; k <= kMax; k++) {
      worst = Math.max(worst, Math.abs(magnetization(rho, n) - (k % 2 === 0 ? 1 : -1)));
      rho = applyUnitary(rho, f);
    }
  }
  return worst;
}

/** E2+E3: worst |tr F^{2m+1}| and worst |tr F^{2m} - (-1)^{nm} tr B^{2m}| (m=1..mMax). */
export function pairingDeviations(rng: Rng, n: number, trials: number, mMax: number): { odd: number; even: number } {
  let oddWorst = 0;
  let evenWorst = 0;
  for (let t = 0; t < trials; t++) {
    const couplings = Array.from({ length: n - 1 }, () => rng() * 2);
    const p: EchoParams = { n, theta: Math.PI / 2, fields: Array(n).fill(0), couplings };
    const f = echoFloquet(p);
    const energies = zzEnergies(p);
    const dim = 1 << n;
    let power = identity(dim);
    for (let j = 1; j <= 2 * mMax; j++) {
      power = mMul(power, f);
      const tr = mTrace(power);
      if (j % 2 === 1) {
        oddWorst = Math.max(oddWorst, Math.hypot(tr.re, tr.im));
      } else {
        // closed form through the energies: tr B^j = sum_z exp(-i j E_z)
        let bre = 0;
        let bim = 0;
        for (let z = 0; z < dim; z++) {
          bre += Math.cos(j * energies[z]!);
          bim -= Math.sin(j * energies[z]!);
        }
        const sign = ((n * j) / 2) % 2 === 0 ? 1 : -1; // (-1)^{n j/2}, j even
        evenWorst = Math.max(evenWorst, Math.hypot(tr.re - sign * bre, tr.im - sign * bim));
      }
    }
  }
  return { odd: oddWorst, even: evenWorst };
}

// ---------------------------------------------------------------------------
// v0.2.0 — THE LIFETIME LAYER (the priced next steps of TC4/TC13):
//   (L1) the isolated benchmark lifetime τ*(δ, θ) = ln θ / ln|cos 2δ| —
//        v0.20.0 RESTATEMENT (TC46): this is the DEPHASED drive's expected
//        echo crossing. The v0.2.0 reading — a COHERENT geometric decay
//        |m(k)| = |cos 2δ|^k — was verified tautologically (the "direct
//        simulation" iterated the formula itself) and is FALSE: the
//        coherent isolated qubit is the detuned rotor m(k) = (-1)^k cos 2kδ,
//        quasi-periodic, it never decays. The geometric law survives
//        EXACTLY IN EXPECTATION under per-period sign noise eps_j = ±δ
//        (E[m~(k)] = (cos 2δ)^k by independence of the sign product).
//   (L2) DATA, the chain: the stroboscopic horizon at which |m| first drops
//        below θ — capped at kMax, "still locked" reported as -1 (the
//        prethermal plateau can outlast any honest ED horizon).
//   (L3) DATA, the heating twin: the energy account's relaxation — the
//        first strobe at which cumulative heating reaches 90% of its
//        long-window total (the empirical E_∞ = mean of the last decile).
// ---------------------------------------------------------------------------

/** (L1) The dephased benchmark's expected-echo lifetime: the first strobe
 * at which the noise-averaged echo (cos 2δ)^k falls below θ. (v0.2.0's
 * closed form, relabeled by TC46 — the coherent isolated qubit crosses θ
 * by beating, not by decay, and recurs.) */
export function isolatedEchoLifetime(delta: number, threshold: number): number {
  const c = Math.abs(Math.cos(2 * delta));
  if (c >= 1) return Number.POSITIVE_INFINITY;
  return Math.ceil(Math.log(threshold) / Math.log(c));
}

export interface LifetimeRow {
  readonly delta: number;
  readonly tauIso: number; // closed form
  readonly tauChain: number; // measured horizon (strobes), -1 = still locked at kMax
  readonly kMax: number;
}

/** (L2) The chain's rigidity lifetime census: first strobe with |m| < θ. */
export function chainLifetimeCensus(
  n: number,
  deltas: readonly number[],
  kMax: number,
  threshold: number,
  j = 1.2,
): LifetimeRow[] {
  const rows: LifetimeRow[] = [];
  for (const delta of deltas) {
    const fields = Array.from({ length: n }, (_, i) => 0.05 + 0.1 * ((i % 3) / 2));
    const couplings = Array.from({ length: n - 1 }, () => j);
    const p: EchoParams = { n, theta: Math.PI / 2 + delta, fields, couplings };
    const f = echoFloquet(p);
    let rho = polarizedRho(n);
    let tau = -1;
    for (let k = 1; k <= kMax; k++) {
      rho = applyUnitary(rho, f);
      if (Math.abs(magnetization(rho, n)) < threshold) {
        tau = k;
        break;
      }
    }
    rows.push({ delta, tauIso: isolatedEchoLifetime(delta, threshold), tauChain: tau, kMax });
  }
  return rows;
}

export interface HeatingRow {
  readonly delta: number;
  readonly tauHeat: number; // strobes to 90% of the long-window heating, -1 = never reached
  readonly e0: number;
  readonly eInf: number; // empirical diagonal value (mean of the last decile)
  readonly totalDrift: number;
}

/** (L3) The heating twin: energy relaxation to the empirical diagonal value. */
export function heatingRelaxation(n: number, delta: number, kMax: number, j = 1.3): HeatingRow {
  const p: EchoParams = {
    n,
    theta: Math.PI / 2 + delta,
    fields: Array<number>(n).fill(0),
    couplings: Array<number>(n - 1).fill(j),
  };
  const f = echoFloquet(p);
  const h = (() => {
    const dim = 1 << n;
    const energies = zzEnergies(p);
    const m = mat(dim, dim);
    for (let z = 0; z < dim; z++) m.re[z * dim + z] = energies[z]!;
    return m;
  })();
  let rho = polarizedRho(n);
  const e0 = expectation(rho, h);
  const series: number[] = [];
  for (let k = 1; k <= kMax; k++) {
    rho = applyUnitary(rho, f);
    series.push(expectation(rho, h));
  }
  const tail = series.slice(Math.floor(series.length * 0.9));
  const eInf = tail.reduce((s, v) => s + v, 0) / tail.length;
  const total = eInf - e0;
  let tau = -1;
  if (total > 1e-9) {
    for (let k = 0; k < series.length; k++) {
      if (series[k]! - e0 >= 0.9 * total) {
        tau = k + 1;
        break;
      }
    }
  }
  return { delta, tauHeat: tau, e0, eInf, totalDrift: total };
}

// ---------------------------------------------------------------------------
// v0.3.0 — THE CLIFF LINE (the priced next step of TC19): where does the
// protection collapse sit as the coupling J varies? Bisection over δ with
// the criterion "chain lifetime exceeds the isolated benchmark by >= 10x"
// at a capped horizon — the measured phase-boundary curve δ_c(J).
// ---------------------------------------------------------------------------

/** One lifetime probe at given (J, δ) — returns strobes to |m| < θ, -1 if locked at kMax. */
export function chainLifetimeAt(n: number, j: number, delta: number, kMax: number, threshold: number): number {
  const fields = Array.from({ length: n }, (_, i) => 0.05 + 0.1 * ((i % 3) / 2));
  const p: EchoParams = { n, theta: Math.PI / 2 + delta, fields, couplings: Array.from({ length: n - 1 }, () => j) };
  const f = echoFloquet(p);
  let rho = polarizedRho(n);
  for (let k = 1; k <= kMax; k++) {
    rho = applyUnitary(rho, f);
    if (Math.abs(magnetization(rho, n)) < threshold) return k;
  }
  return -1;
}

export interface CliffPoint {
  readonly j: number;
  readonly deltaC: number; // the bisection's protected-side edge
  readonly tauBelow: number; // lifetime just below the edge
  readonly tauAbove: number; // lifetime just above the edge
}

/**
 * The cliff line by bisection: protected means tau_chain >= 10 × tau_iso
 * (with "locked at kMax" counting as protected); the returned edge is the
 * midpoint of the final protected/unprotected bracket.
 */
export function cliffBisect(
  n: number,
  j: number,
  kMax: number,
  threshold: number,
  lo = 0.05,
  hi = 0.6,
  iterations = 7,
): CliffPoint {
  const protectedAt = (delta: number): boolean => {
    const tau = chainLifetimeAt(n, j, delta, kMax, threshold);
    const iso = isolatedEchoLifetime(delta, threshold);
    return tau < 0 || tau >= 10 * iso;
  };
  let a = lo;
  let b = hi;
  if (!protectedAt(a) || protectedAt(b)) {
    throw new Error(`cliff bracket wrong at J=${j}: protected(lo)=${protectedAt(a)} protected(hi)=${protectedAt(b)}`);
  }
  for (let i = 0; i < iterations; i++) {
    const mid = (a + b) / 2;
    if (protectedAt(mid)) a = mid;
    else b = mid;
  }
  return {
    j,
    deltaC: (a + b) / 2,
    tauBelow: chainLifetimeAt(n, j, a, kMax, threshold),
    tauAbove: chainLifetimeAt(n, j, b, kMax, threshold),
  };
}

// ---------------------------------------------------------------------------
// Rigidity census (DATA): detuned chain vs isolated qubit, |m(k)| horizon.
// ---------------------------------------------------------------------------

export interface RigidityRow {
  readonly n: number;
  readonly delta: number;
  readonly k: number;
  readonly chainAbsM: number;
  readonly isolatedAbsM: number;
}

/**
 * DATA only: at equal detuning delta = theta - pi/2, the interacting chain's
 * |m(k)| against the isolated qubit's. v0.20.0 note (TC46): the isolated
 * arm (h = 0.05) does NOT decay — it is the detuned rotor, quasi-periodic
 * with recurrences; its dips are beatings (YAO17's peak splitting), not
 * losses. The honest isolated DECAY benchmark is the dephased drive's
 * expected echo (cos 2 delta)^k. Couplings J = 1.2 uniform, fields h_i in
 * [0.05, 0.15] so the chain's protection has something to protect against.
 * Finite horizon — NOT a lifetime theorem; the hardware-scale certificate
 * is MI22 (cited).
 */
export function rigidityCensus(n: number, deltas: readonly number[], kMax: number): RigidityRow[] {
  const rows: RigidityRow[] = [];
  const couplings = Array.from({ length: n - 1 }, () => 1.2);
  for (const delta of deltas) {
    const fields = Array.from({ length: n }, (_, i) => 0.05 + 0.1 * ((i % 3) / 2));
    const p: EchoParams = { n, theta: Math.PI / 2 + delta, fields, couplings };
    const f = echoFloquet(p);
    let rho = polarizedRho(n);
    // the isolated qubit: same detuning, its own field, no coupling
    const isoP: EchoParams = { n: 1, theta: Math.PI / 2 + delta, fields: [fields[0]!], couplings: [] };
    const isoF = echoFloquet(isoP);
    let isoRho = polarizedRho(1);
    for (let k = 1; k <= kMax; k++) {
      rho = applyUnitary(rho, f);
      isoRho = applyUnitary(isoRho, isoF);
      rows.push({
        n,
        delta,
        k,
        chainAbsM: Math.abs(magnetization(rho, n)),
        isolatedAbsM: Math.abs(magnetization(isoRho, 1)),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// v0.20.0 — TC46: THE ISOLATED ECHO LAWS, INDEPENDENTLY RE-VERIFIED.
//
// Route-price v0.2.0's cross-check CONVICTED the v0.2.0 verification of the
// isolated face as TAUTOLOGICAL: the shipped "direct simulation" iterated
// the closed form itself (m *= c in the test, the witness W-H, and
// scratch-life.ts), so it could not fail for ANY c. The independent paths,
// both through the family kernel (the real two-level simulation):
//   (C1) COHERENT, h = 0: the isolated qubit NEVER decays — it is the
//        detuned rotor m(k) = (-1)^k cos(2 k delta) EXACTLY (YAO17's
//        beating/splitting; a coherent closed system cannot decay
//        geometrically). First threshold crossings are beat crossings,
//        not lifetimes.
//   (C2) COHERENT, any h: the rotor generalizes — F = exp(-i theta X)
//        exp(-i h Z) = cos(b/2) I - i sin(b/2) (n.sigma) with b/axis read
//        off F once, so F^k is closed-form and the trajectory is the
//        quasi-periodic rotor at any field (the B1 census arm's law).
//   (D) DEPHASED, exact in expectation: with per-period sign errors
//        eps_j = ±delta (the noisy drive), m~(k) = cos(2 delta sum_j s_j)
//        and E[m~(k)] = (cos 2 delta)^k EXACTLY by independence — the
//        geometric law is the noise-averaged echo's law. Verified
//        EXHAUSTIVELY over all 2^k sign sequences at small k (an exact
//        expectation, not a sample) and by Monte Carlo beyond.
// The v0.2.0 coherent-geometric reading is FALSE — convicted with the
// deviation number below — and the tautology that smuggled it is preserved
// as a negative control: it "verifies" any decay constant it is handed.
// ---------------------------------------------------------------------------

/** The isolated qubit's coherent trajectory m(1..kMax) through the family
 * kernel — the independent simulation path the v0.2.0 witness lacked. */
export function isolatedEchoTrajectory(delta: number, h: number, kMax: number): number[] {
  const p: EchoParams = { n: 1, theta: Math.PI / 2 + delta, fields: [h], couplings: [] };
  const f = echoFloquet(p);
  let rho = polarizedRho(1);
  const out: number[] = [];
  for (let k = 0; k < kMax; k++) {
    rho = applyUnitary(rho, f);
    out.push(magnetization(rho, 1));
  }
  return out;
}

/** (C1) worst |kernel m(k) - (-1)^k cos 2k delta| over k <= kMax at h = 0. */
export function coherentEchoLawDeviation(delta: number, kMax: number): number {
  let worst = 0;
  isolatedEchoTrajectory(delta, 0, kMax).forEach((m, i) => {
    const k = i + 1;
    worst = Math.max(worst, Math.abs(m - (k % 2 === 0 ? 1 : -1) * Math.cos(2 * k * delta)));
  });
  return worst;
}

/** (C2) the rotor decomposition of the isolated Floquet operator
 * F = exp(-i theta X) exp(-i h Z): rotation angle b and axis n (the axis
 * reconstruction's own deviation from unit norm is reported — the road's
 * self-check). */
export function isolatedRotorParts(delta: number, h: number): {
  beta: number;
  nx: number;
  ny: number;
  nz: number;
  normDev: number;
} {
  const p: EchoParams = { n: 1, theta: Math.PI / 2 + delta, fields: [h], couplings: [] };
  const f = echoFloquet(p);
  const trHalf = (f.re[0]! + f.re[3]!) / 2; // SU(2): tr F = 2 cos(b/2), real
  const beta = 2 * Math.acos(Math.min(1, Math.abs(trHalf)));
  const s = Math.sin(beta / 2);
  // F = cos(b/2) I - i sin(b/2)(nx X + ny Y + nz Z) reads the axis directly
  const nx = -f.im[1]! / s;
  const ny = -f.re[1]! / s;
  const nz = -f.im[0]! / s;
  return { beta, nx, ny, nz, normDev: Math.abs(Math.sqrt(nx * nx + ny * ny + nz * nz) - 1) };
}

/** (C2) worst |kernel trajectory - rotor-road trajectory| at field h (the
 * rotor road builds F^k from (b, n) once; the kernel road multiplies F k
 * times — two independent roads to the same quasi-periodic signal). */
export function rotorEchoLawDeviation(delta: number, h: number, kMax: number): number {
  const { beta, nx, ny, nz } = isolatedRotorParts(delta, h);
  const traj = isolatedEchoTrajectory(delta, h, kMax);
  let worst = 0;
  traj.forEach((m, i) => {
    const k = i + 1;
    const ck = Math.cos((k * beta) / 2);
    const sk = Math.sin((k * beta) / 2);
    // F^k |0> = (ck - i sk nz, sk ny - i sk nx); m = |a|^2 - |b|^2
    const aRe = ck;
    const aIm = -sk * nz;
    const bRe = sk * ny;
    const bIm = -sk * nx;
    worst = Math.max(worst, Math.abs(m - (aRe * aRe + aIm * aIm - (bRe * bRe + bIm * bIm))));
  });
  return worst;
}

/** THE CONVICTION: worst ||m(k)| - |cos 2 delta|^k| — the v0.2.0 law against
 * the kernel path it was never checked against. */
export function convictedLawDeviation(delta: number, kMax: number): number {
  let worst = 0;
  isolatedEchoTrajectory(delta, 0, kMax).forEach((m, i) => {
    const k = i + 1;
    worst = Math.max(worst, Math.abs(Math.abs(m) - Math.abs(Math.cos(2 * delta)) ** k));
  });
  return worst;
}

/** THE TAUTOLOGY, preserved as the negative control — the v0.2.0 witness's
 * "direct simulation" verbatim: iterate c into itself and compare with the
 * closed form built FROM THE SAME c. Returns agreement for ANY c (feed it
 * |cos 3 delta| and it still passes) — the demonstration that it verifies
 * nothing. The honest roads are coherentEchoLawDeviation (exact) and the
 * dephased witnesses below. */
export function tautologicalIsoAgreement(c: number, threshold: number): boolean {
  const tau = Math.ceil(Math.log(threshold) / Math.log(c));
  let k = 0;
  let m = 1;
  while (m >= threshold && k < 100000) {
    k++;
    m *= c;
  }
  return tau === k;
}

/** (D) one noisy-drive trajectory: k kicks exp(-i(pi/2 + s_j delta)X), the
 * signs s_j = ±1 the drive noise, applied to |0> through the kernel's own
 * kick builder; returns the echo-corrected signal m~(k) = (-1)^k m(k). */
export function dephasedEchoSample(rng: Rng, delta: number, k: number): number {
  let rho = polarizedRho(1);
  for (let j = 0; j < k; j++) {
    const theta = Math.PI / 2 + (rng() < 0.5 ? delta : -delta);
    rho = applyUnitary(rho, kickStroke(theta, 1));
  }
  const m = magnetization(rho, 1);
  return k % 2 === 0 ? m : -m;
}

/** (D) the dephased law's EXACT expectation: all 2^k sign sequences through
 * the kernel, averaged — E[m~(k)] must equal (cos 2 delta)^k. Domain
 * k <= 16 (the ensemble is exponential). */
export function dephasedEchoExpectationExact(delta: number, k: number): number {
  if (k < 1 || k > 16) throw new Error("dephasedEchoExpectationExact: 1 <= k <= 16 (the ensemble is exponential)");
  const seq = 1 << k;
  const signs = new Float64Array(k);
  let sum = 0;
  for (let mask = 0; mask < seq; mask++) {
    for (let j = 0; j < k; j++) signs[j] = (mask >> j) & 1 ? delta : -delta;
    let rho = polarizedRho(1);
    for (let j = 0; j < k; j++) rho = applyUnitary(rho, kickStroke(Math.PI / 2 + signs[j]!, 1));
    const m = magnetization(rho, 1);
    sum += k % 2 === 0 ? m : -m;
  }
  return sum / seq;
}

/** (D) the dephased law's Monte-Carlo mean and standard error at large k. */
export function dephasedEchoMean(rng: Rng, delta: number, k: number, samples: number): { mean: number; se: number } {
  const vals = new Float64Array(samples);
  let sum = 0;
  for (let t = 0; t < samples; t++) {
    vals[t] = dephasedEchoSample(rng, delta, k);
    sum += vals[t]!;
  }
  const mean = sum / samples;
  let vr = 0;
  for (let t = 0; t < samples; t++) vr += (vals[t]! - mean) ** 2;
  return { mean, se: Math.sqrt(vr / (samples - 1) / samples) };
}

/** (D) the benchmark lifetime's crossing, MC-witnessed: E[m~] at tau*-1
 * must sit above theta and at tau* below it. */
export function dephasedLifetimeCrossing(
  rng: Rng,
  delta: number,
  threshold: number,
  samples: number,
): { tau: number; below: number; at: number } {
  const tau = isolatedEchoLifetime(delta, threshold);
  const below = dephasedEchoMean(rng, delta, tau - 1, samples).mean;
  const at = dephasedEchoMean(rng, delta, tau, samples).mean;
  return { tau, below, at };
}

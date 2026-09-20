/**
 * R21 agent omicron — F15 spec-as-assumption pre-verification, v2 (OUTSIDE the repos).
 *
 * v1 FALSIFIED the task sheet's first reading: T_tau is NOT a class function
 * (max intra-class deviation 0.1875). The correct structure (v2 verifies):
 *  (A) T_{pi,sigma} depends only on the group element pi^-1 sigma (LEFT
 *      invariance under identical channels) — 24 coefficients, not 5.
 *  (B) For the ensemble-average input I/2 the coefficients are scalars
 *      a_tau * I (X,Z covariance of the depolarizing dilation); for the
 *      member inputs |0><0| they are diag(x_tau, a_tau - x_tau).
 *  (C) The 48x48 C(c)S operators are group circulants: they commute with the
 *      left regular representation, hence block-diagonalize along the S4
 *      isotypic decomposition (blocks of size 2*dim R, multiplicity dim R) —
 *      THIS is the class structure of the spectrum: the character table
 *      labels the blocks.
 *  (D) Base spectra at c=1 are rational (dyadic-ish denominators); eig(c) =
 *      c*base + (1-c)/48 affine; chi4(lambda) decreasing + convex.
 */
import {
  type CMat,
  mat,
  mMul,
  mDagger,
  matEq,
  eigenvaluesHermitian,
  mAdd,
  mScale,
} from "../readout-wall/src/core/cmat.js";
import { completelyDepolarizingKraus } from "../readout-wall/src/switch/chanlib.js";
import { krausToStinespring } from "../readout-wall/src/switch/isometry.js";
import { vonNeumannEntropy } from "../readout-wall/src/core/measures.js";

// --- S4 group machinery ------------------------------------------------------------------------

type Perm = readonly [number, number, number, number];

const S4: Perm[] = (() => {
  const out: Perm[] = [];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++)
      for (let c = 0; c < 4; c++)
        for (let d = 0; d < 4; d++) {
          const seen = new Set([a, b, c, d]);
          if (seen.size === 4) out.push([a, b, c, d]);
        }
  return out;
})();

const comp = (a: Perm, b: Perm): Perm => [a[b[0]!]!, a[b[1]!]!, a[b[2]!]!, a[b[3]!]!];
const inv = (p: Perm): Perm => {
  const q: number[] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) q[p[i]!] = i;
  return [q[0]!, q[1]!, q[2]!, q[3]!];
};

function cycleType(p: Perm): string {
  const done = [false, false, false, false];
  const lens: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (done[i]!) continue;
    let len = 0;
    let j = i;
    while (!done[j]!) {
      done[j] = true;
      j = p[j]!;
      len++;
    }
    lens.push(len);
  }
  lens.sort((x, y) => y - x);
  const counts = new Map<number, number>();
  for (const l of lens) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts.entries()]
    .sort((x, y) => y[0] - x[0])
    .map(([l, n]) => (n === 1 ? `${l}` : `${l}^${n}`))
    .join(".");
}

// --- the k=4 branch isometry composer (fixed-slot discipline, adapted from kswitch3) -----------

const STRIDES = (dims: readonly number[]): number[] => {
  const s: number[] = new Array<number>(dims.length);
  s[dims.length - 1] = 1;
  for (let i = dims.length - 2; i >= 0; i--) s[i] = s[i + 1]! * dims[i + 1]!;
  return s;
};

function permuteSlots(
  re: Float64Array,
  im: Float64Array,
  dims: number[],
  perm: number[],
): { re: Float64Array; im: Float64Array; dims: number[] } {
  const m = dims.length;
  const strides = STRIDES(dims);
  const newDims = perm.map((p) => dims[p]!);
  const newStrides = STRIDES(newDims);
  const outRe = new Float64Array(re.length);
  const outIm = new Float64Array(im.length);
  for (let idx = 0; idx < re.length; idx++) {
    let rest = idx;
    const digits: number[] = new Array<number>(m);
    for (let i = 0; i < m; i++) {
      digits[i] = Math.floor(rest / strides[i]!);
      rest %= strides[i]!;
    }
    let newIdx = 0;
    for (let k = 0; k < m; k++) newIdx += digits[perm[k]!]! * newStrides[k]!;
    outRe[newIdx] = re[idx]!;
    outIm[newIdx] = im[idx]!;
  }
  return { re: outRe, im: outIm, dims: newDims };
}

const depol = krausToStinespring(completelyDepolarizingKraus(2));
const E = depol.envDim; // 4

function branchIsometry4(pi: Perm): { re: Float64Array; im: Float64Array; rows: number } {
  const d = 2;
  const rows = d * E ** 4;
  const re = new Float64Array(rows * d);
  const im = new Float64Array(rows * d);
  for (let i = 0; i < d; i++) {
    let dims = [d];
    let cre = new Float64Array(d);
    let cim = new Float64Array(d);
    cre[i] = 1;
    for (const k of pi) {
      const st = depol.V;
      const newDims = [d, E, ...dims.slice(1)];
      const size = newDims.reduce((a, b) => a * b, 1);
      const nre = new Float64Array(size);
      const nim = new Float64Array(size);
      const liveStride = Math.max(1, size / (d * E));
      for (let rest = 0; rest < liveStride; rest++)
        for (let s = 0; s < d; s++)
          for (let m = 0; m < E; m++) {
            let are = 0;
            let aim = 0;
            const rowIdx = (s * E + m) * d;
            for (let j = 0; j < d; j++) {
              const ar = cre[j * liveStride + rest]!;
              const ai = cim[j * liveStride + rest]!;
              if (ar === 0 && ai === 0) continue;
              const vr = st.re[rowIdx + j]!;
              const vi = st.im[rowIdx + j]!;
              are += vr * ar - vi * ai;
              aim += vr * ai + vi * ar;
            }
            const target = (s * E + m) * liveStride + rest;
            nre[target] = are;
            nim[target] = aim;
          }
      dims = newDims;
      cre = nre;
      cim = nim;
    }
    const perm: number[] = [0];
    for (let c = 0; c < 4; c++)
      for (let t = 0; t < 4; t++)
        if (pi[t] === c) {
          perm.push(4 - t); // old env slot (1-based), holding channel c
          break;
        }
    const fixed = permuteSlots(cre, cim, dims, perm);
    for (let r = 0; r < rows; r++) {
      re[r * d + i] = fixed.re[r]!;
      im[r * d + i] = fixed.im[r]!;
    }
  }
  return { re, im, rows };
}

const W: { re: Float64Array; im: Float64Array; rows: number }[] = S4.map((pi) => branchIsometry4(pi));
const ID = S4.findIndex((p) => p[0] === 0 && p[1] === 1 && p[2] === 2 && p[3] === 3);

/** rho as [r00, r01re, r01im, r11]; returns the 2x2 T block [00, 01re, 01im, 11]. */
function tCross(piIdx: number, sigmaIdx: number, rho: readonly number[]): number[] {
  const wp = W[piIdx]!;
  const ws = W[sigmaIdx]!;
  const out = [0, 0, 0, 0];
  const envSpan = E ** 4;
  for (let a = 0; a < 2; a++)
    for (let b = 0; b < 2; b++) {
      let accRe = 0;
      let accIm = 0;
      for (let env = 0; env < envSpan; env++)
        for (let j = 0; j < 2; j++)
          for (let k = 0; k < 2; k++) {
            const rr = j === k ? (j === 0 ? rho[0]! : rho[3]!) : rho[1]!;
            const ri = j === k ? 0 : j === 0 ? rho[2]! : -rho[2]!;
            if (rr === 0 && ri === 0) continue;
            const pr = wp.re[(a * envSpan + env) * 2 + j]!;
            const pi_ = wp.im[(a * envSpan + env) * 2 + j]!;
            const sr = ws.re[(b * envSpan + env) * 2 + k]!;
            const si = ws.im[(b * envSpan + env) * 2 + k]!;
            const xr = pr * rr - pi_ * ri;
            const xi = pr * ri + pi_ * rr;
            accRe += xr * sr + xi * si;
            accIm += xi * sr - xr * si;
          }
      if (a === b) out[a * 2 + b] = accRe;
      else {
        out[1] = accRe;
        out[2] = accIm;
      }
    }
  return out;
}

const RHO_AVG = [0.5, 0, 0, 0.5];
const RHO_0 = [1, 0, 0, 0];

// (A) LEFT invariance: T_{pi,sigma} depends only on pi^-1 sigma
{
  let maxDev = 0;
  for (let g = 0; g < 24; g++)
    for (let t = 1; t < 24; t++) {
      // pair (g, g*t) vs pair (id, t): pi^-1 sigma = t in both
      const piIdx = S4.findIndex((x) => comp(S4[g]!, S4[t]!).every((v, i) => v === x[i]));
      const direct = tCross(piIdx, g, RHO_AVG);
      const base = tCross(t, ID, RHO_AVG);
      for (let i = 0; i < 4; i++) maxDev = Math.max(maxDev, Math.abs(direct[i]! - base[i]!));
    }
  console.log(
    `(A) left invariance T_{pi,sigma} = T_{pi^-1 sigma}: max dev over 24x23 translated pairs ${maxDev.toExponential(3)} (want <1e-12)`,
  );
}

// (B) the 24-entry coefficient tables; scalar structure for avg, diag for member
const aTau = S4.map((_, t) => tCross(t, ID, RHO_AVG));
const mTau = S4.map((_, t) => tCross(t, ID, RHO_0));

{
  let scalarOK = true;
  let diagOK = true;
  let offDiagMax = 0;
  for (let t = 0; t < 24; t++) {
    const [r00, r01re, r01im, r11] = aTau[t]!;
    if (Math.abs(r00 - r11) > 1e-12 || Math.abs(r01re) > 1e-12 || Math.abs(r01im) > 1e-12)
      scalarOK = false;
    const [m00, m01re, m01im, m11] = mTau[t]!;
    offDiagMax = Math.max(offDiagMax, Math.abs(m01re), Math.abs(m01im));
    if (Math.abs(m00 + m11 - (r00 + r11)) > 1e-12) diagOK = false;
  }
  console.log(
    `(B) avg coefficients all scalar a_tau*I: ${scalarOK}; member coefficients diagonal with m00+m11 = a_tau: ${diagOK} (offdiag ${offDiagMax.toExponential(2)})`,
  );
  console.log("(B) the 24-entry table (tau: cycleType -> [a_tau, x_tau]):");
  const rows: string[] = [];
  for (let t = 0; t < 24; t++) {
    rows.push(
      `    S4[#${t}] ${cycleType(S4[t]!)}: a=${aTau[t]![0]!.toFixed(8)} x=${mTau[t]![0]!.toFixed(8)}`,
    );
  }
  console.log(rows.join("\n"));
  const byClass = new Map<string, number[]>();
  for (let t = 0; t < 24; t++) {
    const key = cycleType(S4[t]!);
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(aTau[t]![0]!);
  }
  let intraA = 0;
  for (const v of byClass.values()) for (const x of v) intraA = Math.max(intraA, Math.abs(x - v[0]!));
  console.log(
    `(B) is a_tau a CLASS function? max intra-class deviation ${intraA.toExponential(3)} ${intraA < 1e-12 ? "(YES)" : "(NO — v1's falsified reading stands)"}`,
  );
}

// coefficient-indexed 48x48 build vs direct 576-pair build
const TAU_OF = S4.map((p) =>
  S4.map((s) => S4.findIndex((x) => comp(inv(p), s).every((v, i) => v === x[i]))),
);

function buildJoint(rho: readonly number[], c: number, viaCoefficients: boolean): CMat {
  const n = 48;
  const m = mat(n, n);
  const tab = rho === RHO_AVG ? aTau : mTau;
  for (let p = 0; p < 24; p++)
    for (let s = 0; s < 24; s++) {
      const T = viaCoefficients ? tab[TAU_OF[p]![s]!]! : tCross(p, s, rho);
      const diag = p === s ? 1 / 24 : c / 24;
      const put = (a: number, b: number, re: number, im: number) => {
        m.re[(p * 2 + a) * n + s * 2 + b] += re * diag;
        m.im[(p * 2 + a) * n + s * 2 + b] += im * diag;
      };
      put(0, 0, T[0]!, 0);
      put(1, 1, T[3]!, 0);
      put(0, 1, T[1]!, T[2]!);
      put(1, 0, T[1]!, -T[2]!);
    }
  return m;
}

{
  const cls = buildJoint(RHO_AVG, 1, true);
  const dir = buildJoint(RHO_AVG, 1, false);
  const dir0 = buildJoint(RHO_0, 1, false);
  const cls0 = buildJoint(RHO_0, 1, true);
  let trace = 0;
  for (let i = 0; i < 48; i++) trace += cls.re[i * 48 + i]!;
  console.log(
    `(C) coefficient build vs direct 576-pair build: avg matEq(1e-12)=${matEq(cls, dir, 1e-12)} member0 matEq(1e-12)=${matEq(cls0, dir0, 1e-12)}; trace(avg)=${trace.toFixed(12)}`,
  );
}

// (D) base spectra, rational reconstruction, affine law, chi4
function eigs48(rho: readonly number[], c: number): Float64Array {
  return eigenvaluesHermitian(buildJoint(rho, c, true)).sort((x, y) => x - y);
}

function reconstruct(vals: Float64Array): { D: number; ns: number[] } | null {
  for (let j = 0; j <= 16; j++)
    for (const D of [3 * 2 ** j, 2 ** j]) {
      let ok = true;
      const ns: number[] = [];
      for (const v of vals) {
        const n = Math.round(v * D);
        if (Math.abs(v - n / D) > 1e-9) {
          ok = false;
          break;
        }
        ns.push(n);
      }
      if (ok) return { D, ns };
    }
  return null;
}

const avgBase = eigs48(RHO_AVG, 1);
const mem0Base = eigs48(RHO_0, 1);
{
  const minA = Math.min(...avgBase);
  const minM = Math.min(...mem0Base);
  const ra = reconstruct(avgBase);
  const rm = reconstruct(mem0Base);
  console.log(
    `(D) avg base: min eig ${minA.toExponential(3)} sum ${avgBase.reduce((a, b) => a + b, 0).toFixed(12)} D=${ra?.D}`,
  );
  console.log(
    `(D) member0 base: min eig ${minM.toExponential(3)} sum ${mem0Base.reduce((a, b) => a + b, 0).toFixed(12)} D=${rm?.D}`,
  );
  const counts = (ns: number[]) => {
    const c = new Map<number, number>();
    for (const n of ns) c.set(n, (c.get(n) ?? 0) + 1);
    return [...c.entries()].sort((x, y) => x[0] - y[0]).map(([n, k]) => `${n}x${k}`).join(" ");
  };
  console.log(`(D) avg spectrum n/D: [${counts(ra?.ns ?? [])}]`);
  console.log(`(D) member0 spectrum n/D: [${counts(rm?.ns ?? [])}]`);
}

{
  let maxDev = 0;
  for (const c of [0.9, 0.5, 0.37])
    for (const [name, base] of [
      ["avg", avgBase],
      ["member0", mem0Base],
    ] as const) {
      const rho = name === "avg" ? RHO_AVG : RHO_0;
      const got = eigs48(rho, c);
      let d = 0;
      for (let i = 0; i < 48; i++)
        d = Math.max(d, Math.abs(got[i]! - (c * base[i]! + (1 - c) / 48)));
      maxDev = Math.max(maxDev, d);
    }
  console.log(
    `(D) affine law eig(c) = c*base + (1-c)/48: max dev ${maxDev.toExponential(3)} (want <1e-11)`,
  );
}

{
  const vals: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const c = 1 - i / 20;
    const sa = vonNeumannEntropy(buildJoint(RHO_AVG, c, true));
    const s0 = vonNeumannEntropy(buildJoint(RHO_0, c, true));
    vals.push(sa - s0);
  }
  let dec = true;
  let cvx = true;
  let minGap = Infinity;
  let minDD = Infinity;
  for (let i = 0; i + 1 < vals.length; i++) {
    const gap = vals[i]! - vals[i + 1]!;
    minGap = Math.min(minGap, gap);
    if (gap <= 1e-13) dec = false;
  }
  for (let i = 1; i + 1 < vals.length; i++) {
    const dd = vals[i - 1]! + vals[i + 1]! - 2 * vals[i]!;
    minDD = Math.min(minDD, dd);
    if (dd <= 1e-13) cvx = false;
  }
  console.log(
    `(D) chi4 float grid: chi4(0)=${vals[0]!.toFixed(9)} chi4(1)=${vals[20]!.toExponential(3)} decreasing=${dec} (min gap ${minGap.toExponential(3)}) convex=${cvx} (min dd ${minDD.toExponential(3)})`,
  );
}

// (E) S4 character table + isotypic blocks
const CLASSES = ["1^4", "2.1^2", "2^2", "3.1", "4"] as const;
const CLASS_SIZES: Record<string, number> = { "1^4": 1, "2.1^2": 6, "2^2": 3, "3.1": 8, "4": 6 };
const CHARS: { name: string; dim: number; chi: Record<string, number> }[] = [
  { name: "trivial", dim: 1, chi: { "1^4": 1, "2.1^2": 1, "2^2": 1, "3.1": 1, "4": 1 } },
  { name: "sign", dim: 1, chi: { "1^4": 1, "2.1^2": -1, "2^2": 1, "3.1": 1, "4": -1 } },
  { name: "rho2", dim: 2, chi: { "1^4": 2, "2.1^2": 0, "2^2": 2, "3.1": -1, "4": 0 } },
  { name: "standard", dim: 3, chi: { "1^4": 3, "2.1^2": 1, "2^2": -1, "3.1": 0, "4": -1 } },
  { name: "standard*sign", dim: 3, chi: { "1^4": 3, "2.1^2": -1, "2^2": -1, "3.1": 0, "4": 1 } },
];

{
  let orthOK = true;
  for (const R of CHARS) {
    const s = CLASSES.reduce((acc, c) => acc + CLASS_SIZES[c]! * R.chi[c]! * R.chi[c]!, 0);
    if (s !== 24) orthOK = false;
  }
  for (let i = 0; i < CHARS.length; i++)
    for (let j = i + 1; j < CHARS.length; j++) {
      const s = CLASSES.reduce(
        (acc, c) => acc + CLASS_SIZES[c]! * CHARS[i]!.chi[c]! * CHARS[j]!.chi[c]!,
        0,
      );
      if (s !== 0) orthOK = false;
    }
  const regOK = CLASSES.every(
    (c) => CHARS.reduce((acc, R) => acc + R.dim * R.chi[c]!, 0) === (c === "1^4" ? 24 : 0),
  );
  const sumSq = CHARS.reduce((acc, R) => acc + R.dim * R.dim, 0);
  console.log(
    `(E) character table: orthogonality ${orthOK}, regular-character law ${regOK}, sum dim^2 = ${sumSq} (want 24)`,
  );
}

// isotypic blocks of the avg and member operators at c=1
// CORRECT multiplicity law: the isotypic component (dim 2*dimR^2, with S) carries
// each eigenvalue of the reduced (2*dimR)-dim block exactly dimR times.
{
  for (const [name, rho] of [
    ["avg", RHO_AVG],
    ["member0", RHO_0],
  ] as const) {
    const op = buildJoint(rho, 1, true);
    const n = 48;
    const L = S4.map((g) => {
      const m = mat(24, 24);
      for (let p = 0; p < 24; p++) {
        const gp = S4.findIndex((x) => comp(g, S4[p]!).every((v, i) => v === x[i]));
        m.re[gp * 24 + p] = 1;
      }
      return m;
    });
    let maxComm = 0;
    // direct entrywise invariance: rho[(g pi),(g sigma)] == rho[(pi),(sigma)] for all pairs
    let maxEntry = 0;
    for (const gi of [1, 7, 13]) {
      const g = S4[gi]!;
      for (let p = 0; p < 24; p++)
        for (let s = 0; s < 24; s++) {
          const gp = S4.findIndex((x) => comp(g, S4[p]!).every((v, i) => v === x[i]));
          const gs = S4.findIndex((x) => comp(g, S4[s]!).every((v, i) => v === x[i]));
          for (let a = 0; a < 2; a++)
            for (let b = 0; b < 2; b++) {
              const v1 = op.re[(gp * 2 + a) * n + gs * 2 + b]!;
              const v2 = op.re[(p * 2 + a) * n + s * 2 + b]!;
              maxEntry = Math.max(maxEntry, Math.abs(v1 - v2));
            }
        }
    }
    console.log(`      [debug] entrywise left-invariance rho[(g pi),(g sigma)]=rho[(pi,sigma)]: ${maxEntry.toExponential(3)}`);
    for (const g of [1, 7, 13]) {
      const Lg = L[g]!;
      const full = mat(n, n);
      for (let i = 0; i < 24; i++)
        for (let j = 0; j < 24; j++)
          if (Lg.re[i * 24 + j]! !== 0)
            for (let a = 0; a < 2; a++)
              for (let b = 0; b < 2; b++)
                full.re[(i * 2 + a) * n + j * 2 + b] = Lg.re[i * 24 + j]!;
      const lhs = mMul(full, mMul(op, mDagger(full)));
      const diff = mAdd(lhs, mScale(op, -1));
      for (let i = 0; i < n * n; i++)
        maxComm = Math.max(maxComm, Math.abs(diff.re[i]!), Math.abs(diff.im[i]!));
    }
    const fullSpectrum = [...eigenvaluesHermitian(op)].sort((a, b) => a - b);
    const pooled: number[] = [];
    const report: string[] = [];
    let allOK = maxComm < 1e-12;
    for (const R of CHARS) {
      const P = mat(24, 24);
      for (let t = 0; t < 24; t++) {
        const sc = (R.dim / 24) * R.chi[cycleType(S4[t]!)]!;
        for (let i = 0; i < 24 * 24; i++) P.re[i]! += sc * L[t]!.re[i]!;
      }
      let tr = 0;
      for (let i = 0; i < 24; i++) tr += P.re[i * 24 + i]!;
      const ortho: number[][] = [];
      for (let i = 0; i < 24 && ortho.length < R.dim * R.dim; i++) {
        const w = new Array<number>(24).fill(0);
        for (let a = 0; a < 24; a++)
          for (let b = 0; b < 24; b++) w[a]! += P.re[a * 24 + b]! * (b === i ? 1 : 0);
        const v = w;
        for (const u of ortho) {
          let dot = 0;
          for (let a = 0; a < 24; a++) dot += u[a]! * v[a]!;
          for (let a = 0; a < 24; a++) v[a]! -= dot * u[a]!;
        }
        const nrm = Math.hypot(...v);
        if (nrm > 1e-8) ortho.push(v.map((x) => x / nrm));
      }
      const bd = R.dim * R.dim * 2;
      const block = mat(bd, bd);
      for (let x = 0; x < bd; x++)
        for (let y = 0; y < bd; y++) {
          const ux = ortho[Math.floor(x / 2)]!;
          const uy = ortho[Math.floor(y / 2)]!;
          const ax = x % 2;
          const ay = y % 2;
          let val = 0;
          for (let pi = 0; pi < 24; pi++)
            for (let sg = 0; sg < 24; sg++)
              val += ux[pi]! * uy[sg]! * op.re[(pi * 2 + ax) * 48 + sg * 2 + ay]!;
          block.re[x * bd + y] = val;
        }
      // every entry dyadic? (block * 2^k integral for some k <= 24)
      let dyadicOK = true;
      outer: for (let k = 0; k <= 24; k++) {
        dyadicOK = true;
        for (let i = 0; i < bd * bd; i++) {
          const v = block.re[i]! * 2 ** k;
          if (Math.abs(v - Math.round(v)) > 1e-6) {
            dyadicOK = false;
            break outer;
          }
        }
        if (dyadicOK) break;
      }
      const blockEigs = [...eigenvaluesHermitian(block)].sort((a, b) => a - b);
      pooled.push(...blockEigs);
      // multiplicity law: each DISTINCT eigenvalue appears a multiple of dimR times
      const groups = new Map<string, number>();
      for (const e of blockEigs) {
        const key = e.toFixed(6);
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      const multOK = [...groups.values()].every((k) => k % R.dim === 0);
      allOK = allOK && multOK && dyadicOK && Math.abs(tr - R.dim * R.dim) < 1e-9;
      const distinct = [...groups.entries()].map(([k, c]) => `${k}x${c}`).join(" ");
      report.push(
        `${R.name} (dim ${R.dim}): ${bd}x${bd} block, traceP=${tr.toFixed(6)}, entries dyadic=${dyadicOK}, multiplicity %${R.dim}=${multOK}, eigs=[${distinct}]`,
      );
    }
    pooled.sort((a, b) => a - b);
    let d = 0;
    for (let i = 0; i < 48; i++) d = Math.max(d, Math.abs(pooled[i]! - fullSpectrum[i]!));
    const reconstructOK = d < 1e-9;
    console.log(
      `(E) ${name}: commutation dev ${maxComm.toExponential(3)}, pooled blocks reconstruct the 48 (dev ${d.toExponential(2)}) -> ${reconstructOK}, allOK=${allOK && reconstructOK}`,
    );
    for (const line of report) console.log(`      ${line}`);
    if (name === "member0") {
      console.log(`(E) member0 full base spectrum (48, sorted): [${fullSpectrum.map((e) => e.toFixed(9)).join(", ")}]`);
      console.log(`(E) avg full base spectrum (48, sorted): [${eigenvaluesHermitian(buildJoint(RHO_AVG, 1, true)).sort((a, b) => a - b).map((e) => e.toFixed(9)).join(", ")}]`);
    }
  }
}

console.log("PREVERIFY_F15_DONE");

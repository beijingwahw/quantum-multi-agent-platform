import { randomMps, normalizeMps } from "./mps.js";
import type { Mps } from "./mps.js";
import { jacobiEigenWithVectors } from "../core/jacobi.js";
import { MPO_DIM } from "./mpo.js";
import type { ChainHamiltonian } from "./mpo.js";
import { buildMpo } from "./mpo.js";
import { Rng } from "../core/rng.js";

/**
 * 两位点 DMRG —— H 的基态（实 MPS，变分上界）。MPO 稀疏表贯穿环境吸收
 * 与有效哈密顿量 matvec（W 每站仅 ~7 个非零元）。裁判：n ≤ 12 与虚时
 * 投影能量对拍（test/tn.test.ts）。
 */

export interface DmrgOptions {
  readonly chiMax?: number;
  readonly sweeps?: number;
  readonly lanczosK?: number;
  readonly seed?: number;
}

export interface DmrgResult {
  readonly state: Mps;
  readonly energy: number;
  readonly sweeps: number;
  readonly maxBond: number;
  readonly maxDiscarded: number;
  readonly wallMs: number;
}

interface MpEntry {
  readonly wl: number;
  readonly sp: number;
  readonly s: number;
  readonly wr: number;
  readonly v: number;
}

interface Env {
  chi: number;
  data: Float64Array; // [a, w, a'] 平铺 a*wDim*chi + w*chi + a'
}

/** ⟨ψ|H|ψ⟩ 公开裁判接口（全网络收缩）。 */
export function energyOf(state: Mps, h: ChainHamiltonian): number {
  const mpo = buildMpo(h);
  const sparse = mpo.map(sparseOf);
  let env: Env = { chi: 1, data: new Float64Array(MPO_DIM) };
  env.data[0] = 1;
  for (let i = 0; i < h.n; i++) {
    env = absorbLeft(env, state.tensors[i]!, state.chis[i]!, state.chis[i + 1]!, sparse[i]!);
  }
  return env.data[envIdx(0, 3, 0, env.chi)]!;
}

function envIdx(a: number, w: number, ap: number, chi: number): number {
  return a * MPO_DIM * chi + w * chi + ap;
}

function sparseOf(t: Float64Array): MpEntry[] {
  const entries: MpEntry[] = [];
  for (let wl = 0; wl < MPO_DIM; wl++) {
    for (let sp = 0; sp < 2; sp++) {
      for (let sk = 0; sk < 2; sk++) {
        for (let wr = 0; wr < MPO_DIM; wr++) {
          const v = t[((wl * 2 + sp) * 2 + sk) * MPO_DIM + wr]!;
          if (v !== 0) entries.push({ wl, sp, s: sk, wr, v });
        }
      }
    }
  }
  return entries;
}

/** L_{i+1}[b,wr,bp] += Σ L_i[a,wl,a']·A_i[a,s,b]·W_i[wl→wr]·A_i[a',s',b'] */
function absorbLeft(L: Env, t: Float64Array, chiL: number, cr: number, entries: readonly MpEntry[]): Env {
  const w = MPO_DIM;
  const next = new Float64Array(cr * w * cr);
  for (const e of entries) {
    for (let a = 0; a < chiL; a++) {
      for (let ap = 0; ap < chiL; ap++) {
        const lval = L.data[envIdx(a, e.wl, ap, chiL)]!;
        if (lval === 0) continue;
        const v0 = e.v * lval;
        const rowS = (a * 2 + e.s) * cr;
        const rowSp = (ap * 2 + e.sp) * cr;
        for (let b = 0; b < cr; b++) {
          const v1 = t[rowS + b]!;
          if (v1 === 0) continue;
          const dstBase = b * w * cr + e.wr * cr;
          const vc = v0 * v1;
          for (let bp = 0; bp < cr; bp++) {
            const v2 = t[rowSp + bp]!;
            if (v2 === 0) continue;
            next[dstBase + bp] = next[dstBase + bp]! + vc * v2;
          }
        }
      }
    }
  }
  return { chi: cr, data: next };
}

/** R_i[a,wl,ap] += Σ R_{i+1}[b,wr,b']·A_i[a,s,b]·W_i[wl→wr]·A_i[a',s',b'] */
function absorbRight(R: Env, t: Float64Array, chiR: number, cl: number, entries: readonly MpEntry[]): Env {
  const w = MPO_DIM;
  const next = new Float64Array(cl * w * cl);
  for (const e of entries) {
    for (let b = 0; b < chiR; b++) {
      for (let bp = 0; bp < chiR; bp++) {
        const rval = R.data[envIdx(b, e.wr, bp, chiR)]!;
        if (rval === 0) continue;
        const v0 = e.v * rval;
        for (let a = 0; a < cl; a++) {
          const v1 = t[((a * 2 + e.s) * chiR + b)]!;
          if (v1 === 0) continue;
          const dstBase = a * w * cl + e.wl * cl;
          const vc = v0 * v1;
          for (let ap = 0; ap < cl; ap++) {
            const v2 = t[((ap * 2 + e.sp) * chiR + bp)]!;
            if (v2 === 0) continue;
            next[dstBase + ap] = next[dstBase + ap]! + vc * v2;
          }
        }
      }
    }
  }
  return { chi: cl, data: next };
}

export function dmrgGroundState(h: ChainHamiltonian, options: DmrgOptions = {}): DmrgResult {
  const chiMax = options.chiMax ?? 64;
  const maxSweeps = options.sweeps ?? 8;
  const lanczosK = options.lanczosK ?? 24;
  const seed = options.seed ?? 0xd0119;
  const t0 = Date.now();

  const n = h.n;
  const mpo = buildMpo(h);
  const sparse = mpo.map(sparseOf);
  const state = randomMps(n, chiMax, seed);
  normalizeMps(state);

  const leftEnvs: Env[] = new Array<Env>(n + 1);
  const rightEnvs: Env[] = new Array<Env>(n + 1);
  leftEnvs[0] = { chi: 1, data: new Float64Array(MPO_DIM) };
  leftEnvs[0].data[0] = 1;
  rightEnvs[n] = { chi: 1, data: new Float64Array(MPO_DIM) };
  rightEnvs[n].data[3] = 1;
  for (let i = n - 1; i >= 0; i--) {
    rightEnvs[i] = absorbRight(rightEnvs[i + 1]!, state.tensors[i]!, state.chis[i + 1]!, state.chis[i]!, sparse[i]!);
  }

  let energy = Number.POSITIVE_INFINITY;
  let sweepsDone = 0;
  let maxDiscarded = 0;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    sweepsDone = sweep + 1;
    const prevEnergy = energy;
    const leftToRight = sweep % 2 === 0;
    const order: number[] = [];
    for (let i = 0; i < n - 1; i++) order.push(i);
    if (!leftToRight) order.reverse();

    for (const i of order) {
      const cl = state.chis[i]!;
      const cr = state.chis[i + 2]!;
      const L = leftEnvs[i]!;
      const R = rightEnvs[i + 2]!;
      const t1 = state.tensors[i]!;
      const t2 = state.tensors[i + 1]!;
      const chiMid = state.chis[i + 1]!;
      const e1 = sparse[i]!;
      const e2 = sparse[i + 1]!;
      const dim = cl * 2 * 2 * cr;

      const theta0 = new Float64Array(dim);
      for (let a = 0; a < cl; a++) {
        for (let s = 0; s < 2; s++) {
          const v1base = (a * 2 + s) * chiMid;
          for (let m = 0; m < chiMid; m++) {
            const v1 = t1[v1base + m]!;
            if (v1 === 0) continue;
            for (let t = 0; t < 2; t++) {
              const row = (m * 2 + t) * cr;
              const dst = ((a * 2 + s) * 2 + t) * cr;
              for (let b = 0; b < cr; b++) theta0[dst + b] = theta0[dst + b]! + v1 * t2[row + b]!;
            }
          }
        }
      }

      // 四步收缩（每步 ~χ²·常数，比朴素嵌套快 ~100×）：
      //   T1[ap,sp,tp,b,wr2] = Σ_bp R[b,wr2,bp]·Θ[ap,sp,tp,bp]
      //   U[ap,sp,t,b,wl1]  = Σ_{tp,wr2} W2[wl1→wr2]·T1
      //   V[ap,s,t,b,wl1]   = Σ_sp W1[wl1→wr1]·U（wr1 折叠进 U 的通道）
      //   out[a,s,t,b]      = Σ_{ap,wl1} L[a,wl1,ap]·V[ap,s,t,b,wl1]
      const dT1 = cl * 2 * 2 * cr * MPO_DIM;
      const dU = cl * 2 * 2 * cr * MPO_DIM;
      const t1Buf = new Float64Array(dT1);
      const uBuf = new Float64Array(dU);
      const vBuf = new Float64Array(dU);
      const matvec = (vin: Float64Array, o: Float64Array): Float64Array => {
        t1Buf.fill(0);
        uBuf.fill(0);
        vBuf.fill(0);
        o.fill(0);
        // 1) 右环境
        for (let b = 0; b < cr; b++) {
          for (let bp = 0; bp < cr; bp++) {
            for (let wr2 = 0; wr2 < MPO_DIM; wr2++) {
              const rval = R.data[envIdx(b, wr2, bp, R.chi)]!;
              if (rval === 0) continue;
              for (let ap = 0; ap < cl; ap++) {
                for (let sp = 0; sp < 2; sp++) {
                  for (let tp = 0; tp < 2; tp++) {
                    const x = vin[((ap * 2 + sp) * 2 + tp) * cr + bp]!;
                    if (x === 0) continue;
                    t1Buf[(((ap * 2 + sp) * 2 + tp) * cr + b) * MPO_DIM + wr2] = t1Buf[(((ap * 2 + sp) * 2 + tp) * cr + b) * MPO_DIM + wr2]! + rval * x;
                  }
                }
              }
            }
          }
        }
        // 2) W2（站点 i+1）：入自旋 tp（=q2.s）→ 出自旋 t（=q2.sp）
        for (const q2 of e2) {
          for (let ap = 0; ap < cl; ap++) {
            for (let sp = 0; sp < 2; sp++) {
              for (let b = 0; b < cr; b++) {
                const src = (((ap * 2 + sp) * 2 + q2.s) * cr + b) * MPO_DIM + q2.wr;
                const v = t1Buf[src]!;
                if (v === 0) continue;
                const dst = (((ap * 2 + sp) * 2 + q2.sp) * cr + b) * MPO_DIM + q2.wl;
                uBuf[dst] = uBuf[dst]! + q2.v * v;
              }
            }
          }
        }
        // 3) W1（站点 i）：入自旋 sp（=q1.s）→ 出自旋 s（=q1.sp）
        for (const q1 of e1) {
          for (let ap = 0; ap < cl; ap++) {
            for (let t = 0; t < 2; t++) {
              for (let b = 0; b < cr; b++) {
                const src = (((ap * 2 + q1.s) * 2 + t) * cr + b) * MPO_DIM + q1.wr;
                const v = uBuf[src]!;
                if (v === 0) continue;
                const dst = (((ap * 2 + q1.sp) * 2 + t) * cr + b) * MPO_DIM + q1.wl;
                vBuf[dst] = vBuf[dst]! + q1.v * v;
              }
            }
          }
        }
        // 4) 左环境
        for (let a = 0; a < cl; a++) {
          for (let ap = 0; ap < cl; ap++) {
            for (let wl1 = 0; wl1 < MPO_DIM; wl1++) {
              const lval = L.data[envIdx(a, wl1, ap, L.chi)]!;
              if (lval === 0) continue;
              for (let idx = 0; idx < 2 * 2 * cr; idx++) {
                const v = vBuf[((ap * 2 * 2 * cr) + idx) * MPO_DIM + wl1]!;
                if (v === 0) continue;
                o[(a * 2 * 2 * cr) + idx] = o[(a * 2 * 2 * cr) + idx]! + lval * v;
              }
            }
          }
        }
        return o;
      };

      const { ground, energy: localE } = localLanczos(matvec, theta0, dim, lanczosK);
      energy = localE;

      // SVD 分裂 [a·s | t·b]
      const rows = cl * 2;
      const cols = 2 * cr;
      const mtm: number[][] = Array.from({ length: cols }, () => new Array<number>(cols).fill(0));
      for (let p = 0; p < cols; p++) {
        for (let q = p; q < cols; q++) {
          let acc = 0;
          for (let r2 = 0; r2 < rows; r2++) acc += ground[r2 * cols + p]! * ground[r2 * cols + q]!;
          mtm[p]![q] = acc;
        }
      }
      for (let p = 0; p < cols; p++) for (let q = 0; q < p; q++) mtm[p]![q] = mtm[q]![p]!;
      const { eigenvalues, eigenvectors } = jacobiEigenWithVectors(mtm);
      const order2 = eigenvalues.map((v, idx) => [v, idx] as const).sort((x, y) => y[0] - x[0]);
      const chiNew = Math.min(chiMax, cols);
      let discarded = 0;
      for (let j = chiNew; j < order2.length; j++) discarded += order2[j]![0];
      if (discarded > maxDiscarded) maxDiscarded = discarded;

      const U = new Float64Array(rows * chiNew);
      const S = new Float64Array(chiNew);
      for (let j = 0; j < chiNew; j++) {
        const vCol = eigenvectors[order2[j]![1]]!;
        for (let r2 = 0; r2 < rows; r2++) {
          let acc = 0;
          for (let c = 0; c < cols; c++) acc += ground[r2 * cols + c]! * vCol[c]!;
          U[r2 * chiNew + j] = acc;
        }
        let nrm = 0;
        for (let r2 = 0; r2 < rows; r2++) nrm += U[r2 * chiNew + j]! ** 2;
        const sigma = Math.sqrt(nrm);
        S[j] = sigma;
        if (sigma > 1e-14) for (let r2 = 0; r2 < rows; r2++) U[r2 * chiNew + j] = U[r2 * chiNew + j]! / sigma;
      }
      const newT1 = new Float64Array(cl * 2 * chiNew);
      for (let a = 0; a < rows; a++) {
        for (let j = 0; j < chiNew; j++) newT1[a * chiNew + j] = U[a * chiNew + j]! * S[j]!;
      }
      const newT2 = new Float64Array(chiNew * 2 * cr);
      for (let j = 0; j < chiNew; j++) {
        const vCol = eigenvectors[order2[j]![1]]!;
        for (let t = 0; t < 2; t++) {
          for (let b = 0; b < cr; b++) {
            newT2[(j * 2 + t) * cr + b] = S[j]! > 1e-14 ? vCol[t * cr + b]! : 0;
          }
        }
      }
      state.tensors[i] = newT1;
      state.tensors[i + 1] = newT2;
      state.chis[i + 1] = chiNew;

      if (leftToRight) {
        leftEnvs[i + 1] = absorbLeft(leftEnvs[i]!, state.tensors[i], cl, chiNew, e1);
      } else {
        rightEnvs[i + 1] = absorbRight(rightEnvs[i + 2]!, state.tensors[i + 1]!, cr, chiNew, e2);
      }
    }

    for (let i = n - 1; i >= 0; i--) {
      rightEnvs[i] = absorbRight(rightEnvs[i + 1]!, state.tensors[i]!, state.chis[i + 1]!, state.chis[i]!, sparse[i]!);
    }
    for (let i = 0; i < n; i++) {
      leftEnvs[i + 1] = absorbLeft(leftEnvs[i]!, state.tensors[i]!, state.chis[i]!, state.chis[i + 1]!, sparse[i]!);
    }

    if (sweep > 0 && Math.abs(energy - prevEnergy) < 1e-11) break;
  }

  normalizeMps(state);
  let maxBond = 1;
  for (const c of state.chis) maxBond = Math.max(maxBond, c);
  return {
    state,
    energy,
    sweeps: sweepsDone,
    maxBond,
    maxDiscarded,
    wallMs: Date.now() - t0,
  };
}

/** 局部 Lanczos（全重正交），返回最低本征对。 */
function localLanczos(
  matvec: (v: Float64Array, o: Float64Array) => Float64Array,
  start: Float64Array,
  dim: number,
  k: number,
): { ground: Float64Array; energy: number } {
  const rng = new Rng(4321);
  const basis: Float64Array[] = [];
  const alphas: number[] = [];
  const betas: number[] = [];
  const v = start.slice();
  let nrm = Math.sqrt(v.reduce((x, y) => x + y * y, 0));
  if (nrm < 1e-14) {
    for (let i = 0; i < dim; i++) v[i] = rng.range(-1, 1);
    nrm = Math.sqrt(v.reduce((x, y) => x + y * y, 0));
  }
  for (let i = 0; i < dim; i++) v[i] = v[i]! / nrm;
  basis.push(v);
  const w = new Float64Array(dim);
  for (let m = 0; m < k; m++) {
    matvec(basis[m]!, w);
    const alpha = dot(basis[m]!, w);
    alphas.push(alpha);
    for (let i = 0; i < dim; i++) w[i] = w[i]! - alpha * basis[m]![i]!;
    if (m > 0) {
      const bp = betas[m - 1]!;
      for (let i = 0; i < dim; i++) w[i] = w[i]! - bp * basis[m - 1]![i]!;
    }
    for (const b of basis) {
      const d = dot(b, w);
      for (let i = 0; i < dim; i++) w[i] = w[i]! - d * b[i]!;
    }
    const beta = Math.sqrt(dot(w, w));
    if (beta < 1e-12 || m === k - 1) break;
    betas.push(beta);
    const nxt = new Float64Array(dim);
    for (let i = 0; i < dim; i++) nxt[i] = w[i]! / beta;
    basis.push(nxt);
  }
  const size = alphas.length;
  const T: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  for (let i = 0; i < size; i++) {
    T[i]![i] = alphas[i]!;
    if (i < betas.length) {
      T[i]![i + 1] = betas[i]!;
      T[i + 1]![i] = betas[i]!;
    }
  }
  const { eigenvalues, eigenvectors } = jacobiEigenWithVectors(T);
  let best = 0;
  for (let i = 1; i < size; i++) if (eigenvalues[i]! < eigenvalues[best]!) best = i;
  const ground = new Float64Array(dim);
  for (let j = 0; j < basis.length; j++) {
    const c = eigenvectors[best]![j]!;
    if (c === 0) continue;
    for (let i = 0; i < dim; i++) ground[i] = ground[i]! + c * basis[j]![i]!;
  }
  return { ground, energy: eigenvalues[best]! };
}

function dot(a: Float64Array, b: Float64Array): number {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += a[i]! * b[i]!;
  return acc;
}

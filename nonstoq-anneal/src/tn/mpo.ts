/**
 * 开链 MPO —— H = Σ_i (α_i·Z_i + β_i·X_i) + Σ_i (ω_i·Z_iZ_{i+1} + κ_i·X_iX_{i+1})
 * 的 4 通道有限自动机构造（0=起始 / 1=z 待配 / 2=x 待配 / 3=完成）。
 * 布局：W[i][wL, sOut, sIn, wR]，平铺 ((wL*2+sOut)*2+sIn)*wDim + wR；
 * 边界向量取行 0 / 列 3（未配对通道在右边界被消灭）。
 */

export interface ChainHamiltonian {
  readonly n: number;
  readonly alpha: readonly number[]; // Z 场（−s·h_i）
  readonly beta: readonly number[]; // X 场（−(1−s)Γ）
  readonly omega: readonly number[]; // Z_iZ_{i+1} 系数（−s·w_i），长度 n−1
  readonly kappa: readonly number[]; // X_iX_{i+1} 系数（(1−s)κ_i），长度 n−1
}

export const MPO_DIM = 4;

// 局部算符（d×d 平铺 sOut*2+sIn）
const OP_I: readonly number[] = [1, 0, 0, 1];
const OP_Z: readonly number[] = [1, 0, 0, -1];
const OP_X: readonly number[] = [0, 1, 1, 0];

/** 构造全部 n 个 W 张量（每个 wDim·2·2·wDim 平铺）。 */
export function buildMpo(h: ChainHamiltonian): Float64Array[] {
  const w = MPO_DIM;
  const out: Float64Array[] = [];
  for (let i = 0; i < h.n; i++) {
    const t = new Float64Array(w * 2 * 2 * w);
    const idx = (wl: number, sOut: number, sIn: number, wr: number): number =>
      ((wl * 2 + sOut) * 2 + sIn) * w + wr;
    const put = (wl: number, wr: number, op: readonly number[], scale: number): void => {
      for (let so = 0; so < 2; so++) {
        for (let si = 0; si < 2; si++) {
          const di = idx(wl, so, si, wr);
          t[di] = t[di]! + op[so * 2 + si]! * scale;
        }
      }
    };
    put(0, 0, OP_I, 1);
    put(0, 1, OP_Z, 1);
    put(0, 2, OP_X, 1);
    put(0, 3, OP_Z, h.alpha[i]!);
    put(0, 3, OP_X, h.beta[i]!);
    // 键 (i−1) 的完成项在站 i：自动机 = 站 i−1 发射 (0→1/2)，站 i 完成 (1/2→3)
    if (i >= 1) {
      put(1, 3, OP_Z, h.omega[i - 1]!);
      put(2, 3, OP_X, h.kappa[i - 1]!);
    }
    put(3, 3, OP_I, 1);
    out.push(t);
  }
  return out;
}

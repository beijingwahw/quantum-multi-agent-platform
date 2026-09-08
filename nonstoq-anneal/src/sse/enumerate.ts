import type { SseConfig } from "./sse.js";
import { sseDiagElement } from "./sse.js";

/**
 * 小尺度精确枚举 —— MC 的真值裁判。
 *
 * SSE 配分函数：Z = Σ_{z₀} Σ_{m≥0} (β^m/m!) Σ_{序贯 m 算符}
 *   [Π 矩阵元] · [传播 z₀ → z₀ 闭合]，截断到 maxOrder 阶。
 * 同时累积 |W| 与带符号 W：⟨sign⟩ = ΣW/Σ|W| 精确值（截断内）。
 * 矩阵元与 SseSampler 共用同一函数 sseDiagElement（对角平移非负；
 * 边 XX 非对角带符号——裁判与采样器的约定在构造上不可能漂移）。
 */
export function exactSignAverage(cfg: SseConfig, maxOrder: number): {
  signAvg: number;
  z: number;
  zAbs: number;
  meanOrderAbs: number;
  truncatedOrders: number;
} {
  const dim = 1 << cfg.n;
  let zSum = 0;
  let zAbsSum = 0;
  let orderAbsSum = 0;

  const bonds = bondTable(cfg);
  const zState = new Int8Array(cfg.n);
  const initial = new Int8Array(cfg.n);

  for (let z0 = 0; z0 < dim; z0++) {
    for (let i = 0; i < cfg.n; i++) {
      const v = (z0 >>> i) & 1 ? -1 : 1;
      zState[i] = v;
      initial[i] = v;
    }
    dfs(0, 1, 1);
  }

  function diagElement(bond: number, z: Int8Array): number {
    return sseDiagElement(cfg, bond, z);
  }

  /** DFS：depth = 已放算符数；wSigned/wAbs = 带符号/绝对值累积权重。 */
  function dfs(depth: number, wSigned: number, wAbs: number): void {
    // 结算：迹闭合（传播后回到 initial）才计入 Z
    let closed = true;
    for (let i = 0; i < cfg.n; i++) {
      if (zState[i] !== initial[i]) {
        closed = false;
        break;
      }
    }
    if (closed) {
      let logFact = 0;
      for (let k = 2; k <= depth; k++) logFact += Math.log(k);
      const factor = Math.pow(cfg.beta, depth) * Math.exp(-logFact);
      zSum += factor * wSigned;
      zAbsSum += factor * wAbs;
      orderAbsSum += depth * factor * wAbs;
    }
    if (depth >= maxOrder) return;
    for (const b of bonds) {
      // 对角算符
      const a = diagElement(b.bond, zState);
      if (a > 0) dfs(depth + 1, wSigned * a, wAbs * a);
      // 非对角算符（幅值 > 0 时；边 XX 带符号 −1）
      if (b.off > 0) {
        flipBond(b, zState);
        const sign = b.isEdge ? -1 : 1;
        dfs(depth + 1, wSigned * sign * b.off, wAbs * b.off);
        flipBond(b, zState);
      }
    }
  }

  function flipBond(b: { isEdge: boolean; i: number; j: number; bond: number }, z: Int8Array): void {
    if (b.isEdge) {
      z[b.i] = -z[b.i]!;
      z[b.j] = -z[b.j]!;
    } else {
      z[b.bond] = -z[b.bond]!;
    }
  }

  const signAvg = zAbsSum > 0 ? zSum / zAbsSum : 1;
  return {
    signAvg,
    z: zSum,
    zAbs: zAbsSum,
    meanOrderAbs: zAbsSum > 0 ? orderAbsSum / zAbsSum : 0,
    truncatedOrders: maxOrder,
  };
}

interface BondDescr {
  bond: number;
  isEdge: boolean;
  i: number;
  j: number;
  off: number;
}

function bondTable(cfg: SseConfig): BondDescr[] {
  const out: BondDescr[] = [];
  for (let i = 0; i < cfg.n; i++) {
    out.push({ bond: i, isEdge: false, i, j: -1, off: (1 - cfg.s) * cfg.gamma });
  }
  cfg.edges.forEach((e, idx) => {
    out.push({ bond: cfg.n + idx, isEdge: true, i: e.i, j: e.j, off: (1 - cfg.s) * e.kappaMag });
  });
  return out;
}

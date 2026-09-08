import { Rng } from "../core/rng.js";
import type { IsingModel } from "../core/ising.js";
import type { DriverSpec } from "../anneal/driver.js";

/**
 * SSE（随机级数展开）世界线采样器 —— 平均符号 ⟨sign⟩ 的直接测量。
 *
 * 被采样的是 |W| 系综（"影子"系综）：所有 −H 矩阵元取绝对值后非负，
 * 等价于 κ→−κ 的 stoquastic 影子模型 H̄（⟨sign⟩ = Z(H)/Z(H̄) 精确成立）。
 * 原模型的符号由估计量携带：每个 XX 双翻转算符贡献因子 −1，即
 *   sign(config) = (−1)^{N_xx}，
 * σx 单翻转（+Γ）与（平移后的）对角元恒正，不带符号。
 *
 * 更新方案（细致平衡逐 Move 可证，n=2 精确枚举对拍仲裁）：
 *  A. 对角更新：逐槽 插入/移除 对角算符；配分权重比 β^m/m! 给出
 *     W_{n+1}/W_n = β·a/(n+1)，提议不对称性（移除确定 vs 插入选键 1/B）
 *     进入 Metropolis 接受率；
 *  B. 类型翻转：对一键（站点 σx 或边 XX）把其上全部算符 diag↔offdiag
 *     同时翻转初态自旋（奇数个算符时）——传播一致性保持，权重比为
 *     逐算符元素比的连乘。
 */

export interface SseEdgeBond {
  readonly i: number;
  readonly j: number;
  readonly w: number; // 问题耦合（对角部分 s·w·z_i z_j）
  readonly kappaMag: number; // |κ_ij|（非对角部分 (1−s)·|κ|，符号由估计量携带）
}

export interface SseConfig {
  readonly n: number;
  readonly s: number;
  readonly beta: number;
  readonly fields: readonly number[]; // h_i
  readonly edges: readonly SseEdgeBond[];
  readonly gamma: number;
}

/** 从 Ising 问题 + XX 驱动器构造 SSE 配置（κ 加在问题耦合边上，与 exp1 一致）。 */
export function sseConfigFrom(model: IsingModel, driver: DriverSpec, s: number, beta: number): SseConfig {
  const kappaOf = new Map<string, number>();
  for (const c of driver.couplings) kappaOf.set(`${c.j}-${c.k}`, Math.abs(c.w));
  const edges: SseEdgeBond[] = model.couplings.map((c) => ({
    i: c.j,
    j: c.k,
    w: c.w,
    kappaMag: kappaOf.get(`${c.j}-${c.k}`) ?? 0,
  }));
  return { n: model.n, s, beta, fields: model.fields, edges, gamma: driver.gamma };
}

// 算符编码：0 = 恒等；2b+1 = 键 b 上的对角算符；2b+2 = 键 b 上的非对角算符。
// 键序：0..n−1 站点键（σx 场），n..n+E−1 边键（ZZ 问题项 + XX 驱动）。

/**
 * 对角矩阵元（平移非负约定）——采样器与精确枚举裁判的单一来源。
 * 站点键：s·(h·z + |h|)；边键：s·(w·z_i·z_j + |w|)。|W| 系综要求该平移
 * 对每个构型非负，这是裁判与采样器必须逐位一致的约定（此前两处各持
 * 一份拷贝，裁判漂移风险即藏于此——0.3.0 单源化）。
 */
export function sseDiagElement(cfg: SseConfig, bond: number, z: Int8Array): number {
  if (bond < cfg.n) {
    const h = cfg.fields[bond]!;
    return cfg.s * (h * z[bond]! + Math.abs(h));
  }
  const e = cfg.edges[bond - cfg.n]!;
  return cfg.s * (e.w * z[e.i]! * z[e.j]! + Math.abs(e.w));
}

export class SseSampler {
  readonly nBonds: number;
  readonly M: number;
  private readonly ops: Int32Array;
  private readonly spins: Int8Array; // z ∈ {+1,−1}，底部传播态
  private readonly zRun: Int8Array;
  private nOps = 0;
  private nXx = 0;
  private readonly rng: Rng;

  constructor(private readonly cfg: SseConfig, options: { mSlots?: number; seed?: number } = {}) {
    this.nBonds = cfg.n + cfg.edges.length;
    this.M = options.mSlots ?? Math.max(8, Math.ceil(8 * cfg.beta * (1 + cfg.n / 4)));
    this.ops = new Int32Array(this.M);
    this.spins = new Int8Array(cfg.n).fill(1);
    this.zRun = new Int8Array(cfg.n);
    this.rng = new Rng(options.seed ?? 0x5ee);
  }

  /** 对角元素（平移非负）：与精确枚举裁判共用 sseDiagElement（单一来源）。 */
  private diagElement(bond: number, z: Int8Array): number {
    return sseDiagElement(this.cfg, bond, z);
  }

  /** 非对角元素幅值：站点 (1−s)·Γ；边 (1−s)·|κ|。 */
  private offElement(bond: number): number {
    const { cfg } = this;
    if (bond < cfg.n) return (1 - cfg.s) * cfg.gamma;
    return (1 - cfg.s) * cfg.edges[bond - cfg.n]!.kappaMag;
  }

  private isEdge(bond: number): boolean {
    return bond >= this.cfg.n;
  }

  /** A. 对角更新：逐槽插入/移除对角算符。平稳权重含 1/C(M,n) 槽位组合因子
   *  （同一有序序列可放入 C(M,n) 种槽位）→ W_{n+1}/W_n = β·a/(M−n)，
   *  提案不对称性（移除确定 vs 插入选键 1/B）进入 Metropolis 接受率。 */
  private sweepDiagonal(): void {
    const { cfg, ops, M } = this;
    const B = this.nBonds;
    this.zRun.set(this.spins);
    const z = this.zRun;
    for (let m = 0; m < M; m++) {
      const op = ops[m]!;
      if (op === 0) {
        if (M - this.nOps <= 0) continue;
        const bond = this.rng.int(B);
        const a = this.diagElement(bond, z);
        if (a > 0) {
          const p = Math.min(1, (B * cfg.beta * a) / (M - this.nOps));
          if (this.rng.next() < p) {
            ops[m] = 2 * bond + 1;
            this.nOps++;
          }
        }
      } else if (op % 2 === 1) {
        const bond = (op - 1) / 2;
        const a = this.diagElement(bond, z);
        // 移除：n → n−1；接受率用移除后的恒等槽数 M−n+1（与插入率互为逆）
        const p = Math.min(1, (M - this.nOps + 1) / (B * cfg.beta * a));
        if (this.rng.next() < p) {
          ops[m] = 0;
          this.nOps--;
        }
      }
      this.propagate(m, z);
    }
  }

  /** 槽 m 的算符作用于传播态 z（对角不动；站点翻转一键；XX 边翻转两键）。 */
  private propagate(m: number, z: Int8Array): void {
    const op = this.ops[m]!;
    if (op === 0 || op % 2 === 1) return;
    const bond = (op - 2) / 2;
    if (this.isEdge(bond)) {
      const e = this.cfg.edges[bond - this.cfg.n]!;
      z[e.i] = -z[e.i]!;
      z[e.j] = -z[e.j]!;
    } else {
      z[bond] = -z[bond]!;
    }
  }

  /**
   * B. 类型翻转：把键 bond 上全部算符 diag↔offdiag。周期一致性要求每个
   * 量子比特的非对角算符数为偶——翻转该键改变所触比特的奇偶性 count mod 2，
   * 因此 **count 为奇的键不可翻转（直接返回）**；count 为偶时翻转合法，
   * 并同时翻转初态自旋（改变自旋扇区，遍历性来源；count=0 的空键即纯
   * 初态翻转）。双世界逐槽评估连乘权重比：键的翻转改变其下方传播态，
   * 所有对角算符都要在两个世界各评一次。
   */
  private flipBondType(bond: number): void {
    const { ops, M, cfg } = this;
    // 先数键上算符数（奇数 → 非法目标构型）
    let count = 0;
    for (let m = 0; m < M; m++) {
      const op = ops[m]!;
      if (op === 0) continue;
      const isDiag = op % 2 === 1;
      const bondOf = isDiag ? (op - 1) / 2 : (op - 2) / 2;
      if (bondOf === bond) count++;
    }
    if (count % 2 === 1) return;

    // 双世界：old 从现初态出发；new 从翻转后的初态出发（初态翻转进入权重比）
    const zOld = new Int8Array(this.spins);
    const zNew = new Int8Array(this.spins);
    if (this.isEdge(bond)) {
      const e = cfg.edges[bond - cfg.n]!;
      zNew[e.i] = -zNew[e.i]!;
      zNew[e.j] = -zNew[e.j]!;
    } else {
      zNew[bond] = -zNew[bond]!;
    }
    let ratio = 1;
    let dXx = 0;
    for (let m = 0; m < M; m++) {
      const op = ops[m]!;
      if (op === 0) continue;
      const isDiag = op % 2 === 1;
      const bondOf = isDiag ? (op - 1) / 2 : (op - 2) / 2;
      if (bondOf !== bond) {
        if (isDiag) {
          ratio *= this.diagElement(bondOf, zNew) / this.diagElement(bondOf, zOld);
        }
        this.applyOp(isDiag, bondOf, zOld, zOld);
        this.applyOp(isDiag, bondOf, zNew, zNew);
        continue;
      }
      const aOff = this.offElement(bond);
      if (isDiag) {
        ratio *= aOff / this.diagElement(bond, zOld);
        if (this.isEdge(bond)) dXx++;
      } else {
        ratio *= this.diagElement(bond, zNew) / aOff;
        if (this.isEdge(bond)) dXx--;
      }
      this.applyOp(isDiag, bond, zOld, zOld);
      this.applyOp(!isDiag, bond, zNew, zNew);
    }
    if (this.rng.next() < Math.min(1, ratio)) {
      for (let m = 0; m < M; m++) {
        const op = ops[m]!;
        if (op === 0) continue;
        const isDiag = op % 2 === 1;
        const bondOf = isDiag ? (op - 1) / 2 : (op - 2) / 2;
        if (bondOf === bond) ops[m] = isDiag ? op + 1 : op - 1;
      }
      // count 为偶 → 传播奇偶不变 → 初态翻转自动保持出口=入口（遍历性）
      if (this.isEdge(bond)) {
        const e = cfg.edges[bond - cfg.n]!;
        this.spins[e.i] = -this.spins[e.i]!;
        this.spins[e.j] = -this.spins[e.j]!;
      } else {
        this.spins[bond] = -this.spins[bond]!;
      }
      this.nXx += dXx;
    }
  }

  /** applyOp：算符（diag/offdiag, bond）作用于 to 状态（读 from，可同数组）。 */
  private applyOp(isDiag: boolean, bond: number, from: Int8Array, to: Int8Array): void {
    if (isDiag) return;
    if (this.isEdge(bond)) {
      const e = this.cfg.edges[bond - this.cfg.n]!;
      to[e.i] = -from[e.i]!;
      to[e.j] = -from[e.j]!;
    } else {
      to[bond] = -from[bond]!;
    }
  }

  sweep(): void {
    this.sweepDiagonal();
    // 类型翻转：每键一轮（站点 + 边）——扇区内快混合
    for (let bond = 0; bond < this.nBonds; bond++) {
      if (this.offElement(bond) > 0) this.flipBondType(bond);
    }
    // 三元组翻转：跨奇偶扇区（⟨sign⟩ 可测的前提）
    for (let a = 0; a < 4; a++) this.tripleToggle();
  }

  /** 调试钩子：逐相位执行 sweep，返回首个破坏一致性的相位名（测试用）。 */
  sweepDebug(): string | null {
    this.sweepDiagonal();
    if (!this.consistent()) return "diagonal";
    for (let bond = 0; bond < this.nBonds; bond++) {
      if (this.offElement(bond) > 0) this.flipBondType(bond);
      if (!this.consistent()) return `bondType:${bond}`;
    }
    for (let a = 0; a < 4; a++) {
      this.tripleToggle();
      if (!this.consistent()) return `triple:${a}`;
    }
    return null;
  }

  /** 当前构型的符号估计量：(−1)^{N_xx}。 */
  sign(): number {
    return this.nXx % 2 === 0 ? 1 : -1;
  }

  opCount(): number {
    return this.nOps;
  }

  xxCount(): number {
    return this.nXx;
  }

  /** 构型全权重（|W| 系综）：逐槽传播求元素连乘；不一致或零元素 → 0。 */
  fullWeight(): number {
    const z = new Int8Array(this.spins);
    let w = 1;
    for (let m = 0; m < this.M; m++) {
      const op = this.ops[m]!;
      if (op === 0) continue;
      const isDiag = op % 2 === 1;
      const bond = isDiag ? (op - 1) / 2 : (op - 2) / 2;
      if (isDiag) {
        const a = this.diagElement(bond, z);
        if (a <= 0) return 0;
        w *= a;
      } else {
        const b = this.offElement(bond);
        if (b <= 0) return 0;
        w *= b;
        if (this.isEdge(bond)) {
          const e = this.cfg.edges[bond - this.cfg.n]!;
          z[e.i] = -z[e.i]!;
          z[e.j] = -z[e.j]!;
        } else {
          z[bond] = -z[bond]!;
        }
      }
    }
    for (let i = 0; i < this.cfg.n; i++) {
      if (z[i] !== this.spins[i]) return 0;
    }
    return w;
  }

  /**
   * C. 三元组类型翻转（跨奇偶扇区的遍历性来源）：同时翻转一条边算符
   * 与其两端点上各一条站点算符的类型。每比特非对角奇偶变化
   * 1(边)+1(站点) ≡ 0 → 新构型自动一致。提案按（边槽, i 槽, j 槽）
   * 均匀采样，翻转后集合不变 → 正反提案概率相等；全权重 Metropolis。
   */
  private tripleToggle(): void {
    const { ops, M, cfg } = this;
    const edgeSlots: number[] = [];
    for (let m = 0; m < M; m++) {
      const op = ops[m]!;
      if (op === 0) continue;
      const bond = op % 2 === 1 ? (op - 1) / 2 : (op - 2) / 2;
      if (this.isEdge(bond) && this.offElement(bond) > 0) edgeSlots.push(m);
    }
    if (edgeSlots.length === 0) return;
    const m = edgeSlots[this.rng.int(edgeSlots.length)]!;
    const edgeOp = ops[m]!;
    const e = cfg.edges[(edgeOp % 2 === 1 ? edgeOp - 1 : edgeOp - 2) / 2 - cfg.n]!;
    const slotsI: number[] = [];
    const slotsJ: number[] = [];
    for (let s = 0; s < M; s++) {
      const op = ops[s]!;
      if (op === 0) continue;
      const bond = op % 2 === 1 ? (op - 1) / 2 : (op - 2) / 2;
      if (bond === e.i) slotsI.push(s);
      else if (bond === e.j) slotsJ.push(s);
    }
    if (slotsI.length === 0 || slotsJ.length === 0) return;
    const m2 = slotsI[this.rng.int(slotsI.length)]!;
    const m3 = slotsJ[this.rng.int(slotsJ.length)]!;

    const wOld = this.fullWeight();
    const edgeWasDiag = ops[m]! % 2 === 1;
    ops[m] = edgeWasDiag ? ops[m]! + 1 : ops[m]! - 1;
    ops[m2] = ops[m2]! % 2 === 1 ? ops[m2]! + 1 : ops[m2]! - 1;
    ops[m3] = ops[m3]! % 2 === 1 ? ops[m3]! + 1 : ops[m3]! - 1;
    const wNew = this.fullWeight();
    // 零权重态（对角元为 0 的瞬态）只出不进：绝不接受 wNew=0（含闭合破坏）目标
    const accept = wNew > 0 && (wOld === 0 || this.rng.next() < wNew / wOld);
    if (accept) {
      this.nXx += edgeWasDiag ? 1 : -1;
    } else {
      // 拒绝：翻回（翻转映射是 involution——用与翻转完全相同的三目再作用一次）
      ops[m] = edgeWasDiag ? ops[m] - 1 : ops[m] + 1;
      ops[m2] = ops[m2] % 2 === 1 ? ops[m2] + 1 : ops[m2] - 1;
      ops[m3] = ops[m3] % 2 === 1 ? ops[m3] + 1 : ops[m3] - 1;
    }
  }

  /** 校验：从初态逐槽传播后回到初态（周期一致性）。 */
  consistent(): boolean {
    const c = this.debugCheck();
    return c.closed && c.opsMatch && c.xxMatch;
  }

  /** 细分校验：闭合性 / nOps 计数 / nXx 计数（调试与测试用）。 */
  debugCheck(): { closed: boolean; opsMatch: boolean; xxMatch: boolean } {
    const z = new Int8Array(this.spins);
    let nOps = 0;
    let nXx = 0;
    for (let m = 0; m < this.M; m++) {
      const op = this.ops[m]!;
      if (op === 0) continue;
      nOps++;
      const isDiag = op % 2 === 1;
      const bond = isDiag ? (op - 1) / 2 : (op - 2) / 2;
      if (!isDiag) {
        if (this.isEdge(bond)) {
          nXx++;
          const e = this.cfg.edges[bond - this.cfg.n]!;
          z[e.i] = -z[e.i]!;
          z[e.j] = -z[e.j]!;
        } else {
          z[bond] = -z[bond]!;
        }
      }
    }
    let closed = true;
    for (let i = 0; i < this.cfg.n; i++) {
      if (z[i] !== this.spins[i]) closed = false;
    }
    return { closed, opsMatch: nOps === this.nOps, xxMatch: nXx === this.nXx };
  }
}

export interface SseResult {
  readonly signAvg: number;
  /** 块平均标准误。 */
  readonly signErr: number;
  readonly samples: number;
  readonly meanOps: number;
  /** 恢复 1 位有效信号所需样本量 ~ 1/⟨sign⟩²（符号问题代价的直接读数）。 */
  readonly samplesNeeded: number;
}

/** 运行 MC：warmup + measure 轮 sweep，每 sweep 记一次符号。 */
export function runSignMeasurement(
  cfg: SseConfig,
  options: { warmup?: number; measure?: number; seed?: number; mSlots?: number } = {},
): SseResult {
  const warmup = options.warmup ?? 2000;
  const measure = options.measure ?? 50000;
  const sampler = new SseSampler(cfg, {
    ...(options.mSlots !== undefined ? { mSlots: options.mSlots } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  });
  for (let i = 0; i < warmup; i++) sampler.sweep();
  const signs: number[] = [];
  let opsAcc = 0;
  for (let i = 0; i < measure; i++) {
    sampler.sweep();
    signs.push(sampler.sign());
    opsAcc += sampler.opCount();
  }
  const signAvg = signs.reduce((a, b) => a + b, 0) / signs.length;
  // 自适应块平均：块宽逐级放大取最大标准误——扇区翻转的自相关时间随 β·κ
  // 增长，固定小块宽会严重低估误差（长程跑实测散布可达标称误差 10 倍）
  let signErr = Math.sqrt(Math.max(1 - signAvg * signAvg, 1 / signs.length) / signs.length);
  for (const bs of [10, 50, 250, 1000]) {
    if (signs.length < 20 * bs) break;
    const blocks: number[] = [];
    for (let i = 0; i + bs <= signs.length; i += bs) {
      let acc = 0;
      for (let k = 0; k < bs; k++) acc += signs[i + k]!;
      blocks.push(acc / bs);
    }
    const nB = blocks.length;
    const varB = blocks.reduce((acc, b) => acc + (b - signAvg) ** 2, 0) / (nB - 1);
    const errB = Math.sqrt(varB / nB);
    if (errB > signErr) signErr = errB;
  }
  return {
    signAvg,
    signErr,
    samples: measure,
    meanOps: opsAcc / measure,
    samplesNeeded: signAvg !== 0 ? Math.round(1 / (signAvg * signAvg)) : Number.POSITIVE_INFINITY,
  };
}

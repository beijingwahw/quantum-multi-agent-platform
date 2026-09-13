/**
 * min-cost-flow-potentials —— 位势驱动的最小费用流（R14-A 创新 2，opt-in；
 * R17-A 引擎改造：求解循环换装 SPFA，Dijkstra/二叉堆退役）。
 *
 * ============ 动机（读完 min-cost-flow.ts / batch-vcg-scheduler.ts 后确认） ============
 *
 * 现行 MinCostFlow（SPFA 连续最短增广，自由处置变体）每次增广相位都从
 * dist=∞ 全量重启 Bellman-Ford 式松弛，且不暴露任何对偶信息：单次求解
 * 无妨，但批量 VCG 的 λ-bisection 一次 allocateBatch 要跑 ≤62 次
 * solveWithPayments × (1+赢家数) 次 solveWDP 重解——同一拓扑、边费用只随
 * λ/μ 平移或减边（pivot）——每次都从零开始，对偶变量（节点位势）全部丢弃。
 *
 * R14 版本用「Dijkstra(归约费用)+二叉堆」实现 SSP，单解墙钟实测比 SPFA
 * 原版慢 87–122%（bench-kit A/B，本机）——小/中图上堆与节点排序的开销
 * 吃掉渐近优势，模块价值只剩对偶面与增量重解。R17 把求解引擎换回与
 * min-cost-flow.ts 同款的 SPFA（原始费用、FIFO 队列、相位级缓冲复用、
 * 逐位相同的松弛条件与回放次序），位势改为**零成本旁路累积**（见下），
 * 对偶面/增量面全部保留，单解墙钟与原版平价（r17a 钉板）。
 *
 * ============ 本模块 ============
 *
 * SPFA 连续最短增广 + Johnson 位势旁路 + 负环消除（Klein 型环取消兜底），
 * 相对既有实现的四个增量能力：
 *
 * 1. **对偶面（getPotentials/injectPotentials）**：节点位势可读出、可注入。
 *    跨实例迁移（λ 变化 / VCG pivot / agent 下线）是**启发式热启动**：
 *    注入位势近可行时修复轮次通常很少，但可行性无构造性保证（实证：
 *    基础解里容量已吃满的 S→agent 前向边不在终态残量网络中、不受位势
 *    约束，迁移到零流图上即成违规边）——修复后正确性不受影响。
 * 2. **同实例增量重解（构造性）**：run() 后 addEdge（新任务到达）再
 *    run()，流与位势原地延续。新边可能在残量网络造出负环（高价值新
 *    任务挤掉旧指派的改进环）——此时自动转入环取消（Bellman-Ford 前驱
 *    链提取负环、瓶颈量消除），恢复「极值流 + 可行位势」后续跑 SSP。
 *    一次到达只付 O(环数) 次取消 + 少量增广，不重解全图；正确性由
 *    「增量终态 = 冷重建终态」对拍钉住（测试）。
 * 3. **确定性操作计数**（metrics()：spfaPhases/dijkstraRuns(退役钉子)/
 *    bellmanFordPasses/edgeRelaxations/feasibilityScans/potentialRepairs/
 *    cycleCancellations/augmentations）：性能口径环境无关、重跑逐位一致。
 * 4. **全新图负环具名拒绝**：初始图（调用方直接给出含负环的费用结构）
 *    的 s-t 自由处置最优没有良定义，BF 不稳定即抛 MechanismError——
 *    求解循环此场景同样无终止保证，故先拒绝再进循环。
 *
 * ============ 位势零成本旁路（R17 核心） ============
 *
 * 求解循环完全不接触位势：SPFA 在**原始费用**上跑（与 min-cost-flow.ts
 * 逐位同形的内环），位势只在每相位收敛后做一次 O(V) 旁路累积。经典 SSP
 * 对偶不变量是 π'[v] = π[v] + min(d_π[v], d_π[t])（d_π = 归约费用距离，
 * 未达节点取 d_π[t]）；由恒等式 d_π[v] = d_raw[v] − π[v] + π[s]（路费的
 * telescoping），用 SPFA 的原始距离直接代数回代：
 *
 *   π'[v] = min(d_raw[v] + π[s], π[v] + d_raw[t] − π[t] + π[s])
 *          （未达节点 d_raw[v]=∞，自然落到第二支）
 *
 * **不能**按字面把原始距离塞进 min(d,d[t])：π 非常数时该式破坏对偶可行
 * 性（反例形状：π=[0,0,3,3] 对边集 s→u(1)/u→v(5)/v→t(1)/s→t(8) 可行，
 * d_raw=[0,1,6,7] 全近侧，字面更新后 u→v 归约费用 = 5+1−9 = −3 < 0）。
 * WDP 初值化 BF 产出的位势 [0,…,0,−s_t,…,−M] 从第一相位起就非常数，
 * 所以回代式是必要的，不是锦上添花。回代式与 R14 的 Dijkstra 引擎逐
 * 相位维持同一不变量、产出同一位势值（浮点舍入序不同）。
 *
 * 语义对齐 min-cost-flow.ts：自由处置（只推进总费用 < −TERM_EPS 的增广
 * 路）、RELAX_EPS/TERM_EPS 同值同义、addEdge/edgeOccupied 同形、
 * {flow,cost} 返回同构（cost = 本次调用的流成本增量，含环取消的成本
 * 增量——增量重解下多次 run() 的 cost 之和 = 冷重建总成本）。求解循环
 * 的内环形态与 min-cost-flow.ts 逐位相同（松弛条件、边序、队列序、回放
 * 次序），同一残量网络上两引擎选出相同的增广路——{flow,cost} 不仅语义
 * 一致，算术上逐位一致。最优性对拍（与 SPFA 版在随机图上 {flow,cost}
 * 一致）由 tests/r14a-min-cost-flow-potentials.test.ts 钉住——两个独立
 * 实现算出同一最优值，互相认证（本仓对照文化）。
 *
 * 文献接地（R15 双源核实，台账 DELIVERY/r15-dual-source-citations-20260914.md）：
 * 逐次最短增广与位势法（N. Tomizawa, Networks 1(2):173-194, 1971, DOI
 * 10.1002/net.3230010206；M. Iri, JORSJ 3:27-87, 1960）；归约位势
 * （D.B. Johnson, "Efficient Algorithms for Shortest Paths in Sparse
 * Networks", JACM 24(1):1-13, 1977, DOI 10.1145/321992.321993）；
 * Klein 型环取消（M. Klein, Management Science 14(3):205-220, 1967,
 * DOI 10.1287/mnsc.14.3.205，伪多项式）。R14 引擎曾用 Dijkstra 最短路
 * （E.W. Dijkstra, Numerische Mathematik 1:269-271, 1959, DOI
 * 10.1007/BF01386390）——R17 求解引擎退役该路径，引用留档。
 *
 * 诚实边界：
 * - eps-可行性（归约费用 ≥ −RELAX_EPS 而非 ≥ 0）与 SPFA 版同一容差级；
 * - 单解墙钟与原版 SPFA 的平价由 tests/r17a 钉板（bench-kit 交错 A/B，
 *   140×160 WDP 族 + 小实例族）；旁路累积的 O(V)/相位与可行化 BF 是
 *   残余开销，判决以测量为准；
 * - 环取消是伪多项式兜底（每次消除严格降本，整数容量下必然终止），
 *   只在增量/迁移触发的脏修复路径上运行；
 * - 浮点费用下并列最短路的路径分解与旧 Dijkstra 引擎可不同（数学等价
 *   的最优流）；与 min-cost-flow.ts 的 SPFA 则是同内环同选路，逐位一致；
 * - metrics().dijkstraRuns 是退役钉子（恒 0）：字段名保留是只读消费者
 *   examples/quantum-innovation-showcase.ts 的编译锁定，真实相位计数在
 *   spfaPhases。
 */

import { MechanismError } from '../utils/errors.js';
import type { FlowEdgeRef } from './min-cost-flow.js';

/** 松弛容差：与 min-cost-flow.ts 的 RELAX_EPS 同值同义 */
const RELAX_EPS = 1e-9;
/** 自由处置终止容差：与 min-cost-flow.ts 的 TERM_EPS 同值同义 */
const TERM_EPS = 1e-12;
/** 环取消防御上限（终止性有证明：每次消除严格降本；上限只兜底未来退化） */
const MAX_CYCLE_CANCELLATIONS = 100_000;

interface InternalEdge {
  to: number;
  rev: number;
  cap: number;
  cost: number;
}

/** 确定性操作计数（性能口径：环境无关，重跑逐位一致） */
export interface SspMetrics {
  /** Dijkstra 引擎退役钉子（R17）：恒 0。字段保留是只读消费者 examples/quantum-innovation-showcase.ts 的编译锁定；真实相位计数在 spfaPhases */
  readonly dijkstraRuns: number;
  /** 求解循环的 SPFA 最短路相位数（含最终停止相位） */
  readonly spfaPhases: number;
  /** 可行化/环消除的 Bellman-Ford 扫描轮数（全新图初值化 + 脏修复） */
  readonly bellmanFordPasses: number;
  /** SPFA 与 Bellman-Ford 的残边扫描总数 */
  readonly edgeRelaxations: number;
  /** 残量网络位势可行性扫描次数（O(E)） */
  readonly feasibilityScans: number;
  /** 脏位势实际触发修复（BF 重算/环取消）的次数 */
  readonly potentialRepairs: number;
  /** 增量/迁移修复中消除的负环数 */
  readonly cycleCancellations: number;
  readonly augmentations: number;
}

interface FeasibilityViolation {
  readonly from: number;
  readonly to: number;
  readonly reducedCost: number;
}

interface BellmanFordResult {
  readonly dist: Float64Array;
  /** true = 收敛（无负环，dist 即可行位势）；false = 检出负环 */
  readonly stable: boolean;
  /** 不稳定时：最后一轮被松弛的节点（负环回溯入口） */
  readonly lastUpdated: number;
  readonly prevNode: Int32Array;
  readonly prevEdge: Int32Array;
}

/**
 * 位势驱动的最小费用流（自由处置变体）。
 * API 子集与 min-cost-flow.MinCostFlow 兼容（addEdge/run/edgeOccupied），
 * 另有位势读写与确定性操作计数。求解引擎与 min-cost-flow.ts 同款 SPFA
 * （原始费用），位势每相位 O(V) 旁路累积、不进求解内环。
 */
export class MinCostFlowPotentials {
  private readonly graph: InternalEdge[][] = [];
  private potentials: Float64Array | null = null;
  /** 位势可能不满足可行性的标志（注入位势 / 求解后加边） */
  private dirty = false;
  private readonly counters = {
    dijkstraRuns: 0,
    spfaPhases: 0,
    bellmanFordPasses: 0,
    edgeRelaxations: 0,
    feasibilityScans: 0,
    potentialRepairs: 0,
    cycleCancellations: 0,
    augmentations: 0,
  };

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 0) {
      throw new MechanismError(
        `MinCostFlowPotentials: node count must be a non-negative integer, got ${String(n)}`,
      );
    }
    for (let i = 0; i < n; i++) this.graph.push([]);
  }

  private node(u: number): InternalEdge[] {
    const edges = this.graph[u];
    if (!edges)
      throw new MechanismError(
        `MinCostFlowPotentials: node ${u} out of range (n=${this.graph.length})`,
      );
    return edges;
  }

  private edge(u: number, idx: number): InternalEdge {
    const e = this.node(u)[idx];
    if (!e) throw new MechanismError(`MinCostFlowPotentials: edge ${u}[${idx}] does not exist`);
    return e;
  }

  /** 建边并返回前向边引用（与 MinCostFlow.addEdge 同形；域校验更严） */
  addEdge(from: number, to: number, cap: number, cost: number): FlowEdgeRef {
    const fromEdges = this.node(from);
    const toEdges = this.node(to);
    if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0) {
      throw new MechanismError(
        `MinCostFlowPotentials.addEdge: cap must be a finite number ≥ 0, got ${String(cap)}`,
      );
    }
    if (typeof cost !== 'number' || !Number.isFinite(cost)) {
      throw new MechanismError(
        `MinCostFlowPotentials.addEdge: cost must be a finite number, got ${String(cost)}`,
      );
    }
    fromEdges.push({ to, rev: toEdges.length, cap, cost });
    toEdges.push({ to: from, rev: fromEdges.length - 1, cap: 0, cost: -cost });
    const idx = fromEdges.length - 1;
    if (this.potentials) this.dirty = true; // 新边的归约费用未受位势控制
    const graph = this.graph;
    return {
      from,
      idx,
      to,
      cost,
      get cap(): number {
        return graph[from]?.[idx]?.cap ?? 0;
      },
    };
  }

  /**
   * 轮式 Bellman-Ford（带前驱）：从任意初值收敛到可行位势。
   * 初值 null = 全零（Johnson 超级源语义）；初值为旧位势 = 热启动
   * （闭包 D(v)=min_x(init[x]+d(x,v)) 满足 ∀残边 c_π ≥ −RELAX_EPS，
   * 收敛轮数随初值接近可行而减少）。n+1 轮仍不稳定 = 残量网络含负环
   * （stable=false，调用方决定环取消或拒绝）。
   */
  private bellmanFord(initial: Float64Array | null): BellmanFordResult {
    const n = this.graph.length;
    const dist = initial ? new Float64Array(initial) : new Float64Array(n);
    const prevNode = new Int32Array(n).fill(-1);
    const prevEdge = new Int32Array(n).fill(-1);
    let passes = 0;
    let lastUpdated = -1;
    for (;;) {
      let changed = false;
      for (let u = 0; u < n; u++) {
        const edges = this.graph[u]!;
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i]!;
          if (e.cap <= 0) continue;
          this.counters.edgeRelaxations++;
          const nd = dist[u]! + e.cost;
          if (nd < dist[e.to]! - RELAX_EPS) {
            dist[e.to] = nd;
            prevNode[e.to] = u;
            prevEdge[e.to] = i;
            changed = true;
            lastUpdated = e.to;
          }
        }
      }
      passes++;
      if (!changed) {
        this.counters.bellmanFordPasses += passes;
        return { dist, stable: true, lastUpdated: -1, prevNode, prevEdge };
      }
      if (passes > n + 1) {
        this.counters.bellmanFordPasses += passes;
        return { dist, stable: false, lastUpdated, prevNode, prevEdge };
      }
    }
  }

  /**
   * 从 BF 前驱链提取并消除一个负环（Klein 型环取消）。
   * 返回成本增量（aug × 环成本，恒负）。走 n 步前驱必入环（标准论证）；
   * 链形态异常（理论上不可达）具名抛错兜底。
   */
  private cancelCycle(r: BellmanFordResult): number {
    const n = this.graph.length;
    let v = r.lastUpdated;
    for (let i = 0; i < n && r.prevNode[v]! >= 0; i++) v = r.prevNode[v]!;
    const ring: number[] = [v];
    let u = r.prevNode[v]!;
    while (u !== v) {
      if (u < 0 || ring.length > n) {
        throw new MechanismError(
          `MinCostFlowPotentials: negative cycle extraction failed (predecessor chain malformed)`,
        );
      }
      ring.push(u);
      u = r.prevNode[u]!;
    }
    let aug = Infinity;
    let cycleCost = 0;
    for (const x of ring) {
      const e = this.edge(r.prevNode[x]!, r.prevEdge[x]!);
      aug = Math.min(aug, e.cap);
      cycleCost += e.cost;
    }
    if (!(aug > 0) || !(cycleCost < 0)) {
      throw new MechanismError(
        `MinCostFlowPotentials: extracted a non-improving cycle (cap=${aug}, cost=${cycleCost}) — this is a bug`,
      );
    }
    for (const x of ring) {
      const e = this.edge(r.prevNode[x]!, r.prevEdge[x]!);
      e.cap -= aug;
      this.edge(e.to, e.rev).cap += aug;
    }
    this.counters.cycleCancellations++;
    return aug * cycleCost;
  }

  /**
   * 取得可行位势。allowCancel=false（全新图）：负环 = 调用方给了无良定义
   * 的费用结构，具名拒绝；allowCancel=true（增量/迁移的脏修复）：负环是
   * 图编辑的合法产物，环取消后重算直至稳定。
   */
  private ensureFeasiblePotentials(
    initial: Float64Array | null,
    allowCancel: boolean,
  ): { potentials: Float64Array; cancelCost: number } {
    let warm: Float64Array | null = initial;
    let cancelCost = 0;
    for (;;) {
      const r = this.bellmanFord(warm);
      if (r.stable) return { potentials: r.dist, cancelCost };
      if (!allowCancel) {
        throw new MechanismError(
          `MinCostFlowPotentials: negative cycle suspected in the initial graph ` +
            `(Bellman-Ford unstable past ${this.graph.length + 1} passes) — the free-disposal s-t optimum is undefined; refuse instead of looping`,
        );
      }
      if (this.counters.cycleCancellations >= MAX_CYCLE_CANCELLATIONS) {
        throw new MechanismError(
          `MinCostFlowPotentials: cycle cancellation cap ${MAX_CYCLE_CANCELLATIONS} exceeded (termination invariant broken — this is a bug)`,
        );
      }
      cancelCost += this.cancelCycle(r);
      warm = r.dist;
    }
  }

  /** 残量网络位势可行性扫描：首个违规残边（无违规返回 null）。O(E)。 */
  private findViolation(pi: Float64Array): FeasibilityViolation | null {
    this.counters.feasibilityScans++;
    for (let u = 0; u < this.graph.length; u++) {
      for (const e of this.graph[u]!) {
        if (e.cap <= 0) continue;
        const reduced = e.cost + pi[u]! - pi[e.to]!;
        if (reduced < -RELAX_EPS) {
          return { from: u, to: e.to, reducedCost: reduced };
        }
      }
    }
    return null;
  }

  /**
   * 自由处置求解：SPFA 连续最短增广（原始费用，与 min-cost-flow.ts 同形
   * 引擎），只推进总费用 < −TERM_EPS 的增广路。
   *
   * 每相位收敛后做位势零成本旁路累积（O(V)，不进 SPFA 内环）：
   * π'[v] = π[v] + min(d_π[v], d_π[t])，用原始距离代数回代成
   * π'[v] = min(d_raw[v] + π[s], π[v] + d_raw[t] − π[t] + π[s])
   * （未达节点 d_raw=∞ 落到第二支）——维持残量网络归约费用非负的经典
   * 对偶可行性不变量（字面套原始距离会破坏不变量，见模块头注反例）。
   *
   * 返回 {flow, cost}：flow = 本次推进的流量；cost = 本次流成本增量
   * （含增量/迁移修复中的环取消成本增量）。语义与 MinCostFlow.run 的
   * 「每次调用返回增量」口径一致，增量的代数和 = 冷重建总账。
   */
  run(s: number, t: number): { flow: number; cost: number } {
    if (typeof s !== 'number' || !Number.isInteger(s)) {
      throw new MechanismError(
        `MinCostFlowPotentials.run: source must be an integer node id, got ${String(s)}`,
      );
    }
    if (typeof t !== 'number' || !Number.isInteger(t)) {
      throw new MechanismError(
        `MinCostFlowPotentials.run: sink must be an integer node id, got ${String(t)}`,
      );
    }
    this.node(s);
    this.node(t);
    if (this.graph.length === 0) return { flow: 0, cost: 0 };

    let cancelCost = 0;
    if (!this.potentials) {
      // 全新图：负环 = 无良定义输入，具名拒绝（不循环）
      const r = this.ensureFeasiblePotentials(null, false);
      this.potentials = r.potentials;
      this.dirty = false;
    } else if (this.dirty) {
      // 增量/迁移：违规才修复；新边诱发的负环按改进机会消除（环取消）
      if (this.findViolation(this.potentials) !== null) {
        this.counters.potentialRepairs++;
        const r = this.ensureFeasiblePotentials(this.potentials, true);
        this.potentials = r.potentials;
        cancelCost += r.cancelCost;
      }
      this.dirty = false;
    }

    const n = this.graph.length;
    // 相位级缓冲复用（与 min-cost-flow.ts 同形）：dist/inQueue/prevNode/
    // prevEdge 在每个增广相位开头全量重置，跨相位共用同一块内存；队列
    // 用索引头出队（shift() 每次搬移整个数组，O(n)）。
    const dist = new Array<number>(n);
    const inQueue = new Array<boolean>(n);
    const prevNode = new Int32Array(n);
    const prevEdge = new Int32Array(n);
    const queue: number[] = [];
    // 相位计数走 run() 级局部变量、返回前一次性入账：热路径上零属性写
    // （探针实测：每相位两次 counters 属性写占整轮 ~3%，比位势旁路本身还贵）
    let phases = 0;
    let scanned = 0;
    let augs = 0;
    let flow = 0;
    let cost = 0;
    for (;;) {
      dist.fill(Infinity);
      inQueue.fill(false);
      prevNode.fill(-1);
      prevEdge.fill(-1);
      dist[s] = 0;
      let head = 0;
      queue.push(s);
      while (head < queue.length) {
        const u = queue[head++]!;
        inQueue[u] = false;
        const edges = this.node(u);
        // distU 在 u 的整条出边扫描中不变（dist[u] 只会被指向 u 的边
        // 松弛改写，而本扫描不重入）
        const distU = dist[u]!;
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i]!;
          if (e.cap <= 0) continue;
          scanned++;
          if (distU + e.cost < dist[e.to]! - RELAX_EPS) {
            dist[e.to] = distU + e.cost;
            prevNode[e.to] = u;
            prevEdge[e.to] = i;
            if (!inQueue[e.to]) {
              queue.push(e.to);
              inQueue[e.to] = true;
            }
          }
        }
      }
      phases++;
      // 无增广路，或边际费用非负（再分配只会降福利）→ 停止
      const dT = dist[t]!;
      if (dT === Infinity || dT >= -TERM_EPS) break;

      // 位势旁路累积（O(V)）：π' = π + min(d_π, d_π[t]) 的原始距离回代形
      const pi = this.potentials;
      const piS = pi[s]!;
      const shift = dT - pi[t]! + piS; // = 归约距离 d_π[t]（< −TERM_EPS）
      for (let v = 0; v < n; v++) {
        const viaDist = dist[v]! + piS; // = π[v] + d_π[v]（未达为 ∞）
        const viaPi = pi[v]! + shift; // = π[v] + d_π[t]
        pi[v] = viaDist < viaPi ? viaDist : viaPi;
      }

      // 沿最短路增广（回放次序与 MinCostFlow.run 一致）
      let aug = Infinity;
      for (let v = t; v !== s;) {
        const pn = prevNode[v]!;
        aug = Math.min(aug, this.edge(pn, prevEdge[v]!).cap);
        v = pn;
      }
      for (let v = t; v !== s;) {
        const pn = prevNode[v]!;
        const e = this.edge(pn, prevEdge[v]!);
        e.cap -= aug;
        this.edge(e.to, e.rev).cap += aug;
        cost += aug * e.cost;
        v = pn;
      }
      flow += aug;
      augs++;
      // 回到相位头前清空队缓冲（head 游标随之作废）
      queue.length = 0;
    }
    this.counters.spfaPhases += phases;
    this.counters.edgeRelaxations += scanned;
    this.counters.augmentations += augs;
    return { flow, cost: cost + cancelCost };
  }

  /** 当前位势快照（尚未求解或被注入时为 null；跨求解热启动的载体） */
  getPotentials(): number[] | null {
    return this.potentials ? Array.from(this.potentials) : null;
  }

  /**
   * 注入位势（对偶热启动）。缺省宽松模式：run() 首轮做 O(E) 可行性扫描，
   * 违规才自动修复（必要时环取消）；strict 模式在注入时点名首个违规残边
   * 并拒绝。注意：strict 通过 ≠ 注入后零修复——修复判定还包含 run() 时刻
   * 的残量状态（此前求解推进过的流可能已改变哪些边在残量网络中）。
   */
  injectPotentials(p: readonly number[], opts: { strict?: boolean } = {}): void {
    if (!Array.isArray(p)) {
      throw new MechanismError(
        `injectPotentials: expected an array of ${this.graph.length} potentials, got ${typeof p}`,
      );
    }
    const values = p as readonly number[]; // Array.isArray 把类型收窄成 any[]——回到声明口径
    if (values.length !== this.graph.length) {
      throw new MechanismError(
        `injectPotentials: length ${values.length} must equal node count ${this.graph.length}`,
      );
    }
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new MechanismError(
          `injectPotentials: potentials[${i}] must be a finite number, got ${String(v)}`,
        );
      }
    }
    const candidate = Float64Array.from(values);
    if (opts.strict) {
      const violation = this.findViolation(candidate);
      if (violation) {
        throw new MechanismError(
          `injectPotentials: reduced-cost feasibility violated at residual edge ` +
            `${violation.from}→${violation.to} (reduced cost ${violation.reducedCost} < -${RELAX_EPS})`,
        );
      }
    }
    this.potentials = candidate;
    this.dirty = true;
  }

  /** 读取前向边是否被占用（cap 由正值减为 0 即被分配） */
  edgeOccupied(ref: FlowEdgeRef): boolean {
    return this.edge(ref.from, ref.idx).cap === 0;
  }

  /** 确定性操作计数快照（性能对比的环境无关口径） */
  metrics(): SspMetrics {
    return { ...this.counters };
  }
}

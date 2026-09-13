/**
 * min-cost-flow-potentials —— 位势驱动的最小费用流（R14-A 创新 2，opt-in）。
 *
 * ============ 动机（读完 min-cost-flow.ts / batch-vcg-scheduler.ts 后确认） ============
 *
 * 现行 MinCostFlow（SPFA 连续最短增广，自由处置变体）每次增广相位都从
 * dist=∞ 全量重启 Bellman-Ford 式松弛，且不暴露任何对偶信息：单次求解
 * 无妨，但批量 VCG 的 λ-bisection 一次 allocateBatch 要跑 ≤62 次
 * solveWithPayments × (1+赢家数) 次 solveWDP 重解——同一拓扑、边费用只随
 * λ/μ 平移或减边（pivot）——每次都从零开始，对偶变量（节点位势）全部丢弃。
 *
 * ============ 本模块 ============
 *
 * 逐次最短增广（SSP）+ Johnson 位势 + 负环消除（Klein 型环取消兜底），
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
 * 3. **确定性操作计数**（metrics()：dijkstraRuns/bellmanFordPasses/
 *    edgeRelaxations/feasibilityScans/potentialRepairs/
 *    cycleCancellations/augmentations）：性能口径环境无关、重跑逐位一致。
 * 4. **全新图负环具名拒绝**：初始图（调用方直接给出含负环的费用结构）
 *    的 s-t 自由处置最优没有良定义，BF 不稳定即抛 MechanismError——
 *    SPFA 版此场景无终止保证。
 *
 * 语义对齐 min-cost-flow.ts：自由处置（只推进总费用 < −TERM_EPS 的增广
 * 路）、RELAX_EPS/TERM_EPS 同值同义、addEdge/edgeOccupied 同形、
 * {flow,cost} 返回同构（cost = 本次调用的流成本增量，含环取消的成本
 * 增量——增量重解下多次 run() 的 cost 之和 = 冷重建总成本）。
 * 最优性对拍（与 SPFA 版在随机图上 {flow,cost} 一致）由
 * tests/r14a-min-cost-flow-potentials.test.ts 钉住——两个独立实现算出
 * 同一最优值，互相认证（本仓对照文化）。
 *
 * 文献接地：逐次最短增广与位势法（Tomizawa 1971 / Iri 1960 型
 * min-cost flow potential method〔待双源〕）；Johnson 1977 归约位势
 * 〔待双源〕；Dijkstra 1959 最短路；Ford-Bellman 松弛与负环检测；
 * Klein 型环取消（cycle-canceling，伪多项式）〔待双源〕。SSP 每次增广
 * 后位势更新 π[v] += min(d[v], d[t])（未达节点取 d[t]）维持残量网络
 * 归约费用非负——经典对偶可行性不变量。
 *
 * 诚实边界：
 * - eps-可行性（归约费用 ≥ −RELAX_EPS 而非 ≥ 0）与 SPFA 版同一容差级；
 * - 实测墙钟（bench-kit A/B，本机）：140×160 WDP 上 SSP+二叉堆比 SPFA
 *   慢（判决见测试输出）——小图上堆开销吃掉渐近优势，**墙钟收益不宣称**；
 *   模块价值是对偶面、增量重解、负环安全与确定性计数；
 * - 环取消是伪多项式兜底（每次消除严格降本，整数容量下必然终止），
 *   只在增量/迁移触发的脏修复路径上运行；
 * - 浮点费用下并列最短路的路径分解可与 SPFA 版不同（数学等价的最优
 *   流），总费用在浮点求和序意义下可有 ULP 级差异——对拍容差锚定。
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
  readonly dijkstraRuns: number;
  readonly bellmanFordPasses: number;
  /** Dijkstra 与 Bellman-Ford 的残边扫描总数 */
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
 * 另有位势读写与确定性操作计数。
 */
export class MinCostFlowPotentials {
  private readonly graph: InternalEdge[][] = [];
  private potentials: Float64Array | null = null;
  /** 位势可能不满足可行性的标志（注入位势 / 求解后加边） */
  private dirty = false;
  private readonly counters = {
    dijkstraRuns: 0,
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
   * Dijkstra（归约费用、二叉小根堆、(距离,节点) 字典序决胜——确定性）。
   * 返回 s 出发的归约距离与前驱；不可达节点距离为 Infinity。
   */
  private dijkstra(s: number): { d: Float64Array; prevNode: Int32Array; prevEdge: Int32Array } {
    const n = this.graph.length;
    const pi = this.potentials!;
    const d = new Float64Array(n).fill(Infinity);
    const prevNode = new Int32Array(n).fill(-1);
    const prevEdge = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    d[s] = 0;

    // 二叉小根堆（[归约距离, 节点]，懒惰删除）
    const heap: Array<[number, number]> = [[0, s]];
    const less = (a: readonly [number, number], b: readonly [number, number]): boolean =>
      a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
    const swap = (i: number, j: number): void => {
      const tmp = heap[i]!;
      heap[i] = heap[j]!;
      heap[j] = tmp;
    };
    const push = (entry: readonly [number, number]): void => {
      heap.push(entry as [number, number]);
      let i = heap.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (less(heap[i]!, heap[parent]!)) {
          swap(i, parent);
          i = parent;
        } else break;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
          if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    };

    while (heap.length > 0) {
      const [du, u] = pop();
      if (done[u]!) continue;
      done[u] = 1;
      const dU = d[u]!;
      if (du > dU) continue; // 懒惰删除的过期条目
      const edges = this.graph[u]!;
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]!;
        if (e.cap <= 0) continue;
        this.counters.edgeRelaxations++;
        const reduced = e.cost + pi[u]! - pi[e.to]!;
        const nd = dU + reduced;
        if (nd < d[e.to]! - RELAX_EPS) {
          d[e.to] = nd;
          prevNode[e.to] = u;
          prevEdge[e.to] = i;
          push([nd, e.to]);
        }
      }
    }
    this.counters.dijkstraRuns++;
    return { d, prevNode, prevEdge };
  }

  /**
   * 自由处置求解：只推进总费用 < −TERM_EPS 的增广路。
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

    let flow = 0;
    let cost = 0;
    for (;;) {
      const { d, prevNode, prevEdge } = this.dijkstra(s);
      const dT = d[t]!;
      if (!Number.isFinite(dT)) break; // 无增广路
      const pi = this.potentials;
      const realDist = dT + pi[t]! - pi[s]!;
      if (realDist >= -TERM_EPS) break; // 自由处置：边际费用非负则停

      // 位势更新：π[v] += min(d[v], d[t])，未达节点取 d[t]——SSP 经典不变量
      for (let v = 0; v < pi.length; v++) {
        const dv = Number.isFinite(d[v]!) ? d[v]! : dT;
        pi[v] = pi[v]! + Math.min(dv, dT);
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
      this.counters.augmentations++;
    }
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

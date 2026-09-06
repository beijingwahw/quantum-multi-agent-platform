/**
 * 最小费用最大流（SPFA 连续最短增广），自由处置变体：
 * 只沿负费用增广路推进——当容量竞争使"多分配一单"的边际福利为负时停止，
 * 允许最优解弃标。若跑满最大流会强制分配所有可分配任务，在容量挤占下
 * 得到次优解。
 *
 * 被 batch-vcg-scheduler（批量 VCG 拍卖 WDP）与 compound-brain（增长复利
 * 市场清算）共享，两处此前各持有一份逐行相同的实现。
 */

import { MechanismError } from '../utils/errors.js';

/**
 * 松弛容差（01#21）：SPFA 边松弛仅在改善量超过该阈值时更新，吸收
 * 「round9 舍入后的费用在 -1e-9 量级抖动」——设得比舍入噪声小会把
 * 已舍入相等的路径反复翻转，设得比典型费用差大会吞掉真实的次优转移。
 *
 * 终止容差取其 1/1000：连续最短增广的停止条件是 t 的最短边际费用
 * 非负（≥ -TERM_EPS）。两档差三个数量级是量纲耦合——松弛侧容忍的是
 * 「边费用」的舍入噪声（~1e-9），终止侧判定的是「路费用」的符号，
 * 必须远小于任何可能被有意构造的负费用路（权重经 round9 后非零
 * 差异 ≥ 1e-9 × 边数），否则会把真实可改进的分配误判为最优。
 */
const RELAX_EPS = 1e-9;
const TERM_EPS = 1e-12;

interface InternalEdge {
  to: number;
  rev: number;
  cap: number;
  cost: number;
}

/** addEdge 返回的稳定边引用：cap 为实时读数（0 = 已被占用/耗尽） */
export interface FlowEdgeRef {
  readonly from: number;
  readonly idx: number;
  readonly to: number;
  readonly cost: number;
  readonly cap: number;
}

export class MinCostFlow {
  private readonly graph: InternalEdge[][] = [];

  constructor(n: number) {
    for (let i = 0; i < n; i++) this.graph.push([]);
  }

  private node(u: number): InternalEdge[] {
    const edges = this.graph[u];
    if (!edges)
      throw new MechanismError(`MinCostFlow: node ${u} out of range (n=${this.graph.length})`);
    return edges;
  }

  private edge(u: number, idx: number): InternalEdge {
    const e = this.node(u)[idx];
    if (!e) throw new MechanismError(`MinCostFlow: edge ${u}[${idx}] does not exist`);
    return e;
  }

  /** 建边并返回前向边引用（供事后查询是否被占用） */
  addEdge(from: number, to: number, cap: number, cost: number): FlowEdgeRef {
    const fromEdges = this.node(from);
    const toEdges = this.node(to);
    fromEdges.push({ to, rev: toEdges.length, cap, cost });
    toEdges.push({ to: from, rev: fromEdges.length - 1, cap: 0, cost: -cost });
    const idx = fromEdges.length - 1;
    // 捕获 graph 引用而非 this 别名（no-this-alias）；edge() 的越界防护
    // 不进热路径——引用只在建边方持有，越界即编程错误
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

  /** 返回 {flow, cost}；只推进总费用为负的增广路径 */
  run(s: number, t: number): { flow: number; cost: number } {
    let flow = 0;
    let cost = 0;
    const n = this.graph.length;
    for (;;) {
      const dist = Array<number>(n).fill(Infinity);
      const inQueue = Array<boolean>(n).fill(false);
      const prev: Array<{ node: number; edgeIdx: number } | null> = Array<{
        node: number;
        edgeIdx: number;
      } | null>(n).fill(null);
      dist[s] = 0;
      const queue: number[] = [s];
      // 索引头出队：shift() 每次搬移整个数组（O(n)），SPFA 的每次最短路
      // 相位因此从 O(V·E) 退化到 O(V²·E)；head 前移语义等价、均摊 O(1)
      let head = 0;
      while (head < queue.length) {
        const u = queue[head++]!;
        inQueue[u] = false;
        const edges = this.node(u);
        for (let i = 0; i < edges.length; i++) {
          const e = this.edge(u, i);
          const distU = dist[u]!;
          if (e.cap > 0 && distU + e.cost < dist[e.to]! - RELAX_EPS) {
            dist[e.to] = distU + e.cost;
            prev[e.to] = { node: u, edgeIdx: i };
            if (!inQueue[e.to]) {
              queue.push(e.to);
              inQueue[e.to] = true;
            }
          }
        }
      }
      // 无增广路，或边际费用非负（再分配只会降福利）→ 停止
      if (dist[t] === Infinity || dist[t]! >= -TERM_EPS) break;
      let aug = Infinity;
      for (let v = t; v !== s;) {
        const p = prev[v]!;
        aug = Math.min(aug, this.edge(p.node, p.edgeIdx).cap);
        v = p.node;
      }
      for (let v = t; v !== s;) {
        const p = prev[v]!;
        const e = this.edge(p.node, p.edgeIdx);
        e.cap -= aug;
        this.edge(e.to, e.rev).cap += aug;
        cost += aug * e.cost;
        v = p.node;
      }
      flow += aug;
    }
    return { flow, cost };
  }

  /** 读取前向边是否被占用（cap 由正值减为 0 即被分配） */
  edgeOccupied(ref: FlowEdgeRef): boolean {
    return this.edge(ref.from, ref.idx).cap === 0;
  }
}

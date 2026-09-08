/**
 * Network topology: nodes joined by heralded quantum links. Path utilities
 * (shortest path, k shortest simple paths) operate on small graphs, so plain
 * BFS/DFS enumeration is exact and dependency-free.
 */

import { SchedError } from "../core/errors.js";

export interface LinkSpec {
  readonly id: string;
  readonly a: string;
  readonly b: string;
  /** Heralded attempt success probability per round. */
  readonly p: number;
  /** Memory slots per link end (attempt parallelism / stored pairs). */
  readonly slots: number;
  /** Fidelity of a freshly generated elementary pair. */
  readonly f0: number;
}

export interface NetSpec {
  readonly nodes: readonly string[];
  readonly links: readonly LinkSpec[];
  /** Memory depolarization time constant T₂ in rounds (undefined = perfect memories). */
  readonly t2?: number;
  /** Bell-state-measurement success probability at repeater nodes. */
  readonly qSwap: number;
  /** Cutoff: discard a pair whose older end qubit exceeds this age (rounds). */
  readonly cutOff?: number;
}

export interface PathInfo {
  /** Link ids from src to dst. */
  readonly links: string[];
  /** Expected rounds to establish all elementary links once: Σ 1/p_e. */
  readonly et: number;
}

/**
 * Structural validation of a NetSpec at construction. Without it two silent
 * corruption channels stay open: a link whose endpoint is not in `nodes` was
 * dropped from the adjacency by `?.` (paths change with no error), and a
 * duplicate link id made `linkById` silently keep only the last entry.
 */
function validateSpec(spec: NetSpec): void {
  const nodes = new Set(spec.nodes);
  const seenIds = new Set<string>();
  const prob = (name: string, v: number, where: string): void => {
    if (!Number.isFinite(v) || v < 0 || v > 1)
      throw new SchedError("TOPOLOGY_SPEC", `${where}: ${name}=${v} outside [0,1]`);
  };
  for (const l of spec.links) {
    const where = `link '${l.id}'`;
    if (l.id.length === 0) throw new SchedError("TOPOLOGY_SPEC", "link id must be non-empty");
    if (seenIds.has(l.id))
      throw new SchedError("TOPOLOGY_SPEC", `duplicate link id '${l.id}' (linkById would silently keep only the last)`);
    seenIds.add(l.id);
    if (!nodes.has(l.a) || !nodes.has(l.b))
      throw new SchedError("TOPOLOGY_SPEC", `${where}: endpoint '${nodes.has(l.a) ? l.b : l.a}' is not in nodes — the link would be silently dropped from the adjacency`);
    if (l.a === l.b) throw new SchedError("TOPOLOGY_SPEC", `${where}: self-loop (${l.a}→${l.b})`);
    prob("p", l.p, where);
    prob("f0", l.f0, where);
    if (!Number.isInteger(l.slots) || l.slots < 1)
      throw new SchedError("TOPOLOGY_SPEC", `${where}: slots=${l.slots} is not an integer ≥ 1`);
  }
  prob("qSwap", spec.qSwap, "net");
  if (spec.t2 !== undefined && !(spec.t2 > 0))
    throw new SchedError("TOPOLOGY_SPEC", `t2=${spec.t2} must be > 0 (use undefined for perfect memory)`);
  if (spec.cutOff !== undefined && (!Number.isInteger(spec.cutOff) || spec.cutOff < 0))
    throw new SchedError("TOPOLOGY_SPEC", `cutOff=${spec.cutOff} is not an integer ≥ 0`);
}

export class Topology {
  private readonly adj = new Map<string, Array<{ to: string; link: LinkSpec }>>();
  readonly linkById = new Map<string, LinkSpec>();

  constructor(readonly spec: NetSpec) {
    validateSpec(spec);
    for (const n of spec.nodes) this.adj.set(n, []);
    for (const l of spec.links) {
      this.linkById.set(l.id, l);
      this.adj.get(l.a)!.push({ to: l.b, link: l }); // endpoints validated above
      this.adj.get(l.b)!.push({ to: l.a, link: l });
    }
  }

  neighbors(n: string): Array<{ to: string; link: LinkSpec }> {
    return this.adj.get(n) ?? [];
  }

  /** BFS shortest path (fewest hops); returns null if disconnected. */
  shortestPath(src: string, dst: string): PathInfo | null {
    if (src === dst) return { links: [], et: 0 };
    const prev = new Map<string, { node: string; link: LinkSpec }>();
    const seen = new Set([src]);
    const queue = [src];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === undefined) break; // length > 0 guard makes this unreachable; keeps the type honest
      for (const { to, link } of this.neighbors(cur)) {
        if (seen.has(to)) continue;
        seen.add(to);
        prev.set(to, { node: cur, link });
        if (to === dst) {
          const links: string[] = [];
          let walk = dst;
          while (walk !== src) {
            const step = prev.get(walk);
            if (!step) return null;
            links.unshift(step.link.id);
            walk = step.node;
          }
          return { links, et: this.pathEt(links) };
        }
        queue.push(to);
      }
    }
    return null;
  }

  /**
   * k shortest simple paths by (hops, then expected establishment time).
   * Exhaustive DFS with pruning — exact for the small graphs we schedule.
   */
  kShortestPaths(src: string, dst: string, k: number): PathInfo[] {
    const results: PathInfo[] = [];
    const onPath = new Set<string>([src]);
    const links: string[] = [];
    const dfs = (node: string): void => {
      if (results.length >= 200) return; // hard cap for pathological graphs
      if (node === dst) {
        results.push({ links: [...links], et: this.pathEt(links) });
        return;
      }
      for (const { to, link } of this.neighbors(node)) {
        if (onPath.has(to)) continue;
        onPath.add(to);
        links.push(link.id);
        dfs(to);
        links.pop();
        onPath.delete(to);
      }
    };
    dfs(src);
    results.sort((x, y) => x.links.length - y.links.length || x.et - y.et);
    return results.slice(0, k);
  }

  pathEt(links: readonly string[]): number {
    let et = 0;
    for (const id of links) {
      const l = this.linkById.get(id);
      if (!l) throw new SchedError("TOPOLOGY_UNKNOWN_LINK", `pathEt: link '${id}' is not in the topology (ET would silently miscount it as p=1)`);
      et += 1 / l.p;
    }
    return et;
  }
}

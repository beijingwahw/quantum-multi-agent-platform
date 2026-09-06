/**
 * Network topology: nodes joined by heralded quantum links. Path utilities
 * (shortest path, k shortest simple paths) operate on small graphs, so plain
 * BFS/DFS enumeration is exact and dependency-free.
 */

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

export class Topology {
  private readonly adj = new Map<string, Array<{ to: string; link: LinkSpec }>>();
  readonly linkById = new Map<string, LinkSpec>();

  constructor(readonly spec: NetSpec) {
    for (const n of spec.nodes) this.adj.set(n, []);
    for (const l of spec.links) {
      this.linkById.set(l.id, l);
      this.adj.get(l.a)?.push({ to: l.b, link: l });
      this.adj.get(l.b)?.push({ to: l.a, link: l });
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
      const cur = queue.shift() as string;
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
    for (const id of links) et += 1 / (this.linkById.get(id)?.p ?? 1);
    return et;
  }
}

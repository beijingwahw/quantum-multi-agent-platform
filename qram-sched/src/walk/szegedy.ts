/**
 * Szegedy quantized walk on the edge space of a reversible Markov chain
 * (Szegedy, arXiv:quant-ph/0401053; search framework of Magniez-Nayak-Roland-
 * Santha, arXiv:quant-ph/0608026). Chains are made lazy so the walk spectrum
 * is aperiodic.
 *
 * Edge space basis |x,y> with p'(y|x) > 0 for the lazy chain P'. With
 *   phi_x = sum_y sqrt(p'(y|x)) |x,y>,
 * one search step applies v <- C . S . R v where
 *   R = 2 Pi - I    (Pi = sum_x |phi_x><phi_x|, blockwise rank-1;
 *                    the columns phi_x are orthogonal since they live on
 *                    disjoint blocks),
 *   S |x,y> = |y,x> (flip-flop swap),
 *   C = I - 2 P_M^2 (oracle: phase flip on every edge touching a marked
 *                    vertex, both coordinates).
 * The "check after move" ordering (oracle last) is the working convention
 * verified here; each step is O(edges) via the blockwise rank-1 structure.
 * Detection signal: probability mass on first-coordinate-marked edges.
 *
 * Referee structure (see experiments): exact classical hitting time from the
 * same start law via the fundamental matrix (LU), the exactly solvable
 * two-state family (classical 2/q vs quantum ~ const/sqrt(q)), and the
 * canonical barbell bottleneck family where the quadratic separation
 * Theta(n^2) -> Theta(n) is established.
 */

import { reject } from "../core/errors.js";

export interface Chain {
  readonly n: number;
  /** Sparse row-stochastic transitions: neighbors[i] distinct, probs[i] row-stochastic. */
  readonly neighbors: ReadonlyArray<readonly number[]>;
  readonly probs: ReadonlyArray<readonly number[]>;
}

/**
 * Structural shape of a hand-built Chain (v0.3.0): n rows in both tables,
 * equal row lengths. Malformed chains used to read `undefined as number` in
 * the dense-matrix referee and the lazy transform — silent NaN onward.
 * (Stochasticity is a property of the input family, not checked here.)
 */
function checkChainShape(c: Chain): void {
  if (!Number.isInteger(c.n) || c.n < 1) reject("WALK_CHAIN_SHAPE", `n >= 1 states required (got ${c.n})`);
  if (c.neighbors.length !== c.n || c.probs.length !== c.n) {
    reject("WALK_CHAIN_SHAPE", `neighbors and probs must both carry n=${c.n} rows`);
  }
  for (let i = 0; i < c.n; i++) {
    const nb = c.neighbors[i] as readonly number[];
    const pr = c.probs[i] as readonly number[];
    if (nb.length !== pr.length) {
      reject("WALK_CHAIN_SHAPE", `row ${i}: neighbors/probs length mismatch (${nb.length} vs ${pr.length})`);
    }
  }
}

/** Uniform chain over an undirected adjacency structure (no self-loops added). */
export function chainFromGraph(adj: ReadonlyArray<readonly number[]>): Chain {
  const n = adj.length;
  const neighbors: number[][] = [];
  const probs: number[][] = [];
  for (let i = 0; i < n; i++) {
    const nb = Array.from(adj[i] as readonly number[]);
    if (nb.length === 0) reject("WALK_ISOLATED_VERTEX", `isolated vertex ${i}`);
    // v0.3.0: out-of-range neighbors used to be silently DROPPED by the dense
    // Float64Array referee matrix (OOB writes are no-ops) — a wrong hitting time.
    for (const j of nb) {
      if (!Number.isInteger(j) || j < 0 || j >= n) {
        reject("WALK_NEIGHBOR_RANGE", `vertex ${i} lists neighbor ${j} outside [0, n=${n})`);
      }
    }
    neighbors.push(nb);
    probs.push(nb.map(() => 1 / nb.length));
  }
  return { n, neighbors, probs };
}

/** Lazy version P' = (P + I)/2: self-loop weight 1/2 + p(x|x)/2, all other probabilities halved. */
export function lazyChain(c: Chain): Chain {
  checkChainShape(c);
  const neighbors: number[][] = [];
  const probs: number[][] = [];
  for (let i = 0; i < c.n; i++) {
    const nb: number[] = [i];
    const pr: number[] = [0.5];
    const row = c.neighbors[i] as readonly number[];
    const rp = c.probs[i] as readonly number[];
    for (let k = 0; k < row.length; k++) {
      const j = row[k] as number;
      if (j === i) {
        pr[0] = 0.5 + (rp[k] as number) / 2;
      } else {
        nb.push(j);
        pr.push((rp[k] as number) / 2);
      }
    }
    neighbors.push(nb);
    probs.push(pr);
  }
  return { n: c.n, neighbors, probs };
}

/** Dense row-major matrix of the chain (for LU / Jacobi referees). */
export function chainMatrix(c: Chain): Float64Array {
  checkChainShape(c);
  const a = new Float64Array(c.n * c.n);
  for (let i = 0; i < c.n; i++) {
    const nb = c.neighbors[i] as readonly number[];
    const pr = c.probs[i] as readonly number[];
    for (let k = 0; k < nb.length; k++) a[i * c.n + (nb[k] as number)] = pr[k] as number;
  }
  return a;
}

/** Start distribution: uniform over all states except the targets (the conditioned start law). */
export function uniformAwayFrom(n: number, targets: ReadonlySet<number>): Float64Array {
  for (const t of targets) {
    if (!Number.isInteger(t) || t < 0 || t >= n) {
      reject("WALK_TARGET_RANGE", `target ${t} outside states [0, n=${n})`);
    }
  }
  const free = n - targets.size;
  if (free <= 0) reject("WALK_NO_TRANSIENT", "no transient states");
  const mu = new Float64Array(n);
  for (let i = 0; i < n; i++) if (!targets.has(i)) mu[i] = 1 / free;
  return mu;
}

export class SzegedyWalk {
  readonly chain: Chain;
  readonly marked: ReadonlySet<number>;
  readonly edgeX: Int32Array;
  readonly edgeY: Int32Array;
  readonly edgeIdx: Map<number, number>;
  readonly rowStart: Int32Array;
  readonly rowLen: Int32Array;
  readonly sqrtP: Float64Array;
  readonly flipEdge: Uint8Array;
  steps = 0;

  constructor(chain: Chain, marked: Iterable<number>) {
    checkChainShape(chain);
    this.chain = chain;
    this.marked = new Set(marked);
    // v0.3.0: a marked vertex outside [0, n) can never match an edge — the
    // walk would run forever reporting zero marked mass (a silent dead search).
    for (const m of this.marked) {
      if (!Number.isInteger(m) || m < 0 || m >= chain.n) {
        reject("WALK_TARGET_RANGE", `marked vertex ${m} outside [0, n=${chain.n})`);
      }
    }
    const total = chain.neighbors.reduce((s, r) => s + r.length, 0);
    this.edgeX = new Int32Array(total);
    this.edgeY = new Int32Array(total);
    this.sqrtP = new Float64Array(total);
    this.flipEdge = new Uint8Array(total);
    this.edgeIdx = new Map();
    this.rowStart = new Int32Array(chain.n);
    this.rowLen = new Int32Array(chain.n);
    let e = 0;
    for (let x = 0; x < chain.n; x++) {
      this.rowStart[x] = e;
      const nb = chain.neighbors[x] as readonly number[];
      const pr = chain.probs[x] as readonly number[];
      this.rowLen[x] = nb.length;
      for (let k = 0; k < nb.length; k++) {
        const y = nb[k] as number;
        this.edgeX[e] = x;
        this.edgeY[e] = y;
        this.sqrtP[e] = Math.sqrt(pr[k] as number);
        this.edgeIdx.set(x * chain.n + y, e);
        e++;
      }
    }
    for (let e2 = 0; e2 < total; e2++) {
      const x = this.edgeX[e2] as number;
      const y = this.edgeY[e2] as number;
      if (!this.edgeIdx.has(y * this.chain.n + x)) reject("WALK_ASYMMETRIC_SUPPORT", "chain support must be symmetric");
      this.flipEdge[e2] = this.marked.has(x) || this.marked.has(y) ? 1 : 0;
    }
  }

  get numEdges(): number {
    return this.edgeX.length;
  }

  /** One search step v <- C S R v on the edge-space state. */
  applyStep(re: Float64Array, im: Float64Array): void {
    // R = 2 Pi - I, blockwise: per x, reflect the x-block through phi_x.
    for (let x = 0; x < this.chain.n; x++) {
      const s = this.rowStart[x] as number;
      const len = this.rowLen[x] as number;
      let ar = 0;
      let ai = 0;
      for (let k = 0; k < len; k++) {
        const w = this.sqrtP[s + k] as number;
        ar += w * (re[s + k] as number);
        ai += w * (im[s + k] as number);
      }
      for (let k = 0; k < len; k++) {
        const w = this.sqrtP[s + k] as number;
        const idx = s + k;
        re[idx] = 2 * w * ar - (re[idx] as number);
        im[idx] = 2 * w * ai - (im[idx] as number);
      }
    }
    // S: swap (x,y) <-> (y,x).
    for (let e = 0; e < this.edgeX.length; e++) {
      const x = this.edgeX[e] as number;
      const y = this.edgeY[e] as number;
      if (x >= y) continue;
      const f = this.edgeIdx.get(y * this.chain.n + x);
      if (f === undefined) continue;
      const tr = re[e] as number;
      const ti = im[e] as number;
      re[e] = re[f] as number;
      im[e] = im[f] as number;
      re[f] = tr;
      im[f] = ti;
    }
    // C: oracle flip on edges touching a marked vertex.
    for (let e = 0; e < this.flipEdge.length; e++) {
      if ((this.flipEdge[e] as number) !== 0) {
        re[e] = -(re[e] as number);
        im[e] = -(im[e] as number);
      }
    }
    this.steps++;
  }

  /** Norm of the current state (unitarity monitor; must stay 1 to ~1e-13). */
  norm(re: Float64Array, im: Float64Array): number {
    let s = 0;
    for (let e = 0; e < re.length; e++) s += (re[e] as number) ** 2 + (im[e] as number) ** 2;
    return Math.sqrt(s);
  }

  /** Marked-edge probability mass of the current state. */
  markedProbability(re: Float64Array, im: Float64Array): number {
    let p = 0;
    for (let e = 0; e < this.edgeX.length; e++) {
      if (this.marked.has(this.edgeX[e] as number)) {
        const vr = re[e] as number;
        const vi = im[e] as number;
        p += vr * vr + vi * vi;
      }
    }
    return p;
  }

  /** Initial state phi_mu for a start distribution mu over vertices. */
  initialState(mu: Float64Array): { re: Float64Array; im: Float64Array } {
    // v0.3.0: a wrong-length mu used to build sqrt(undefined) = NaN amplitudes
    // silently — the unitarity monitor would then report NaN, not a defect.
    if (mu.length !== this.chain.n) {
      reject("WALK_MU_SHAPE", `start distribution mu must have length n=${this.chain.n} (got ${mu.length})`);
    }
    const re = new Float64Array(this.edgeX.length);
    const im = new Float64Array(this.edgeX.length);
    for (let e = 0; e < this.edgeX.length; e++) {
      const x = this.edgeX[e] as number;
      re[e] = Math.sqrt(mu[x] as number) * (this.sqrtP[e] as number);
    }
    return { re, im };
  }

  /** Detection curve: marked probability after steps 1..maxSteps from phi_mu, with unitarity check. */
  detectionCurve(mu: Float64Array, maxSteps: number): { curve: Float64Array; minNorm: number } {
    const { re, im } = this.initialState(mu);
    const curve = new Float64Array(maxSteps);
    let minNorm = this.norm(re, im);
    for (let k = 0; k < maxSteps; k++) {
      this.applyStep(re, im);
      curve[k] = this.markedProbability(re, im);
      const nn = this.norm(re, im);
      if (nn < minNorm) minNorm = nn;
    }
    return { curve, minNorm };
  }

  /** First step at which marked probability crosses the threshold (detection with that confidence). */
  detectionTime(mu: Float64Array, threshold: number, maxSteps: number): { step: number; probability: number } {
    const { curve } = this.detectionCurve(mu, maxSteps);
    for (let k = 0; k < maxSteps; k++) {
      if ((curve[k] as number) >= threshold) return { step: k + 1, probability: curve[k] as number };
    }
    return { step: -1, probability: curve.length > 0 ? Math.max(...curve) : 0 };
  }
}

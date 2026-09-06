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
/** Uniform chain over an undirected adjacency structure (no self-loops added). */
export function chainFromGraph(adj) {
    const n = adj.length;
    const neighbors = [];
    const probs = [];
    for (let i = 0; i < n; i++) {
        const nb = Array.from(adj[i]);
        if (nb.length === 0)
            throw new Error(`isolated vertex ${i}`);
        neighbors.push(nb);
        probs.push(nb.map(() => 1 / nb.length));
    }
    return { n, neighbors, probs };
}
/** Lazy version P' = (P + I)/2: self-loop weight 1/2 + p(x|x)/2, all other probabilities halved. */
export function lazyChain(c) {
    const neighbors = [];
    const probs = [];
    for (let i = 0; i < c.n; i++) {
        const nb = [i];
        const pr = [0.5];
        const row = c.neighbors[i];
        const rp = c.probs[i];
        for (let k = 0; k < row.length; k++) {
            const j = row[k];
            if (j === i) {
                pr[0] = 0.5 + rp[k] / 2;
            }
            else {
                nb.push(j);
                pr.push(rp[k] / 2);
            }
        }
        neighbors.push(nb);
        probs.push(pr);
    }
    return { n: c.n, neighbors, probs };
}
/** Dense row-major matrix of the chain (for LU / Jacobi referees). */
export function chainMatrix(c) {
    const a = new Float64Array(c.n * c.n);
    for (let i = 0; i < c.n; i++) {
        const nb = c.neighbors[i];
        const pr = c.probs[i];
        for (let k = 0; k < nb.length; k++)
            a[i * c.n + nb[k]] = pr[k];
    }
    return a;
}
/** Start distribution: uniform over all states except the targets (the conditioned start law). */
export function uniformAwayFrom(n, targets) {
    const free = n - targets.size;
    if (free <= 0)
        throw new Error("no transient states");
    const mu = new Float64Array(n);
    for (let i = 0; i < n; i++)
        if (!targets.has(i))
            mu[i] = 1 / free;
    return mu;
}
export class SzegedyWalk {
    chain;
    marked;
    edgeX;
    edgeY;
    edgeIdx;
    rowStart;
    rowLen;
    sqrtP;
    flipEdge;
    steps = 0;
    constructor(chain, marked) {
        this.chain = chain;
        this.marked = new Set(marked);
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
            const nb = chain.neighbors[x];
            const pr = chain.probs[x];
            this.rowLen[x] = nb.length;
            for (let k = 0; k < nb.length; k++) {
                const y = nb[k];
                this.edgeX[e] = x;
                this.edgeY[e] = y;
                this.sqrtP[e] = Math.sqrt(pr[k]);
                this.edgeIdx.set(x * chain.n + y, e);
                e++;
            }
        }
        for (let e2 = 0; e2 < total; e2++) {
            const x = this.edgeX[e2];
            const y = this.edgeY[e2];
            if (!this.edgeIdx.has(y * this.chain.n + x))
                throw new Error("chain support must be symmetric");
            this.flipEdge[e2] = this.marked.has(x) || this.marked.has(y) ? 1 : 0;
        }
    }
    get numEdges() {
        return this.edgeX.length;
    }
    /** One search step v <- C S R v on the edge-space state. */
    applyStep(re, im) {
        // R = 2 Pi - I, blockwise: per x, reflect the x-block through phi_x.
        for (let x = 0; x < this.chain.n; x++) {
            const s = this.rowStart[x];
            const len = this.rowLen[x];
            let ar = 0;
            let ai = 0;
            for (let k = 0; k < len; k++) {
                const w = this.sqrtP[s + k];
                ar += w * re[s + k];
                ai += w * im[s + k];
            }
            for (let k = 0; k < len; k++) {
                const w = this.sqrtP[s + k];
                const idx = s + k;
                re[idx] = 2 * w * ar - re[idx];
                im[idx] = 2 * w * ai - im[idx];
            }
        }
        // S: swap (x,y) <-> (y,x).
        for (let e = 0; e < this.edgeX.length; e++) {
            const x = this.edgeX[e];
            const y = this.edgeY[e];
            if (x >= y)
                continue;
            const f = this.edgeIdx.get(y * this.chain.n + x);
            if (f === undefined)
                continue;
            const tr = re[e];
            const ti = im[e];
            re[e] = re[f];
            im[e] = im[f];
            re[f] = tr;
            im[f] = ti;
        }
        // C: oracle flip on edges touching a marked vertex.
        for (let e = 0; e < this.flipEdge.length; e++) {
            if (this.flipEdge[e] !== 0) {
                re[e] = -re[e];
                im[e] = -im[e];
            }
        }
        this.steps++;
    }
    /** Norm of the current state (unitarity monitor; must stay 1 to ~1e-13). */
    norm(re, im) {
        let s = 0;
        for (let e = 0; e < re.length; e++)
            s += re[e] ** 2 + im[e] ** 2;
        return Math.sqrt(s);
    }
    /** Marked-edge probability mass of the current state. */
    markedProbability(re, im) {
        let p = 0;
        for (let e = 0; e < this.edgeX.length; e++) {
            if (this.marked.has(this.edgeX[e])) {
                const vr = re[e];
                const vi = im[e];
                p += vr * vr + vi * vi;
            }
        }
        return p;
    }
    /** Initial state phi_mu for a start distribution mu over vertices. */
    initialState(mu) {
        const re = new Float64Array(this.edgeX.length);
        const im = new Float64Array(this.edgeX.length);
        for (let e = 0; e < this.edgeX.length; e++) {
            const x = this.edgeX[e];
            re[e] = Math.sqrt(mu[x]) * this.sqrtP[e];
        }
        return { re, im };
    }
    /** Detection curve: marked probability after steps 1..maxSteps from phi_mu, with unitarity check. */
    detectionCurve(mu, maxSteps) {
        const { re, im } = this.initialState(mu);
        const curve = new Float64Array(maxSteps);
        let minNorm = this.norm(re, im);
        for (let k = 0; k < maxSteps; k++) {
            this.applyStep(re, im);
            curve[k] = this.markedProbability(re, im);
            const nn = this.norm(re, im);
            if (nn < minNorm)
                minNorm = nn;
        }
        return { curve, minNorm };
    }
    /** First step at which marked probability crosses the threshold (detection with that confidence). */
    detectionTime(mu, threshold, maxSteps) {
        const { curve } = this.detectionCurve(mu, maxSteps);
        for (let k = 0; k < maxSteps; k++) {
            if (curve[k] >= threshold)
                return { step: k + 1, probability: curve[k] };
        }
        return { step: -1, probability: curve.length > 0 ? Math.max(...curve) : 0 };
    }
}

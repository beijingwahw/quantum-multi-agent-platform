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
export interface Chain {
    readonly n: number;
    /** Sparse row-stochastic transitions: neighbors[i] distinct, probs[i] row-stochastic. */
    readonly neighbors: ReadonlyArray<readonly number[]>;
    readonly probs: ReadonlyArray<readonly number[]>;
}
/** Uniform chain over an undirected adjacency structure (no self-loops added). */
export declare function chainFromGraph(adj: ReadonlyArray<readonly number[]>): Chain;
/** Lazy version P' = (P + I)/2: self-loop weight 1/2 + p(x|x)/2, all other probabilities halved. */
export declare function lazyChain(c: Chain): Chain;
/** Dense row-major matrix of the chain (for LU / Jacobi referees). */
export declare function chainMatrix(c: Chain): Float64Array;
/** Start distribution: uniform over all states except the targets (the conditioned start law). */
export declare function uniformAwayFrom(n: number, targets: ReadonlySet<number>): Float64Array;
export declare class SzegedyWalk {
    readonly chain: Chain;
    readonly marked: ReadonlySet<number>;
    readonly edgeX: Int32Array;
    readonly edgeY: Int32Array;
    readonly edgeIdx: Map<number, number>;
    readonly rowStart: Int32Array;
    readonly rowLen: Int32Array;
    readonly sqrtP: Float64Array;
    readonly flipEdge: Uint8Array;
    steps: number;
    constructor(chain: Chain, marked: Iterable<number>);
    get numEdges(): number;
    /** One search step v <- C S R v on the edge-space state. */
    applyStep(re: Float64Array, im: Float64Array): void;
    /** Norm of the current state (unitarity monitor; must stay 1 to ~1e-13). */
    norm(re: Float64Array, im: Float64Array): number;
    /** Marked-edge probability mass of the current state. */
    markedProbability(re: Float64Array, im: Float64Array): number;
    /** Initial state phi_mu for a start distribution mu over vertices. */
    initialState(mu: Float64Array): {
        re: Float64Array;
        im: Float64Array;
    };
    /** Detection curve: marked probability after steps 1..maxSteps from phi_mu, with unitarity check. */
    detectionCurve(mu: Float64Array, maxSteps: number): {
        curve: Float64Array;
        minNorm: number;
    };
    /** First step at which marked probability crosses the threshold (detection with that confidence). */
    detectionTime(mu: Float64Array, threshold: number, maxSteps: number): {
        step: number;
        probability: number;
    };
}

/**
 * Effect-level model of a bucket-brigade qRAM (Giovannetti-Lloyd-Maccone,
 * PRL 100, 160501 (2008); PRA 78, 052310 (2008), arXiv:0807.4994).
 *
 * Two layers are modeled and machine-verified separately:
 *
 * (1) ADDRESSING SEMANTICS (noiseless). A query acts on address (n qubits)
 *     plus one bus qubit as the block-diagonal unitary
 *         M = diag_a R(x_a),  R(x): |0> -> sqrt(1-x)|0> + sqrt(x)|1>,
 *     where x_a in [0,1] is the value stored in cell a. For x_a in {0,1}
 *     this is exactly the classical read |a>|0> -> |a>|x_a>; for real-valued
 *     cells it is the amplitude encoding that amplitude estimation consumes.
 *     We verify unitarity of M and the per-address isometry to 1e-15.
 *
 * (2) ERROR-EXPOSURE LEDGER. The physical bucket brigade routes the bus by
 *     writing one routing node per level: exactly n active nodes per query.
 *     The conventional fanout architecture drives every switch of the tree:
 *     2^n - 1 active nodes. Under independent per-active-node failure with
 *     probability p, the query failure probability is 1 - (1-p)^(active),
 *     verified against exhaustive enumeration of failure subsets for n <= 4.
 *
 * The honest boundary: routing failures here are flagged/detectable events;
 * coherent noise on the stored amplitudes is a strictly harder model (see
 * Arunachalam et al., New J. Phys. 17, 123010 (2015)) and is not simulated.
 */
/** Architecture for the error-exposure ledger. */
export type QramArch = "bucket-brigade" | "fanout";
/** Number of routing nodes whose failure can corrupt a single query. */
export declare function activeNodes(arch: QramArch, addressBits: number): number;
/** Query failure probability under independent per-active-node failure p. */
export declare function queryFailureProb(arch: QramArch, addressBits: number, p: number): number;
/** Exhaustive enumeration of failure subsets; referee for queryFailureProb. */
export declare function queryFailureProbEnumerated(arch: QramArch, addressBits: number, p: number): number;
/**
 * A qRAM with 2^addressBits cells holding values in [0,1] (task statistics of
 * an online stream: per-type success rates, fill fractions, ...). Queries act
 * on address x bus (dimension 2^(n+1)); the state is a complex vector because
 * the address register may be in superposition.
 */
export declare class BucketBrigadeQram {
    readonly addressBits: number;
    readonly numCells: number;
    readonly dim: number;
    readonly cells: Float64Array;
    /** Cost ledger: total routing-node activations across all queries. */
    totalActivations: number;
    queryCount: number;
    constructor(addressBits: number, cells?: Float64Array);
    /** Apply one addressing query to a state vector on address x bus, in place-safe fashion. */
    applyQuery(state: Float64Array, im: Float64Array): void;
    /** Stream update: write value into cell a; ledger charges one routing pass (depth n). */
    write(address: number, value: number): void;
    /** Probability of reading bus = 1 after querying the given (already prepared) address state. */
    busOneProbability(state: Float64Array, im: Float64Array): number;
}

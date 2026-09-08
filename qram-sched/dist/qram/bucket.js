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
import { reject } from "../core/errors.js";
/** Number of routing nodes whose failure can corrupt a single query. */
export function activeNodes(arch, addressBits) {
    if (!Number.isInteger(addressBits) || addressBits < 1)
        reject("QRAM_ARG_RANGE", "addressBits must be >= 1");
    if (arch === "bucket-brigade")
        return addressBits;
    return 2 ** addressBits - 1;
}
/** Query failure probability under independent per-active-node failure p. */
export function queryFailureProb(arch, addressBits, p) {
    // v0.3.0: p outside [0,1] used to produce probabilities outside [0,1] silently.
    if (!(p >= 0 && p <= 1))
        reject("QRAM_P_RANGE", "node failure p in [0,1]");
    const k = activeNodes(arch, addressBits);
    return 1 - (1 - p) ** k;
}
/** Exhaustive enumeration of failure subsets; referee for queryFailureProb. */
export function queryFailureProbEnumerated(arch, addressBits, p) {
    if (!(p >= 0 && p <= 1))
        reject("QRAM_P_RANGE", "node failure p in [0,1]");
    const k = activeNodes(arch, addressBits);
    if (k > 20)
        reject("QRAM_ENUM_LIMIT", "enumeration limited to 20 active nodes");
    let fail = 0;
    for (let mask = 0; mask < 2 ** k; mask++) {
        const weight = popcount(mask);
        const prob = p ** weight * (1 - p) ** (k - weight);
        if (mask !== 0)
            fail += prob;
    }
    return fail;
}
function popcount(x) {
    let c = 0;
    while (x !== 0) {
        x &= x - 1;
        c++;
    }
    return c;
}
/**
 * A qRAM with 2^addressBits cells holding values in [0,1] (task statistics of
 * an online stream: per-type success rates, fill fractions, ...). Queries act
 * on address x bus (dimension 2^(n+1)); the state is a complex vector because
 * the address register may be in superposition.
 */
export class BucketBrigadeQram {
    addressBits;
    numCells;
    dim;
    cells;
    /** Cost ledger: total routing-node activations across all queries. */
    totalActivations = 0;
    queryCount = 0;
    constructor(addressBits, cells) {
        if (!Number.isInteger(addressBits) || addressBits < 1 || addressBits > 16) {
            reject("QRAM_ARG_RANGE", "addressBits in [1,16]");
        }
        this.addressBits = addressBits;
        this.numCells = 2 ** addressBits;
        this.dim = this.numCells * 2;
        this.cells = cells ?? new Float64Array(this.numCells);
        if (cells !== undefined && cells.length !== this.numCells)
            reject("QRAM_CELLS_SHAPE", "cells length mismatch");
    }
    /** Apply one addressing query to a state vector on address x bus, in place-safe fashion. */
    applyQuery(state /* re */, im /* im */) {
        for (let a = 0; a < this.numCells; a++) {
            const x = this.cells[a];
            const c = Math.sqrt(1 - x);
            const s = Math.sqrt(x);
            const i0 = a * 2;
            const re0 = state[i0];
            const im0 = im[i0];
            const re1 = state[i0 + 1];
            const im1 = im[i0 + 1];
            state[i0] = c * re0 - s * re1;
            im[i0] = c * im0 - s * im1;
            state[i0 + 1] = s * re0 + c * re1;
            im[i0 + 1] = s * im0 + c * im1;
        }
        this.queryCount++;
        this.totalActivations += activeNodes("bucket-brigade", this.addressBits);
    }
    /** Stream update: write value into cell a; ledger charges one routing pass (depth n). */
    write(address, value) {
        if (address < 0 || address >= this.numCells)
            reject("QRAM_ADDRESS_RANGE", "address out of range");
        if (value < 0 || value > 1)
            reject("QRAM_CELL_RANGE", "cell values live in [0,1]");
        this.cells[address] = value;
        this.totalActivations += activeNodes("bucket-brigade", this.addressBits);
    }
    /** Probability of reading bus = 1 after querying the given (already prepared) address state. */
    busOneProbability(state, im) {
        this.applyQuery(state, im);
        let p = 0;
        for (let a = 0; a < this.numCells; a++) {
            const re = state[a * 2 + 1];
            const imv = im[a * 2 + 1];
            p += re * re + imv * imv;
        }
        return p;
    }
}

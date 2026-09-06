/** Prepare |0...0> on address x bus, apply H^{(n)} on the address, then query. */
export function encodeUniformStream(qram) {
    const re = new Float64Array(qram.dim);
    const im = new Float64Array(qram.dim);
    re[0] = 1; // |0...0>|0>
    const amp = 1 / Math.sqrt(qram.numCells);
    for (let a = 0; a < qram.numCells; a++) {
        re[a * 2] = amp; // Hadamard^n on address, bus stays |0>
    }
    qram.applyQuery(re, im);
    return { re, im };
}
/** Exact mean of the stored stream values. */
export function streamMean(qram) {
    let s = 0;
    for (let a = 0; a < qram.numCells; a++)
        s += qram.cells[a];
    return s / qram.numCells;
}
/** Classical Monte Carlo estimate of the stream mean: draws = number of bus samples (query count). */
export function monteCarloMean(qram, draws, rand) {
    let hits = 0;
    for (let i = 0; i < draws; i++) {
        const a = Math.floor(rand() * qram.numCells);
        if (rand() < qram.cells[a])
            hits++;
    }
    return { estimate: hits / draws, queries: draws };
}

/**
 * Exact amplitude estimation (Brassard-Hoyer-Mosca-Tapp, arXiv:quant-ph/0005055).
 *
 * The Grover iterate G for amplitude a = sin^2(theta) lives on the invariant
 * 2-plane spanned by |good> and the normalized bad component, where it acts as
 * the rotation G = R(2 theta):
 *     G = [[cos 2t, -sin 2t], [sin 2t, cos 2t]],  sin t = sqrt(p).
 *
 * Layered referees:
 *  - FULL-SPACE Grover simulation (H^q, phase oracles, q <= 10) verifies the
 *    2-plane reduction: success probability after k iterates is exactly
 *    sin^2((2k+1) theta) to machine precision.
 *  - EXACT QPE: m phase qubits, controlled-G^{2^j}, exact inverse QFT, all in
 *    exact complex arithmetic on the (2^m x 2) joint space. The estimate
 *    distribution over j in {0..2^m-1} maps to p_hat = sin^2(pi j / 2^m).
 *    Median error scales as c/2^m with 2^m - 1 oracle queries, versus Monte
 *    Carlo's Theta(1/eps^2) samples — the quadratic precision law.
 */
import { Rng } from "../core/rng.js";
import { reject } from "../core/errors.js";
/** Success probability of k Grover iterates with good fraction p (2-plane closed form). */
export function groverSuccessClosedForm(p, k) {
    if (!(p >= 0 && p <= 1))
        reject("AE_P_RANGE", "p in [0,1] for the Grover closed form");
    if (!Number.isInteger(k) || k < 0)
        reject("AE_K_RANGE", "k >= 0 Grover iterations");
    const theta = Math.asin(Math.sqrt(p));
    return Math.sin((2 * k + 1) * theta) ** 2;
}
/** Full-space Grover simulation over N = 2^q items, t of them marked. Referee for the closed form. */
export function groverFullSpace(q, marked, k) {
    if (!Number.isInteger(q) || q < 1 || q > 30) {
        reject("AE_FULLSPACE_PARAMS", "groverFullSpace: q address bits in [1,30]");
    }
    const n = 2 ** q;
    const seen = new Set();
    for (const m of marked) {
        if (!Number.isInteger(m) || m < 0 || m >= n) {
            reject("AE_FULLSPACE_PARAMS", `groverFullSpace: marked index ${m} outside [0, N=${n})`);
        }
        if (seen.has(m))
            reject("AE_FULLSPACE_PARAMS", `groverFullSpace: duplicate marked index ${m}`);
        seen.add(m);
    }
    if (!Number.isInteger(k) || k < 0)
        reject("AE_FULLSPACE_PARAMS", "groverFullSpace: k >= 0 iterations");
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    // A = H^{(q)} applied to |0...0>: uniform superposition.
    const amp = 1 / Math.sqrt(n);
    for (let i = 0; i < n; i++)
        re[i] = amp;
    for (let it = 0; it < k; it++) {
        // S_chi: flip phases of marked items.
        for (const m of marked)
            re[m] = -re[m];
        // A S_0 A^{-1} with A = H^{(q)}: reflection about the uniform state.
        let sr = 0;
        let si = 0;
        for (let i = 0; i < n; i++) {
            sr += re[i];
            si += im[i];
        }
        for (let i = 0; i < n; i++) {
            const vr = re[i];
            const vi = im[i];
            re[i] = 2 * sr / n - vr;
            im[i] = 2 * si / n - vi;
        }
    }
    let p = 0;
    for (const m of marked) {
        const vr = re[m];
        const vi = im[m];
        p += vr * vr + vi * vi;
    }
    return p;
}
/** Distribution of QPE register outcomes j for amplitude estimation of p with m phase qubits. */
export function qaeDistribution(p, m) {
    if (!(p > 0 && p < 1))
        reject("AE_P_RANGE", "p in (0,1) for QAE (0 and 1 are read off trivially)");
    if (!Number.isInteger(m) || m < 1 || m > 30)
        reject("AE_M_RANGE", "m in [1,30] phase qubits");
    const M = 2 ** m;
    const theta = Math.asin(Math.sqrt(p));
    // Joint state on phase register x good/bad, after H^m and controlled-G^x:
    //   c_g[x] = sin((2x+1)theta)/sqrt(M), c_b[x] = cos((2x+1)theta)/sqrt(M)
    const cgRe = new Float64Array(M);
    const cgIm = new Float64Array(M);
    const cbRe = new Float64Array(M);
    const cbIm = new Float64Array(M);
    const invSqrtM = 1 / Math.sqrt(M);
    for (let x = 0; x < M; x++) {
        const ang = (2 * x + 1) * theta;
        cgRe[x] = Math.sin(ang) * invSqrtM;
        cbRe[x] = Math.cos(ang) * invSqrtM;
    }
    // Exact inverse QFT on the phase register, independently on each 2-plane sector.
    // Forward QFT uses omega^{-xy}; the inverse uses omega^{+xy}, omega = e^{-2 pi i / M}.
    for (const [re, im] of [
        [cgRe, cgIm],
        [cbRe, cbIm],
    ]) {
        const outRe = new Float64Array(M);
        const outIm = new Float64Array(M);
        for (let y = 0; y < M; y++) {
            let accRe = 0;
            let accIm = 0;
            for (let x = 0; x < M; x++) {
                const ang = (2 * Math.PI * x * y) / M;
                const wr = Math.cos(ang);
                const wi = Math.sin(ang);
                const cr = re[x];
                const ci = im[x];
                accRe += cr * wr - ci * wi;
                accIm += cr * wi + ci * wr;
            }
            outRe[y] = accRe * invSqrtM;
            outIm[y] = accIm * invSqrtM;
        }
        for (let j = 0; j < M; j++) {
            re[j] = outRe[j];
            im[j] = outIm[j];
        }
    }
    const dist = new Float64Array(M);
    for (let j = 0; j < M; j++) {
        dist[j] = cgRe[j] ** 2 + cgIm[j] ** 2 + cbRe[j] ** 2 + cbIm[j] ** 2;
    }
    return dist;
}
/** p_hat value for register outcome j. */
export function qaeEstimate(j, m) {
    if (!Number.isInteger(m) || m < 1 || m > 30)
        reject("AE_M_RANGE", "m in [1,30] phase qubits");
    if (!Number.isInteger(j) || j < 0 || j >= 2 ** m) {
        reject("AE_REGISTER_RANGE", `outcome j in [0, 2^m) (got ${j} for m=${m})`);
    }
    return Math.sin((Math.PI * j) / 2 ** m) ** 2;
}
/** Median absolute error of QAE with m phase qubits for true amplitude p. */
export function qaeMedianError(p, m) {
    const dist = qaeDistribution(p, m);
    const M = 2 ** m;
    const entries = [];
    for (let j = 0; j < M; j++) {
        const prob = dist[j];
        if (prob > 0)
            entries.push({ err: Math.abs(qaeEstimate(j, m) - p), prob });
    }
    entries.sort((a, b) => a.err - b.err);
    let acc = 0;
    for (const e of entries) {
        acc += e.prob;
        if (acc >= 0.5)
            return e.err;
    }
    return entries.length > 0 ? entries[entries.length - 1].err : 0;
}
/** Oracle queries used by one QAE run with m phase qubits (controlled powers 2^0..2^{m-1}). */
export function qaeQueries(m) {
    if (!Number.isInteger(m) || m < 1 || m > 30)
        reject("AE_M_RANGE", "m in [1,30] phase qubits");
    return 2 ** m - 1;
}
/** Monte Carlo median absolute error for estimating p with s samples, over trials runs. */
export function mcMedianError(p, s, trials, seed) {
    if (!(p >= 0 && p <= 1))
        reject("AE_P_RANGE", "p in [0,1] for Monte Carlo");
    // v0.3.0: s = 0 used to return NaN and trials = 0 an undefined median; named rejection.
    if (!Number.isInteger(s) || s < 1 || !Number.isInteger(trials) || trials < 1) {
        reject("AE_MC_PARAMS", "s >= 1 samples and trials >= 1");
    }
    const rng = new Rng(seed);
    const errs = [];
    for (let t = 0; t < trials; t++) {
        let hits = 0;
        for (let i = 0; i < s; i++)
            if (rng.next() < p)
                hits++;
        errs.push(Math.abs(hits / s - p));
    }
    errs.sort((a, b) => a - b);
    return errs[Math.floor(trials / 2)];
}

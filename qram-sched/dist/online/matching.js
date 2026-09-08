import { reject } from "../core/errors.js";
import { durHoyerFindBest, groverFindMarked } from "./grover.js";
/**
 * Structural integrity of an online-matching instance (v0.3.0): every arrival
 * list must name integer workers inside [0, n). Out-of-range indices used to
 * read typed arrays out of bounds — silently marking the arrival "taken"
 * (Uint8Array OOB reads are undefined) instead of failing.
 */
function checkObmInstance(inst) {
    if (!Number.isInteger(inst.n) || inst.n < 1) {
        reject("OBM_INSTANCE_SHAPE", `n >= 1 workers required (got ${inst.n})`);
    }
    for (let a = 0; a < inst.arrivals.length; a++) {
        const nb = inst.arrivals[a];
        for (const w of nb) {
            if (!Number.isInteger(w) || w < 0 || w >= inst.n) {
                reject("OBM_INSTANCE_SHAPE", `arrival ${a} lists worker ${w} outside [0, n=${inst.n})`);
            }
        }
    }
}
/** Exact maximum matching size of the final graph (Kuhn's algorithm). */
export function kuhnMaxMatching(inst) {
    checkObmInstance(inst);
    const matchOfWorker = new Int32Array(inst.n).fill(-1);
    const tryAssign = (arrival, visited) => {
        const nb = inst.arrivals[arrival];
        for (const w of nb) {
            if (visited[w] !== 0)
                continue;
            visited[w] = 1;
            if (matchOfWorker[w] === -1 || tryAssign(matchOfWorker[w], visited)) {
                matchOfWorker[w] = arrival;
                return true;
            }
        }
        return false;
    };
    let size = 0;
    for (let a = 0; a < inst.arrivals.length; a++) {
        const visited = new Uint8Array(inst.n);
        if (tryAssign(a, visited))
            size++;
    }
    return size;
}
/** The cascade adversary: arrivals in pairs (v ~ {u_1, u_2}; w ~ {u_1}); greedy with
 *  lowest-index ties matches exactly half; uniform ties do better; ranking 3/4. */
export function cascadeInstance(pairs) {
    if (!Number.isInteger(pairs) || pairs < 1)
        reject("MATCH_ARG_RANGE", "pairs >= 1");
    const n = 2 * pairs;
    const arrivals = [];
    for (let i = 0; i < pairs; i++) {
        arrivals.push([2 * i, 2 * i + 1]);
        arrivals.push([2 * i]);
    }
    return { n, arrivals };
}
/** Erdos-Renyi arrival bank. */
export function randomInstance(n, arrivals, p, rng) {
    if (!Number.isInteger(n) || n < 1)
        reject("MATCH_ARG_RANGE", "n >= 1 workers");
    if (!Number.isInteger(arrivals) || arrivals < 0)
        reject("MATCH_ARG_RANGE", "arrivals >= 0");
    if (!(p >= 0 && p <= 1))
        reject("MATCH_ARG_RANGE", "edge probability p in [0,1]");
    const list = [];
    for (let a = 0; a < arrivals; a++) {
        const nb = [];
        for (let w = 0; w < n; w++)
            if (rng.next() < p)
                nb.push(w);
        list.push(nb);
    }
    return { n, arrivals: list };
}
/** Greedy matching. tie 'lowest'/'highest': deterministic first/last-available
 *  (worst case exactly 1/2, both tight via the phase adversary). tie
 *  'uniform': uniformly random available neighbor. mode 'grover' serves the
 *  uniform-tie variant via Grover sampling (distribution-identical) or falls
 *  back to the exact rule on bounded-error misses (charged). */
export function greedyMatch(inst, rng, mode, tie = "uniform") {
    checkObmInstance(inst);
    const taken = new Uint8Array(inst.n);
    let size = 0;
    let reads = 0;
    let disagreements = 0;
    for (const nb of inst.arrivals) {
        const isAvail = (w) => taken[w] === 0 && nb.includes(w);
        if (mode === "linear") {
            reads += inst.n;
            const available = nb.filter((w) => taken[w] === 0);
            if (available.length === 0)
                continue;
            const w = tie === "lowest"
                ? available[0]
                : tie === "highest"
                    ? available[available.length - 1]
                    : available[rng.int(available.length)];
            taken[w] = 1;
            size++;
        }
        else {
            const r = groverFindMarked(inst.n, isAvail, rng);
            reads += r.reads;
            // Referee check: the returned worker must be an available neighbor (Grover
            // never invents items; a miss returns -1 and the arrival is skipped only
            // when the marked set is truly empty up to bounded error).
            if (r.index >= 0 && isAvail(r.index)) {
                taken[r.index] = 1;
                size++;
            }
            else if (r.index >= 0) {
                disagreements++;
            }
            else {
                // bounded-error miss: fall back to the exact rule to keep the decision
                // rule identical, charging the linear cost
                const available = nb.filter((w) => taken[w] === 0);
                reads += inst.n;
                if (available.length > 0) {
                    const w = available[rng.int(available.length)];
                    taken[w] = 1;
                    size++;
                    disagreements++;
                }
            }
        }
    }
    return { size, reads, disagreements };
}
/** RANKING: random permutation of workers, arrivals take best-ranked available neighbor. */
export function rankingMatch(inst, rng, mode) {
    const rank = rng.shuffle(Array.from({ length: inst.n }, (_, i) => i));
    return rankingMatchWithRank(inst, rank, mode, rng);
}
/**
 * RANKING core under an explicit worker ranking: rank[w] = the position of
 * worker w (lower = better); each arrival takes its available neighbor of
 * best rank. 'linear' consumes no randomness beyond the given ranking;
 * 'grover' draws from rng inside the Durr-Hoyer search. The split exists so
 * exact enumerators (kv-tight) can drive the same decision rule.
 */
export function rankingMatchWithRank(inst, rank, mode, rng) {
    checkObmInstance(inst);
    // v0.3.0: a short rank array used to read `undefined as number` for missing
    // workers — every unranked arrival silently looked unmatchable.
    if (rank.length !== inst.n) {
        reject("OBM_RANK_SHAPE", `rank must carry one entry per worker (got ${rank.length} for n=${inst.n})`);
    }
    const taken = new Uint8Array(inst.n);
    let size = 0;
    let reads = 0;
    let disagreements = 0;
    for (const nb of inst.arrivals) {
        const adjSet = new Set(nb);
        const value = (w) => (taken[w] === 0 && adjSet.has(w) ? rank[w] : Number.MAX_SAFE_INTEGER);
        if (mode === "linear") {
            reads += inst.n;
            let bestW = -1;
            let bestV = Number.MAX_SAFE_INTEGER;
            for (let w = 0; w < inst.n; w++) {
                const v = value(w);
                if (v < bestV) {
                    bestV = v;
                    bestW = w;
                }
            }
            if (bestW >= 0) {
                taken[bestW] = 1;
                size++;
            }
        }
        else {
            // Durr-Hoyer minimum over value(); identical decision when correct.
            const values = Array.from({ length: inst.n }, (_, w) => value(w));
            const r = durHoyerFindBest(values, (x, y) => x < y, rng);
            reads += r.reads;
            // Referee (no oracle reads charged — the values array is the oracle the
            // search already queries): the exact argmin the linear rule would take.
            let exactBest = -1;
            let exactV = Number.MAX_SAFE_INTEGER;
            for (let w = 0; w < inst.n; w++) {
                if (values[w] < exactV) {
                    exactV = values[w];
                    exactBest = w;
                }
            }
            const w = r.best;
            if (value(w) < Number.MAX_SAFE_INTEGER) {
                taken[w] = 1;
                size++;
            }
            // A bounded-error miss: the search's pick differs from the exact rule's
            // (counted only when the exact rule had a match to find).
            if (exactBest >= 0 && w !== exactBest)
                disagreements++;
        }
    }
    return { size, reads, disagreements };
}

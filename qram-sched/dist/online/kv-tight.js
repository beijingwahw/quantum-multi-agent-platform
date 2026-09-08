import { greedyMatch, kuhnMaxMatching, rankingMatchWithRank } from "./matching.js";
import { Rng } from "../core/rng.js";
/** MonotoneG: arrival j has the suffix neighborhood {v_j, ..., v_{n-1}}. */
export function monotoneInstance(n) {
    if (n < 1 || n > 4096)
        throw new Error("n in [1,4096]");
    const arrivals = [];
    for (let j = 0; j < n; j++) {
        const nb = [];
        for (let w = j; w < n; w++)
            nb.push(w);
        arrivals.push(nb);
    }
    return { n, arrivals };
}
/** MonotoneG under a uniformly random worker relabeling tau (a D_n member). */
export function sampleDnMember(n, rng) {
    const tau = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const arrivals = [];
    for (let j = 0; j < n; j++)
        arrivals.push(tau.slice(j).sort((a, b) => a - b));
    return { n, arrivals };
}
/** d(m): derangement numbers, exact (d(0)=1, d(1)=0, d(m)=(m-1)(d(m-1)+d(m-2))). */
export function derangement(m) {
    if (m < 0 || m > 5000)
        throw new Error("m in [0,5000]");
    if (m === 0)
        return 1n;
    let dPrev = 1n; // d(0)
    let dCur = 0n; // d(1)
    for (let i = 2; i <= m; i++) {
        const dNext = BigInt(i - 1) * (dCur + dPrev);
        dPrev = dCur;
        dCur = dNext;
    }
    return dCur;
}
function factorial(m) {
    let f = 1n;
    for (let i = 2; i <= m; i++)
        f *= BigInt(i);
    return f;
}
/** Feige arXiv:1812.11774, Corollary 21: E[RANKING on D_n] = ((n+1)! - d(n+1) - d(n)) / n!. */
export function feigeRankingExpectation(n) {
    if (n < 1 || n > 1024)
        throw new Error("n in [1,1024]");
    const numerator = factorial(n + 1) - derangement(n + 1) - derangement(n);
    // BigInt division with 18 kept digits: factorials overflow double precision
    // beyond n ~ 18, so the ratio is computed exactly in BigInt first.
    const scaled = (numerator * 10n ** 18n) / factorial(n);
    return Number(scaled) / 1e18;
}
/**
 * Exhaustive RANKING expectation on MonotoneG: run the algorithm under every
 * one of the n! rank permutations. Exact kernel; the permutation enumeration
 * is Heap's algorithm. Limited to n <= 9 (362880 permutations).
 */
export function rankingExpectationExhaustive(n) {
    if (n < 1 || n > 9)
        throw new Error("exhaustive enumeration limited to n <= 9");
    const rank = Array.from({ length: n }, (_, i) => i);
    const shared = new Rng(0); // 'linear' mode consumes no randomness; one dummy for all runs
    const inst = monotoneInstance(n);
    let total = 0;
    let perms = 0;
    const evaluate = () => {
        const res = rankingMatchWithRank(inst, rank, "linear", shared);
        total += res.size;
        perms++;
    };
    const c = new Int32Array(n);
    evaluate();
    for (let i = 0; i < n;) {
        if (c[i] < i) {
            const k = i % 2 === 0 ? 0 : c[i];
            const tmp = rank[i];
            rank[i] = rank[k];
            rank[k] = tmp;
            evaluate();
            c[i] = c[i] + 1;
            i = 0;
        }
        else {
            c[i] = 0;
            i++;
        }
    }
    return total / perms;
}
/**
 * Exact expectation of greedy with uniformly random tie-breaking on MonotoneG,
 * by subset dynamic programming over the suffix structure. At step j the only
 * relevant state is the set of taken workers inside the live window [j, n)
 * (workers below j are unreachable forever after); the arrival takes a
 * uniformly random available neighbor. Exact in double precision (products of
 * unit fractions; cross-checked against the derangement formula and Monte
 * Carlo in EXP6/tests — the KVV Lemma 13 consequence).
 */
export function greedyUniformExpectationExact(n) {
    if (n < 1 || n > 24)
        throw new Error("subset DP limited to n <= 24");
    let states = new Map([[0, 1]]);
    let expected = 0;
    for (let j = 0; j < n; j++) {
        const next = new Map();
        const windowSize = n - j;
        for (const [mask, prob] of states) {
            const avail = [];
            for (let b = 0; b < windowSize; b++)
                if (((mask >>> b) & 1) === 0)
                    avail.push(b);
            if (avail.length === 0) {
                add(next, mask >>> 1, prob);
            }
            else {
                expected += prob;
                const p = prob / avail.length;
                for (const b of avail)
                    add(next, (mask | (1 << b)) >>> 1, p);
            }
        }
        states = next;
    }
    return expected;
}
function add(map, key, delta) {
    map.set(key, (map.get(key) ?? 0) + delta);
}
/**
 * The deterministic 1/2-tight phase adversary (Feige Section 1 sketch): the
 * first n/2 arrivals see ALL workers; the adversary records the set S the
 * (fixed, deterministic) rule matches them to; the last n/2 arrivals see
 * exactly S. Once the rule is fixed this is an oblivious instance; greedy
 * matches exactly n/2 while OPT = n (phase 2 to S, phase 1 to the complement).
 */
export function deterministicGreedyHalfInstance(n, rule) {
    if (n < 2 || n % 2 !== 0)
        throw new Error("n must be even");
    const half = n / 2;
    const all = Array.from({ length: n }, (_, i) => i);
    const arrivals = [];
    for (let i = 0; i < half; i++)
        arrivals.push([...all]);
    const taken = new Uint8Array(n);
    const matched = [];
    for (let i = 0; i < half; i++) {
        const avail = all.filter((w) => taken[w] === 0);
        const w = rule === "lowest" ? avail[0] : avail[avail.length - 1];
        taken[w] = 1;
        matched.push(w);
    }
    for (let i = 0; i < half; i++)
        arrivals.push([...matched]);
    return { n, arrivals };
}
const NAME_OBLIVIOUS = new Set(["ranking", "greedy-uniform"]);
/**
 * Verify a tightness certificate against the machine kernels. The checker
 * never trusts the claim's numbers: it rebuilds the canonical instance for
 * the family, recomputes OPT (Kuhn) and the exact expectation (derangement
 * formula / subset DP / deterministic replay), and NAMES every deviation.
 */
export function verifyTightCertificate(claim) {
    const violations = [];
    const { family, n, algorithm } = claim;
    let inst;
    if (family === "kv-monotone") {
        if (n < 1 || n > 24) {
            return rejected(violations, NaN, NaN, NaN, `kv-monotone certificates limited to n <= 24`);
        }
        inst = monotoneInstance(n);
    }
    else {
        if (n < 2 || n % 2 !== 0) {
            return rejected(violations, NaN, NaN, NaN, "greedy-adversary certificates need even n >= 2");
        }
        if (algorithm === "ranking" || algorithm === "greedy-uniform") {
            violations.push({
                name: "family/algorithm mismatch",
                detail: "the deterministic half adversary certifies DETERMINISTIC rules (exact n/2); randomized rules must be " +
                    "certified on the kv-monotone (D_n) family instead",
            });
        }
        inst = deterministicGreedyHalfInstance(n, algorithm === "greedy-highest" ? "highest" : "lowest");
    }
    const opt = kuhnMaxMatching(inst);
    if (opt !== n) {
        violations.push({
            name: "no perfect matching",
            detail: `OPT = ${opt}, but a tightness certificate requires OPT = n = ${n} (the cap is a ratio to the optimum)`,
        });
    }
    let machineExpectedSize;
    if (family === "kv-monotone") {
        if (!NAME_OBLIVIOUS.has(algorithm)) {
            // Name-aware deterministic rules do not have the D_n value on the fixed
            // representative: their honest expectation is the D_n average, which the
            // exact kernels here cannot produce by a single-member run. Reject with
            // the member value attached, naming the gap.
            const reversed = { n, arrivals: inst.arrivals.map((nb) => [...nb].reverse()) };
            const memberValue = algorithm === "greedy-lowest"
                ? greedyMatch(inst, dummyRng(), "linear", "lowest").size
                : greedyMatch(reversed, dummyRng(), "linear", "lowest").size;
            const dnValue = feigeRankingExpectation(n);
            violations.push({
                name: "name-aware rule on a single member",
                detail: `${algorithm} is name-aware: on the fixed MonotoneG member it matches ${memberValue} (ratio ` +
                    `${fmt6(memberValue / n)}) while the D_n family value is ${fmt6(dnValue)} (ratio ${fmt6(dnValue / n)}); ` +
                    `a single-member certificate smuggles the distribution's tightness onto one graph`,
            });
            machineExpectedSize = memberValue;
        }
        else if (algorithm === "ranking") {
            machineExpectedSize = feigeRankingExpectation(n);
        }
        else {
            machineExpectedSize = greedyUniformExpectationExact(n);
        }
    }
    else {
        const res = greedyMatch(inst, dummyRng(), "linear", algorithm === "greedy-highest" ? "highest" : "lowest");
        machineExpectedSize = res.size;
    }
    if (Math.abs(claim.claimedExpectedSize - machineExpectedSize) > 1e-6) {
        violations.push({
            name: "counterfeit expectation",
            detail: `claimed E[size] = ${fmt6(claim.claimedExpectedSize)}, machine exact = ${fmt6(machineExpectedSize)}`,
        });
    }
    const machineRatio = opt > 0 ? machineExpectedSize / opt : NaN;
    if (Math.abs(claim.claimedRatio - machineRatio) > 1e-6) {
        violations.push({
            name: "counterfeit ratio cap",
            detail: `claimed ratio = ${fmt6(claim.claimedRatio)}, machine = ${fmt6(machineRatio)}`,
        });
    }
    return { accepted: violations.length === 0, violations, machineExpectedSize, machineOpt: opt, machineRatio };
}
function rejected(violations, size, opt, ratio, detail) {
    violations.push({ name: "malformed certificate", detail });
    return { accepted: false, violations, machineExpectedSize: size, machineOpt: opt, machineRatio: ratio };
}
function fmt6(x) {
    return Number.isFinite(x) ? x.toFixed(6) : String(x);
}
/** The certificate checker consumes no randomness; greedy-linear ignores it. */
function dummyRng() {
    return new Rng(0);
}
/**
 * Verify a claimed per-arrival query ledger for RANKING on an instance by
 * replaying it over the given seeds with the exported kernels. Named
 * rejections: an impossibly cheap ledger (below the one-read-per-arrival
 * floor, or linear reads differing from the exact n-per-arrival rule),
 * disagreement laundering (claimed 0 while the replay shows misses), and a
 * claimed mean size deviating beyond the bounded-error miss budget.
 */
export function verifyQueryLedger(inst, claim, seeds) {
    const violations = [];
    const arrivals = inst.arrivals.length;
    let reads = 0;
    let size = 0;
    let disagreements = 0;
    for (let s = 0; s < seeds; s++) {
        const rng = new Rng(s ^ 0x5f356495);
        const res = rankingMatchWithRank(inst, rng.shuffle(Array.from({ length: inst.n }, (_, i) => i)), claim.mode, rng);
        reads += res.reads;
        size += res.size;
        disagreements += res.disagreements;
    }
    const meanReads = reads / seeds;
    const meanSize = size / seeds;
    const meanDisagreements = disagreements / seeds;
    if (claim.mode === "linear") {
        const exact = inst.n * arrivals;
        if (claim.claimedReads !== exact) {
            violations.push({
                name: "linear ledger must be exact",
                detail: `linear mode reads exactly n per arrival: ${exact}, claimed ${claim.claimedReads}`,
            });
        }
        if (claim.claimedMeanSize !== meanSize) {
            violations.push({
                name: "counterfeit mean size",
                detail: `linear mode is deterministic per seed: replay mean = ${fmt6(meanSize)}, claimed ${fmt6(claim.claimedMeanSize)}`,
            });
        }
        if (claim.claimedDisagreements !== 0) {
            violations.push({
                name: "phantom disagreements",
                detail: `linear mode has no bounded-error misses; claimed ${claim.claimedDisagreements}`,
            });
        }
    }
    else {
        if (claim.claimedReads < arrivals) {
            violations.push({
                name: "ledger below the oracle floor",
                detail: `every arrival costs at least one oracle read: floor = ${arrivals}, claimed ${claim.claimedReads}`,
            });
        }
        if (claim.claimedDisagreements !== meanDisagreements) {
            violations.push({
                name: "disagreement laundering",
                detail: `claimed ${claim.claimedDisagreements} disagreeing arrivals, replay shows ${fmt6(meanDisagreements)} per run`,
            });
        }
        const sizeBudget = meanDisagreements;
        if (Math.abs(claim.claimedMeanSize - meanSize) > sizeBudget + 1e-9) {
            violations.push({
                name: "size beyond the miss budget",
                detail: `claimed mean size ${fmt6(claim.claimedMeanSize)} deviates from replay ${fmt6(meanSize)} by more than the reported miss budget ${fmt6(sizeBudget)}`,
            });
        }
        if (claim.claimedReads > meanReads * 4 + arrivals) {
            violations.push({
                name: "inflated quantum ledger",
                detail: `claimed reads ${claim.claimedReads} far above replay ${fmt6(meanReads)} (x4 slack) — padding the quantum bill also fails audit`,
            });
        }
    }
    return { accepted: violations.length === 0, violations, machineMeanReads: meanReads, machineMeanSize: meanSize, machineMeanDisagreements: meanDisagreements };
}

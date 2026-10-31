/**
 * The qRAM amortized payback law (v0.4.0, R19 wave G5-a) — the exact closed
 * form behind EXP1-D's premise-audit census, promoted to a theorem layer.
 *
 * Charging model (identical to EXP1-D, the bucket-brigade's OWN ledgers, in
 * the spirit of Jaques-Rattew, arXiv:2305.10310 / Quantum 9, 1922 (2025)):
 *   - one write/query routes through n_b active nodes -> n_b activations;
 *   - loading a fresh stream of N = 2^n_b cells costs the QUANTUM side
 *     N * n_b activations (one routed write per cell) while the CLASSICAL
 *     opponent pays its symmetric one-off N (one array op per cell — the
 *     symmetric-billing declaration lives in the model, not in prose);
 *   - per estimation task (median error <= eps) the quantum side pays
 *     qaeQueries(m*(eps)) * n_b activations, the classical side pays the
 *     Hoeffding count at failure budget 0.05 (the EXP4-B convention).
 *
 * THEOREM (PB-a, exact closed form). With Load = N*(n_b - 1) (the net one-off
 * insertion surcharge) and Den = Classical(eps) - Quantum(n_b, eps) > 0, the
 * per-task ledger totals satisfy
 *     Q(T) = N*n_b + T*q*n_b <= N + T*s = C(T)
 * exactly at integer T iff T >= T* := ceil(Load / Den), and T* is the least
 * such integer — division of integers is exact here (all costs are integers
 * below 2^53). EXP1-D anchor reproduced bit-for-bit: n_b = 20, eps = 0.01
 * -> m* = 8, queries = 255, samples = 18445, T* = 1493.
 *
 * THEOREM (PB-b, infeasible domain). Payback NEVER happens exactly on
 *     { Classical(eps) <= Quantum(n_b, eps) } = { s(eps) <= q(eps) * n_b },
 * because Q(T) - C(T) = N*(n_b-1) + T*(q*n_b - s) with both terms >= 0 and
 * the first > 0 for n_b >= 2. The domain boundary is explicit:
 * n_b >= s(eps)/q(eps) is infeasible — criticalAddressBits(eps) evaluates it.
 *
 * LAW (PB-c, machine form). The R18 spec asserted closed-form monotonicity
 * implying a UNIQUE crossover eps*. The machine refuted that reading: Den(eps)
 * is a difference of two oppositely-stepped staircase functions (s ~ 1/eps^2
 * jumps down, q ~ 1/eps jumps down at QAE register thresholds), so the
 * feasible set is NOT an interval — it carries finitely many holes. What
 * survives (and is asserted here): eps*(n_b) := sup{eps : Den(eps) > 0} is
 * the unique crossover in the sup sense, feasibility holds on all small eps,
 * and every hole inside (0, eps*] is machine-enumerated by epsilonStar(nb).
 *
 * AUDIT (PB-d). auditPaybackClaim convicts by name: a payback claim below T*
 * (with the exact ledger gap), a payback claim inside the infeasible domain,
 * and a forged "never pays back" claim inside the feasible domain.
 */
import { qaeMedianError, qaeQueries } from "../ae/ampest.js";
import { activeNodes } from "./bucket.js";
import { reject } from "../core/errors.js";
/** Failure budget of the Hoeffding count (EXP4-B convention, shared by EXP1-D). */
export const FAILURE_BUDGET = 0.05;
/**
 * Off-grid p bank for the QAE requirement: p = 1/2 sits exactly on the phase
 * grid for every m (the degenerate best case, exp1-qram.ts's own guard) and
 * must not set the register size — the requirement is the WORST median error
 * over this bank, exactly as EXP1-D computes it.
 */
export const OFF_GRID_P_BANK = [
    0.037, 0.137, 0.237, 0.337, 0.437, 0.537, 0.637, 0.737, 0.837, 0.937,
];
/** Smallest phase register m whose exact-QAE WORST off-grid median error clears eps. */
export function minimalPhaseQubits(eps) {
    if (!(eps > 0 && eps < 1))
        reject("QRAM_ARG_RANGE", "eps in (0,1) for the payback model");
    let m = 3;
    // 2026-11-01 修复：边界差一错误——原条件 m < 30 使搜索在 m=30 前停止，且出口守卫
    // m >= 30 连"恰好在 m=30 可达"的 eps 一并拒绝；本层契约是 m ∈ [3,30] 闭区间
    // （ampest.ts 的 AE_M_RANGE 与本函数自身的报错文案 "at m <= 30" 都确认含 30）。
    // 改为 m <= 30（允许测试 m=30）与 m > 30（仅当 30 仍不够时才拒绝）
    while (m <= 30 &&
        Math.max(...OFF_GRID_P_BANK.map((p) => qaeMedianError(p, m))) > eps)
        m++;
    if (m > 30)
        reject("QRAM_ARG_RANGE", "eps below the exact-QAE reach at m <= 30");
    return m;
}
/** Classical samples for median error <= eps at failure budget delta (Hoeffding). */
export function hoeffdingSamples(eps, delta = FAILURE_BUDGET) {
    if (!(eps > 0 && eps < 1) || !(delta > 0 && delta < 1)) {
        reject("QRAM_ARG_RANGE", "eps and delta in (0,1) for the Hoeffding count");
    }
    return Math.ceil(Math.log(2 / delta) / (2 * eps * eps));
}
export function paybackModel(nb, eps, delta = FAILURE_BUDGET) {
    if (!Number.isInteger(nb) || nb < 1 || nb > 30) {
        reject("QRAM_ARG_RANGE", "address bits n_b in [1,30] for the payback model");
    }
    const m = minimalPhaseQubits(eps);
    const queries = qaeQueries(m);
    const samples = hoeffdingSamples(eps, delta);
    const N = 2 ** nb;
    const loadQuantum = N * activeNodes("bucket-brigade", nb);
    const perTaskQuantum = queries * activeNodes("bucket-brigade", nb);
    return {
        nb,
        eps,
        N,
        m,
        queries,
        samples,
        loadQuantum,
        loadClassical: N,
        loadNet: loadQuantum - N,
        perTaskQuantum,
        perTaskClassical: samples,
    };
}
/** Total metered activations after T tasks, both sides. */
export function totalQuantumCost(model, tasks) {
    return model.loadQuantum + tasks * model.perTaskQuantum;
}
export function totalClassicalCost(model, tasks) {
    return model.loadClassical + tasks * model.perTaskClassical;
}
/** (PB-a / PB-b) the exact threshold and the infeasible domain, from the model. */
export function paybackThreshold(model) {
    const denominator = model.perTaskClassical - model.perTaskQuantum;
    if (denominator <= 0)
        return { feasible: false, denominator };
    return {
        feasible: true,
        denominator,
        Tstar: Math.ceil(model.loadNet / denominator),
    };
}
/**
 * Independent referee: the first task count T (1..cap) at which the metered
 * quantum total undercuts the classical total, found by running the ledger
 * task-by-task WITHOUT consulting the closed form. null = no crossover inside
 * cap (for infeasible models that is forever, by PB-b's two non-negative
 * terms; cap only bounds the scan, never the claim).
 */
export function bruteForceThreshold(model, cap = 20000) {
    if (!Number.isInteger(cap) || cap < 1)
        reject("QRAM_ARG_RANGE", "scan cap >= 1");
    for (let t = 1; t <= cap; t++) {
        if (totalQuantumCost(model, t) <= totalClassicalCost(model, t))
            return { Tstar: t, scannedTo: t };
    }
    return { Tstar: null, scannedTo: cap };
}
/**
 * (PB-b) the explicit infeasibility boundary at precision eps: n_b at or above
 * ceiling(samples / queries) never pays back (s <= q * n_b), one below it is
 * feasible (s > q * n_b — both sides of the inequality are exact integers).
 */
export function criticalAddressBits(eps, delta = FAILURE_BUDGET) {
    const samples = hoeffdingSamples(eps, delta);
    const queries = qaeQueries(minimalPhaseQubits(eps));
    return { thresholdNb: Math.ceil(samples / queries), samples, queries };
}
export function epsilonStar(nb, gridStep = 0.0025, gridMax = 0.5) {
    if (!Number.isInteger(nb) || nb < 1 || nb > 30) {
        reject("QRAM_ARG_RANGE", "address bits n_b in [1,30] for the crossover scan");
    }
    if (!(gridStep > 0) || !(gridMax > gridStep)) {
        reject("QRAM_ARG_RANGE", "crossover grid needs 0 < step < max");
    }
    const steps = Math.floor(gridMax / gridStep + 1e-9);
    const feasible = [];
    const epsAt = [];
    for (let i = 1; i <= steps; i++) {
        const eps = i * gridStep;
        epsAt.push(eps);
        feasible.push(hoeffdingSamples(eps) - qaeQueries(minimalPhaseQubits(eps)) * nb > 0);
    }
    let epsStar = 0;
    for (let i = 0; i < steps; i++)
        if (feasible[i])
            epsStar = epsAt[i];
    const holes = [];
    for (let i = 0; i < steps; i++) {
        if (epsAt[i] <= epsStar && !feasible[i])
            holes.push(epsAt[i]);
    }
    const firstHole = holes.length > 0 ? epsAt.indexOf(holes[0]) : steps;
    let feasibleFromBelow = true;
    for (let i = 0; i < firstHole; i++)
        feasibleFromBelow = feasibleFromBelow && feasible[i];
    return { nb, epsStar, gridStep, holes, feasibleFromBelow };
}
/** The claim checker: counterfeit break-even rows die here, by name. */
export function auditPaybackClaim(claim) {
    const violations = [];
    if (!Number.isInteger(claim.nb) || claim.nb < 1 || claim.nb > 30) {
        return {
            accepted: false,
            violations: [
                {
                    name: "domain",
                    detail: `address bits n_b in [1,30] required, got ${claim.nb}`,
                },
            ],
        };
    }
    const model = paybackModel(claim.nb, claim.eps, claim.delta ?? FAILURE_BUDGET);
    const threshold = paybackThreshold(model);
    if (claim.breakEvenTasks === null) {
        if (threshold.feasible) {
            violations.push({
                name: "forged-infeasibility",
                detail: `claim says never-pay-back, but the ledger denominator is ${threshold.denominator} > 0 ` +
                    `with T* = ${threshold.Tstar} (Q(T*) = ${totalQuantumCost(model, threshold.Tstar)} <= ` +
                    `C(T*) = ${totalClassicalCost(model, threshold.Tstar)})`,
            });
        }
    }
    else {
        if (!Number.isInteger(claim.breakEvenTasks) || claim.breakEvenTasks < 1) {
            violations.push({
                name: "domain",
                detail: `break-even task count must be an integer >= 1 or null, got ${claim.breakEvenTasks}`,
            });
        }
        else {
            const t = claim.breakEvenTasks;
            const q = totalQuantumCost(model, t);
            const c = totalClassicalCost(model, t);
            if (q > c) {
                if (threshold.feasible && t < threshold.Tstar) {
                    violations.push({
                        name: "below-threshold-payback",
                        detail: `claim: caught up at T = ${t}; ledger: Q(${t}) = ${q} > C(${t}) = ${c} ` +
                            `(gap ${q - c}; exact T* = ${threshold.Tstar})`,
                    });
                }
                else {
                    violations.push({
                        name: "infeasible-domain-payback",
                        detail: `claim: caught up at T = ${t} inside the infeasible domain ` +
                            `(per-task classical ${model.perTaskClassical} <= per-task quantum ` +
                            `${model.perTaskQuantum}); ledger: Q(${t}) = ${q} > C(${t}) = ${c} and the gap ` +
                            `grows linearly with T forever`,
                    });
                }
            }
        }
    }
    return { accepted: violations.length === 0, violations };
}

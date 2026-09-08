/**
 * PHASE-LAW v0.5.0 — the SA DENSITY CENSUS (PL18): the two-face law under the
 * k-pair welfare. The v0.1 solvers re-implemented against W_λ(c) = W_0(c) +
 * λ·realizedPairs(c) (the law.ts family is untouched — these are the density
 * twins, same seeds, same weights, same conventions: greedy is coupling-blind,
 * LS starts at greedy on the FULL λ-aware welfare, SA starts at greedy,
 * seed 42, 4000 iterations, best-ever). The campaign reuses ONE enumeration
 * per (size, seed, k) across the whole λ grid — the optimum is max(w0 + jλ)
 * over the enumerated leaves, so λ costs nothing.
 */
import { makeRng } from "../core/rng.js";
import { enumerateKPair, makeKPairInstance, type KPairInstance } from "./law.js";

export type DensitySolver = "local-search" | "anneal";

/** The k-pair welfare of a tour — VALIDATED: a tour reusing or inventing an
 * agent is a counterfeit and is named, never scored. */
export function kPairTourViolation(inst: KPairInstance, tour: readonly number[]): string | null {
  if (tour.length !== inst.m) return `tour length ${tour.length} ≠ m ${inst.m}`;
  const seen = new Set<number>();
  for (let t = 0; t < inst.m; t++) {
    const a = tour[t]!;
    if (!Number.isInteger(a) || a < 0 || a >= inst.n) return `task ${t} → agent ${a}: out of range`;
    if (seen.has(a)) return `agent ${a} reused (tasks ${[...tour].indexOf(a)}, ${t})`;
    seen.add(a);
  }
  return null;
}

/** Score an SA/LS log's tour by re-deriving the welfare — never trust a
 * claimed number. Throws with the NAMED violation on a counterfeit tour. */
export function kPairWelfareOf(inst: KPairInstance, tour: readonly number[]): number {
  const violation = kPairTourViolation(inst, tour);
  if (violation !== null) throw new Error(`counterfeit tour rejected: ${violation}`);
  const used = new Set<number>();
  let w0 = 0;
  for (let t = 0; t < inst.m; t++) {
    const a = tour[t]!;
    w0 += inst.weights[t]![a]!;
    used.add(a);
  }
  let pairs = 0;
  for (let i = 0; i < inst.k; i++) {
    if (used.has(2 * i) && used.has(2 * i + 1)) pairs++;
  }
  return w0 + pairs * inst.lambda;
}

/** An SA log: a tour plus the welfare it CLAIMS. Re-scored on arrival. */
export interface SaLog {
  readonly tour: readonly number[];
  readonly claimedWelfare: number;
}

export function checkSaLog(inst: KPairInstance, log: SaLog): string | null {
  const violation = kPairTourViolation(inst, log.tour);
  if (violation !== null) return `counterfeit tour: ${violation}`;
  const trueW = kPairWelfareOf(inst, log.tour);
  if (Math.abs(trueW - log.claimedWelfare) > 1e-9) {
    return `welfare inflation: claimed ${log.claimedWelfare.toFixed(4)}, re-scored ${trueW.toFixed(4)}`;
  }
  return null;
}

/** Greedy on the k-pair family: coupling-blind, weights only (the v0.1 twin). */
export function kPairGreedy(inst: KPairInstance): number[] {
  const used = new Set<number>();
  const out = new Array<number>(inst.m).fill(-1);
  for (let t = 0; t < inst.m; t++) {
    let best = -1;
    let bestW = -Infinity;
    for (let a = 0; a < inst.n; a++) {
      if (used.has(a)) continue;
      if (inst.weights[t]![a]! > bestW) {
        bestW = inst.weights[t]![a]!;
        best = a;
      }
    }
    out[t] = best;
    used.add(best);
  }
  return out;
}

/** 1-exchange local search on the FULL k-pair welfare, from a given start. */
export function kPairLocalSearch(inst: KPairInstance, start: readonly number[]): number[] {
  const current = start.slice();
  for (;;) {
    let bestGain = 0;
    let bestT = -1;
    let bestA = -1;
    const curW = kPairWelfareOf(inst, current);
    for (let t = 0; t < inst.m; t++) {
      for (let a = 0; a < inst.n; a++) {
        if (a === current[t] || current.includes(a)) continue;
        const cand = current.slice();
        cand[t] = a;
        const gain = kPairWelfareOf(inst, cand) - curW;
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          bestT = t;
          bestA = a;
        }
      }
    }
    if (bestT < 0) return current;
    current[bestT] = bestA;
  }
}

/** SA on the k-pair family (greedy start, reassignment neighbors, best-ever). */
export function kPairAnneal(inst: KPairInstance, seed: number, iterations = 4000): number[] {
  const m = inst.m;
  const n = inst.n;
  const rng = makeRng(seed);
  const current = kPairGreedy(inst);
  const used = new Set<number>(current);
  let best = current.slice();
  let bestW = kPairWelfareOf(inst, best);
  let curW = bestW;
  const T0 = 0.3;
  const cooling = Math.pow(0.001 / T0, 1 / Math.max(1, iterations));
  for (let it = 0; it < iterations; it++) {
    const T = T0 * Math.pow(cooling, it);
    const t = Math.floor(rng() * m);
    const from = current[t]!;
    const to = Math.floor(rng() * n);
    if (used.has(to)) continue;
    current[t] = to;
    used.delete(from);
    used.add(to);
    const w = kPairWelfareOf(inst, current);
    const dW = w - curW;
    if (dW >= 0 || rng() < Math.exp(dW / Math.max(T, 1e-12))) {
      curW = w;
      if (w > bestW) {
        bestW = w;
        best = current.slice();
      }
    } else {
      current[t] = from;
      used.delete(to);
      used.add(from);
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The DENSITY CAMPAIGN (PL18): hit-rate curves of LS and SA over the
// (λ, k) grid at fixed size — the two-face law's coupling face under density,
// and the hunt for the re-entrant tail (PL12 found none by λ=4 at k=1).
// ---------------------------------------------------------------------------

export const DENSITY_LAMBDA_GRID: readonly number[] = Array.from({ length: 81 }, (_, i) => i * 0.1);

export interface DensityCell {
  readonly m: number;
  readonly n: number;
  readonly k: number;
  readonly solver: DensitySolver;
  readonly seeds: number;
  readonly hitRates: readonly number[]; // parallel to the λ grid
  readonly downCross: number; // first λ with hit < 0.5 (interpolated), -1 = never
  readonly minRate: number;
  readonly minLambda: number;
  readonly upCross: number; // first λ AFTER the minimum with hit ≥ 0.5 again, -1 = never
  readonly rateAtZero: number;
  readonly rateAtMax: number;
}

function solveDensity(solver: DensitySolver, inst: KPairInstance): number {
  if (solver === "local-search") return kPairWelfareOf(inst, kPairLocalSearch(inst, kPairGreedy(inst)));
  return kPairWelfareOf(inst, kPairAnneal(inst, 42));
}

export function densityCampaign(
  sizes: ReadonlyArray<readonly [number, number]> = [
    [5, 7],
    [6, 8],
  ],
  ks: readonly number[] = [1, 2, 3],
  seeds = 20,
  lambdas: readonly number[] = DENSITY_LAMBDA_GRID,
  solvers: readonly DensitySolver[] = ["anneal", "local-search"],
): DensityCell[] {
  if (lambdas.length === 0) throw new Error("densityCampaign: empty λ grid");
  const cells: DensityCell[] = [];
  for (const [m, n] of sizes) {
    for (const k of ks) {
      if (2 * k > n) throw new Error(`densityCampaign: k=${k} needs n ≥ 2k (n=${n}) — wrong object`);
      for (const solver of solvers) {
        // one enumeration per (size, k, seed), shared across the whole λ grid
        const optW = new Array<number[]>(seeds);
        for (let s = 1; s <= seeds; s++) {
          const leaves = enumerateKPair(makeKPairInstance(m, n, 500 * s, 0, k));
          optW[s - 1] = lambdas.map((lambda) => {
            let best = -Infinity;
            for (const leaf of leaves) {
              const w = leaf.w0 + leaf.pairs * lambda;
              if (w > best) best = w;
            }
            return best;
          });
        }
        const hitRates = lambdas.map((lambda, li) => {
          let hits = 0;
          for (let s = 1; s <= seeds; s++) {
            const inst = makeKPairInstance(m, n, 500 * s, lambda, k);
            if (Math.abs(solveDensity(solver, inst) - optW[s - 1]![li]!) < 1e-9) hits++;
          }
          return hits / seeds;
        });
        let down = -1;
        for (let i = 0; i < lambdas.length; i++) {
          if (hitRates[i]! < 0.5) {
            const prev = i > 0 ? hitRates[i - 1]! : 1;
            const prevLambda = i > 0 ? lambdas[i - 1]! : 0;
            down = prev >= 0.5 ? (prevLambda + lambdas[i]!) / 2 : lambdas[i]!;
            break;
          }
        }
        let minIdx = 0;
        for (let i = 1; i < hitRates.length; i++) if (hitRates[i]! < hitRates[minIdx]!) minIdx = i;
        let up = -1;
        for (let i = minIdx + 1; i < lambdas.length; i++) {
          if (hitRates[i]! >= 0.5) {
            up = (lambdas[i - 1]! + lambdas[i]!) / 2;
            break;
          }
        }
        cells.push({
          m,
          n,
          k,
          solver,
          seeds,
          hitRates,
          downCross: down,
          minRate: hitRates[minIdx]!,
          minLambda: lambdas[minIdx]!,
          upCross: up,
          rateAtZero: hitRates[0]!,
          rateAtMax: hitRates[hitRates.length - 1]!,
        });
      }
    }
  }
  return cells;
}

/**
 * The density-table AUDIT: re-derive every summary field from the raw hit
 * rates and name any cell whose summary does not match its own data (a
 * counterfeit census row — a claimed up-cross, a buried minimum, a crossing
 * that the rates never cross). Returns one named violation per crime.
 */
export function densityTableViolations(
  cells: readonly DensityCell[],
  lambdas: readonly number[] = DENSITY_LAMBDA_GRID,
): string[] {
  const out: string[] = [];
  for (const c of cells) {
    const name = `${c.m}×${c.n} k=${c.k} ${c.solver}`;
    if (c.hitRates.length !== lambdas.length) {
      out.push(`${name}: hit-rate table length ${c.hitRates.length} ≠ λ grid ${lambdas.length}`);
      continue;
    }
    for (const r of c.hitRates) {
      if (r < 0 || r > 1) out.push(`${name}: hit rate ${r} outside [0,1]`);
      if (Math.abs(r * c.seeds - Math.round(r * c.seeds)) > 1e-9) {
        out.push(`${name}: hit rate ${r} not quantized to 1/${c.seeds}`);
      }
    }
    if (Math.abs(c.rateAtZero - c.hitRates[0]!) > 1e-12) {
      out.push(`${name}: claimed rate@0 ${c.rateAtZero} but the table's first rate is ${c.hitRates[0]}`);
    }
    const last = c.hitRates[c.hitRates.length - 1]!;
    if (Math.abs(c.rateAtMax - last) > 1e-12) {
      out.push(`${name}: claimed rate@max ${c.rateAtMax} but the table's last rate is ${last}`);
    }
    let down = -1;
    for (let i = 0; i < lambdas.length; i++) {
      if (c.hitRates[i]! < 0.5) {
        const prev = i > 0 ? c.hitRates[i - 1]! : 1;
        const prevLambda = i > 0 ? lambdas[i - 1]! : 0;
        down = prev >= 0.5 ? (prevLambda + lambdas[i]!) / 2 : lambdas[i]!;
        break;
      }
    }
    if (down !== c.downCross) {
      out.push(`${name}: claimed down-cross ${c.downCross} but the rates give ${down}`);
    }
    let minIdx = 0;
    for (let i = 1; i < c.hitRates.length; i++) if (c.hitRates[i]! < c.hitRates[minIdx]!) minIdx = i;
    if (Math.abs(c.minRate - c.hitRates[minIdx]!) > 1e-12) {
      out.push(`${name}: claimed min ${c.minRate} but the table's minimum is ${c.hitRates[minIdx]}`);
    }
    if (Math.abs(c.minLambda - lambdas[minIdx]!) > 1e-12) {
      out.push(`${name}: claimed λ at min ${c.minLambda} but the table's minimum sits at λ=${lambdas[minIdx]}`);
    }
    let up = -1;
    for (let i = minIdx + 1; i < lambdas.length; i++) {
      if (c.hitRates[i]! >= 0.5) {
        up = (lambdas[i - 1]! + lambdas[i]!) / 2;
        break;
      }
    }
    if (up !== c.upCross) {
      out.push(
        `${name}: claimed up-cross ${c.upCross < 0 ? "none" : c.upCross} but the rates give ${up < 0 ? "none" : up}`,
      );
    }
  }
  return out;
}

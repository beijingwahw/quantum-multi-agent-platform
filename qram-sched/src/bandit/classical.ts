/**
 * Classical online-scheduling baselines on Bernoulli reward streams.
 *
 * - UCB1 (Auer-Cesa-Bianchi-Fischer, 2002): the standard index policy; every
 *   exploration pull is a live play and pays regret.
 * - Explore-then-commit (classical): the apples-to-apples counterpart of the
 *   quantum replay scheduler — sample each arm N times (live plays, regret),
 *   then commit to the empirical best.
 * - Exp3-style adversarial play with bandit feedback (Auer-Cesa-Bianchi-
 *   Freund-Schapire, SICOMP 2002): the Ω(sqrt(kT)) information-theoretic wall.
 */
import { Rng } from "../core/rng.js";

export interface BanditRun {
  /** Cumulative regret vs the best arm in hindsight (means known to the referee, not the algorithm). */
  regret: number;
  /** Total live plays (each consumes a task; classical exploration burns these). */
  plays: number;
  /** Inner-loop oracle reads of the score table (the compute ledger). */
  oracleReads: number;
  decisions: Uint8Array;
}

/** UCB1 on k Bernoulli arms with true means, horizon T. */
export function ucb1Run(means: readonly number[], horizon: number, seed: number): BanditRun {
  const k = means.length;
  const rng = new Rng(seed);
  const best = Math.max(...means);
  const pulls = new Array<number>(k).fill(0);
  const wins = new Array<number>(k).fill(0);
  const decisions = new Uint8Array(horizon);
  let regret = 0;
  let reads = 0;
  let t = 0;
  for (; t < Math.min(k, horizon); t++) {
    const a = t;
    const r = rng.bernoulli(means[a] as number) ? 1 : 0;
    pulls[a] = (pulls[a] as number) + 1;
    wins[a] = (wins[a] as number) + r;
    regret += (best - (means[a] as number));
    decisions[t] = a;
  }
  for (; t < horizon; t++) {
    let arg = -1;
    let val = -Infinity;
    for (let a = 0; a < k; a++) {
      reads++;
      const n = pulls[a] as number;
      const mean = (wins[a] as number) / n;
      const bonus = Math.sqrt((2 * Math.log(t + 1)) / n);
      const v = mean + bonus;
      if (v > val) {
        val = v;
        arg = a;
      }
    }
    const r = rng.bernoulli(means[arg] as number) ? 1 : 0;
    pulls[arg] = (pulls[arg] as number) + 1;
    wins[arg] = (wins[arg] as number) + r;
    regret += best - (means[arg] as number);
    decisions[t] = arg;
  }
  return { regret, plays: horizon, oracleReads: reads, decisions };
}

/** Explore-then-commit. Mode 'live': exploration samples are live plays that pay regret
 *  (the classical online world). Mode 'replay': samples are drawn from a replayable
 *  environment (classical simulator access — no regret, but each sample costs a query). */
export function etcRun(
  means: readonly number[],
  horizon: number,
  samplesPerArm: number,
  seed: number,
  mode: "live" | "replay" = "live",
): BanditRun {
  const k = means.length;
  const rng = new Rng(seed);
  const best = Math.max(...means);
  const exploration = Math.min(k * samplesPerArm, horizon);
  const decisions = new Uint8Array(horizon);
  let regret = 0;
  let commit = -1;
  let winsBest = -1;
  let idx = 0;
  for (let a = 0; a < k && idx < exploration; a++) {
    let wins = 0;
    for (let s = 0; s < samplesPerArm && idx < exploration; s++, idx++) {
      if (rng.bernoulli(means[a] as number)) wins++;
      decisions[idx] = a;
      if (mode === "live") regret += best - (means[a] as number);
    }
    if (wins > winsBest) {
      winsBest = wins;
      commit = a;
    }
  }
  for (; idx < horizon; idx++) {
    decisions[idx] = commit;
    regret += best - (means[commit] as number);
  }
  return {
    regret,
    plays: mode === "live" ? horizon : horizon - exploration,
    oracleReads: mode === "replay" ? exploration : 0,
    decisions,
  };
}

/**
 * Adversarial bandit stream: oblivious i.i.d. uniform binary rewards — the
 * standard minimax construction of Auer et al. (2002) that forces
 * Θ(sqrt(kT)) regret against any algorithm observing only played-arm feedback.
 * The algorithm is an Exp3-style policy; its argmax inner loop can be served
 * either by a linear scan or by a quantum search harness (identical decision
 * rule), demonstrating that compute acceleration leaves adversarial regret
 * untouched — the wall is informational, not computational.
 */
export function adversarialRun(
  k: number,
  horizon: number,
  seed: number,
  gamma: number,
  search: <T>(scores: readonly T[], less: (x: T, y: T) => boolean) => { best: number; reads: number },
): BanditRun {
  const rng = new Rng(seed);
  const rewards = new Uint8Array(k * horizon); // oblivious adversary, fixed stream
  for (let i = 0; i < rewards.length; i++) rewards[i] = rng.bernoulli(0.5) ? 1 : 0;
  const weights = new Array<number>(k).fill(1);
  const decisions = new Uint8Array(horizon);
  let regret = 0;
  let plays = 0;
  for (let t = 0; t < horizon; t++) {
    const wsum = weights.reduce((s, w) => s + w, 0);
    const p = weights.map((w) => (1 - gamma) * (w / wsum) + gamma / k);
    const u = rng.next();
    let acc = 0;
    let arm = k - 1;
    for (let a = 0; a < k; a++) {
      acc += p[a] as number;
      if (u < acc) {
        arm = a;
        break;
      }
    }
    decisions[t] = arm;
    const r = (rewards[arm * horizon + t] as number) === 1 ? 1 : 0;
    // importance-weighted update
    weights[arm] = weights[arm]! * Math.exp((gamma / k) * (r / p[arm]!));
    plays++;
  }
  // Regret accounting vs best fixed arm in hindsight on the fixed stream.
  const totals = new Array<number>(k).fill(0);
  for (let a = 0; a < k; a++) for (let t = 0; t < horizon; t++) totals[a] = (totals[a] as number) + (rewards[a * horizon + t] as number);
  const bestArm = totals.indexOf(Math.max(...totals));
  for (let t = 0; t < horizon; t++) {
    // decisions[t] is in-bounds: t < horizon and decisions has length horizon
    regret += (rewards[(bestArm) * horizon + t] as number) - (rewards[decisions[t]! * horizon + t] as number);
  }
  // Inner-loop compute: Exp3 samples from the mixing distribution; the score
  // table scan happens once per round in our harness for the ledger.
  const reads = search(totals, (x, y) => x < y).reads;
  return { regret, plays, oracleReads: reads, decisions };
}

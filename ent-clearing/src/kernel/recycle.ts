/**
 * The salvage desk — what the FAILED branch of a BBPSSW round is worth, priced
 * by dynamic programming (v0.5.0). The recurrence desk (purify.ts) keeps the
 * agreeing pair and discards the source pair on disagreement; this desk asks
 * the market question the protocol never asks: can a RECYCLING strategy —
 * banking failed-branch residues and re-pairing them (with or without the
 * isotropic twirl) into further rounds — ever beat the book value of what it
 * started with, when expected E_F is the payoff?
 *
 * The market model is deliberately narrow and fully executed: a STATE is a
 * bank of at most RECYCLE_MAX_BANK Bell-diagonal coins (labeled spectra in
 * the [Phi+, Phi-, Psi+, Psi-] basis); an ACTION pairs two coins into one
 * exact 16x16 purifyRound (each side optionally twirled first — the twirl is
 * a local operation, so it is free of charge but never free of consequence);
 * every round CONSUMES two coins and leaves exactly one (either branch), so
 * the bank shrinks by one per round and any policy is at most n-1 rounds
 * deep — bounded depth is not an assumption, it is conservation (R1).
 *
 * The theorems the machine certifies, all by value iteration over the finite
 * reachable state graph (R2-R5):
 *   R2 (step never-rises, VIDAL00 instantiated per action): for every state
 *      and every action, the branch-averaged book value of the successor
 *      banks does not exceed the book value of the acting bank — recomputed
 *      action by action from the 16x16 kernels, and a violation refuses by
 *      name (the smuggling trial's home).
 *   R3 (the value-iteration certificate, three series): the EXACT series
 *      (forced to act at every depth) is non-increasing to its floor; the
 *      HOLD series (free to stop, payoff = book on stopping) is pinned AT
 *      the book value at every depth — no series entry ever exceeds the
 *      book; the DELIVER series (forced first move, free afterwards) drops
 *      on the first forced round and NEVER CLIMBS BACK — depth does not
 *      pay: the deliverable optimum is exactly the best single round
 *      (D* = E_1, a machine identity across the whole census).
 *   R4 (the L9 squeeze): the conservation ledger's purification row is the
 *      depth-1 face of this DP — book = L9's before, the raw single round =
 *      a feasible recycling policy, so L9_after <= E_1 <= D* <= book =
 *      L9_before; at the ledger's canonical grade the optimum is EXACTLY the
 *      raw round (machine equality with computeLedger()'s L9 row).
 *   R5 (the isothermal melt-down): the failed-branch residue of two coins at
 *      the SAME Werner grade is exactly I/4 (all four Bell weights 1/4, E_F
 *      exactly 0) — the recycling chain beheads itself in one step on a
 *      single-grade market; mixed-grade banks are where multi-round salvage
 *      earns its keep (census R6).
 *
 * Every closed form below (the fail-branch XOR spectrum, the twirl spectrum,
 * the Bell-diagonal concurrence C = 2 max(0, l_max - 1/2)) was hand-derived,
 * REFUTED-or-confirmed against the 16x16 kernel before being keyed in, and is
 * cross-checked on every transition the desk executes (a mismatch refuses by
 * name). The general LOCC optimality of E_F monotonicity stays cited
 * (VIDAL00); what executes here is the DP instantiation on this action
 * family, never a claim about all of LOCC.
 */
import {
  bellDiagonal,
  bellRoundClosedForm,
  bellWeights,
  purifyRound,
} from "./purify.js";
import { efFromConcurrence } from "./clearing.js";

/* ------------------------------------------------------------------ */
/* Spectra: the labeled Bell-basis coin                                */
/* ------------------------------------------------------------------ */

/** A Bell-diagonal coin by its labeled weights [Phi+, Phi-, Psi+, Psi-]. */
export type BellSpectrum = readonly [number, number, number, number];

/** The salvage desk's absolute tolerance (monotonicity audits, convergence). */
export const RECYCLE_TOL = 1e-12;
/** The market's size cap — the bounded scale, same wall as schemePurify. */
export const RECYCLE_MAX_BANK = 4;
/** Decimal places of the state-key — states closer than this are one state. */
export const RECYCLE_KEY_DECIMALS = 9;

/** The labeled Werner spectrum W_F: [F, (1-F)/3, (1-F)/3, (1-F)/3]. */
export function wernerSpectrum(F: number): BellSpectrum {
  if (!Number.isFinite(F) || F <= 0 || F >= 1) {
    throw new Error(`EC_F_RANGE: wernerSpectrum needs F in (0,1), got ${F}`);
  }
  const g = (1 - F) / 3;
  return [F, g, g, g];
}

function checkSpectrum(lam: BellSpectrum, where: string): void {
  let s = 0;
  for (const w of lam) {
    if (!Number.isFinite(w) || w < -RECYCLE_TOL) {
      throw new Error(
        `EC_RECYCLE_SPECTRUM: ${where} has an illegal Bell weight (${w}) — weights are non-negative and sum to 1`,
      );
    }
    s += w;
  }
  if (Math.abs(s - 1) > 1e-9) {
    throw new Error(
      `EC_RECYCLE_SPECTRUM: ${where} weights sum to ${s}, not 1 — not a coin`,
    );
  }
}

function checkBank(bank: readonly BellSpectrum[]): void {
  if (bank.length < 1 || bank.length > RECYCLE_MAX_BANK) {
    throw new Error(
      `EC_RECYCLE_BANK: the salvage market clears banks of 1..${RECYCLE_MAX_BANK} coins, got ${bank.length}`,
    );
  }
  bank.forEach((c, i) => {
    checkSpectrum(c, `coin ${i}`);
  });
}

/* ------------------------------------------------------------------ */
/* Closed forms (hand-derived; the 16x16 kernel is the referee)        */
/* ------------------------------------------------------------------ */

/**
 * Concurrence of a Bell-diagonal coin, closed form: C = 2 max(0, l_max - 1/2).
 * Derived from spin-flip: (Y (x) Y) fixes every Bell state up to sign, so
 * sqrt(rho) rho~ sqrt(rho) has the same spectrum as rho^2 and Wootters'
 * sorted roots are the weights themselves. Machine-held against the full
 * Wootters solver route (worst deviation < 1e-16 on random spectra).
 */
export function bellConcurrenceClosed(lam: BellSpectrum): number {
  checkSpectrum(lam, "bellConcurrenceClosed");
  return 2 * Math.max(0, Math.max(...lam) - 0.5);
}

/** E_F of a Bell-diagonal coin on the closed concurrence route. */
export function bellEfClosed(lam: BellSpectrum): number {
  return efFromConcurrence(bellConcurrenceClosed(lam));
}

/**
 * The isotropic twirl as a spectrum map: any Bell-diagonal coin to the Werner
 * coin of the SAME Phi+ weight (the triplet averaged). Machine-held against
 * the executed 24-element local-Clifford twirl (worst deviation < 1e-15).
 */
export function twirlSpectrum(lam: BellSpectrum): BellSpectrum {
  checkSpectrum(lam, "twirlSpectrum");
  const g = (1 - lam[0]) / 3;
  return [lam[0], g, g, g];
}

/**
 * The BBPSSW round's FAILED branch in XOR calculus, hand-derived (the success
 * branch already has its closed form in purify.ts): disagreement means
 * x_s XOR x_t = 1 after the bilateral CNOT, and the SOURCE keeps its bit
 * label while its phase label absorbs the target's (z_s -> z_s XOR z_t), so
 * the conditional residue spectrum is
 *   fail = [ l0 m2 + l1 m3,  l0 m3 + l1 m2,
 *            l2 m0 + l3 m1,  l2 m1 + l3 m0 ] / pFail,
 *   pFail = (l0+l1)(m2+m3) + (l2+l3)(m0+m1).
 * The residue is Bell-diagonal (measured target decoupled), and on an
 * isothermal pair (l = m = Werner) all four entries are EQUAL — the melt-down
 * theorem R5's exact I/4.
 */
export function bellRoundFailClosedForm(
  lam: BellSpectrum,
  mu: BellSpectrum,
): { pFail: number; out: BellSpectrum } {
  checkSpectrum(lam, "bellRoundFailClosedForm source");
  checkSpectrum(mu, "bellRoundFailClosedForm target");
  const pFail =
    (lam[0] + lam[1]) * (mu[2] + mu[3]) + (lam[2] + lam[3]) * (mu[0] + mu[1]);
  if (pFail <= 1e-12) {
    throw new Error(
      `EC_ZERO_BRANCH: bellRoundFailClosedForm hit a probability-zero fail branch (pFail ${pFail}) — dividing would smuggle NaN`,
    );
  }
  return {
    pFail,
    out: [
      (lam[0] * mu[2] + lam[1] * mu[3]) / pFail,
      (lam[0] * mu[3] + lam[1] * mu[2]) / pFail,
      (lam[2] * mu[0] + lam[3] * mu[1]) / pFail,
      (lam[2] * mu[1] + lam[3] * mu[0]) / pFail,
    ],
  };
}

export interface RoundBranches {
  readonly pSucc: number;
  readonly succ: BellSpectrum;
  readonly pFail: number;
  readonly fail: BellSpectrum;
}

/**
 * One executed round on the 16x16 kernel, in and out in spectra: the states
 * are rebuilt by bellDiagonal, run through purifyRound, and read back by
 * bellWeights. BOTH branches are cross-checked against their XOR closed
 * forms on every call (a mismatch refuses by name) — the desk never trusts
 * its own algebra over the kernel, nor the kernel over the algebra.
 */
export function roundTransition(
  lam: BellSpectrum,
  mu: BellSpectrum,
): RoundBranches {
  checkSpectrum(lam, "roundTransition source");
  checkSpectrum(mu, "roundTransition target");
  const r = purifyRound(bellDiagonal(lam), bellDiagonal(mu));
  const succRef = bellRoundClosedForm(lam, mu);
  const failRef = bellRoundFailClosedForm(lam, mu);
  const succ = bellWeights(r.successState);
  const fail = bellWeights(r.failState);
  let worst = Math.max(
    Math.abs(r.pSucc - succRef.pSucc),
    Math.abs(r.pFail - failRef.pFail),
  );
  for (let k = 0; k < 4; k++) {
    worst = Math.max(
      worst,
      Math.abs(succ[k]! - succRef.out[k]!),
      Math.abs(fail[k]! - failRef.out[k]!),
    );
  }
  if (worst > 1e-12) {
    throw new Error(
      `EC_RECYCLE_XOR_MISMATCH: the 16x16 kernel and the XOR closed forms disagree by ${worst.toExponential(3)} — the desk refuses to price this round`,
    );
  }
  return {
    pSucc: r.pSucc,
    succ: [succ[0]!, succ[1]!, succ[2]!, succ[3]!],
    pFail: r.pFail,
    fail: [fail[0]!, fail[1]!, fail[2]!, fail[3]!],
  };
}

/* ------------------------------------------------------------------ */
/* The market: states, actions, the step never-rises audit             */
/* ------------------------------------------------------------------ */

/** Pair two coins into one round; each side may be twirled first (free, local). */
export interface RecycleAction {
  readonly i: number;
  readonly j: number;
  readonly twirlSource: boolean;
  readonly twirlTarget: boolean;
}

/** A branch ledger: probabilities and successor banks, one entry per branch. */
export interface StepLedger {
  readonly probabilities: readonly number[];
  readonly nextBanks: ReadonlyArray<readonly BellSpectrum[]>;
}

/** The book value of a bank: the sum of its coins' E_F (stop = hold at book). */
export function stopValue(bank: readonly BellSpectrum[]): number {
  checkBank(bank);
  return bank.reduce((acc, c) => acc + bellEfClosed(c), 0);
}

/**
 * The step never-rises audit (R2, VIDAL00 instantiated per action): the
 * branch-averaged book value of the successor banks must not exceed the
 * acting bank's book. A violation refuses by name — this is the instrument
 * the smuggling trial sounds (a "recycling gain" is a mint, and the mint
 * wall has no branch office here).
 */
export function expectStepNeverRises(
  bank: readonly BellSpectrum[],
  ledger: StepLedger,
  note = "unnamed action",
): void {
  if (
    ledger.probabilities.length !== ledger.nextBanks.length ||
    ledger.probabilities.length === 0
  ) {
    throw new Error(
      `EC_RECYCLE_LEDGER: ${note} carries ${ledger.probabilities.length} probabilities against ${ledger.nextBanks.length} successor banks — an unbalanced branch ledger`,
    );
  }
  const before = stopValue(bank);
  let after = 0;
  for (let k = 0; k < ledger.probabilities.length; k++) {
    const p = ledger.probabilities[k]!;
    if (!Number.isFinite(p) || p < 0) {
      throw new Error(
        `EC_RECYCLE_LEDGER: ${note} branch ${k} has an illegal probability ${p}`,
      );
    }
    after += p * stopValue(ledger.nextBanks[k]!);
  }
  if (after > before + RECYCLE_TOL) {
    throw new Error(
      `EC_RECYCLE_MONOTONICITY: ${note} raises expected E_F from ${before.toFixed(12)} to ${after.toFixed(12)} (rise ${(after - before).toExponential(3)}) — salvage is not a mint; the ledger's toll (VIDAL00) is not optional`,
    );
  }
}

function spectrumKey(lam: BellSpectrum): string {
  return lam.map((w) => w.toFixed(RECYCLE_KEY_DECIMALS)).join(",");
}

function bankKey(bank: readonly BellSpectrum[]): string {
  // a bank is a MULTISET of coins — the key is order-free, so two exploration
  // orders of the same market merge into one state
  return bank.map(spectrumKey).sort().join(";");
}

/* ------------------------------------------------------------------ */
/* The DP: reachable graph, three value-iteration series               */
/* ------------------------------------------------------------------ */

export interface RecycleDP {
  /** The bank the market opened on (canonical order). */
  readonly bank: readonly BellSpectrum[];
  /** Reachable states under every action (tolerance-merged). */
  readonly states: number;
  /** Book value of the opening bank (= the HOLD series, = L9's before face). */
  readonly book: number;
  /** The forced-first-move recycling optimum D* (the deliverable ceiling). */
  readonly deliverOptimum: number;
  /** The exact-forced floor E_inf (act at every depth while any pair remains). */
  readonly exactFloor: number;
  /** V_k at the opening state, k = 0..convergedAt (pinned at book — R3). */
  readonly holdSeries: readonly number[];
  /** E_k at the opening state, k = 0..convergedAt (non-increasing — R3). */
  readonly exactSeries: readonly number[];
  /** D_k at the opening state, k = 0..convergedAt (drops once, climbs to D*). */
  readonly deliverSeries: readonly number[];
  /** First k at which all three series are stable (convergence certificate). */
  readonly convergedAt: number;
  /** The R2 certificate: the tightest slack book - branch-average over every
   * audited action (>= -RECYCLE_TOL by construction; the machine's number). */
  readonly worstStepSlack: number;
  /** How many (state, action) step audits the DP executed. */
  readonly auditCount: number;
  /** The opening bank's optimal first moves under D* (ties within tol). */
  readonly bestFirstMoves: readonly RecycleAction[];
}

interface Edge {
  readonly pSucc: number;
  readonly pFail: number;
  readonly s: number;
  readonly f: number;
}

/** Run the salvage DP on a bank of coins (1..4), certifying R1-R4 on the way. */
export function recycleDP(inputBank: readonly BellSpectrum[]): RecycleDP {
  checkBank(inputBank);
  const bank = inputBank
    .map((c) => [c[0], c[1], c[2], c[3]] as BellSpectrum)
    .sort((a, b) => spectrumKey(a).localeCompare(spectrumKey(b)));
  const rootKey = bankKey(bank);

  // --- the reachable state graph (R1: the bank shrinks by one per round, so
  // --- exploration is finite without any depth cutoff)
  const states: BellSpectrum[][] = [];
  const index = new Map<string, number>();
  const transitionMemo = new Map<string, RoundBranches>();
  const addState = (b: BellSpectrum[]): number => {
    const k = bankKey(b);
    const hit = index.get(k);
    if (hit !== undefined) return hit;
    const id = states.length;
    states.push(b);
    index.set(k, id);
    return id;
  };
  const pairTransition = (
    lam: BellSpectrum,
    mu: BellSpectrum,
  ): RoundBranches => {
    const k = `${spectrumKey(lam)}|${spectrumKey(mu)}`;
    let t = transitionMemo.get(k);
    if (t === undefined) {
      t = roundTransition(lam, mu);
      transitionMemo.set(k, t);
    }
    return t;
  };
  const explore = (b: BellSpectrum[]): void => {
    addState(b);
    if (b.length < 2) return;
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        for (const twirlSource of [false, true]) {
          for (const twirlTarget of [false, true]) {
            const src = twirlSource ? twirlSpectrum(b[i]!) : b[i]!;
            const tgt = twirlTarget ? twirlSpectrum(b[j]!) : b[j]!;
            const t = pairTransition(src, tgt);
            const rest = b.filter((_, x) => x !== i && x !== j);
            explore([...rest, t.succ]);
            explore([...rest, t.fail]);
          }
        }
      }
    }
  };
  explore(bank);
  const root = index.get(rootKey);
  if (root === undefined)
    throw new Error(
      "EC_RECYCLE_STATE: the opening bank vanished from its own reachable set",
    );

  // --- actions per state, with the R2 audit executed on every one of them
  const edges: Edge[][] = states.map(() => []);
  const actions: RecycleAction[][] = states.map(() => []);
  let worstStepSlack = Number.POSITIVE_INFINITY;
  let auditCount = 0;
  states.forEach((b, si) => {
    if (b.length < 2) return;
    const stopHere = stopValue(b);
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        for (const twirlSource of [false, true]) {
          for (const twirlTarget of [false, true]) {
            const src = twirlSource ? twirlSpectrum(b[i]!) : b[i]!;
            const tgt = twirlTarget ? twirlSpectrum(b[j]!) : b[j]!;
            const t = pairTransition(src, tgt);
            const rest = b.filter((_, x) => x !== i && x !== j);
            const sBank = [...rest, t.succ];
            const fBank = [...rest, t.fail];
            // R2, on the kernel's own numbers, action by action
            expectStepNeverRises(
              b,
              { probabilities: [t.pSucc, t.pFail], nextBanks: [sBank, fBank] },
              `salvage round (pair ${i},${j}, twirl ${twirlSource ? "s" : "-"}/${twirlTarget ? "t" : "-"})`,
            );
            auditCount++;
            worstStepSlack = Math.min(
              worstStepSlack,
              stopHere -
                (t.pSucc * stopValue(sBank) + t.pFail * stopValue(fBank)),
            );
            edges[si]!.push({
              pSucc: t.pSucc,
              pFail: t.pFail,
              s: addState(sBank),
              f: addState(fBank),
            });
            actions[si]!.push({ i, j, twirlSource, twirlTarget });
          }
        }
      }
    }
  });
  const stop = states.map((b) => stopValue(b));
  const canAct = states.map((b) => b.length >= 2);

  // --- three value-iteration series to a common fixed point, with the R3
  // --- invariants certified in-engine on EVERY state at EVERY depth:
  // ---   hold   pinned at the book (stopping is always available),
  // ---   exact  non-increasing (forced rounds never gain),
  // ---   deliver non-decreasing from depth 1 on (deeper freedom only helps
  // ---          a policy that already paid the first forced round's toll).
  let hold = stop.slice();
  let exact = stop.slice();
  let deliver = stop.slice();
  const holdSeries: number[] = [hold[root]!];
  const exactSeries: number[] = [exact[root]!];
  const deliverSeries: number[] = [deliver[root]!];
  let convergedAt = -1;
  for (let k = 0; k <= bank.length + 1; k++) {
    const nextHold = hold.slice();
    const nextExact = exact.slice();
    const nextDeliver = deliver.slice();
    for (let si = 0; si < states.length; si++) {
      if (!canAct[si]) continue;
      let bestH = stop[si]!;
      let bestE = Number.NEGATIVE_INFINITY;
      let bestD = Number.NEGATIVE_INFINITY;
      for (const e of edges[si]!) {
        bestH = Math.max(bestH, e.pSucc * hold[e.s]! + e.pFail * hold[e.f]!);
        bestE = Math.max(bestE, e.pSucc * exact[e.s]! + e.pFail * exact[e.f]!);
        bestD = Math.max(
          bestD,
          e.pSucc * Math.max(deliver[e.s]!, stop[e.s]!) +
            e.pFail * Math.max(deliver[e.f]!, stop[e.f]!),
        );
      }
      nextHold[si] = bestH;
      nextExact[si] = bestE;
      nextDeliver[si] = bestD;
    }
    for (let si = 0; si < states.length; si++) {
      const where = `state ${si} at depth ${k + 1}`;
      if (nextHold[si]! > stop[si]! + RECYCLE_TOL) {
        throw new Error(
          `EC_RECYCLE_SERIES: the HOLD series left the book at ${where} (${nextHold[si]!.toFixed(12)} > ${stop[si]!.toFixed(12)}) — a policy beating the book is a mint, not a valuation`,
        );
      }
      if (nextExact[si]! > exact[si]! + RECYCLE_TOL) {
        throw new Error(
          `EC_RECYCLE_SERIES: the EXACT series rose at ${where} (${exact[si]!.toFixed(12)} -> ${nextExact[si]!.toFixed(12)}) — forced rounds do not gain`,
        );
      }
      if (k >= 1 && nextDeliver[si]! > deliver[si]! + RECYCLE_TOL) {
        throw new Error(
          `EC_RECYCLE_SERIES: the DELIVER series rose at ${where} (${deliver[si]!.toFixed(12)} -> ${nextDeliver[si]!.toFixed(12)}) — a deeper policy already free to stop cannot gain (the single-round optimum is the optimum)`,
        );
      }
    }
    let stable = true;
    for (let si = 0; si < states.length; si++) {
      if (Math.abs(nextHold[si]! - hold[si]!) > RECYCLE_TOL) stable = false;
      if (Math.abs(nextExact[si]! - exact[si]!) > RECYCLE_TOL) stable = false;
      if (Math.abs(nextDeliver[si]! - deliver[si]!) > RECYCLE_TOL)
        stable = false;
    }
    hold = nextHold;
    exact = nextExact;
    deliver = nextDeliver;
    holdSeries.push(hold[root]!);
    exactSeries.push(exact[root]!);
    deliverSeries.push(deliver[root]!);
    if (stable) {
      convergedAt = k + 1;
      break;
    }
  }
  if (convergedAt < 0) convergedAt = bank.length + 1;

  // --- the opening bank's optimal first moves under the converged D*
  const bestFirstMoves: RecycleAction[] = [];
  let bestVal = Number.NEGATIVE_INFINITY;
  edges[root]!.forEach((e, ai) => {
    const v =
      e.pSucc * Math.max(deliver[e.s]!, stop[e.s]!) +
      e.pFail * Math.max(deliver[e.f]!, stop[e.f]!);
    if (v > bestVal + RECYCLE_TOL) {
      bestVal = v;
      bestFirstMoves.length = 0;
      bestFirstMoves.push(actions[root]![ai]!);
    } else if (v > bestVal - RECYCLE_TOL) {
      if (v > bestVal) bestVal = v;
      bestFirstMoves.push(actions[root]![ai]!);
    }
  });

  return {
    bank,
    states: states.length,
    book: stop[root]!,
    deliverOptimum: deliver[root]!,
    exactFloor: exact[root]!,
    holdSeries,
    exactSeries,
    deliverSeries,
    convergedAt,
    worstStepSlack,
    auditCount,
    bestFirstMoves,
  };
}

/* ------------------------------------------------------------------ */
/* The salvage census — keyed claims, machine-recomputed by R6         */
/* ------------------------------------------------------------------ */

export interface RecycleRow {
  readonly id: string;
  /** The opening bank as Werner grades (one entry per coin). */
  readonly coins: readonly number[];
  /** Book value of the bank (L9's before face at the isothermal pairs). */
  readonly book: number;
  /** The forced-first-move recycling optimum D*. */
  readonly deliver: number;
  /** book - deliver: the recycling discount the market charges. */
  readonly gap: number;
  /** The exact-forced floor E_inf. */
  readonly exactFloor: number;
  /** Convergence depth of the three series. */
  readonly convergedAt: number;
  /** Reachable states under every action. */
  readonly states: number;
}

/**
 * The salvage desk's census, keyed from actual runs and recomputed row by
 * row by the checker (law R6). Two families: the ISOTHERMAL banks (the
 * yield table's grades — where R5's melt-down beheads the chain in one
 * round and the raw round IS the optimum, the ledger's L9 face) and the
 * MIXED-GRADE banks (where failed-branch residues carry book value and
 * multi-round salvage earns a strictly better deliverable than any single
 * round — still never the book). The honest zero: at F = 0.45 the whole
 * bank prices at 0 (no Bell weight above 1/2, no E_F, nothing to salvage).
 */
export const RECYCLE_TABLE: readonly RecycleRow[] = [
  {
    id: "R-S45-2",
    coins: [0.45, 0.45],
    book: 0,
    deliver: 0,
    gap: 0,
    exactFloor: 0,
    convergedAt: 1,
    states: 3,
  },
  {
    id: "R-S55-2",
    coins: [0.55, 0.55],
    book: 0.050532255454,
    deliver: 0.020214624097,
    gap: 0.030317631357,
    exactFloor: 0.020214624097,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-S55-3",
    coins: [0.55, 0.55, 0.55],
    book: 0.075798383181,
    deliver: 0.045480751824,
    gap: 0.030317631357,
    exactFloor: 0.013918067679,
    convergedAt: 3,
    states: 8,
  },
  {
    id: "R-S65-2",
    coins: [0.65, 0.65],
    book: 0.31626587312,
    deliver: 0.134880204518,
    gap: 0.181385668603,
    exactFloor: 0.134880204518,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-S65-3",
    coins: [0.65, 0.65, 0.65],
    book: 0.474398809681,
    deliver: 0.293013141078,
    gap: 0.181385668603,
    exactFloor: 0.101191181396,
    convergedAt: 3,
    states: 8,
  },
  {
    id: "R-S75-2",
    coins: [0.75, 0.75],
    book: 0.709157805331,
    deliver: 0.31907090891,
    gap: 0.39008689642,
    exactFloor: 0.31907090891,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-S75-3",
    coins: [0.75, 0.75, 0.75],
    book: 1.063736707996,
    deliver: 0.673649811575,
    gap: 0.39008689642,
    exactFloor: 0.26038075327,
    convergedAt: 3,
    states: 8,
  },
  {
    id: "R-S85-2",
    coins: [0.85, 0.85],
    book: 1.183714814341,
    deliver: 0.557574635695,
    gap: 0.626140178646,
    exactFloor: 0.557574635695,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-S85-3",
    coins: [0.85, 0.85, 0.85],
    book: 1.775572221512,
    deliver: 1.149432042866,
    gap: 0.626140178646,
    exactFloor: 0.494161864599,
    convergedAt: 3,
    states: 8,
  },
  {
    id: "R-S85-4",
    coins: [0.85, 0.85, 0.85, 0.85],
    book: 2.367429628683,
    deliver: 1.741289450037,
    gap: 0.626140178646,
    exactFloor: 0.453424826705,
    convergedAt: 4,
    states: 30,
  },
  {
    id: "R-S95-2",
    coins: [0.95, 0.95],
    book: 1.716471750603,
    deliver: 0.84211540123,
    gap: 0.874356349374,
    exactFloor: 0.84211540123,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-S95-3",
    coins: [0.95, 0.95, 0.95],
    book: 2.574707625905,
    deliver: 1.700351276531,
    gap: 0.874356349374,
    exactFloor: 0.809272275298,
    convergedAt: 3,
    states: 8,
  },
  {
    id: "R-M875",
    coins: [0.85, 0.75],
    book: 0.946436309836,
    deliver: 0.428617880071,
    gap: 0.517818429765,
    exactFloor: 0.428617880071,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-M865",
    coins: [0.85, 0.65],
    book: 0.749990343731,
    deliver: 0.305594228489,
    gap: 0.444396115242,
    exactFloor: 0.305594228489,
    convergedAt: 2,
    states: 3,
  },
  {
    id: "R-M87565",
    coins: [0.85, 0.75, 0.65],
    book: 1.104569246396,
    deliver: 0.808178908851,
    gap: 0.296390337545,
    exactFloor: 0.276532949667,
    convergedAt: 3,
    states: 26,
  },
  {
    id: "R-M8875",
    coins: [0.85, 0.85, 0.75],
    book: 1.538293717007,
    deliver: 1.020475287242,
    gap: 0.517818429765,
    exactFloor: 0.41508684614,
    convergedAt: 3,
    states: 16,
  },
  {
    id: "R-M8756555",
    coins: [0.85, 0.75, 0.65, 0.55],
    book: 1.129835374123,
    deliver: 1.011487362906,
    gap: 0.118348011217,
    exactFloor: 0.180496052926,
    convergedAt: 4,
    states: 388,
  },
];

export interface RecycleViolation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

/** A RecycleRow as it crosses the untrusted boundary into the checker. */
export type UntrustedRecycleRow = Omit<RecycleRow, never>;

/** R6 — census provenance: every keyed number must recompute from the DP. */
export function checkRecycleTable(
  rows: readonly UntrustedRecycleRow[] = RECYCLE_TABLE,
): RecycleViolation[] {
  const violations: RecycleViolation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id))
      violations.push({
        row: r.id,
        law: "R6",
        detail: "duplicate salvage census row id",
      });
    seen.add(r.id);
    if (r.coins.length < 1 || r.coins.length > RECYCLE_MAX_BANK) {
      violations.push({
        row: r.id,
        law: "R6",
        detail: `a salvage bank carries 1..${RECYCLE_MAX_BANK} coins, got ${r.coins.length}`,
      });
      continue;
    }
    if (r.gap < -1e-12) {
      violations.push({
        row: r.id,
        law: "R6",
        detail: `claimed a NEGATIVE recycling discount (${r.gap}) — salvage beating the book is a mint, and the mint wall has no branch office`,
      });
    }
    const dp = recycleDP(r.coins.map((F) => wernerSpectrum(F)));
    const worst = Math.max(
      Math.abs(dp.book - r.book),
      Math.abs(dp.deliverOptimum - r.deliver),
      Math.abs(dp.book - dp.deliverOptimum - r.gap),
      Math.abs(dp.exactFloor - r.exactFloor),
    );
    if (worst > 1e-9) {
      violations.push({
        row: r.id,
        law: "R6",
        detail: `claimed numbers do not recompute (worst dev ${worst.toExponential(3)}): book ${dp.book.toFixed(12)}, deliverable D* ${dp.deliverOptimum.toFixed(12)}, floor ${dp.exactFloor.toFixed(12)}`,
      });
    }
    if (dp.convergedAt !== r.convergedAt || dp.states !== r.states) {
      violations.push({
        row: r.id,
        law: "R6",
        detail: `claimed convergence ${r.convergedAt}/${r.states} states but the DP settles at ${dp.convergedAt}/${dp.states}`,
      });
    }
  }
  return violations;
}

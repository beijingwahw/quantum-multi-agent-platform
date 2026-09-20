/**
 * The second-largest wall — the comparison model's second executed theorem
 * (the sibling of src/lower/comparison.ts, new-file by law).
 *
 * THEOREM (falsifiable, machine-checked at small n, cited at all n): in the
 * deterministic comparison model, finding the second largest of n distinct
 * keys needs exactly
 *     n + ceil(log2 n) - 2      comparisons (n >= 2).
 *
 * Three legs, cross-checked against each other exactly as the find-max /
 * sorting walls are:
 *
 *   LEG A (flat exhaustive sweep): every canonical depth-q tree audited on
 *     all n! inputs — zero correct trees at q = n + ceil(log2 n) - 3.
 *   LEG B (game-tree DFS on partial orders): "exists a correct tree of
 *     depth <= q" as a game — the terminal is UPGRADED from find-max's
 *     unique maximum to "maximum and second BOTH determined": the state
 *     decides the second iff it has a unique maximum m and exactly one
 *     element whose only proven superior is m (the direct losers of m are
 *     the only possible seconds; two incomparable ones leave the leaf
 *     ambiguous).
 *   LEG C (the adversary, at ANY n): the tournament argument as a machine
 *     invariant. Each element carries a team (initially itself); when the
 *     transcript does not already decide a pair, the LARGER TEAM wins and
 *     absorbs the loser's team. Invariants after every play: |T_x| <=
 *     2^{wins(x)} (a win at most doubles the winner's team); >= n - k
 *     elements remain undefeated; and once a unique champion stands its
 *     team is ALL n elements (every loss chain ends at the only undefeated
 *     element), so it has >= ceil(log2 n) DIRECT losers — each a possible
 *     second. With k = n + ceil(log2 n) - 3 comparisons at most
 *     ceil(log2 n) - 3 of them can be eliminated below someone else
 *     (every elimination below a non-champion consumes a comparison beyond
 *     the n - 1 first defeats), leaving >= 3 second-candidates — the
 *     second is undetermined, with two witness total orders (consistent
 *     with EVERY answer, same champion, different seconds) named by the
 *     machine.
 *
 * The counting gate, held as data: a correct second-tree sends the n(n-1)
 * ordered (max, second) outcomes to distinct leaves, so q >=
 * ceil(log2(n(n-1))) — for n = 5 that is 5 while the optimum is 6: the gap
 * the adversary leg closes (the same gap ceil(log2 n) leaves in find-max).
 *
 * Upper bound: secondTreeWitness(n) CONSTRUCTS a correct tree at the closed
 * form's depth (balanced-tournament play replayed through the DFS oracle),
 * audited by the same flat audit — the bound is tight, not just counted.
 */
import {
  allPerms,
  type OptimumResult,
  type SweepResult,
} from "./comparison.js";

/** ceil(log2 n) for n >= 1, exact in number range. */
export function ceilLog2(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 53) {
    throw new Error(`ceilLog2: n must be a positive integer (got ${n})`);
  }
  let q = 0;
  let p = 1;
  while (p < n) {
    p *= 2;
    q++;
  }
  return q;
}

/** The closed form this module executes: n + ceil(log2 n) - 2. */
export function secondClosedForm(n: number): number {
  if (!Number.isInteger(n) || n < 2 || n > 2 ** 20) {
    throw new Error(
      `secondClosedForm: n must be an integer in [2, 2^20] (got ${n})`,
    );
  }
  return n + ceilLog2(n) - 2;
}

/** The ordered (argmax, arg-second) of a rank assignment — distinct values make both unique. */
export function secondOf(p: readonly number[]): readonly [number, number] {
  if (p.length < 2)
    throw new Error(`secondOf: need at least 2 elements (got ${p.length})`);
  let m = 0;
  let s = -1;
  for (let i = 1; i < p.length; i++) {
    if (p[i]! > p[m]!) {
      s = m;
      m = i;
    } else if (s === -1 || p[i]! > p[s]!) {
      s = i;
    }
  }
  return [m, s];
}

// --- LEG A: the flat sweep ---------------------------------------------------------------------

export interface SecondTreeAudit {
  readonly n: number;
  readonly depth: number;
  readonly correct: boolean;
  /** the leaf whose perm set carries two different true (max, second) pairs (null when correct) */
  readonly inconsistentLeaf: number | null;
  /** a permutation reaching that leaf whose true pair contradicts the leaf's first perm */
  readonly wrongPerm: readonly number[] | null;
  readonly truePairOfWrong: readonly [number, number] | null;
  /** the pair the leaf's first perm had (the forgery's claim), null when correct */
  readonly leafClaimedPair: readonly [number, number] | null;
  readonly reachedLeaves: number;
}

/** Shared shape guard — the same contract as comparison.ts's flat trees (re-derived here). */
function checkAsk(
  n: number,
  ask: ReadonlyArray<readonly [number, number]>,
): number {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(
      `comparison tree: n must be an integer in [2,8] (got ${n})`,
    );
  }
  if (!Number.isInteger(Math.log2(ask.length + 1))) {
    throw new Error(
      `comparison tree: ask length ${ask.length} is not 2^depth - 1`,
    );
  }
  const depth = Math.round(Math.log2(ask.length + 1));
  for (const [i, j] of ask) {
    if (
      !Number.isInteger(i) ||
      !Number.isInteger(j) ||
      i < 0 ||
      j < 0 ||
      i >= n ||
      j >= n
    ) {
      throw new Error(`comparison tree: pair (${i},${j}) outside [0,${n})`);
    }
    if (i === j) {
      throw new Error(
        `comparison tree: pair (${i},${i}) compares an element with itself — no information exists`,
      );
    }
    if (i > j) {
      throw new Error(
        `comparison tree: pair (${i},${j}) is not canonically oriented (i < j)`,
      );
    }
  }
  return depth;
}

/**
 * Audit a flat second-largest tree: walk every permutation to its leaf; the
 * tree is correct iff every reached leaf sees a single true (max, second)
 * pair. The first inconsistent leaf is NAMED with the permutation that
 * kills it — the conviction the trials read out.
 */
export function auditSecondTree(
  n: number,
  ask: ReadonlyArray<readonly [number, number]>,
): SecondTreeAudit {
  const depth = checkAsk(n, ask);
  const nodes = 2 ** depth - 1;
  const leaves = 2 ** depth;
  const perms = allPerms(n);
  const leafPair: Array<readonly [number, number] | null> = new Array<
    readonly [number, number] | null
  >(leaves).fill(null);
  let reached = 0;
  for (const p of perms) {
    let v = 0;
    for (let d = 0; d < depth; d++) {
      const [i, j] = ask[v]!;
      v = p[i]! < p[j]! ? 2 * v + 1 : 2 * v + 2;
    }
    const leaf = v - nodes;
    const pair = secondOf(p);
    if (leafPair[leaf] === null) {
      leafPair[leaf] = pair;
      reached++;
    } else if (
      leafPair[leaf]![0] !== pair[0] ||
      leafPair[leaf]![1] !== pair[1]
    ) {
      return {
        n,
        depth,
        correct: false,
        inconsistentLeaf: leaf,
        wrongPerm: p,
        truePairOfWrong: pair,
        leafClaimedPair: leafPair[leaf]!,
        reachedLeaves: reached,
      };
    }
  }
  return {
    n,
    depth,
    correct: true,
    inconsistentLeaf: null,
    wrongPerm: null,
    truePairOfWrong: null,
    leafClaimedPair: null,
    reachedLeaves: reached,
  };
}

/** LEG A for second-largest: enumerate ALL depth-q trees (canonical orientation i < j). */
export function exhaustiveSecondSweep(n: number, q: number): SweepResult {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(
      `exhaustive sweep: n must be an integer in [2,8] (got ${n})`,
    );
  }
  if (!Number.isInteger(q) || q < 0 || q > 6) {
    throw new Error(
      `exhaustive sweep: q must be an integer in [0,6] (got ${q}) — the tree count is C(n,2)^(2^q-1)`,
    );
  }
  const pairs = allPairs(n);
  const ask = new Array<[number, number]>(2 ** q - 1).fill([0, 1]);
  let trees = 0;
  let correct = 0;
  let correctAllLeafSeparated = true;
  const rec = (v: number): void => {
    if (v === 2 ** q - 1) {
      trees++;
      const audit = auditSecondTree(n, ask);
      if (audit.correct) {
        correct++;
        // a correct tree separates the n(n-1) ordered outcomes (the weak counting bound, data)
        if (audit.reachedLeaves < n * (n - 1)) correctAllLeafSeparated = false;
      }
      return;
    }
    for (const pr of pairs) {
      ask[v] = pr;
      rec(v + 1);
    }
  };
  rec(0);
  return { n, q, trees, correct, correctAllLeafSeparated };
}

function allPairs(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

// --- LEG B: the game-tree DFS on partial orders --------------------------------------------------

type Reach = boolean[][]; // reach[i][j] = the transcript proves a_i < a_j

const initialReach = (n: number): Reach =>
  Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

const cloneReach = (r: Reach): Reach => r.map((row) => [...row]);

const keyOf = (r: Reach): string =>
  r.map((row) => row.map((b) => (b ? "1" : "0")).join("")).join("/");

/** Add the edge i < j with transitive closure (fresh copy). */
function withEdge(r: Reach, i: number, j: number): Reach {
  const n = r.length;
  const out = cloneReach(r);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      if (!out[x]![y]! && (x === i || r[x]![i]!) && (y === j || r[j]![y]!))
        out[x]![y] = true;
    }
  }
  return out;
}

/** The unique maximum, or -1 — the transcript proves every other element below it. */
function uniqueMaxOf(r: Reach): number {
  const n = r.length;
  outer: for (let m = 0; m < n; m++) {
    for (let x = 0; x < n; x++) if (x !== m && !r[x]![m]!) continue outer;
    return m;
  }
  return -1;
}

/**
 * The upgraded terminal: the state decides the SECOND iff it has a unique
 * maximum m and exactly one element whose only proven superior is m. The
 * possible seconds are exactly m's direct losers that no non-champion sits
 * above (any element proven below a non-champion is out; any element never
 * compared with m has a consistent order through the chain above it). Two
 * such candidates leave the leaf ambiguous — a witness order crowns each.
 */
function secondDetermined(r: Reach): boolean {
  const m = uniqueMaxOf(r);
  if (m === -1) return false;
  const n = r.length;
  let candidates = 0;
  for (let x = 0; x < n; x++) {
    if (x === m) continue;
    let onlyMax = true;
    for (let y = 0; y < n; y++) {
      if (r[x]![y]! && y !== m) {
        onlyMax = false;
        break;
      }
    }
    if (onlyMax) candidates++;
  }
  return candidates === 1;
}

/** The elements that could still be the second — the terminal's witness material. */
function secondCandidates(r: Reach): number[] {
  const m = uniqueMaxOf(r);
  if (m === -1) return [];
  const n = r.length;
  const out: number[] = [];
  for (let x = 0; x < n; x++) {
    if (x === m) continue;
    let onlyMax = true;
    for (let y = 0; y < n; y++) {
      if (r[x]![y]! && y !== m) {
        onlyMax = false;
        break;
      }
    }
    if (onlyMax) out.push(x);
  }
  return out;
}

function winFindSecond(
  r: Reach,
  budget: number,
  memo: Map<string, boolean>,
): boolean {
  if (secondDetermined(r)) return true;
  if (budget === 0) return false;
  const key = `${budget}:${keyOf(r)}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const n = r.length;
  let result = false;
  for (let i = 0; i < n && !result; i++) {
    for (let j = i + 1; j < n && !result; j++) {
      if (r[i]![j]! || r[j]![i]!) continue; // already comparable — uninformative
      if (
        winFindSecond(withEdge(r, i, j), budget - 1, memo) &&
        winFindSecond(withEdge(r, j, i), budget - 1, memo)
      )
        result = true;
    }
  }
  memo.set(key, result);
  return result;
}

/** LEG B: the exact optimum — n <= 6 within test budgets (the partial-order state space is the budget). */
export function findSecondOptimalDepth(n: number): OptimumResult {
  if (!Number.isInteger(n) || n < 2 || n > 6) {
    throw new Error(
      `findSecondOptimalDepth: n must be an integer in [2,6] (got ${n}) — the partial-order state space is the budget`,
    );
  }
  const memo = new Map<string, boolean>();
  const r0 = initialReach(n);
  const ceiling = secondClosedForm(n); // the tournament + loser bracket attains it
  for (let q = 0; q <= ceiling; q++) {
    if (winFindSecond(r0, q, memo))
      return { n, optimum: q, statesExplored: memo.size };
  }
  throw new Error(
    "findSecondOptimalDepth: unreachable — the closed form's tree exists",
  );
}

/**
 * The constructive upper-bound witness: a correct flat tree at EXACTLY the
 * closed form's depth, built by replaying the DFS oracle (at each live node
 * the first pair whose both branches win; determined subtrees are padded
 * with an already-decided pair, whose wrong branch no permutation reaches).
 */
export function secondTreeWitness(
  n: number,
): ReadonlyArray<readonly [number, number]> {
  if (!Number.isInteger(n) || n < 2 || n > 6) {
    throw new Error(
      `secondTreeWitness: n must be an integer in [2,6] (got ${n})`,
    );
  }
  const depth = secondClosedForm(n);
  const memo = new Map<string, boolean>();
  const ask = new Array<readonly [number, number]>(2 ** depth - 1).fill([0, 1]);
  const decidedPair = (r: Reach): readonly [number, number] => {
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        if (r[i]![j]! || r[j]![i]!) return [i, j];
      }
    }
    throw new Error(
      "secondTreeWitness: a determined state has a comparable pair",
    );
  };
  const fillDead = (v: number, r: Reach): void => {
    if (v >= 2 ** depth - 1) return;
    const pr = decidedPair(r);
    ask[v] = pr;
    fillDead(2 * v + 1, r);
    fillDead(2 * v + 2, r);
  };
  const build = (v: number, r: Reach, budget: number): void => {
    if (v >= 2 ** depth - 1) return;
    if (secondDetermined(r)) {
      fillDead(v, r);
      return;
    }
    if (budget === 0) {
      throw new Error(
        "secondTreeWitness: the oracle ran out of budget on a live path",
      );
    }
    const n2 = r.length;
    for (let i = 0; i < n2; i++) {
      for (let j = i + 1; j < n2; j++) {
        if (r[i]![j]! || r[j]![i]!) continue;
        if (
          winFindSecond(withEdge(r, i, j), budget - 1, memo) &&
          winFindSecond(withEdge(r, j, i), budget - 1, memo)
        ) {
          ask[v] = [i, j];
          build(2 * v + 1, withEdge(r, i, j), budget - 1);
          build(2 * v + 2, withEdge(r, j, i), budget - 1);
          return;
        }
      }
    }
    throw new Error(
      "secondTreeWitness: no winning pair at a live node — oracle divergence",
    );
  };
  build(0, initialReach(n), depth);
  return ask;
}

// --- LEG C: the weight adversary ------------------------------------------------------------------

export interface SecondAdversaryWitness {
  /** the element this order crowns as max — for SECOND witnesses, the champion */
  readonly crown: number;
  /** SECOND witnesses: the element placed directly under the crown (the claimed second) */
  readonly second: number | null;
  readonly order: readonly number[]; // a total order consistent with EVERY answer
}

export interface SecondAdversaryRecord {
  readonly n: number;
  readonly k: number;
  readonly plays: ReadonlyArray<readonly [number, number]>;
  readonly answers: readonly boolean[];
  /** weight[x] <= 2^{wins(x)} after every play — the doubling core */
  readonly invariantHeld: boolean;
  /** >= n - k undefeated after every play */
  readonly undefeatedBudgetHeld: boolean;
  /** once one undefeated remains: its weight is exactly n and it directly beat >= ceil(log2 n) distinct elements */
  readonly championInvariantHeld: boolean;
  readonly undefeated: readonly number[];
  readonly champion: number | null;
  readonly directLosersOfChampion: readonly number[];
  readonly secondCandidates: readonly number[];
  /** MAX-UNKNOWN (>= 2 undefeated) | SECOND-UNKNOWN (>= 2 candidates) | DETERMINED */
  readonly blocked: "MAX-UNKNOWN" | "SECOND-UNKNOWN" | "DETERMINED";
  readonly witnesses: readonly SecondAdversaryWitness[];
}

/** Topological order of the DAG with `u` forced last (u is a sink — by the invariants). */
function topoWithLast(r: Reach, u: number): number[] {
  const n = r.length;
  const done = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  for (let round = 0; round < n; round++) {
    let picked = -1;
    for (let x = 0; x < n; x++) {
      if (done[x] || x === u) continue;
      let ready = true;
      for (let y = 0; y < n; y++)
        if (!done[y] && y !== x && r[y]![x]!) ready = false;
      if (ready) {
        picked = x;
        break;
      }
    }
    if (picked === -1) break;
    done[picked] = true;
    order.push(picked);
  }
  for (let x = 0; x < n; x++) if (!done[x]) order.push(x); // u lands last
  return order;
}

/**
 * The weight adversary for second-largest, at any n — the classical tournament
 * argument (Kislitsyn; Knuth 5.3.3) as a machine invariant. Each element
 * carries a WEIGHT (initially 1; a defeated element's weight has been
 * transferred away). Answers follow the transcript when it already decides
 * the pair; otherwise the rule that keeps mass flowing toward the living:
 *   - both UNDEFEATED: the larger weight wins (ties: the canonically higher
 *     index) — the loser is eliminated and its weight transfers;
 *   - one undefeated, one defeated: the UNDEFEATED wins (it absorbs 0);
 *   - both defeated: arbitrary (fixed) — no mass exists to move.
 * Mass can then only ever sit on undefeated elements, and the unique final
 * champion is the only element that never lost — so after k = n - 1 plays
 * against ANY strategy its weight is exactly n. Since a win at most doubles
 * the winner's weight (the rule guarantees loser-weight <= winner-weight on
 * live duels), the champion must have won >= ceil(log2 n) MASS-GROWING
 * duels, each against a distinct live opponent — so it directly beat
 * >= ceil(log2 n) distinct elements, every one a possible second.
 */
export function adversaryFindSecond(
  n: number,
  comparisons: ReadonlyArray<readonly [number, number]>,
): SecondAdversaryRecord {
  if (!Number.isInteger(n) || n < 2 || n > 12) {
    throw new Error(
      `adversaryFindSecond: n must be an integer in [2,12] (got ${n})`,
    );
  }
  const r = initialReach(n);
  const weight = new Array<number>(n).fill(1);
  const wins = new Array<number>(n).fill(0);
  const defeated = new Array<boolean>(n).fill(false);
  const victims: Array<Set<number>> = Array.from(
    { length: n },
    () => new Set<number>(),
  );
  const plays: Array<[number, number]> = [];
  const answers: boolean[] = [];
  let invariantHeld = true;
  let undefeatedBudgetHeld = true;
  const checkInvariants = (kSoFar: number): void => {
    for (let x = 0; x < n; x++) {
      if (weight[x]! > 2 ** wins[x]!) invariantHeld = false;
    }
    let u = 0;
    for (let x = 0; x < n; x++) if (!defeated[x]) u++;
    if (u < n - kSoFar) undefeatedBudgetHeld = false;
  };
  for (const [i0, j0] of comparisons) {
    const i = Math.min(i0, j0);
    const j = Math.max(i0, j0);
    if (
      !Number.isInteger(i) ||
      !Number.isInteger(j) ||
      i < 0 ||
      j >= n ||
      i === j
    ) {
      throw new Error(
        `adversaryFindSecond: comparison (${i0},${j0}) is not a pair of distinct elements in [0,${n})`,
      );
    }
    plays.push([i, j]);
    let less: boolean; // the answer to "a_i < a_j?"
    if (r[i]![j]!) {
      less = true;
    } else if (r[j]![i]!) {
      less = false;
    } else if (defeated[i] && defeated[j]) {
      less = true; // no mass exists to move — arbitrary but fixed
    } else if (defeated[i]) {
      less = true; // the undefeated j wins — the defeated i has no mass to give
    } else if (defeated[j]) {
      less = false; // the undefeated i wins
    } else if (weight[i]! > weight[j]!) {
      less = false; // live duel, i is heavier: i wins and absorbs (at most a doubling)
    } else {
      less = true; // live duel, j at least as heavy: j wins (a tie goes to the higher index)
    }
    const winner = less ? j : i;
    const loser = less ? i : j;
    wins[winner] = wins[winner]! + 1;
    weight[winner] = weight[winner]! + weight[loser]!;
    weight[loser] = 0;
    victims[winner]!.add(loser);
    defeated[loser] = true;
    const e0 = less ? i : j;
    const e1 = less ? j : i;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        if (!r[x]![y]! && (x === e0 || r[x]![e0]!) && (y === e1 || r[e1]![y]!))
          r[x]![y] = true;
      }
    }
    answers.push(less);
    checkInvariants(plays.length);
  }
  const undefeated: number[] = [];
  for (let x = 0; x < n; x++) if (!defeated[x]) undefeated.push(x);
  let champion: number | null = null;
  let championInvariantHeld = true;
  let directLosers: number[] = [];
  let candidates: number[] = [];
  let blocked: SecondAdversaryRecord["blocked"] = "DETERMINED";
  const witnesses: SecondAdversaryWitness[] = [];
  if (undefeated.length >= 2) {
    blocked = "MAX-UNKNOWN";
    for (const u of undefeated.slice(0, 2)) {
      witnesses.push({ crown: u, second: null, order: topoWithLast(r, u) });
    }
  } else if (undefeated.length === 1) {
    champion = undefeated[0]!;
    championInvariantHeld =
      weight[champion]! === n && victims[champion]!.size >= ceilLog2(n);
    directLosers = [...victims[champion]!];
    candidates = secondCandidates(r);
    if (candidates.length >= 2) {
      blocked = "SECOND-UNKNOWN";
      for (const c of candidates.slice(0, 2)) {
        // crown the champion, place the candidate directly under it — a consistent order
        const below = topoWithLast(r, c);
        const order = [...below.filter((x) => x !== champion), champion];
        witnesses.push({ crown: champion, second: c, order });
      }
    }
  }
  return {
    n,
    k: comparisons.length,
    plays,
    answers,
    invariantHeld,
    undefeatedBudgetHeld,
    championInvariantHeld,
    undefeated,
    champion,
    directLosersOfChampion: directLosers,
    secondCandidates: candidates,
    blocked,
    witnesses,
  };
}

export interface SecondAdversarySweep {
  readonly n: number;
  readonly k: number;
  readonly sequences: number; // every adaptive strategy's play
  readonly allInvariantsHeld: boolean;
  readonly allWitnessesValid: boolean;
  /** every strategy of k = n + ceil(log2 n) - 3 plays leaves the second undetermined */
  readonly allBlocked: boolean;
}

/** The self-check every record must pass: witnesses satisfy every answer and crown what they claim. */
function witnessesSelfCheck(rec: SecondAdversaryRecord): boolean {
  if (
    !rec.invariantHeld ||
    !rec.undefeatedBudgetHeld ||
    !rec.championInvariantHeld
  )
    return false;
  if (rec.blocked === "DETERMINED") return rec.witnesses.length === 0;
  if (rec.witnesses.length !== 2) return false;
  const pos = (o: readonly number[], x: number): number => o.indexOf(x);
  for (const w of rec.witnesses) {
    if (w.order.length !== rec.n || new Set(w.order).size !== rec.n)
      return false;
    for (let t = 0; t < rec.answers.length; t++) {
      const pr = rec.plays[t]!;
      if (rec.answers[t]! !== pos(w.order, pr[0]) < pos(w.order, pr[1]))
        return false;
    }
    if (w.order[rec.n - 1] !== w.crown) return false;
    if (w.second !== null && w.order[rec.n - 2] !== w.second) return false;
  }
  if (rec.blocked === "MAX-UNKNOWN")
    return new Set(rec.witnesses.map((w) => w.crown)).size === 2;
  // blocked === "SECOND-UNKNOWN" by elimination here (DETERMINED returned early)
  const crowns = new Set(rec.witnesses.map((w) => w.crown));
  const seconds = new Set(rec.witnesses.map((w) => w.second));
  return crowns.size === 1 && seconds.size === 2;
}

/** LEG C exhaustive: play EVERY adaptive strategy of k comparisons against the team adversary. */
export function adversarySecondSweepAllSequences(
  n: number,
  k: number,
): SecondAdversarySweep {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(
      `adversarySecondSweepAllSequences: n must be an integer in [2,8] (got ${n})`,
    );
  }
  if (!Number.isInteger(k) || k < 0 || k > 5) {
    throw new Error(
      `adversarySecondSweepAllSequences: k must be an integer in [0,5] (got ${k}) — C(n,2)^k sequences`,
    );
  }
  const pairs = allPairs(n);
  const seq: Array<[number, number]> = [];
  let sequences = 0;
  let allInvariantsHeld = true;
  let allWitnessesValid = true;
  let allBlocked = true;
  const rec2 = (t: number): void => {
    if (t === k) {
      sequences++;
      const record = adversaryFindSecond(n, seq);
      if (
        !record.invariantHeld ||
        !record.undefeatedBudgetHeld ||
        !record.championInvariantHeld
      )
        allInvariantsHeld = false;
      if (!witnessesSelfCheck(record)) allWitnessesValid = false;
      if (record.blocked === "DETERMINED") allBlocked = false;
      return;
    }
    for (const pr of pairs) {
      seq.push(pr);
      rec2(t + 1);
      seq.pop();
    }
  };
  rec2(0);
  return { n, k, sequences, allInvariantsHeld, allWitnessesValid, allBlocked };
}

// --- the counting gate -----------------------------------------------------------------------------

export interface SecondInfoBound {
  readonly n: number;
  readonly pairs: bigint; // n(n-1) ordered (max, second) outcomes
  readonly ceilingLog2Pairs: number; // min q with 2^q >= n(n-1)
  readonly pow2: bigint;
}

/** The leaf-counting gate: a correct second-tree has >= n(n-1) reached leaves and <= 2^q leaves total. */
export function secondInfoBound(n: number): SecondInfoBound {
  if (!Number.isInteger(n) || n < 2 || n > 20) {
    throw new Error(
      `secondInfoBound: n must be an integer in [2,20] (got ${n})`,
    );
  }
  const pairs = BigInt(n) * BigInt(n - 1);
  let q = 0;
  let pow2 = 1n;
  while (pow2 < pairs) {
    pow2 *= 2n;
    q++;
  }
  return { n, pairs, ceilingLog2Pairs: q, pow2 };
}

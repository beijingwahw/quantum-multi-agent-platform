/**
 * The min&max wall — the comparison model's third executed theorem
 * (the sibling of src/lower/second.ts, new-file by law; the same DFS
 * mechanics, a different terminal and a different adversary).
 *
 * THEOREM (falsifiable, machine-checked at small n, cited at all n): in the
 * deterministic comparison model, finding BOTH the minimum and the maximum
 * of n distinct keys needs exactly
 *     ceil(3n/2) - 2      comparisons (n >= 2)
 * — even n: 3n/2 - 2, odd n: (3n - 3)/2. The R18 draft's prose said "n = 2
 * special case: 3 comparisons"; the machine rules 1 (compare the two, the
 * winner is the max, the loser the min — the closed form itself).
 *
 * Three legs, cross-checked against each other exactly as the find-max /
 * sorting / second-largest walls are:
 *
 *   LEG A (flat exhaustive sweep): every canonical depth-q tree audited on
 *     all n! inputs — zero correct trees at q = ceil(3n/2) - 3.
 *   LEG B (game-tree DFS on partial orders): "exists a correct tree of
 *     depth <= q" as a game — the terminal is "minimum AND maximum BOTH
 *     determined": the partial order has a unique sink-source pair (exactly
 *     one element every other is proven above, exactly one every other is
 *     proven below).
 *   LEG C (the PAIRING adversary, at ANY n): the classical pairing argument
 *     as a machine invariant. Every element starts with TWO candidacies —
 *     max (until it loses) and min (until it wins); a comparison takes the
 *     loser's max candidacy and the winner's min candidacy. Classes: NO
 *     (never compared), MAXC (won only), MINC (lost only), OUT (both). The
 *     answer rule: follow the transcript when it already decides the pair;
 *     otherwise NO-vs-NO is the ONLY play that burns two candidacies at
 *     once (and only floor(n/2) such plays exist — each consumes two NOs),
 *     same-class duels burn one, cross-class duels burn ZERO. So after k
 *     plays the surviving candidacy pool is >= 2n - k - floor(n/2), and at
 *     k = ceil(3n/2) - 3 the pool is >= 3 > 2: either two elements never
 *     lost (the max is open) or two never won (the min is open) — each
 *     carrying a witness total order consistent with EVERY answer.
 *
 * The counting gate, held as data: a correct min&max tree sends the n(n-1)
 * ordered (min, max) outcomes to distinct leaves, so q >=
 * ceil(log2(n(n-1))) — for n = 4 that is 4 and the optimum is 4 (TIGHT;
 * find-max and second-largest never touch their counting bounds at n = 4);
 * for n = 5 it is 5 while the optimum is 6, and for n = 6 it is 5 while the
 * optimum is 7 — the gap the pairing adversary closes.
 *
 * Upper bound: minmaxTreeWitness(n) CONSTRUCTS a correct tree at the closed
 * form's depth (the DFS oracle replayed through the flat audit), and the
 * pairing strategy itself (pair them up, king-of-the-hill the winners,
 * king-of-the-hill the losers) played against the adversary determines both
 * at exactly ceil(3n/2) - 2 plays — the bound is tight, not just counted.
 */
import {
  allPerms,
  type OptimumResult,
  type SweepResult,
} from "./comparison.js";

/** The closed form this module executes: ceil(3n/2) - 2, in pure integer
 *  arithmetic — ceil(3n/2) = n + ceil(n/2) for integer n. */
export function minmaxClosedForm(n: number): number {
  if (!Number.isInteger(n) || n < 2 || n > 2 ** 20) {
    throw new Error(
      `minmaxClosedForm: n must be an integer in [2, 2^20] (got ${n})`,
    );
  }
  return n + ((n + 1) >> 1) - 2;
}

/** The ordered (argmin, argmax) of a rank assignment — distinct values make both unique. */
export function minmaxOf(p: readonly number[]): readonly [number, number] {
  if (p.length < 2)
    throw new Error(`minmaxOf: need at least 2 elements (got ${p.length})`);
  let lo = 0;
  let hi = 0;
  for (let i = 1; i < p.length; i++) {
    if (p[i]! < p[lo]!) lo = i;
    if (p[i]! > p[hi]!) hi = i;
  }
  return [lo, hi];
}

// --- LEG A: the flat sweep ---------------------------------------------------------------------

export interface MinmaxTreeAudit {
  readonly n: number;
  readonly depth: number;
  readonly correct: boolean;
  /** the leaf whose perm set carries two different true (min, max) pairs (null when correct) */
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
 * Audit a flat min&max tree: walk every permutation to its leaf; the tree is
 * correct iff every reached leaf sees a single true (min, max) pair. The
 * first inconsistent leaf is NAMED with the permutation that kills it — the
 * conviction the trials read out.
 */
export function auditMinmaxTree(
  n: number,
  ask: ReadonlyArray<readonly [number, number]>,
): MinmaxTreeAudit {
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
    const pair = minmaxOf(p);
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

/** LEG A for min&max: enumerate ALL depth-q trees (canonical orientation i < j). */
export function exhaustiveMinmaxSweep(n: number, q: number): SweepResult {
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
      const audit = auditMinmaxTree(n, ask);
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

/** The unique minimum, or -1 — the transcript proves every other element above it. */
function uniqueMinOf(r: Reach): number {
  const n = r.length;
  outer: for (let m = 0; m < n; m++) {
    for (let x = 0; x < n; x++) if (x !== m && !r[m]![x]!) continue outer;
    return m;
  }
  return -1;
}

/**
 * The terminal: the state decides BOTH extrema iff the partial order has a
 * unique maximum AND a unique minimum (in a DAG a unique maximal element
 * has every element below it, and a unique minimal element every element
 * above it). Two incomparable elements on either side leave the leaf
 * ambiguous — a witness order crowns each.
 */
function minmaxDetermined(r: Reach): boolean {
  return uniqueMaxOf(r) !== -1 && uniqueMinOf(r) !== -1;
}

function winFindMinmax(
  r: Reach,
  budget: number,
  memo: Map<string, boolean>,
): boolean {
  if (minmaxDetermined(r)) return true;
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
        winFindMinmax(withEdge(r, i, j), budget - 1, memo) &&
        winFindMinmax(withEdge(r, j, i), budget - 1, memo)
      )
        result = true;
    }
  }
  memo.set(key, result);
  return result;
}

/** LEG B: the exact optimum — n <= 6 within test budgets (the partial-order state space is the budget). */
export function findMinmaxOptimalDepth(n: number): OptimumResult {
  if (!Number.isInteger(n) || n < 2 || n > 6) {
    throw new Error(
      `findMinmaxOptimalDepth: n must be an integer in [2,6] (got ${n}) — the partial-order state space is the budget`,
    );
  }
  const memo = new Map<string, boolean>();
  const r0 = initialReach(n);
  const ceiling = minmaxClosedForm(n); // the pairing strategy attains it
  for (let q = 0; q <= ceiling; q++) {
    if (winFindMinmax(r0, q, memo))
      return { n, optimum: q, statesExplored: memo.size };
  }
  throw new Error(
    "findMinmaxOptimalDepth: unreachable — the closed form's tree exists",
  );
}

/**
 * The constructive upper-bound witness: a correct flat tree at EXACTLY the
 * closed form's depth, built by replaying the DFS oracle (at each live node
 * the first pair whose both branches win; determined subtrees are padded
 * with an already-decided pair, whose wrong branch no permutation reaches).
 */
export function minmaxTreeWitness(
  n: number,
): ReadonlyArray<readonly [number, number]> {
  if (!Number.isInteger(n) || n < 2 || n > 6) {
    throw new Error(
      `minmaxTreeWitness: n must be an integer in [2,6] (got ${n})`,
    );
  }
  const depth = minmaxClosedForm(n);
  const memo = new Map<string, boolean>();
  const ask = new Array<readonly [number, number]>(2 ** depth - 1).fill([0, 1]);
  const decidedPair = (r: Reach): readonly [number, number] => {
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        if (r[i]![j]! || r[j]![i]!) return [i, j];
      }
    }
    throw new Error(
      "minmaxTreeWitness: a determined state has a comparable pair",
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
    if (minmaxDetermined(r)) {
      fillDead(v, r);
      return;
    }
    if (budget === 0) {
      throw new Error(
        "minmaxTreeWitness: the oracle ran out of budget on a live path",
      );
    }
    const n2 = r.length;
    for (let i = 0; i < n2; i++) {
      for (let j = i + 1; j < n2; j++) {
        if (r[i]![j]! || r[j]![i]!) continue;
        if (
          winFindMinmax(withEdge(r, i, j), budget - 1, memo) &&
          winFindMinmax(withEdge(r, j, i), budget - 1, memo)
        ) {
          ask[v] = [i, j];
          build(2 * v + 1, withEdge(r, i, j), budget - 1);
          build(2 * v + 2, withEdge(r, j, i), budget - 1);
          return;
        }
      }
    }
    throw new Error(
      "minmaxTreeWitness: no winning pair at a live node — oracle divergence",
    );
  };
  build(0, initialReach(n), depth);
  return ask;
}

// --- LEG C: the pairing adversary ------------------------------------------------------------------

/** The four candidacy classes of the pairing argument. */
export type PairClass = "NO" | "MAXC" | "MINC" | "OUT";

export interface MinmaxAdversaryWitness {
  /** the element this order crowns as max (MAX-UNKNOWN witnesses; null for MIN-UNKNOWN) */
  readonly claimedMax: number | null;
  /** the element this order floors as min (MIN-UNKNOWN witnesses; null for MAX-UNKNOWN) */
  readonly claimedMin: number | null;
  readonly order: readonly number[]; // a total order consistent with EVERY answer
}

export interface MinmaxAdversaryRecord {
  readonly n: number;
  readonly k: number;
  readonly plays: ReadonlyArray<readonly [number, number]>;
  readonly answers: readonly boolean[];
  /** candidacies burned by each play: 2 only on NO-vs-NO, else <= 1 */
  readonly drops: readonly number[];
  /** every element's class after the transcript */
  readonly classes: readonly PairClass[];
  /** pool >= 2n - k - noNoCount after every play — the accounting core */
  readonly poolAccountingHeld: boolean;
  /** noNoCount <= floor(n/2) after every play — the pairing budget */
  readonly noNoBudgetHeld: boolean;
  /** each play's drop law: drop <= 2, drop = 2 only on NO-vs-NO */
  readonly dropLawHeld: boolean;
  /** surviving max candidacies (never lost) and min candidacies (never won) */
  readonly maxCandidates: readonly number[];
  readonly minCandidates: readonly number[];
  /** MAX-UNKNOWN (>= 2 never lost) | MIN-UNKNOWN (>= 2 never won) | DETERMINED */
  readonly blocked: "MAX-UNKNOWN" | "MIN-UNKNOWN" | "DETERMINED";
  readonly witnesses: readonly MinmaxAdversaryWitness[];
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

/** Topological order with `u` forced FIRST (u is a source — no r[y][u] exists
 *  for a never-won u: every incoming proof edge would be a direct win). */
function topoWithFirst(r: Reach, u: number): number[] {
  const n = r.length;
  const done = new Array<boolean>(n).fill(false);
  done[u] = true;
  const order: number[] = [u];
  for (let round = 0; round < n; round++) {
    let picked = -1;
    for (let x = 0; x < n; x++) {
      if (done[x]) continue;
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
  for (let x = 0; x < n; x++) if (!done[x]) order.push(x);
  return order;
}

const classOf = (won: boolean, lost: boolean): PairClass =>
  !won && !lost ? "NO" : won && !lost ? "MAXC" : !won && lost ? "MINC" : "OUT";

/**
 * The pairing adversary for min&max, at any n — the classical argument
 * (Pohl 1972; Knuth 5.3.3) as a machine invariant. Every element carries
 * TWO candidacies: max until it loses, min until it wins. Answers follow
 * the transcript when it already decides the pair; otherwise the rule that
 * burns as few candidacies as the pair admits:
 *   - NO vs NO: the ONLY two-burn play (and at most floor(n/2) of them
 *     exist — each consumes two NOs); the answer is fixed (yes).
 *   - NO vs {MAXC, OUT}: the NON-NO wins (the NO burns its max candidacy
 *     alone); NO vs MINC: the NO wins (burns its min candidacy alone).
 *   - MAXC vs MAXC: either answer burns one (the loser leaves the max
 *     pool); MINC vs MINC: either burns one (the winner leaves the min
 *     pool); the answer is fixed (yes) in both.
 *   - every cross-class duel (MAXC/MINC, MAXC/OUT, MINC/OUT, OUT/OUT)
 *     burns ZERO — the winner was already out of the min pool, the loser
 *     already out of the max pool.
 * So after k plays, of which p paired-NO duels, the surviving pool is
 * >= 2n - k - p >= 2n - k - floor(n/2); at k = ceil(3n/2) - 3 the pool is
 * >= 3 > 2, and determination needs EXACTLY 2 (one survivor per side).
 */
export function adversaryMinmax(
  n: number,
  comparisons: ReadonlyArray<readonly [number, number]>,
): MinmaxAdversaryRecord {
  if (!Number.isInteger(n) || n < 2 || n > 12) {
    throw new Error(
      `adversaryMinmax: n must be an integer in [2,12] (got ${n})`,
    );
  }
  const r = initialReach(n);
  const won = new Array<boolean>(n).fill(false);
  const lost = new Array<boolean>(n).fill(false);
  const plays: Array<[number, number]> = [];
  const answers: boolean[] = [];
  const drops: number[] = [];
  let noNoCount = 0;
  let poolAccountingHeld = true;
  let noNoBudgetHeld = true;
  let dropLawHeld = true;
  const poolNow = (): number => {
    let p = 0;
    for (let x = 0; x < n; x++) {
      if (!lost[x]) p++; // max candidacy
      if (!won[x]) p++; // min candidacy
    }
    return p;
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
        `adversaryMinmax: comparison (${i0},${j0}) is not a pair of distinct elements in [0,${n})`,
      );
    }
    plays.push([i, j]);
    const ci = classOf(won[i]!, lost[i]!);
    const cj = classOf(won[j]!, lost[j]!);
    let less: boolean; // the answer to "a_i < a_j?"
    let noNo = false;
    if (r[i]![j]!) {
      less = true; // the transcript already decides (zero burns — classes settled)
    } else if (r[j]![i]!) {
      less = false;
    } else if (ci === "NO" && cj === "NO") {
      less = true; // the paired duel — fixed answer, the only two-burn play
      noNo = true;
    } else if (ci === "NO") {
      // the NO element burns exactly ONE candidacy, on the side the other
      // element has already vacated: it LOSES to a MAXC/OUT (dropping its
      // max candidacy) and BEATS a MINC (dropping its min candidacy) — the
      // opposite answer would burn one on EACH side
      less = cj !== "MINC";
    } else if (cj === "NO") {
      less = ci === "MINC";
    } else if (ci === "MAXC" && cj === "MAXC") {
      less = true; // either burns one — fixed
    } else if (ci === "MINC" && cj === "MINC") {
      less = true; // either burns one — fixed
    } else if (
      (ci === "MAXC" && cj === "MINC") ||
      (ci === "MINC" && cj === "MAXC")
    ) {
      // the MAXC beats the MINC — the ONLY zero-burn live duel
      less = cj === "MAXC";
    } else if (ci === "MAXC" || cj === "MAXC") {
      // MAXC vs OUT: the MAXC wins — zero burns
      less = cj === "MAXC";
    } else {
      // MINC vs OUT: the OUT wins (the MINC keeps losing) — zero burns; OUT vs OUT: fixed
      less = ci === "OUT" && cj === "OUT" ? true : ci === "MINC";
    }
    const winner = less ? j : i;
    const loser = less ? i : j;
    // the exact burn: the loser burns its max candidacy iff it HAD one (NO
    // or MAXC); the winner burns its min candidacy iff it had one (NO or MINC)
    const loserHadMax = !lost[loser];
    const winnerHadMin = !won[winner];
    const burn = (loserHadMax ? 1 : 0) + (winnerHadMin ? 1 : 0);
    won[winner] = true;
    lost[loser] = true;
    if (noNo) {
      noNoCount++;
      dropLawHeld = dropLawHeld && burn === 2;
    } else {
      dropLawHeld = dropLawHeld && burn <= 1;
    }
    drops.push(burn);
    const e0 = less ? i : j;
    const e1 = less ? j : i;
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        if (!r[x]![y]! && (x === e0 || r[x]![e0]!) && (y === e1 || r[e1]![y]!))
          r[x]![y] = true;
      }
    }
    answers.push(less);
    const k = plays.length;
    if (poolNow() < 2 * n - k - noNoCount) poolAccountingHeld = false;
    if (noNoCount > Math.floor(n / 2)) noNoBudgetHeld = false;
  }
  const classes = Array.from({ length: n }, (_, x) =>
    classOf(won[x]!, lost[x]!),
  );
  const maxCandidates: number[] = [];
  const minCandidates: number[] = [];
  for (let x = 0; x < n; x++) {
    if (!lost[x]) maxCandidates.push(x);
    if (!won[x]) minCandidates.push(x);
  }
  let blocked: MinmaxAdversaryRecord["blocked"] = "DETERMINED";
  const witnesses: MinmaxAdversaryWitness[] = [];
  if (maxCandidates.length >= 2) {
    blocked = "MAX-UNKNOWN";
    for (const u of maxCandidates.slice(0, 2)) {
      witnesses.push({
        claimedMax: u,
        claimedMin: null,
        order: topoWithLast(r, u),
      });
    }
  } else if (minCandidates.length >= 2) {
    blocked = "MIN-UNKNOWN";
    for (const u of minCandidates.slice(0, 2)) {
      witnesses.push({
        claimedMax: null,
        claimedMin: u,
        order: topoWithFirst(r, u),
      });
    }
  }
  return {
    n,
    k: comparisons.length,
    plays,
    answers,
    drops,
    classes,
    poolAccountingHeld,
    noNoBudgetHeld,
    dropLawHeld,
    maxCandidates,
    minCandidates,
    blocked,
    witnesses,
  };
}

export interface MinmaxAdversarySweep {
  readonly n: number;
  readonly k: number;
  readonly sequences: number; // every adaptive strategy's play
  readonly allInvariantsHeld: boolean;
  readonly allWitnessesValid: boolean;
  /** every strategy of k = ceil(3n/2) - 3 plays leaves min&max undetermined */
  readonly allBlocked: boolean;
}

/** The self-check every record must pass: witnesses satisfy every answer and
 *  claim the extremum they say they do. */
function witnessesSelfCheck(rec: MinmaxAdversaryRecord): boolean {
  if (!rec.poolAccountingHeld || !rec.noNoBudgetHeld || !rec.dropLawHeld)
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
    if (w.claimedMax !== null && w.order[rec.n - 1] !== w.claimedMax)
      return false;
    if (w.claimedMin !== null && w.order[0] !== w.claimedMin) return false;
  }
  if (rec.blocked === "MAX-UNKNOWN") {
    if (new Set(rec.witnesses.map((w) => w.claimedMax)).size !== 2)
      return false;
    return rec.witnesses.every((w) => w.claimedMin === null);
  }
  // blocked === "MIN-UNKNOWN" by elimination here (DETERMINED returned early)
  if (new Set(rec.witnesses.map((w) => w.claimedMin)).size !== 2) return false;
  return rec.witnesses.every((w) => w.claimedMax === null);
}

/** LEG C exhaustive: play EVERY adaptive strategy of k comparisons against the pairing adversary. */
export function adversaryMinmaxSweepAllSequences(
  n: number,
  k: number,
): MinmaxAdversarySweep {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(
      `adversaryMinmaxSweepAllSequences: n must be an integer in [2,8] (got ${n})`,
    );
  }
  if (!Number.isInteger(k) || k < 0 || k > 5) {
    throw new Error(
      `adversaryMinmaxSweepAllSequences: k must be an integer in [0,5] (got ${k}) — C(n,2)^k sequences`,
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
      const record = adversaryMinmax(n, seq);
      if (
        !record.poolAccountingHeld ||
        !record.noNoBudgetHeld ||
        !record.dropLawHeld
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

export interface MinmaxInfoBound {
  readonly n: number;
  readonly pairs: bigint; // n(n-1) ordered (min, max) outcomes
  readonly ceilingLog2Pairs: number; // min q with 2^q >= n(n-1)
  readonly pow2: bigint;
}

/** The leaf-counting gate: a correct min&max tree has >= n(n-1) reached leaves and <= 2^q leaves total. */
export function minmaxInfoBound(n: number): MinmaxInfoBound {
  if (!Number.isInteger(n) || n < 2 || n > 20) {
    throw new Error(
      `minmaxInfoBound: n must be an integer in [2,20] (got ${n})`,
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

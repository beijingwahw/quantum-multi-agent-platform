/**
 * The comparison model, made executable — the atlas's P-EXACT island
 * (sorting / assignment) carried only citations; this module runs the
 * lower-bound machinery itself.
 *
 * Model: n distinct keys a_0..a_{n-1}, unknown total order; a deterministic
 * comparison algorithm is a binary tree whose internal node v asks
 * "a_i < a_j?" for a pair i < j — yes goes left (2v+1), no goes right
 * (2v+2). Inputs are the n! rank assignments (permutations). Three legs,
 * cross-checked against each other:
 *
 *   LEG A (flat exhaustive sweep): enumerate ALL comparison trees of depth
 *     q at small n and audit each on all n! inputs — the brute-force wall.
 *   LEG B (game-tree DFS on partial orders): the exact optimum "exists a
 *     correct tree of depth <= q" evaluated as a game (algorithm picks the
 *     pair, input picks the answer) over memoized reachability states —
 *     the compressed enumeration that reaches n the flat sweep cannot.
 *   LEG C (the adversary, for find-max at ANY n): answers follow the
 *     transcript when it already decides the pair, else the undefeated
 *     element wins; each comparison eliminates at most one undefeated
 *     element, so k comparisons leave >= n-k undefeated, each carrying a
 *     witness total order (consistent with every answer) in which it is
 *     the maximum — the classical adversary argument as a machine-checked
 *     invariant.
 *
 * Sorting additionally carries the information-theoretic gate: a correct
 * sorting tree sends the n! permutations to distinct leaves (verified as
 * data by the sweep), so 2^q >= n! exactly (BigInt) — q >= ceil(log2(n!)).
 * For find-max the same counting gives only q >= ceil(log2 n) (n possible
 * maxima, n leaves) — the gap between ceil(log2 n) and n-1 is exactly why
 * the adversary leg exists, and the sweep holds the weak bound as data.
 */

// --- permutations --------------------------------------------------------------------------

/** All n! rank assignments: perm[i] = the value of a_i. */
export function allPerms(n: number): number[][] {
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    throw new Error(`allPerms: n must be an integer in [1,8] (got ${n}) — the permutation product is the budget`);
  }
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(i);
  const out: number[][] = [];
  const rec = (k: number): void => {
    if (k === n) {
      out.push([...vals]);
      return;
    }
    for (let i = k; i < n; i++) {
      const t = vals[i]!;
      vals[i] = vals[k]!;
      vals[k] = t;
      rec(k + 1);
      const t2 = vals[i]!;
      vals[i] = vals[k]!;
      vals[k] = t2;
    }
  };
  rec(0);
  return out;
}

const argmax = (p: readonly number[]): number => {
  let m = 0;
  for (let i = 1; i < p.length; i++) if (p[i]! > p[m]!) m = i;
  return m;
};

// --- LEG A: the flat sweep -----------------------------------------------------------------

export interface MaxTreeAudit {
  readonly n: number;
  readonly depth: number;
  readonly correct: boolean;
  /** the leaf whose perm set carries two different true maxima (null when correct) */
  readonly inconsistentLeaf: number | null;
  /** a permutation reaching that leaf whose true max contradicts the leaf's first perm (null when correct) */
  readonly wrongPerm: readonly number[] | null;
  readonly trueMaxOfWrong: number | null;
  /** the max the leaf's first perm had (the forgery's claim), null when correct */
  readonly leafClaimedMax: number | null;
  readonly reachedLeaves: number;
}

/**
 * Audit a flat find-max tree: walk every permutation to its leaf; the tree
 * is correct iff every reached leaf sees a single true maximum. The first
 * inconsistent leaf is NAMED with a wrong permutation — the conviction the
 * smuggling trials read out.
 */
export function auditMaxTree(n: number, ask: ReadonlyArray<readonly [number, number]>): MaxTreeAudit {
  const depth = checkAsk(n, ask);
  const nodes = 2 ** depth - 1;
  const leaves = 2 ** depth;
  const perms = allPerms(n);
  const leafMax = new Array<number>(leaves).fill(-1);
  let reached = 0;
  for (const p of perms) {
    let v = 0;
    for (let d = 0; d < depth; d++) {
      const [i, j] = ask[v]!;
      v = p[i]! < p[j]! ? 2 * v + 1 : 2 * v + 2;
    }
    const leaf = v - nodes;
    if (leafMax[leaf] === -1) {
      leafMax[leaf] = argmax(p);
      reached++;
    } else if (leafMax[leaf]! !== argmax(p)) {
      return {
        n,
        depth,
        correct: false,
        inconsistentLeaf: leaf,
        wrongPerm: p,
        trueMaxOfWrong: argmax(p),
        leafClaimedMax: leafMax[leaf]!,
        reachedLeaves: reached,
      };
    }
  }
  return { n, depth, correct: true, inconsistentLeaf: null, wrongPerm: null, trueMaxOfWrong: null, leafClaimedMax: null, reachedLeaves: reached };
}

export interface SortTreeAudit {
  readonly n: number;
  readonly depth: number;
  readonly correct: boolean;
  readonly inconsistentLeaf: number | null;
  /** two distinct permutations that reached the same leaf (null when correct) */
  readonly wrongPerm: readonly number[] | null;
  readonly leafFirstPerm: readonly number[] | null;
  readonly reachedLeaves: number;
}

/** Audit a flat sorting tree: correct iff every reached leaf sees exactly one permutation. */
export function auditSortTree(n: number, ask: ReadonlyArray<readonly [number, number]>): SortTreeAudit {
  const depth = checkAsk(n, ask);
  const nodes = 2 ** depth - 1;
  const leaves = 2 ** depth;
  const perms = allPerms(n);
  const first = new Array<number[] | null>(leaves).fill(null);
  let reached = 0;
  for (const p of perms) {
    let v = 0;
    for (let d = 0; d < depth; d++) {
      const [i, j] = ask[v]!;
      v = p[i]! < p[j]! ? 2 * v + 1 : 2 * v + 2;
    }
    const leaf = v - nodes;
    if (first[leaf] === null) {
      first[leaf] = p;
      reached++;
    } else if (first[leaf]!.some((x, k) => x !== p[k])) {
      return { n, depth, correct: false, inconsistentLeaf: leaf, wrongPerm: p, leafFirstPerm: first[leaf]!, reachedLeaves: reached };
    }
  }
  return { n, depth, correct: true, inconsistentLeaf: null, wrongPerm: null, leafFirstPerm: null, reachedLeaves: reached };
}

/** Shared shape guard for the flat ask array — the refusal is by description, per house style. */
function checkAsk(n: number, ask: ReadonlyArray<readonly [number, number]>): number {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(`comparison tree: n must be an integer in [2,8] (got ${n})`);
  }
  if (!Number.isInteger(Math.log2(ask.length + 1))) {
    throw new Error(`comparison tree: ask length ${ask.length} is not 2^depth - 1`);
  }
  const depth = Math.round(Math.log2(ask.length + 1));
  for (const [i, j] of ask) {
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= n || j >= n) {
      throw new Error(`comparison tree: pair (${i},${j}) outside [0,${n})`);
    }
    if (i === j) {
      throw new Error(`comparison tree: pair (${i},${i}) compares an element with itself — no information exists`);
    }
    if (i > j) {
      throw new Error(`comparison tree: pair (${i},${j}) is not canonically oriented (i < j)`);
    }
  }
  return depth;
}

export interface SweepResult {
  readonly n: number;
  readonly q: number;
  readonly trees: number; // complete internal assignments enumerated
  readonly correct: number; // trees correct on all n! inputs
  /**
   * The counting bound, verified as data: every correct tree reaches at
   * least `minLeaves` leaves — n for find-max (each possible maximum needs
   * its own leaf: q >= ceil(log2 n), the WEAK bound), n! for sorting (each
   * permutation needs its own leaf: q >= ceil(log2 n!), the information
   * bound). The adversary leg is what lifts find-max from the weak bound
   * to n-1 — the gap the two numbers expose.
   */
  readonly correctAllLeafSeparated: boolean;
}

/** LEG A for find-max: enumerate ALL depth-q trees (canonical orientation i<j). */
export function exhaustiveMaxSweep(n: number, q: number): SweepResult {
  guardSweep(n, q);
  const pairs = allPairs(n);
  const ask = new Array<[number, number]>(2 ** q - 1).fill([0, 1]);
  let trees = 0;
  let correct = 0;
  let correctAllLeafSeparated = true;
  const rec = (v: number): void => {
    if (v === 2 ** q - 1) {
      trees++;
      const audit = auditMaxTree(n, ask);
      if (audit.correct) {
        correct++;
        if (audit.reachedLeaves < n) correctAllLeafSeparated = false;
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

/** LEG A for sorting: same enumeration, judged by the injectivity audit. */
export function exhaustiveSortSweep(n: number, q: number): SweepResult {
  guardSweep(n, q);
  const pairs = allPairs(n);
  const ask = new Array<[number, number]>(2 ** q - 1).fill([0, 1]);
  let trees = 0;
  let correct = 0;
  let correctAllLeafSeparated = true;
  const rec = (v: number): void => {
    if (v === 2 ** q - 1) {
      trees++;
      const audit = auditSortTree(n, ask);
      if (audit.correct) {
        correct++;
        if (audit.reachedLeaves < factorialSmall(n)) correctAllLeafSeparated = false;
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

function guardSweep(n: number, q: number): void {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(`exhaustive sweep: n must be an integer in [2,8] (got ${n})`);
  }
  if (!Number.isInteger(q) || q < 0 || q > 6) {
    throw new Error(`exhaustive sweep: q must be an integer in [0,6] (got ${q}) — the tree count is C(n,2)^(2^q-1)`);
  }
}

function allPairs(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

function factorialSmall(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// --- LEG B: the game-tree DFS on partial orders --------------------------------------------

type Reach = boolean[][]; // reach[i][j] = the transcript proves a_i < a_j

const initialReach = (n: number): Reach => Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

const cloneReach = (r: Reach): Reach => r.map((row) => [...row]);

const keyOf = (r: Reach): string => r.map((row) => row.map((b) => (b ? "1" : "0")).join("")).join("/");

/** Add the edge i < j with transitive closure (fresh copy). */
function withEdge(r: Reach, i: number, j: number): Reach {
  const n = r.length;
  const out = cloneReach(r);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      if (!out[x]![y]! && (x === i || r[x]![i]!) && (y === j || r[j]![y]!)) out[x]![y] = true;
    }
  }
  return out;
}

const uniqueMax = (r: Reach): boolean => {
  const n = r.length;
  outer: for (let m = 0; m < n; m++) {
    for (let x = 0; x < n; x++) if (x !== m && !r[x]![m]!) continue outer;
    return true;
  }
  return false;
};

const totalOrder = (r: Reach): boolean => {
  const n = r.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && !r[i]![j]! && !r[j]![i]!) return false;
  return true;
};

/**
 * "A correct tree of depth <= budget exists from this state": the algorithm
 * picks a comparison among INCOMPARABLE pairs — a comparison whose answer
 * the transcript already determines cannot help (its forced branch repeats
 * the state at cost one, its free branch is unreachable), so restricting
 * to informative pairs is a sound dominance pruning, cross-checked by the
 * flat sweep at small n — and the input picks the answer: BOTH branches
 * must win.
 */
function winFindMax(r: Reach, budget: number, memo: Map<string, boolean>): boolean {
  if (uniqueMax(r)) return true;
  if (budget === 0) return false;
  const key = `${budget}:${keyOf(r)}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const n = r.length;
  let result = false;
  for (let i = 0; i < n && !result; i++) {
    for (let j = i + 1; j < n && !result; j++) {
      if (r[i]![j]! || r[j]![i]!) continue; // already comparable — uninformative
      if (winFindMax(withEdge(r, i, j), budget - 1, memo) && winFindMax(withEdge(r, j, i), budget - 1, memo)) result = true;
    }
  }
  memo.set(key, result);
  return result;
}

function winSort(r: Reach, budget: number, memo: Map<string, boolean>): boolean {
  if (totalOrder(r)) return true;
  if (budget === 0) return false;
  const key = `${budget}:${keyOf(r)}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const n = r.length;
  let result = false;
  for (let i = 0; i < n && !result; i++) {
    for (let j = i + 1; j < n && !result; j++) {
      if (r[i]![j]! || r[j]![i]!) continue;
      if (winSort(withEdge(r, i, j), budget - 1, memo) && winSort(withEdge(r, j, i), budget - 1, memo)) result = true;
    }
  }
  memo.set(key, result);
  return result;
}

export interface OptimumResult {
  readonly n: number;
  readonly optimum: number; // the exact minimal depth of a correct tree
  readonly statesExplored: number;
}

/** LEG B for find-max: the exact optimum, n <= 7 within test budgets. */
export function findMaxOptimalDepth(n: number): OptimumResult {
  if (!Number.isInteger(n) || n < 2 || n > 7) {
    throw new Error(`findMaxOptimalDepth: n must be an integer in [2,7] (got ${n})`);
  }
  const memo = new Map<string, boolean>();
  const r0 = initialReach(n);
  for (let q = 0; q <= n; q++) {
    if (winFindMax(r0, q, memo)) return { n, optimum: q, statesExplored: memo.size };
  }
  throw new Error("findMaxOptimalDepth: unreachable — n comparisons always suffice");
}

/** LEG B for sorting: the exact optimum, n <= 5 within test budgets. */
export function sortingOptimalDepth(n: number): OptimumResult {
  if (!Number.isInteger(n) || n < 2 || n > 5) {
    throw new Error(`sortingOptimalDepth: n must be an integer in [2,5] (got ${n}) — the partial-order state space is the budget`);
  }
  const memo = new Map<string, boolean>();
  const r0 = initialReach(n);
  const ceiling = sortingInfoBound(n).ceilingLog2Fact + 2; // info bound + slack for the search cap
  for (let q = 0; q <= ceiling; q++) {
    if (winSort(r0, q, memo)) return { n, optimum: q, statesExplored: memo.size };
  }
  throw new Error("sortingOptimalDepth: unreachable — insertion sort sorts in n(n-1)/2");
}

// --- LEG C: the adversary ------------------------------------------------------------------

export interface AdversaryWitness {
  readonly candidate: number; // an undefeated element
  readonly order: readonly number[]; // a total order consistent with EVERY answer, candidate last
}

export interface AdversaryRecord {
  readonly n: number;
  readonly k: number;
  /** the comparisons as played, canonically oriented (min,max) — the answers' frame */
  readonly plays: ReadonlyArray<readonly [number, number]>;
  readonly answers: readonly boolean[]; // per comparison: true = "a_i < a_j" for the canonical pair
  /** after every step, no undefeated element has an outgoing path (it can still be the max) */
  readonly invariantHeld: boolean;
  readonly undefeated: readonly number[]; // size >= n - k
  readonly witnesses: readonly AdversaryWitness[];
}

function invariantOk(r: Reach, defeated: readonly boolean[]): boolean {
  for (let u = 0; u < r.length; u++) {
    if (defeated[u]) continue;
    for (let x = 0; x < r.length; x++) if (r[u]![x]!) return false; // a_u < a_x proven — u cannot be the max
  }
  return true;
}

/** Topological order of the DAG with `u` forced last (u is a sink — invariant). */
function topoWithLast(r: Reach, u: number): number[] {
  const n = r.length;
  const done = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  for (let round = 0; round < n; round++) {
    // pick any element whose predecessors-in-DAG are all placed; never pick u until it is the only one left
    let picked = -1;
    for (let x = 0; x < n; x++) {
      if (done[x] || x === u) continue;
      let ready = true;
      for (let y = 0; y < n; y++) if (!done[y] && y !== x && r[y]![x]!) ready = false;
      if (ready) {
        picked = x;
        break;
      }
    }
    if (picked === -1) {
      // only u remains (or the residual graph among others is a DAG with u as sink — same thing)
      break;
    }
    done[picked] = true;
    order.push(picked);
  }
  for (let x = 0; x < n; x++) if (!done[x]) order.push(x); // u lands last; any straggler would break acyclicity, which the verifier catches
  return order;
}

/**
 * The adversary for find-max, at any n: answers follow the transcript when
 * it already decides the pair (a repeated comparison must not flip), and
 * otherwise the undefeated element wins — when both are undefeated exactly
 * one is eliminated, and a fresh edge only ever joins incomparable elements,
 * so the transcript stays acyclic. After k comparisons >= n-k elements
 * remain undefeated, each with a witness total order consistent with every
 * answer in which it is the maximum.
 */
export function adversaryFindMax(n: number, comparisons: ReadonlyArray<readonly [number, number]>): AdversaryRecord {
  if (!Number.isInteger(n) || n < 2 || n > 12) {
    throw new Error(`adversaryFindMax: n must be an integer in [2,12] (got ${n})`);
  }
  const r = initialReach(n);
  const defeated = new Array<boolean>(n).fill(false);
  const plays: Array<[number, number]> = [];
  const answers: boolean[] = [];
  let invariantHeld = true;
  for (const [i0, j0] of comparisons) {
    const i = Math.min(i0, j0);
    const j = Math.max(i0, j0);
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j >= n || i === j) {
      throw new Error(`adversaryFindMax: comparison (${i0},${j0}) is not a pair of distinct elements in [0,${n})`);
    }
    plays.push([i, j]);
    let less: boolean; // the answer to "a_i < a_j?"
    if (r[i]![j]!) {
      less = true; // forced by the transcript (repeated comparisons must not flip)
    } else if (r[j]![i]!) {
      less = false; // forced by the transcript
    } else if (!defeated[i] && !defeated[j]) {
      less = true; // arbitrary but fixed: j survives this duel, i is eliminated
      defeated[i] = true; // exactly one elimination
    } else if (!defeated[i] && defeated[j]) {
      less = false; // the undefeated i wins: a_j < a_i, so "a_i < a_j?" is NO
    } else if (defeated[i] && !defeated[j]) {
      less = true; // the undefeated j wins: a_i < a_j
    } else {
      less = true; // both defeated, incomparable: fresh edge i -> j — acyclic by construction
    }
    // add the oriented edge with closure (loser -> winner), consistency guaranteed by the invariant
    const e0 = less ? i : j; // the smaller element
    const e1 = less ? j : i; // the larger element — edge e0 -> e1
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        if (!r[x]![y]! && (x === e0 || r[x]![e0]!) && (y === e1 || r[e1]![y]!)) r[x]![y] = true;
      }
    }
    answers.push(less);
    if (!invariantOk(r, defeated)) invariantHeld = false;
  }
  const undefeated: number[] = [];
  for (let u = 0; u < n; u++) if (!defeated[u]) undefeated.push(u);
  const witnesses: AdversaryWitness[] = undefeated.map((u) => ({ candidate: u, order: topoWithLast(r, u) }));
  return { n, k: comparisons.length, plays, answers, invariantHeld, undefeated, witnesses };
}

export interface AdversarySweep {
  readonly n: number;
  readonly k: number;
  readonly sequences: number; // every adaptive strategy's play (choices at each step cover all adaptivity)
  readonly allInvariantsHeld: boolean;
  readonly allWitnessesValid: boolean;
  readonly minUndefeated: number;
}

/** LEG C exhaustive: play EVERY adaptive strategy of k comparisons against the adversary. */
export function adversarySweepAllSequences(n: number, k: number): AdversarySweep {
  if (!Number.isInteger(n) || n < 2 || n > 8) {
    throw new Error(`adversarySweepAllSequences: n must be an integer in [2,8] (got ${n})`);
  }
  if (!Number.isInteger(k) || k < 0 || k > 5) {
    throw new Error(`adversarySweepAllSequences: k must be an integer in [0,5] (got ${k}) — C(n,2)^k sequences`);
  }
  const pairs = allPairs(n);
  const seq: Array<[number, number]> = [];
  let sequences = 0;
  let allInvariantsHeld = true;
  let allWitnessesValid = true;
  let minUndefeated = n;
  const rec = (t: number): void => {
    if (t === k) {
      sequences++;
      const record = adversaryFindMax(n, seq);
      if (!record.invariantHeld) allInvariantsHeld = false;
      if (record.undefeated.length < minUndefeated) minUndefeated = record.undefeated.length;
      if (!witnessesSelfCheck(record)) allWitnessesValid = false;
      return;
    }
    for (const pr of pairs) {
      seq.push(pr);
      rec(t + 1);
      seq.pop();
    }
  };
  rec(0);
  return { n, k, sequences, allInvariantsHeld, allWitnessesValid, minUndefeated };
}

/** The self-check every record must pass: each witness satisfies every answer (in canonical orientation) and crowns its candidate. */
function witnessesSelfCheck(rec: AdversaryRecord): boolean {
  if (!rec.invariantHeld) return false;
  if (rec.undefeated.length < rec.n - rec.k) return false;
  for (const w of rec.witnesses) {
    if (w.order.length !== rec.n || new Set(w.order).size !== rec.n) return false;
    const pos = new Map<number, number>(w.order.map((x, idx) => [x, idx]));
    for (let t = 0; t < rec.answers.length; t++) {
      const pr = rec.plays[t]!;
      const less = rec.answers[t]!;
      const i = pr[0];
      const j = pr[1];
      if (less !== (pos.get(i)! < pos.get(j)!)) return false;
    }
    if (w.order[w.order.length - 1] !== w.candidate) return false;
  }
  return true;
}

// --- the sorting information gate ------------------------------------------------------------

export interface InfoBound {
  readonly n: number;
  readonly fact: bigint; // n!
  readonly ceilingLog2Fact: number; // min q with 2^q >= n!
  readonly pow2: bigint; // 2^ceilingLog2Fact
}

/** The leaf-counting gate: a correct sorting tree has >= n! reached leaves and <= 2^q leaves total. */
export function sortingInfoBound(n: number): InfoBound {
  if (!Number.isInteger(n) || n < 2 || n > 20) {
    throw new Error(`sortingInfoBound: n must be an integer in [2,20] (got ${n})`);
  }
  let fact = 1n;
  for (let i = 2n; i <= BigInt(n); i++) fact *= i;
  let q = 0;
  let pow2 = 1n;
  while (pow2 < fact) {
    pow2 *= 2n;
    q++;
  }
  return { n, fact, ceilingLog2Fact: q, pow2 };
}

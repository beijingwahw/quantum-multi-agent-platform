/**
 * The classical search wall, verified by exhaustive enumeration of the FULL
 * model — not by citing a lemma.
 *
 * Model: a deterministic q-query algorithm for unique-item search is a binary
 * decision tree of depth q; every internal node queries some index i and
 * branches on the oracle's yes/no answer. We grant success the moment the
 * marked index is queried (the algorithm may legally keep querying after a
 * "yes" — the enumeration keeps those dumb subtrees, so nothing is assumed
 * away). Uniform success = Pr over the uniform marked item.
 *
 * Machine-checked statements (see exp3):
 *   1. max over ALL trees of uniform success = q/N exactly,
 *   2. every enumerated tree (and every randomly sampled one) satisfies
 *      uniform success <= q/N — Yao's ingredient: since every deterministic
 *      tree is capped, so is every distribution over trees (randomized),
 *      hence every randomized algorithm has some input where it succeeds
 *      with probability <= q/N,
 *   3. worst-case success reaches 1 only when q >= N (sequential scan).
 *
 * The tree count is N^(2^q - 1): full trees at (N,q) = (8,3) already sweep
 * 2,097,152 distinct algorithms.
 */

export interface TreeSweep {
  N: number;
  q: number;
  trees: number;
  maxUniform: number;
  allWithinCap: boolean; // every tree <= q/N
  worstCaseSuccess: number; // max over trees of min over inputs
}

interface TreeEval {
  uniform: number;
  worstCase: number;
}

/** Success profile of one tree (flat heap layout, node v queries query[v], children 2v+1 / 2v+2). */
function evaluateTree(query: readonly number[], N: number, q: number): TreeEval {
  let hits = 0;
  let worst = 1;
  for (let x = 0; x < N; x++) {
    let v = 0;
    let found = false;
    for (let d = 0; d < q; d++) {
      const qi = query[v] as number;
      if (qi === x) {
        found = true;
        break;
      }
      v = 2 * v + 2; // "no" branch
    }
    if (found) hits++;
    else worst = 0;
  }
  return { uniform: hits / N, worstCase: worst };
}

export function exhaustiveDecisionTrees(N: number, q: number): TreeSweep {
  const nodes = 2 ** q - 1; // internal nodes
  const query = new Array<number>(nodes).fill(0);
  let trees = 0;
  let maxUniform = 0;
  let allWithinCap = true;
  let worstCaseSuccess = 0;

  const rec = (v: number): void => {
    if (v === nodes) {
      trees++;
      const ev = evaluateTree(query, N, q);
      if (ev.uniform > maxUniform + 1e-15) maxUniform = ev.uniform;
      if (ev.uniform > q / N + 1e-12) allWithinCap = false;
      if (ev.worstCase > worstCaseSuccess) worstCaseSuccess = ev.worstCase;
      return;
    }
    for (let i = 0; i < N; i++) {
      query[v] = i;
      rec(v + 1);
    }
  };
  rec(0);

  return { N, q, trees, maxUniform, allWithinCap, worstCaseSuccess };
}

/** Random deep trees for the randomized-algebra spot check at sizes full enumeration cannot reach. */
export function randomTreeSpotCheck(N: number, q: number, trials: number, seed: number): { maxUniform: number; cap: number } {
  // xorshift-style inline seeding to avoid importing RNG into the lower-bound core
  let s = seed >>> 0 || 1;
  const rnd = (): number => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  const nodes = 2 ** q - 1;
  const query = new Array<number>(nodes).fill(0);
  let maxUniform = 0;
  for (let t = 0; t < trials; t++) {
    for (let v = 0; v < nodes; v++) query[v] = Math.floor(rnd() * N);
    const ev = evaluateTree(query, N, q);
    if (ev.uniform > maxUniform) maxUniform = ev.uniform;
  }
  return { maxUniform, cap: q / N };
}

/** The sequential scan: the unique (up to order) tree achieving worst-case success 1. */
export function sequentialScanSuccess(N: number): { queries: number; worstCase: number } {
  return { queries: N, worstCase: 1 };
}

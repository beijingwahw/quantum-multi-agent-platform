/**
 * R21-xi preverify — bqp-map B2 (R18/agentH.md): min&max exact optimum,
 * spec closed form ceil(3n/2) - 2, spec note "n=2 special case 3 comparisons".
 * SPEC-AS-ASSUMPTION: quick DFS on partial orders; terminal = unique max AND
 * unique min both determined.
 */

interface Reach {
  r: boolean[][];
}

const initial = (n: number): boolean[][] =>
  Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

const withEdge = (r: boolean[][], i: number, j: number): boolean[][] => {
  const n = r.length;
  const out = r.map((row) => [...row]);
  for (let x = 0; x < n; x++)
    for (let y = 0; y < n; y++)
      if (!out[x]![y]! && (x === i || r[x]![i]!) && (y === j || r[j]![y]!))
        out[x]![y] = true;
  return out;
};

const keyOf = (r: boolean[][]): string =>
  r.map((row) => row.map((b) => (b ? "1" : "0")).join("")).join("/");

const uniqueMax = (r: boolean[][]): number => {
  const n = r.length;
  outer: for (let m = 0; m < n; m++) {
    for (let x = 0; x < n; x++) if (x !== m && !r[x]![m]!) continue outer;
    return m;
  }
  return -1;
};

const uniqueMin = (r: boolean[][]): number => {
  const n = r.length;
  outer: for (let m = 0; m < n; m++) {
    for (let x = 0; x < n; x++) if (x !== m && !r[m]![x]!) continue outer;
    return m;
  }
  return -1;
};

const determined = (r: boolean[][]): boolean =>
  uniqueMax(r) !== -1 && uniqueMin(r) !== -1;

const win = (r: boolean[][], budget: number, memo: Map<string, boolean>): boolean => {
  if (determined(r)) return true;
  if (budget === 0) return false;
  const key = `${budget}:${keyOf(r)}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const n = r.length;
  let result = false;
  for (let i = 0; i < n && !result; i++)
    for (let j = i + 1; j < n && !result; j++) {
      if (r[i]![j]! || r[j]![i]!) continue;
      if (win(withEdge(r, i, j), budget - 1, memo) && win(withEdge(r, j, i), budget - 1, memo))
        result = true;
    }
  memo.set(key, result);
  return result;
};

const ceilHalf = (n: number): number => Math.ceil((3 * n) / 2) - 2;

for (let n = 2; n <= 6; n++) {
  const memo = new Map<string, boolean>();
  let q = 0;
  while (!win(initial(n), q, memo)) q++;
  console.log(
    `n=${n}: DFS optimum=${q} closedForm=${ceilHalf(n)} match=${q === ceilHalf(n)} states=${memo.size}`,
  );
}
console.log(`n=2 special: closed form gives ${ceilHalf(2)} (spec prose said 3 — machine rules ${ceilHalf(2)})`);
console.log(`odd/even split: n=5 -> ${ceilHalf(5)} (=(3n-3)/2), n=6 -> ${ceilHalf(6)} (=3n/2-2)`);
console.log("PREVERIFY-B2 DONE");

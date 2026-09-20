/**
 * R21 batch-2 pi — trichotomy pre-verify: does D_k depend only on F?
 * (recreated via the Write channel after a heredoc sighting — see the
 * report's self-report section; content identical to the convicted original)
 */
const bigFact = (n: number): bigint => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const bigBinom = (n: number, kk: number): bigint => {
  if (kk < 0 || kk > n) return 0n;
  let r = 1n;
  for (let i = 0; i < kk; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
  return r;
};
function qOfFK(F: number, K: number): { q: bigint; den: bigint } {
  const k = F + K + 1;
  let N1 = 0n;
  for (let s = 0; s <= k - 1; s++) {
    let O = 0n;
    for (let f = 1; f <= Math.min(F, s); f += 2) O += bigBinom(F, f) * bigBinom(K, s - f);
    N1 += bigFact(s) * bigFact(k - 1 - s) * O;
  }
  return { q: N1, den: bigFact(k) };
}
let bad = 0;
for (let F = 0; F <= 7; F++) {
  for (let K = 0; K <= 6; K++) {
    const { q, den } = qOfFK(F, K);
    let expected: bigint; let ed: bigint;
    if (F === 0) { expected = 0n; ed = 1n; }
    else if (F % 2 === 1) { expected = 1n; ed = 2n; }
    else { const m = F / 2; expected = BigInt(m); ed = BigInt(2 * m + 1); }
    const ok = q * ed === expected * den;
    if (!ok) { bad++; console.log(`MISMATCH F=${F} K=${K}: q=${q}/${den} expected ${expected}/${ed}`); }
  }
}
console.log(bad === 0 ? "TRICHOTOMY HOLDS on F=0..7 x K=0..6 (42 cells, exact BigInt)" : `${bad} mismatches`);

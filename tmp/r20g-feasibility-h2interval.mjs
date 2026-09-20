// R20 γ 规格即假设 · depreciation-ledger F9（h₂(1/40) 精确区间证书）仓外机器验证。
// 规格断言（R18 agentF §三 F5-b）：
//  X1 ln(41/40) = 2·artanh(1/81)（正项级数 + 几何尾界，BigInt）
//  X2 ln(39/40) = −2·artanh(1/79)
//  X3 h₂(1/40) 的 BigInt 区间证书 U−L < 1e-15，与 W-E 浮点 0.168661 相容
//  X4 两条独立收敛路（artanh vs ln(1+x) 交错级数）区间重叠
//  X5 负对照：漏尾界的部分和定罪（区间不包含真值）
// BigInt 分数 {n|d}，d>0；区间 {lo,hi}。

const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t; } return a; };
const fr = (n, d = 1n) => { const s = d < 0n ? -1n : 1n; const dd = d < 0n ? -d : d; const g = gcd(n, dd) || 1n; return { n: (s * n) / g, d: dd / g }; };
const fAdd = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a, b) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a, b) => fr(a.n * b.n, a.d * b.d);
const fCmp = (a, b) => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; };
const fToNum = (a) => Number(a.n) / Number(a.d);

/** artanh(p/q) 的严格区间：S_K = Σ_{k=0..K} x^{2k+1}/(2k+1)，尾界
 *  R_K = x^{2K+3}/((2K+3)(1−x²)) （正项递减，几何支配）。返回 [S, S+R]。 */
function artanhIvl(num, den, K) {
  const x2 = fr(num * num, den * den);
  let S = fr(0n);
  let term = fr(num, den); // x^{2k+1} at k=0
  for (let k = 0; k <= K; k++) {
    S = fAdd(S, fr(term.n, term.d * BigInt(2 * k + 1)));
    term = fMul(term, x2);
  }
  // R_K = term(k=K+1 head) / (1 − x²)，其中 term 已推进到 x^{2K+3}
  const tailHead = fr(term.n, term.d * BigInt(2 * K + 3));
  const geom = fSub(fr(1n), x2);
  const R = fMul(tailHead, fr(geom.d, geom.n));
  return { lo: S, hi: fAdd(S, R) };
}

/** ln(1+x) 交错级数（x=p/q>0）：S_{2m+1} 为上界、S_{2m} 为下界（Leibniz）。 */
function ln1pAltIvl(num, den, m) {
  const x = fr(num, den);
  let S = fr(0n);
  let term = x; // x^k
  for (let k = 1; k <= 2 * m + 1; k++) {
    S = k % 2 === 1 ? fAdd(S, fr(term.n, term.d * BigInt(k))) : fSub(S, fr(term.n, term.d * BigInt(k)));
    term = fMul(term, x);
  }
  // S_{2m+1} 是上界；下界 = S_{2m+1} − x^{2m+2}/(2m+2)
  const drop = fr(term.n, term.d * BigInt(2 * m + 2));
  return { lo: fSub(S, drop), hi: S };
}

/** ln(1−x) 负项级数（x=p/q, 0<x<1）：ln(1−x) = −Σx^k/k；部分和 > 真值；
 *  下界 = S − R，R = x^{K+1}/((K+1)(1−x))。返回 −ln(1−x) 的区间（正数）。 */
function negLn1mIvl(num, den, K) {
  const x = fr(num, den);
  let S = fr(0n);
  let term = x;
  for (let k = 1; k <= K; k++) {
    S = fAdd(S, fr(term.n, term.d * BigInt(k)));
    term = fMul(term, x);
  }
  const tailHead = fr(term.n, term.d * BigInt(K + 1));
  const geom = fSub(fr(1n), x);
  const R = fMul(tailHead, fr(geom.d, geom.n));
  return { lo: S, hi: fAdd(S, R) };
}

// 诚实的正区间乘/除（四积取 min/max）
function mulPos(a, b) {
  const c1 = fMul(a.lo, b.lo), c2 = fMul(a.lo, b.hi), c3 = fMul(a.hi, b.lo), c4 = fMul(a.hi, b.hi);
  const lo = [c1, c2, c3, c4].reduce((u, v) => (fCmp(v, u) < 0 ? v : u));
  const hi = [c1, c2, c3, c4].reduce((u, v) => (fCmp(v, u) > 0 ? v : u));
  return { lo, hi };
}
function divPos(a, b) {
  const c1 = fDiv(a.lo, b.hi), c2 = fDiv(a.hi, b.lo);
  return { lo: fCmp(c1, c2) < 0 ? c1 : c2, hi: fCmp(c1, c2) > 0 ? c1 : c2 };
}
function fDiv(a, b) { return fr(a.n * b.d, a.d * b.n); }
function width(a) { return fSub(a.hi, a.lo); }
function overlap(a, b) { return fCmp(a.hi, b.lo) >= 0 && fCmp(b.hi, a.lo) >= 0; }
function intersect(a, b) { return { lo: fCmp(a.lo, b.lo) > 0 ? a.lo : b.lo, hi: fCmp(a.hi, b.hi) < 0 ? a.hi : b.hi }; }
function contains(a, xNum) { const l = a.lo.n * a.lo.d < 0 ? -a.lo.n * a.lo.d : a.lo.n * a.lo.d; void l; const f = { n: BigInt(Math.round(xNum * 1e15)), d: 1000000000000000n }; return fCmp(f, a.lo) >= 0 && fCmp(f, a.hi) <= 0; }

// ---- 路线 1：artanh ----
// ln2 = 2A(1/3), ln(5/4) = 2A(1/9), ln(40/39) = 2A(1/79), ln(41/40) = 2A(1/81)
const ln2R1 = { lo: fMul(fr(2n), artanhIvl(1n, 3n, 30).lo), hi: fMul(fr(2n), artanhIvl(1n, 3n, 30).hi) };
const ln54R1 = { lo: fMul(fr(2n), artanhIvl(1n, 9n, 12).lo), hi: fMul(fr(2n), artanhIvl(1n, 9n, 12).hi) };
const ln4039R1 = { lo: fMul(fr(2n), artanhIvl(1n, 79n, 6).lo), hi: fMul(fr(2n), artanhIvl(1n, 79n, 6).hi) };
const ln4140R1 = { lo: fMul(fr(2n), artanhIvl(1n, 81n, 6).lo), hi: fMul(fr(2n), artanhIvl(1n, 81n, 6).hi) };

// ---- 路线 2：ln(1−x)/交错 ----
const ln2R2 = negLn1mIvl(1n, 2n, 80);       // ln2 = −ln(1−1/2)
const ln54R2 = ln1pAltIvl(1n, 4n, 20);      // ln(5/4) = ln(1+1/4)
const ln4039R2 = ln1pAltIvl(1n, 39n, 8);    // ln(40/39) = ln(1+1/39)
const ln4140R2 = ln1pAltIvl(1n, 40n, 8);    // ln(41/40) = ln(1+1/40)

console.log("[X1/X4 逐对数] 路线重叠与宽度（十进制）:");
for (const [nm, a, b] of [
  ["ln2", ln2R1, ln2R2], ["ln(5/4)", ln54R1, ln54R2], ["ln(40/39)", ln4039R1, ln4039R2], ["ln(41/40)", ln4140R1, ln4140R2],
]) {
  console.log(`  ${nm}: R1=[${fToNum(a.lo).toPrecision(18)}, ${fToNum(a.hi).toPrecision(18)}] w=${Number(width(a).n) / Number(width(a).d).toExponential(2)} R2=[${fToNum(b.lo).toPrecision(18)}, ${fToNum(b.hi).toPrecision(18)}] overlap=${overlap(a, b)}`);
}

// h₂(1/40) = (1/40)·log₂40 + (39/40)·log₂(40/39)，log₂40 = (5·ln2 + ln(5/4))/ln2
function h2ivl(ln2, ln54, ln4039) {
  const five = fr(5n);
  const ln40 = { lo: fAdd(fMul(five, ln2.lo), ln54.lo), hi: fAdd(fMul(five, ln2.hi), ln54.hi) };
  const log2_40 = divPos(ln40, ln2);
  const log2_4039 = divPos(ln4039, ln2);
  const t1 = mulPos({ lo: fr(1n, 40n), hi: fr(1n, 40n) }, log2_40);
  const t2 = mulPos({ lo: fr(39n, 40n), hi: fr(39n, 40n) }, log2_4039);
  return { lo: fAdd(t1.lo, t2.lo), hi: fAdd(t1.hi, t2.hi) };
}
const h2R1 = h2ivl(ln2R1, ln54R1, ln4039R1);
const h2R2 = h2ivl(ln2R2, ln54R2, ln4039R2);
const both = intersect(h2R1, h2R2);
const wNum = Number(width(both).n) / Number(width(both).d);
const floatH2 = -(1 / 40) * Math.log2(1 / 40) - (39 / 40) * Math.log2(39 / 40);
console.log(`[X3] h2(1/40): R1=[${fToNum(h2R1.lo).toPrecision(18)},${fToNum(h2R1.hi).toPrecision(18)}] R2=[${fToNum(h2R2.lo).toPrecision(18)},${fToNum(h2R2.hi).toPrecision(18)}]`);
console.log(`[X3] 交集宽度 = ${wNum.toExponential(3)} (<1e-15 要求: ${wNum < 1e-15}); float 值 ${floatH2.toPrecision(18)} 在交集内: ${contains(both, floatH2)}`);
console.log(`[X3] W-E 六位对账: mid=${((fToNum(both.lo) + fToNum(both.hi)) / 2).toFixed(6)} (ledger 行 0.168661); 宽度余量 ${(1e-15 / wNum).toExponential(1)}x`);

// ---- X5 负对照：漏尾界 ----
{
  // K=2 的 artanh(1/3) 部分和当作 ln2/2 的「区间」（degenerate [S,S]）
  const partial = artanhIvl(1n, 3n, 2).lo; // 部和本身
  const fake = { lo: partial, hi: partial };
  const trueLn2 = 0.6931471805599453;
  console.log(`[X5] 漏尾界（K=2）: 部分和 ${fToNum(fMul(fr(2n), partial)).toPrecision(10)} vs ln2 ${trueLn2} — 不含真值: ${!contains(fake, trueLn2)}（差 ${Math.abs(fToNum(fMul(fr(2n), partial)) - trueLn2).toExponential(2)}）`);
}
// 术语数与机器成本
console.time("bigint-cost");
for (let i = 0; i < 50; i++) h2ivl(ln2R1, ln54R1, ln4039R1);
console.timeEnd("bigint-cost");

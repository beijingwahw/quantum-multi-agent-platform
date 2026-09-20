// debug the (3)/(5) failures: is p_V wrong, or isolateRoot?
import { eigHermitian, type CMat } from "../vacuum-compiler/src/core/cmat.js";
type Q = { num: bigint; den: bigint };
const bigAbs = (a: bigint): bigint => (a < 0n ? -a : a);
const bigGcd = (a: bigint, b: bigint): bigint => { let x = bigAbs(a), y = bigAbs(b); while (y !== 0n) { const t = x % y; x = y; y = t; } return x; };
function qNorm(r: Q): Q { if (r.den < 0n) return { num: -r.num, den: -r.den }; const g = bigGcd(r.num, r.den) || 1n; return { num: r.num / g, den: r.den / g }; }
const qAdd = (a: Q, b: Q): Q => qNorm({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
const qMul = (a: Q, b: Q): Q => qNorm({ num: a.num * b.num, den: a.den * b.den });
const qNeg = (a: Q): Q => ({ num: -a.num, den: a.den });
const qSub = (a: Q, b: Q): Q => qAdd(a, qNeg(b));
const qOf = (n: bigint, d: bigint): Q => qNorm({ num: n, den: d });
const qF = (q: Q): number => Number(q.num) / Number(q.den);
const ZERO = qOf(0n, 1n), ONE = qOf(1n, 1n);
type Poly = Q[];
const polyTrim = (p: Poly): Poly => { const o = [...p]; while (o.length > 1 && o[o.length - 1]!.num === 0n) o.pop(); return o; };
const polyScale = (p: Poly, c: Q): Poly => p.map((a) => qMul(a, c));
const polyAdd = (a: Poly, b: Poly): Poly => { const out: Poly = []; for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(qAdd(a[i] ?? ZERO, b[i] ?? ZERO)); return polyTrim(out); };
const polyMul = (a: Poly, b: Poly): Poly => { const out: Poly = Array(a.length + b.length - 1).fill(ZERO); for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = qAdd(out[i + j]!, qMul(a[i]!, b[j]!)); return polyTrim(out); };
const polyEval = (p: Poly, x: Q): Q => { let acc = ZERO; for (let i = p.length - 1; i >= 0; i--) acc = qAdd(qMul(acc, x), p[i]!); return acc; };
const polyDeriv = (p: Poly): Poly => { if (p.length <= 1) return [ZERO]; const o: Poly = []; for (let i = 1; i < p.length; i++) o.push(qMul(p[i]!, qOf(BigInt(i), 1n))); return o; };
function polyRem(a: Poly, b: Poly): Poly {
  const r = [...a]; const db = b.length - 1; const lead = b[db]!;
  while (r.length - 1 >= db && !(r.length === 1 && r[0]!.num === 0n)) {
    const dr = r.length - 1;
    const f = qMul(r[dr]!, qOf(lead.den, lead.num));
    for (let i = 0; i <= db; i++) r[dr - i] = qSub(r[dr - i]!, qMul(f, b[db - i]!));
    while (r.length > 1 && r[r.length - 1]!.num === 0n) r.pop();
  }
  return polyTrim(r);
}
const sgn = (v: Q): number => (v.num === 0n ? 0 : v.den < 0n ? (v.num > 0n ? -1 : 1) : v.num > 0n ? 1 : -1);
function sturmChain(p: Poly): Poly[] {
  const seq: Poly[] = [polyTrim(p), polyDeriv(p)];
  for (;;) {
    const prev = seq[seq.length - 2]!, cur = seq[seq.length - 1]!;
    const r = polyRem(prev, cur).map(qNeg);
    if (r.length === 1 && r[0]!.num === 0n) break;
    seq.push(polyTrim(r));
  }
  return seq;
}
function variations(seq: Poly[], x: Q): number {
  let v = 0, last = 0;
  for (const p of seq) { const s = sgn(polyEval(p, x)); if (s === 0) continue; if (last !== 0 && s !== last) v++; last = s; }
  return v;
}
function vAtNegInf(seq: Poly[]): number {
  let v = 0, last = 0;
  for (const p of seq) { const deg = p.length - 1; const s = deg % 2 === 0 ? sgn(p[deg]!) : -sgn(p[deg]!); if (last !== 0 && s !== last) v++; last = s; }
  return v;
}
const rootsBelow = (p: Poly, x: Q): number => { const seq = sturmChain(p); return vAtNegInf(seq) - variations(seq, x); };

function chainDiagonals(T: number, eps: Q, penalty: bigint): Q[] {
  const C = T + 1; const d: Q[] = [];
  for (let t = 0; t < C; t++) {
    let a = qOf(t === 0 || t === T ? 1n : 2n, 2n);
    if (t === 0) a = qAdd(a, qOf(penalty, 1n));
    d.push(qSub(a, qOf(eps.num * BigInt(t), eps.den)));
  }
  return d;
}
function jacobiCharPoly(diag: Q[]): Poly {
  let dPrev: Poly = [ZERO];
  let dCur: Poly = polyAdd([ZERO, ONE], [qNeg(diag[0]!)]);
  for (let t = 1; t < diag.length; t++) {
    const lamMinusA = polyAdd([ZERO, ONE], [qNeg(diag[t]!)]);
    const next = polyAdd(polyMul(lamMinusA, dCur), polyScale(dPrev, qOf(-1n, 4n)));
    dPrev = dCur; dCur = next;
  }
  return dCur;
}
// C=3 hand case, T=2, eps=0
const d3 = chainDiagonals(2, ZERO, 0n);
console.log("diag C=3:", d3.map(qF));
const p3 = jacobiCharPoly(d3);
console.log("p (C=3) coeffs:", p3.map((c) => `${c.num}/${c.den}`));
// expected: lam*(lam^2 - 2*lam + 3/4): roots 0, 1/2, 3/2
console.log("p(0) =", polyEval(p3, ZERO).num);
const seq3 = sturmChain(p3);
console.log("chain lens:", seq3.map((p) => p.length));
for (const x of [qOf(-10n, 1n), ZERO, qOf(1n, 4n), qOf(1n, 1n), qOf(10n, 1n)]) {
  console.log(`V(${qF(x)}) =`, variations(seq3, x), " rootsBelow:", vAtNegInf(seq3) - variations(seq3, x));
}
console.log("vAtNegInf:", vAtNegInf(seq3));
// and the float eigenvalues of the same chain
const m: CMat = { dim: 3, re: [[0.5, -0.5, 0], [-0.5, 1, -0.5], [0, -0.5, 0.5]], im: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
console.log("float eig:", Array.from(eigHermitian(m).values));

import { mat, mAdd, identity, matEq, mMul, mDagger } from '../quantum-mech/src/core/cmat.js';
const resetDampKrausK = (k: number, g: number) => {
  const k0 = mat(k, k);
  k0.re[0] = 1;
  for (let i = 1; i < k; i++) k0.re[i * k + i] = Math.sqrt(1 - g);
  const k1 = mat(k, k);
  for (let i = 1; i < k; i++) k1.re[0 * k + i] = Math.sqrt(g);
  return [k0, k1];
};
const [k0, k1] = resetDampKrausK(4, 0.5);
let kk = mat(4, 4);
for (const op of [k0, k1]) kk = mAdd(kk, mMul(mMul(mDagger(op), identity(4)), op));
let worst = 0; let worstIdx = -1;
for (let i = 0; i < 16; i++) { const d = Math.abs(kk.re[i]! - (i % 5 === 0 ? 1 : 0)); if (d > worst) { worst = d; worstIdx = i; } }
console.log('worst idx', worstIdx, 'dev', worst, 'im worst', Math.max(...Array.from(kk.im, Math.abs)));
console.log('full re:', Array.from(kk.re).map(x => x.toPrecision(17)).join(' '));

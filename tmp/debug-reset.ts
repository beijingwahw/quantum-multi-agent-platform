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
console.log('K†K sum diag:', Array.from(kk.re).filter((_, i) => [0,5,10,15].includes(i)));
console.log('matEq:', matEq(kk, identity(4), 1e-12));

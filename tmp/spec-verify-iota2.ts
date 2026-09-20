import { type CMat, kronAll, identity } from '../quantum-mech/src/core/cmat.js';
import { fromVec } from '../quantum-mech/src/core/states.js';
import { applyKraus, phaseFlipKraus, amplitudeDampKraus, partialTrace } from '../quantum-mech/src/core/channels.js';
import { concurrence, bellFidelity } from '../quantum-mech/src/contract/monogamy.js';
const famState = (x: number) => {
  const v = { n: 8, re: new Float64Array(8), im: new Float64Array(8) };
  v.re[4] = Math.sqrt(x); v.re[2] = Math.sqrt((1 - x) / 2); v.re[1] = Math.sqrt((1 - x) / 2);
  return fromVec(v);
};
const noiseOnBond = (rho: CMat, noise: 'dephase' | 'damp', g: number) => {
  const I2 = identity(2);
  const ops = (noise === 'dephase' ? phaseFlipKraus(g) : amplitudeDampKraus(g)).map((k) => kronAll([k, I2, I2]));
  return applyKraus(rho, ops);
};
let worst = 0;
for (const g of [0, 0.15, 0.5, 0.9]) {
  for (const x of [0.1, 0.5, 0.9]) {
    const rho = noiseOnBond(famState(x), 'damp', g);
    const c1 = concurrence(partialTrace(rho, [2, 2, 2], [2]));
    const closed = Math.sqrt(1 - g) * Math.sqrt(2 * x * (1 - x));
    worst = Math.max(worst, Math.abs(c1 - closed));
  }
}
console.log(worst <= 1e-12 ? `PASS damp concurrence closed form worst=${worst.toExponential(2)}` : `FAIL worst=${worst}`);
// also: F1 closed form per-x under damp: (1-x)/4 + gamma*x/2
let worstF = 0;
for (const g of [0, 0.3, 0.7, 1]) {
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const rho = noiseOnBond(famState(x), 'damp', g);
    const f1 = bellFidelity(partialTrace(rho, [2, 2, 2], [2]));
    worstF = Math.max(worstF, Math.abs(f1 - ((1 - x) / 4 + (g * x) / 2)));
  }
}
console.log(worstF <= 1e-12 ? `PASS damp F1 closed form worst=${worstF.toExponential(2)}` : `FAIL worstF=${worstF}`);

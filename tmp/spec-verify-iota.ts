/**
 * R21 agent-iota SPEC VERIFICATION (throwaway, not a deliverable).
 * Machine-checks the G1-a (T1-N spectral criterion) and G1-b (collateral
 * noise budget) hypotheses BEFORE any production code is written.
 * Run from quantum-mech: node --import tsx ../tmp/spec-verify-iota.ts
 */
import { type CMat, mat, mAdd, mDagger, identity, eigenvaluesHermitian, eigHermitian, isHermitian, mScale, matEq, kronAll } from '../quantum-mech/src/core/cmat.js';
import { applyKraus, phaseFlipKraus, amplitudeDampKraus } from '../quantum-mech/src/core/channels.js';
import { fromVec, randomPureState, HADAMARD, valueKet } from '../quantum-mech/src/core/states.js';
import { makeRng } from '../quantum-mech/src/core/rng.js';
import { utilityOf } from '../quantum-mech/src/mech/auctions.js';
import { quantumBestGain, makeQuantumUtility, codeword } from '../quantum-mech/src/mech/dsic.js';
import { concurrence, ckw, bellFidelity } from '../quantum-mech/src/contract/monogamy.js';
import { partialTrace, applyQubitChannel } from '../quantum-mech/src/core/channels.js';

// ---------- channel families under test ----------
const depolarizeKrausK = (k: number, p: number): CMat[] => {
  const ops: CMat[] = [mScale(identity(k), Math.sqrt(1 - p))];
  const c = Math.sqrt(p / k);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const m = mat(k, k);
      m.re[i * k + j] = c; // |i><j| * sqrt(p/k)
      ops.push(m);
    }
  }
  return ops;
};
const resetDampKrausK = (k: number, g: number): CMat[] => {
  const ops: CMat[] = [];
  const k0 = mat(k, k);
  k0.re[0] = 1;
  for (let i = 1; i < k; i++) k0.re[i * k + i] = Math.sqrt(1 - g);
  ops.push(k0);
  for (let i = 1; i < k; i++) {
    // one Kraus PER decay target level: merged |0><i| blocks are NOT TP
    const ki = mat(k, k);
    ki.re[0 * k + i] = Math.sqrt(g);
    ops.push(ki);
  }
  return ops;
};
const parityFlipKrausK = (k: number, g: number): CMat[] => {
  const d = mat(k, k);
  for (let i = 0; i < k; i++) d.re[i * k + i] = i % 2 === 0 ? 1 : -1;
  return [mScale(identity(k), Math.sqrt(1 - g)), mScale(d, Math.sqrt(g))];
};
const rotY = (theta: number): CMat => {
  const u = mat(2, 2);
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  u.re[0] = c; u.re[1] = -s; u.re[2] = s; u.re[3] = c;
  return u;
};

// ---------- machinery under test ----------
const adjointMap = (x: CMat, kraus: readonly CMat[]): CMat => {
  let acc = mat(x.rows, x.cols);
  for (const k of kraus) {
    // K† X K
    const kd = mDagger(k);
    let prod = mat(x.rows, x.cols);
    // (K† X) K
    for (let i = 0; i < x.rows; i++) {
      for (let j = 0; j < x.cols; j++) {
        let sr = 0, si = 0;
        for (let m = 0; m < k.rows; m++) {
          const kr = kd.re[i * kd.cols + m]!, ki = kd.im[i * kd.cols + m]!;
          const xr = x.re[m * x.cols + j]!, xi = x.im[m * x.cols + j]!;
          sr += kr * xr - ki * xi;
          si += kr * xi + ki * xr;
        }
        prod.re[i * x.cols + j] = sr;
        prod.im[i * x.cols + j] = si;
      }
    }
    const term = mat(x.rows, x.cols);
    for (let i = 0; i < x.rows; i++) {
      for (let j = 0; j < x.cols; j++) {
        let sr = 0, si = 0;
        for (let m = 0; m < x.rows; m++) {
          const pr = prod.re[i * x.rows + m]!, pi = prod.im[i * x.rows + m]!;
          const kr = k.re[m * k.cols + j]!, ki = k.im[m * k.cols + j]!;
          sr += pr * kr - pi * ki;
          si += pr * ki + pi * kr;
        }
        term.re[i * x.cols + j] = sr;
        term.im[i * x.cols + j] = si;
      }
    }
    acc = mAdd(acc, term);
  }
  return acc;
};
const projector = (k: number, r: number): CMat => {
  const m = mat(k, k);
  m.re[r * k + r] = 1;
  return m;
};
const traceMat = (a: CMat, b: CMat): number => {
  // Tr[A B] for Hermitian A, general B: sum_ij A_ij B_ji
  let s = 0;
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!, ai = a.im[i * a.cols + j]!;
      const br = b.re[j * b.cols + i]!, bi = b.im[j * b.cols + i]!;
      s += ar * br - ai * bi; // imaginary parts cancel for Hermitian A
    }
  }
  return s;
};

const rng = makeRng(20260920);
let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${name} ${detail}`);
  } else {
    console.log(`ok   ${name} ${detail}`);
  }
};

// ================= G1-a =================
const uVec = (kind: 'first' | 'second', trueValue: number, others: number[], slot: number, k: number): number[] => {
  const u: number[] = [];
  for (let r = 0; r < k; r++) {
    const bids = [...others];
    bids.splice(slot, 0, r);
    u.push(utilityOf(kind, trueValue, bids, slot));
  }
  return u;
};

interface Fam { name: string; kraus: (g: number) => CMat[]; k: number }
const fams: Fam[] = [
  { name: 'phaseFlip(k=2)', kraus: (g) => phaseFlipKraus(g), k: 2 },
  { name: 'ampDamp(k=2)', kraus: (g) => amplitudeDampKraus(g), k: 2 },
  { name: 'depol(k=4)', kraus: (g) => depolarizeKrausK(4, g), k: 4 },
  { name: 'resetDamp(k=4)', kraus: (g) => resetDampKrausK(4, g), k: 4 },
  { name: 'parityFlip(k=4)', kraus: (g) => parityFlipKrausK(4, g), k: 4 },
  { name: 'rotY(k=2)', kraus: (g) => [rotY(g * Math.PI / 2)], k: 2 }, // g in [0,1] -> theta in [0, pi/2]
];

for (const fam of fams) {
  const k = fam.k;
  for (const g of [0, 0.15, 0.5, 0.85, 1]) {
    const kraus = fam.kraus(g);
    // CPTP check: sum K†K = I
    let kk = mat(k, k);
    for (const op of kraus) kk = mAdd(kk, adjointMap(identity(k), [op])); // K† I K = K†K
    const tpDefect = matEq(kk, identity(k), 1e-12);
    // POVM completeness: sum_r A_r = I
    let sumA = mat(k, k);
    const As: CMat[] = [];
    for (let r = 0; r < k; r++) {
      const ar = adjointMap(projector(k, r), kraus);
      As.push(ar);
      sumA = mAdd(sumA, ar);
    }
    const povmDefect = matEq(sumA, identity(k), 1e-12);
    check(`CPTP+POVM ${fam.name} g=${g}`, tpDefect && povmDefect);
    // Hermiticity of every A_r and of B
    const u = uVec('second', 1.4, [1], 0, k);
    let B = mat(k, k);
    for (let r = 0; r < k; r++) B = mAdd(B, mScale(As[r]!, u[r]!));
    check(`A_r,B Hermitian ${fam.name} g=${g}`, As.every((a) => isHermitian(a, 1e-12)) && isHermitian(B, 1e-12));
  }
}

// (T1N-a) dual path: Tr[B sigma] vs applyKraus-then-readout, random sigmas
for (const fam of fams) {
  const k = fam.k;
  for (const g of [0.25, 0.6]) {
    const kraus = fam.kraus(g);
    const u = uVec('second', 1.4, [1], 0, k);
    let B = mat(k, k);
    for (let r = 0; r < k; r++) B = mAdd(B, mScale(adjointMap(projector(k, r), kraus), u[r]!));
    let worst = 0;
    for (let t = 0; t < 200; t++) {
      const sigma = fromVec(randomPureState(k, rng));
      const viaB = traceMat(B, sigma);
      const noisy = applyKraus(sigma, kraus);
      let direct = 0;
      for (let r = 0; r < k; r++) direct += u[r]! * noisy.re[r * k + r]!;
      worst = Math.max(worst, Math.abs(viaB - direct));
    }
    check(`T1N-a dual-path ${fam.name} g=${g}`, worst <= 1e-14, `worst=${worst.toExponential(2)}`);
  }
}

// (T1N-b) Rayleigh: the top eigenvector ACHIEVES lambda_max exactly; random
// sigmas never exceed it. (Random sampling alone cannot hit the max to 1e-14
// — the correct machine form of the Rayleigh identity is achievement+bound.)
for (const fam of fams) {
  const k = fam.k;
  const kraus = fam.kraus(0.7);
  const u = uVec('second', 1.4, [1], 0, k);
  let B = mat(k, k);
  for (let r = 0; r < k; r++) B = mAdd(B, mScale(adjointMap(projector(k, r), kraus), u[r]!));
  const eig = eigenvaluesHermitian(B);
  const lamMax = Math.max(...Array.from(eig));
  // achievement: build sigma from the eigen-decomposition's top vector
  // (eigenvaluesHermitian gives values only; use eigHermitian for vectors)
  const { values, vectors } = eigHermitian(B);
  let top = 0;
  for (let i = 1; i < k; i++) if (values[i]! > values[top]!) top = i;
  const rhoTop = mat(k, k);
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    rhoTop.re[i * k + j] = vectors[top]!.re[i]! * vectors[top]!.re[j]! + vectors[top]!.im[i]! * vectors[top]!.im[j]!;
    rhoTop.im[i * k + j] = vectors[top]!.im[i]! * vectors[top]!.re[j]! - vectors[top]!.re[i]! * vectors[top]!.im[j]!;
  }
  const achieved = traceMat(B, rhoTop);
  let best = -Infinity;
  for (let t = 0; t < 200; t++) {
    const sigma = fromVec(randomPureState(k, rng));
    best = Math.max(best, traceMat(B, sigma));
  }
  check(`T1N-b Rayleigh ${fam.name}`, Math.abs(achieved - lamMax) <= 1e-14 && best <= lamMax + 1e-14, `achieved=${achieved.toFixed(12)} lam=${lamMax.toFixed(12)} bestRandom=${best.toFixed(9)}`);
  check(`T1N-c sandwich ${fam.name}`, lamMax <= Math.max(...u) + 1e-12, `lam=${lamMax.toFixed(6)} maxU=${Math.max(...u)}`);
}

// (T1N-d) identity channel: B diagonal, lambda_max = max u; on a classically
// DSIC instance the criterion's gain is 0 = quantumBestGain's gain
{
  const k = 4;
  const u = uVec('second', 1.4, [1], 0, k);
  let B = mat(k, k);
  for (let r = 0; r < k; r++) B = mAdd(B, mScale(projector(k, r), u[r]!));
  const offDiag = Array.from({ length: k * k }, (_, idx) => (Math.floor(idx / k) === idx % k ? 0 : Math.abs(B.re[idx]!))).reduce((a, b) => Math.max(a, b), 0);
  const lamMax = Math.max(...Array.from(eigenvaluesHermitian(B)));
  const q = quantumBestGain('second', 1.4, [1], 0, k, makeRng(11), 200);
  check('T1N-d zero-noise slice', offDiag <= 1e-15 && Math.abs(lamMax - Math.max(...u)) <= 1e-12 && Math.abs(q.bestGain) <= 1e-12, `offDiag=${offDiag} lamMax=${lamMax.toFixed(10)} maxU=${Math.max(...u)} qGain=${q.bestGain.toExponential(2)}`);
}

// (T1N-e) census preview with the DECOMPOSITION the machine taught us:
// gain = lambdaMax - U_N(truth) = [coherence advantage: lamMax - max_i U_N(cw_i)]
//                              + [classical noisy-grid incentive: max_i U_N(cw_i) - U_N(truth)]
// Noise-CREATED quantum break <=> coherence advantage > 0.
const insts = [
  { kind: 'second' as const, tv: 1.4, others: [1], slot: 0 },
  { kind: 'second' as const, tv: 0.4, others: [1], slot: 0 },
  { kind: 'second' as const, tv: 2.6, others: [1, 3], slot: 1 },
  { kind: 'first' as const, tv: 2.6, others: [1, 3], slot: 1 },
];
let cohAdv: string[] = [];
let worstDiagCoh = 0;
for (const fam of fams) {
  const k = fam.k;
  const isDiag = fam.name !== 'rotY(k=2)';
  for (const g of [0.1, 0.3, 0.5, 0.8]) {
    const kraus = fam.kraus(g);
    for (const inst of insts.filter((i) => Math.round(i.tv) >= 0 && Math.round(i.tv) < k)) {
      const u = uVec(inst.kind, inst.tv, inst.others, inst.slot, k);
      let B = mat(k, k);
      for (let r = 0; r < k; r++) B = mAdd(B, mScale(adjointMap(projector(k, r), kraus), u[r]!));
      const lamMax = Math.max(...Array.from(eigenvaluesHermitian(B)));
      const truth = Math.round(inst.tv);
      const noisyT = applyKraus(codeword(k, truth), kraus);
      let uT = 0;
      for (let r = 0; r < k; r++) uT += u[r]! * noisyT.re[r * k + r]!;
      let bestCw = -Infinity;
      for (let i = 0; i < k; i++) {
        const nc = applyKraus(codeword(k, i), kraus);
        let ui = 0;
        for (let r = 0; r < k; r++) ui += u[r]! * nc.re[r * k + r]!;
        bestCw = Math.max(bestCw, ui);
      }
      const adv = lamMax - bestCw;
      if (isDiag) worstDiagCoh = Math.max(worstDiagCoh, Math.abs(adv));
      if (adv > 1e-12) cohAdv.push(`${fam.name} g=${g} ${inst.kind} tv=${inst.tv}: adv=${adv.toFixed(6)} totalGain=${(lamMax - uT).toFixed(6)}`);
    }
  }
}
console.log('--- coherence-advantage (noise-created quantum) breaks ---');
for (const b of cohAdv) console.log(b);
check('diagonal families: zero coherence advantage everywhere', worstDiagCoh <= 1e-12, `worst=${worstDiagCoh.toExponential(2)}`);
check('rotation family: coherence advantage exists', cohAdv.length > 0 && cohAdv.every((b) => b.startsWith('rotY')), `${cohAdv.length} rows`);
// closed form for the canonical break: second price tv=1.4 others=[1]: gain = 0.4*sin^2(theta/2)
{
  const theta = Math.PI / 4; // g=0.5
  const kraus = [rotY(theta)];
  const u = uVec('second', 1.4, [1], 0, 2);
  let B = mat(2, 2);
  for (let r = 0; r < 2; r++) B = mAdd(B, mScale(adjointMap(projector(2, r), kraus), u[r]!));
  const lamMax = Math.max(...Array.from(eigenvaluesHermitian(B)));
  const noisyT = applyKraus(codeword(2, 1), kraus);
  const uT = u[0]! * noisyT.re[0]! + u[1]! * noisyT.re[3]!;
  const expected = 0.4 * Math.sin(theta / 2) ** 2;
  check('rotY closed form', Math.abs(lamMax - uT - expected) <= 1e-12, `gain=${(lamMax - uT).toFixed(10)} expected=${expected.toFixed(10)}`);
  // H gate equivalent spectrum: HZ = R_y(pi/2)
  const krausH = [HADAMARD];
  let BH = mat(2, 2);
  for (let r = 0; r < 2; r++) BH = mAdd(BH, mScale(adjointMap(projector(2, r), krausH), u[r]!));
  const lamH = Math.max(...Array.from(eigenvaluesHermitian(BH)));
  const krausR = [rotY(Math.PI / 2)];
  let BR = mat(2, 2);
  for (let r = 0; r < 2; r++) BR = mAdd(BR, mScale(adjointMap(projector(2, r), krausR), u[r]!));
  const lamR = Math.max(...Array.from(eigenvaluesHermitian(BR)));
  check('H ~ R_y(pi/2) spectrum', Math.abs(lamH - lamR) <= 1e-12, `lamH=${lamH.toFixed(10)} lamR=${lamR.toFixed(10)}`);
}

// ================= G1-b =================
const famState = (x: number): CMat => {
  // sqrt(x)|100> + sqrt((1-x)/2)(|010>+|001>), bond = qubit 0
  const v = { n: 8, re: new Float64Array(8), im: new Float64Array(8) };
  v.re[4] = Math.sqrt(x);
  v.re[2] = Math.sqrt((1 - x) / 2);
  v.re[1] = Math.sqrt((1 - x) / 2);
  return fromVec(v);
};
const noiseOnBond = (rho: CMat, noise: 'dephase' | 'damp', g: number): CMat => {
  // noise on the BOND qubit ONLY (qubit 0): K ⊗ I ⊗ I
  const I2 = identity(2);
  const ops = (noise === 'dephase' ? phaseFlipKraus(g) : amplitudeDampKraus(g)).map((kOp) => kronAll([kOp, I2, I2]));
  return applyKraus(rho, ops);
};

console.log('--- G1-b closed forms ---');
let worstF = 0;
let worstSlack = -Infinity;
for (const g of [0, 0.2, 0.5, 0.8, 1]) {
  for (const noise of ['dephase', 'damp'] as const) {
    let bestSum = -Infinity;
    let bestX = 0;
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      const rho = noiseOnBond(famState(x), noise, g);
      const be1 = partialTrace(rho, [2, 2, 2], [2]);
      const be2 = partialTrace(rho, [2, 2, 2], [1]);
      const sum = bellFidelity(be1) + bellFidelity(be2);
      if (sum > bestSum) { bestSum = sum; bestX = x; }
      worstSlack = Math.max(worstSlack, ckw(rho).cAB ** 2 + ckw(rho).cAC ** 2 - ckw(rho).cABC ** 2);
    }
    // closed form: dephase sum = (1-x)/2 -> max 1/2 at x=0; damp sum = (1-x)/2 + g*x -> max max(1/2, g)
    const closed = noise === 'dephase' ? 0.5 : Math.max(0.5, g);
    worstF = Math.max(worstF, Math.abs(bestSum - closed));
    console.log(`${noise} g=${g}: max(F1+F2)=${bestSum.toFixed(10)} @x=${bestX.toFixed(3)} closed=${closed.toFixed(10)} eps=${Math.max(0, closed - 1).toFixed(6)}`);
  }
}
check('G1-b closed form match', worstF <= 1e-12, `worst=${worstF.toExponential(2)}`);
check('G1-b CKW slack <= 0 under noise (machine echo)', worstSlack <= 1e-9, `maxSlack=${worstSlack.toExponential(2)}`);

// damping x=1 gamma=1 endpoint: sum exactly 1
{
  const rho = noiseOnBond(famState(1), 'damp', 1);
  const s = bellFidelity(partialTrace(rho, [2, 2, 2], [2])) + bellFidelity(partialTrace(rho, [2, 2, 2], [1]));
  check('damp gamma=1 x=1 sum=1', Math.abs(s - 1) <= 1e-12, `s=${s.toFixed(12)}`);
}
// concurrence formula under dephasing: C_BE = (1-2g)*sqrt(2x(1-x)) for g<=1/2
{
  let worst = 0;
  for (const g of [0, 0.1, 0.25]) {
    for (const x of [0.2, 0.5, 0.8]) {
      const rho = noiseOnBond(famState(x), 'dephase', g);
      const c = concurrence(partialTrace(rho, [2, 2, 2], [2]));
      worst = Math.max(worst, Math.abs(c - (1 - 2 * g) * Math.sqrt(2 * x * (1 - x))));
    }
  }
  check('dephased concurrence closed form', worst <= 1e-12, `worst=${worst.toExponential(2)}`);
}

console.log(failures === 0 ? 'ALL SPEC CHECKS PASSED' : `${failures} SPEC CHECKS FAILED`);

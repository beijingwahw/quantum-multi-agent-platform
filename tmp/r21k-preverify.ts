/**
 * R21 agent-kappa pre-wave spec verification (规格即假设律, Write channel).
 * Machine-checks the R18/G4-a and G4-b spec assertions BEFORE any repo code:
 *
 *  G4-a: (1) the 64-vertex GYNI ring census is FLAT at exactly 1/2;
 *        (2) shared-random mixtures stay at exactly 1/2 by linearity;
 *        (3) a 6-qubit pairwise-Bell battery (x-dependent bases, XOR outputs)
 *            gives exactly 1/2 (flat echo, |v - 1/2| < 1e-12);
 *  G4-b: (4) replacer-pair control-face constants (T=1/2, Helstrom=3/4,
 *            chi=H2(1/4)-1/2) are dimension-invariant for d=2..6;
 *        (5) the joint linear law T_full = p/4 for (depol(p), depol(1))
 *            survives d=2..6 — or honestly degrades to a data table.
 */
import { type CMat, type CVec, kronAll, mat, matEq, vInner } from '../switch-sched/src/core/cmat.js';
import { KET0, rotY, uniformOrthVec, uniformVec, vecToRho } from '../switch-sched/src/core/states.js';
import { traceDistance } from '../switch-sched/src/core/measures.js';
import { krausToStinespring, makeSwitchedChannel } from '../switch-sched/src/switch/isometry.js';
import { depolarizingKraus, replacerKraus } from '../switch-sched/src/switch/chanlib.js';
import { helstromTwo, switchedEnsembleChi, switchedSlices } from '../switch-sched/src/switch/capacity.js';

// ---- (1) GYNI census flatness ------------------------------------------------
const N = 3;
function gyniVertexValue(fs: number[]): number {
  // fs[i] = truth table (2 bits) of party i's output function on own input
  let acc = 0;
  for (let x = 0; x < 8; x++) {
    const x0 = (x >> 2) & 1, x1 = (x >> 1) & 1, x2 = x & 1;
    const b = [x0, x1, x2].map((xi, i) => (fs[i]! >> xi) & 1);
    for (let i = 0; i < N; i++) if (b[i] === [x1, x2, x0][i]) acc += 1;
  }
  return acc / 24;
}
let mn = 1, mx = 0, atCap = 0;
for (let v = 0; v < 64; v++) {
  const p = gyniVertexValue([(v >> 0) & 3, (v >> 2) & 3, (v >> 4) & 3]);
  mn = Math.min(mn, p); mx = Math.max(mx, p);
  if (Math.abs(p - 0.5) < 1e-15) atCap++;
}
console.log(`(1) GYNI census: min=${mn} max=${mx} atHalf=${atCap}/64`);

// ---- (2) shared-random mixtures --------------------------------------------
function vertexBehavior(fs: number[]): Float64Array {
  // P(b0 b1 b2 | x0 x1 x2) as a 64-length sparse-free array: index x*8 + b
  const beh = new Float64Array(64);
  for (let x = 0; x < 8; x++) {
    const x0 = (x >> 2) & 1, x1 = (x >> 1) & 1, x2 = x & 1;
    const idx = x * 8 + (((fs[0]! >> x0) & 1) * 4 + ((fs[1]! >> x1) & 1) * 2 + ((fs[2]! >> x2) & 1));
    beh[idx] = 1;
  }
  return beh;
}
function behaviorValue(beh: Float64Array): number {
  let acc = 0;
  for (let x = 0; x < 8; x++) {
    const x0 = (x >> 2) & 1, x1 = (x >> 1) & 1, x2 = x & 1;
    for (let b = 0; b < 8; b++) {
      if (beh[x * 8 + b] === 0) continue;
      const b0 = (b >> 2) & 1, b1 = (b >> 1) & 1, b2 = b & 1;
      let s = 0;
      if (b0 === x1) s++; if (b1 === x2) s++; if (b2 === x0) s++;
      acc += (1 / 24) * beh[x * 8 + b]! * s;
    }
  }
  return acc;
}
let maxMixDev = 0, maxDecompDev = 0;
for (let trial = 0; trial < 200; trial++) {
  const w = new Float64Array(64);
  let tot = 0;
  for (let v = 0; v < 64; v++) { const u = (Math.sin(trial * 12.9898 + v * 78.233) + 1) / 2; w[v] = u; tot += u; }
  for (let v = 0; v < 64; v++) w[v] = w[v]! / tot;
  const mix = new Float64Array(64);
  let decomp = 0;
  for (let v = 0; v < 64; v++) {
    const beh = vertexBehavior([(v >> 0) & 3, (v >> 2) & 3, (v >> 4) & 3]);
    for (let k = 0; k < 64; k++) mix[k] = mix[k]! + w[v]! * beh[k]!;
    decomp += w[v]! * gyniVertexValue([(v >> 0) & 3, (v >> 2) & 3, (v >> 4) & 3]);
  }
  maxMixDev = Math.max(maxMixDev, Math.abs(behaviorValue(mix) - 0.5));
  maxDecompDev = Math.max(maxDecompDev, Math.abs(decomp - behaviorValue(mix)));
}
console.log(`(2) mixtures: maxDev-from-half=${maxMixDev.toExponential(2)} decomp-vs-direct=${maxDecompDev.toExponential(2)}`);

// ---- (3) pairwise-Bell battery ----------------------------------------------
// qubits 0..5: pair(0,1)=q0,q1 held by parties (0,1); pair(1,2)=q2,q3; pair(2,0)=q4,q5.
// party 0 holds q0,q5; party 1 holds q1,q2; party 2 holds q3,q4. b_i = XOR of the
// two outcomes; each qubit's basis angle set by the OWNING party's input.
const PHI: CMat = (() => { // |Phi+> on (q_even of pair, q_odd of pair)
  const v: CVec = { n: 4, re: Float64Array.from([1 / Math.SQRT2, 0, 0, 1 / Math.SQRT2]), im: new Float64Array(4) };
  const m = mat(4, 4);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    m.re[i * 4 + j] = v.re[i]! * v.re[j]!; m.im[i * 4 + j] = v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!;
  }
  return m;
})();
const SIX: CMat = kronAll([PHI, PHI, PHI]);
function basisVecAt(angle: number, outcome: number): CVec {
  const r = rotY(angle + Math.PI * outcome); // R_y(theta)|0>, R_y(theta)|1>
  const k = KET0;
  const prod: CVec = { n: 2, re: new Float64Array(2), im: new Float64Array(2) };
  for (let i = 0; i < 2; i++) {
    prod.re[i] = r.re[i * 2]! * k.re[0]! - r.im[i * 2]! * k.im[0]!;
    prod.im[i] = r.re[i * 2]! * k.im[0]! + r.im[i * 2]! * k.re[0]!;
  }
  return prod;
}
const OWNERS = [0, 1, 1, 2, 2, 0]; // qubit k held by party OWNERS[k]
function batteryValue(angles: number[][]): number {
  // angles[party][input] = measurement angle
  let acc = 0;
  for (let x = 0; x < 8; x++) {
    const xin = [(x >> 2) & 1, (x >> 1) & 1, x & 1];
    for (let o = 0; o < 64; o++) {
      // product basis vector for outcome pattern o
      const factors: CVec[] = [];
      for (let k = 0; k < 6; k++) factors.push(basisVecAt(angles[OWNERS[k]]![xin[OWNERS[k]]!]!, (o >> (5 - k)) & 1));
      let prod: CVec = factors[0]!;
      for (let k = 1; k < 6; k++) {
        const nx: CVec = { n: prod.n * 2, re: new Float64Array(prod.n * 2), im: new Float64Array(prod.n * 2) };
        for (let i = 0; i < prod.n; i++) for (let j = 0; j < 2; j++) {
          const re = prod.re[i]! * factors[k]!.re[j]! - prod.im[i]! * factors[k]!.im[j]!;
          const im = prod.re[i]! * factors[k]!.im[j]! + prod.im[i]! * factors[k]!.re[j]!;
          nx.re[i * 2 + j] = re; nx.im[i * 2 + j] = im;
        }
        prod = nx;
      }
      // P(o | x) = <prod| SIX |prod> : SIX is real-symmetric; = sum_i prod_i * SIX[i,j] * prod_j
      let p = 0;
      for (let i = 0; i < 64; i++) {
        let row = 0;
        for (let j = 0; j < 64; j++) row += SIX.re[i * 64 + j]! * prod.re[j]!;
        p += prod.re[i]! * row;
      }
      const b0 = ((o >> 5) & 1) ^ (o & 1);           // q0 XOR q5
      const b1 = ((o >> 4) & 1) ^ ((o >> 3) & 1);    // q1 XOR q2
      const b2 = ((o >> 2) & 1) ^ ((o >> 1) & 1);    // q3 XOR q4
      let s = 0;
      if (b0 === xin[1]) s++; if (b1 === xin[2]) s++; if (b2 === xin[0]) s++;
      acc += (1 / 24) * s * p;
    }
  }
  return acc;
}
const grid = [0, Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8, Math.PI / 2];
let maxBattDev = 0;
for (const a0 of grid) for (const a1 of grid) {
  const v = batteryValue([[a0, a0 + Math.PI / 4], [a1, a1], [a0, a1]]);
  maxBattDev = Math.max(maxBattDev, Math.abs(v - 0.5));
}
console.log(`(3) Bell battery: maxDev-from-half=${maxBattDev.toExponential(2)}`);

// ---- (4)+(5) G4-b dimension invariance ---------------------------------------
const h2 = (x: number): number => -x * Math.log2(x) - (1 - x) * Math.log2(1 - x);
const dev = (x: number, y: number): string => Math.abs(x - y).toExponential(1);
const PLUS2 = vecToRho({ n: 2, re: Float64Array.from([Math.SQRT1_2, Math.SQRT1_2]), im: new Float64Array(2) });
for (let d = 2; d <= 6; d++) {
  const sc = makeSwitchedChannel(krausToStinespring(replacerKraus(d)), krausToStinespring(replacerKraus(d)));
  const i0 = vecToRho(uniformVec(d));
  const i1 = vecToRho(uniformOrthVec(d));
  const s0 = switchedSlices(sc, PLUS2, i0);
  const s1 = switchedSlices(sc, PLUS2, i1);
  const chi = switchedEnsembleChi(sc, PLUS2, [i0, i1]);
  console.log(`(4) d=${d}: T_ctrl=${dev(traceDistance(s0.control, s1.control), 0.5)} T_tgt=${dev(traceDistance(s0.target, s1.target), 0)} T_full=${dev(traceDistance(s0.full, s1.full), 0.5)} Helm=${dev(helstromTwo(s0.full, s1.full), 0.75)} chi_ctrl=${dev(chi.control, h2(0.25) - 0.5)}`);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const sc2 = makeSwitchedChannel(krausToStinespring(depolarizingKraus(d, p)), krausToStinespring(depolarizingKraus(d, 1)));
    const a = switchedSlices(sc2, PLUS2, basisRho2(d, 0));
    const b = switchedSlices(sc2, PLUS2, basisRho2(d, 1));
    const tf = traceDistance(a.full, b.full);
    const fix = traceDistance(sc2.fixedAB(basisRho2(d, 0)), sc2.fixedAB(basisRho2(d, 1)));
    console.log(`   (5) d=${d} p=${p}: T_full=${tf.toFixed(12)} (p/4=${(p / 4).toFixed(3)}) dev=${dev(tf, p / 4)} fixedT=${dev(fix, 0)}`);
  }
}
function basisRho2(d: number, i: number): CMat {
  const m = mat(d, d);
  m.re[i * d + i] = 1;
  return m;
}

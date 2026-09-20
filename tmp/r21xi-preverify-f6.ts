/**
 * R21-xi preverify — binding-price F6 (R18/agentF.md candidate 6 = F3-b):
 * "Schmidt joint-reveal reachable envelope", spec formula
 *   P(a,b;t) = 1/4 [1 + sin2a sin2b cos2t].
 * SPEC-AS-ASSUMPTION: the machine rules before any src lands.
 * Derived candidate true law (amplitudes |a> = cosA|0> + e^{i ga} sinA|1>,
 * |b> = cosB|0> + e^{i gb} sinB|1>, ensemble {1/2 psi(t), 1/2 psi'(t)},
 * psi(t) = cos t|00> + sin t|11>, psi'(t) = sin t|00> + cos t|11>):
 *   P = 1/4 [1 + cos2A cos2B + sin2t sin2A sin2B cos(ga + gb)].
 * Bloch reading: P = 1/4 [1 + a^T C b], C = diag(sin2t, -sin2t, 1).
 */
import {
  jointProductReveal,
  coinReveal,
  jointAverage,
  bellStates,
} from "../binding-price/src/kernel/market.js";
import { type CMat, mat, kron, identity } from "../binding-price/src/core/cmat.js";

const psiPair = (t: number): CMat[] => {
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const psi = mat(4, 1);
  psi.re[0] = ct;
  psi.re[3] = st;
  const psiP = mat(4, 1);
  psiP.re[0] = st;
  psiP.re[3] = ct;
  // |psi><psi| via manual outer product on real vectors
  const rho = mat(4, 4);
  const rhoP = mat(4, 4);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      rho.re[i * 4 + j] = (i < 2 ? (i === 0 ? ct : 0) : i === 3 ? st : 0) * (j < 2 ? (j === 0 ? ct : 0) : j === 3 ? st : 0);
      rhoP.re[i * 4 + j] = (i < 2 ? (i === 0 ? st : 0) : i === 3 ? ct : 0) * (j < 2 ? (j === 0 ? st : 0) : j === 3 ? ct : 0);
    }
  return [rho, rhoP];
};

const announcement = (alpha: number, gamma: number): CMat => {
  // |a> = cos a |0> + e^{i g} sin a |1>, as 2x2 density
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  const rho = mat(2, 2);
  rho.re[0] = c * c;
  rho.re[1] = c * s * Math.cos(gamma);
  rho.re[2] = c * s * Math.cos(gamma);
  rho.re[3] = s * s;
  rho.im[1] = c * s * Math.sin(gamma);
  rho.im[2] = -c * s * Math.sin(gamma);
  return rho;
};

const closedForm = (A: number, B: number, ga: number, gb: number, t: number): number =>
  0.25 * (1 + Math.cos(2 * A) * Math.cos(2 * B) + Math.sin(2 * t) * Math.sin(2 * A) * Math.sin(2 * B) * Math.cos(ga + gb));

const specForm = (A: number, B: number, t: number): number =>
  0.25 * (1 + Math.sin(2 * A) * Math.sin(2 * B) * Math.cos(2 * t));

let worstTrue = 0;
let worstSpec = 0;
let count = 0;
const K = 12; // angle grid multiples of pi/24
for (let it = 0; it <= 12; it++) {
  const t = (it / 24) * Math.PI;
  const [rho, rhoP] = psiPair(t);
  const joint = jointAverage([
    { weight: 0.5, state: rho },
    { weight: 0.5, state: rhoP },
  ]);
  for (let ia = 0; ia < K; ia++) {
    const A = (ia / K) * (Math.PI / 2);
    for (let ib = 0; ib < K; ib++) {
      const B = (ib / K) * (Math.PI / 2);
      for (const [ga, gb] of [
        [0, 0],
        [Math.PI / 2, 0],
        [Math.PI / 3, Math.PI / 6],
      ] as const) {
        const dense = jointProductReveal(joint, announcement(A, ga), announcement(B, gb));
        worstTrue = Math.max(worstTrue, Math.abs(dense - closedForm(A, B, ga, gb, t)));
        worstSpec = Math.max(worstSpec, Math.abs(dense - specForm(A, B, t)));
        count++;
      }
    }
  }
}
console.log(`points=${count} worst TRUE-law deviation=${worstTrue.toExponential(3)}`);
console.log(`worst SPEC-formula deviation=${worstSpec.toExponential(3)}  (spec refuted iff >> 0)`);

// witness point killing the spec: t=0, a=b=|+> — spec says 1/2, truth 1/4
{
  const [rho, rhoP] = psiPair(0);
  const joint = jointAverage([
    { weight: 0.5, state: rho },
    { weight: 0.5, state: rhoP },
  ]);
  const dense = jointProductReveal(joint, announcement(Math.PI / 4, 0), announcement(Math.PI / 4, 0));
  console.log(`witness t=0,++ : dense=${dense.toFixed(6)} spec=${specForm(Math.PI / 4, Math.PI / 4, 0).toFixed(6)} true=${closedForm(Math.PI / 4, Math.PI / 4, 0, 0, 0).toFixed(6)}`);
}

// per-coin flatness at every t and every announcement
let worstCoin = 0;
for (let it = 0; it <= 24; it++) {
  const t = (it / 48) * Math.PI;
  const [rho, rhoP] = psiPair(t);
  const joint = jointAverage([
    { weight: 0.5, state: rho },
    { weight: 0.5, state: rhoP },
  ]);
  for (let ia = 0; ia < K; ia++) {
    const a = announcement((ia / K) * (Math.PI / 2), 0);
    worstCoin = Math.max(worstCoin, Math.abs(coinReveal(joint, 0, a) - 0.5), Math.abs(coinReveal(joint, 1, a) - 0.5));
  }
}
console.log(`per-coin worst deviation from 1/2 = ${worstCoin.toExponential(3)}`);

// envelope: sup over announcements = 1/2 flat; equatorial steering 1/4(1+sin2t); Y-phase kills t
let maxP = 0;
let minP = 1;
for (let it = 0; it <= 48; it++) {
  const t = (it / 96) * Math.PI;
  const [rho, rhoP] = psiPair(t);
  const joint = jointAverage([
    { weight: 0.5, state: rho },
    { weight: 0.5, state: rhoP },
  ]);
  for (let ia = 0; ia < 24; ia++) {
    const A = (ia / 24) * Math.PI;
    for (const [ga, gb] of [
      [0, 0],
      [Math.PI / 2, Math.PI / 2],
    ] as const) {
      for (let ib = 0; ib < 24; ib++) {
        const B = (ib / 24) * Math.PI;
        const p = jointProductReveal(joint, announcement(A, ga), announcement(B, gb));
        maxP = Math.max(maxP, p);
        minP = Math.min(minP, p);
      }
    }
  }
}
console.log(`full-sweep envelope: max P=${maxP.toFixed(9)} (claimed 1/2), min P=${minP.toFixed(9)} (claimed 0 at z,-z)`);

// Bell cross-check: t=pi/4 the two members coincide = Phi+; correlation matrix diag(1,-1,1)
{
  const bell = bellStates()[0]!;
  const [rho, rhoP] = psiPair(Math.PI / 4);
  let d = 0;
  for (let k = 0; k < 16; k++) d = Math.max(d, Math.abs(rho.re[k]! - bell.re[k]!), Math.abs(rhoP.re[k]! - bell.re[k]!));
  console.log(`t=pi/4 both members = |Phi+>: worst deviation=${d.toExponential(3)}`);
}

// G8 census cross-anchor: the joint average at (z,z) gives 1/2 at EVERY t
let worstZZ = 0;
for (let it = 0; it <= 24; it++) {
  const t = (it / 48) * Math.PI;
  const [rho, rhoP] = psiPair(t);
  const joint = jointAverage([
    { weight: 0.5, state: rho },
    { weight: 0.5, state: rhoP },
  ]);
  const z = announcement(0, 0);
  worstZZ = Math.max(worstZZ, Math.abs(jointProductReveal(joint, z, z) - 0.5));
}
console.log(`(z,z) reveal at every t: worst deviation from 1/2 = ${worstZZ.toExponential(3)}`);

// correlation matrix reading: C = diag(sin2t, -sin2t, 1) via Pauli correlators
let worstC = 0;
const pauli = (name: "x" | "y" | "z"): CMat => {
  const m = mat(2, 2);
  if (name === "x") {
    m.re[1] = 1;
    m.re[2] = 1;
  } else if (name === "y") {
    m.im[1] = -1;
    m.im[2] = 1;
  } else {
    m.re[0] = 1;
    m.re[3] = -1;
  }
  return m;
};
import { mMul, mTrace } from "../binding-price/src/core/cmat.js";
for (let it = 0; it <= 24; it++) {
  const t = (it / 48) * Math.PI;
  const [rho, rhoP] = psiPair(t);
  const joint = jointAverage([
    { weight: 0.5, state: rho },
    { weight: 0.5, state: rhoP },
  ]);
  for (const i of ["x", "y", "z"] as const) {
    for (const j of ["x", "y", "z"] as const) {
      const obs = mTrace(mMul(kron(pauli(i), pauli(j)), joint)).re;
      const expect = i === "z" && j === "z" ? 1 : i === "x" && j === "x" ? Math.sin(2 * t) : i === "y" && j === "y" ? -Math.sin(2 * t) : 0;
      worstC = Math.max(worstC, Math.abs(obs - expect));
    }
  }
}
console.log(`correlation matrix diag(sin2t,-sin2t,1): worst deviation=${worstC.toExponential(3)}`);
console.log("PREVERIFY-F6 DONE");

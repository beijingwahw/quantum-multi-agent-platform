/**
 * The correlators and their tax — one checker, many resources, zero everywhere.
 *
 * The no-signaling object (batch 20's law): the RECEIVER's marginal must not
 * depend on the SENDER's setting — TV distance across settings, not any
 * statement about outcomes. Three resources pay the same tax:
 *
 *   C1 the cache (singlet correlations): B's marginal under A's axis choice,
 *      through local unitaries and Stinespring CPTP maps on B's side;
 *   C2 the order register (the switched pair): the order-bit outcome
 *      distribution across payload inputs;
 *   C3 the HJW ensembles (binding's root): Bob's ensemble-AVERAGED state is
 *      the same I/2 for every basis Alice commits to — while the conditional
 *      members differ (the correlations are real; the choice is not readable).
 */
import { type CMat, kron, mat, mMul, mDagger, mAdd, identity } from "../core/cmat.js";
import { partialTrace } from "../core/channels.js";
import { traceDistance } from "../core/measures.js";
import { makeRng } from "../core/rng.js";
import { makeSwitchedChannel } from "../switch/isometry.js";
import { completelyDepolarizingKraus, replacerKraus, randomChannelStinespring, krausToStinespring } from "../switch/chanlib.js";
import { readoutSlices } from "./collapse.js";

// --- C1: the singlet cache ---------------------------------------------------

/** Density matrix of |Psi-> = (|01> - |10>)/sqrt(2), basis order |00>,|01>,|10>,|11>. */
export const SINGLET: CMat = (() => {
  const m = mat(4, 4);
  m.re[1 * 4 + 1] = 0.5;
  m.re[2 * 4 + 2] = 0.5;
  m.re[1 * 4 + 2] = -0.5;
  m.re[2 * 4 + 1] = -0.5;
  return m;
})();

/** Projective measurement along axis a on qubit 0 of a 2-qubit state, outcome averaged. */
export function measureQubit0(rho: CMat, a: readonly [number, number, number]): CMat {
  const pPlus = kron(projector(a), identity(2));
  const pMinus = kron(projector([-a[0], -a[1], -a[2]]), identity(2));
  return mAdd(mMul(mMul(pPlus, rho), mDagger(pPlus)), mMul(mMul(pMinus, rho), mDagger(pMinus)));
}

function projector(a: readonly [number, number, number]): CMat {
  const [x, y, z] = a;
  const m = mat(2, 2);
  m.re[0] = (1 + z) / 2;
  m.re[1] = (x - y * 0 - 0) / 2; // (x - i y)/2 -> re part x/2, im part -y/2
  m.im[1] = -y / 2;
  m.re[2] = x / 2;
  m.im[2] = y / 2;
  m.re[3] = (1 - z) / 2;
  return m;
}

/** B's marginal after A measures along axis a (and any local map on B). */
export function bMarginal(rho: CMat, a: readonly [number, number, number], localOnB?: (r: CMat) => CMat): CMat {
  let s = measureQubit0(rho, a);
  if (localOnB) s = localOnB(s);
  return partialTrace(s, [2, 2], [0]);
}

/** TV distance of B's marginal across two axes, with an optional local map on B. */
export function cacheLeakage(rho: CMat, a1: readonly [number, number, number], a2: readonly [number, number, number], localOnB?: (r: CMat) => CMat): number {
  return traceDistance(bMarginal(rho, a1, localOnB), bMarginal(rho, a2, localOnB));
}

/** Random local unitary on B (as a 4x4 on [A,B] acting on B). */
export function randomBUnitary(seed: number): (r: CMat) => CMat {
  const rng = makeRng(seed);
  // random Hermitian -> exp via two rotations is overkill; use a random
  // unitary built from Pauli combination H = sum c_i sigma_i, U = cos(t) I + i sin(t) H/|H|
  const c = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1];
  const n = Math.sqrt(c[0]! * c[0]! + c[1]! * c[1]! + c[2]! * c[2]!) || 1;
  const t = rng() * Math.PI;
  const [x, y, z] = [c[0] as number / n, c[1] as number / n, c[2] as number / n];
  const ct = Math.cos(t);
  const st = Math.sin(t);
  // U = ct I + i st (x X + y Y + z Z)
  // U = ct I + i st (xX + yY + zZ) = [[ct + i st z, st(y + i x)], [st(-y + i x), ct - i st z]]
  const U = mat(2, 2);
  U.re[0] = ct;
  U.re[3] = ct;
  U.im[0] = st * z;
  U.im[3] = -st * z;
  U.re[1] = st * y;
  U.im[1] = st * x;
  U.re[2] = -st * y;
  U.im[2] = st * x;
  const full = kron(identity(2), U);
  return (r: CMat): CMat => mMul(mMul(full, r), mDagger(full));
}

/** Random Stinespring CPTP on B (isometry 2 -> 2*k), traced back to [A,B]. */
export function randomBCPTP(seed: number, envDim: number): (r: CMat) => CMat {
  const rng = makeRng(seed);
  const V = randomChannelStinespring(rng, 2, envDim);
  // embed: on [A(2), B(2)] -> [A(2), B(2), env(k)]: I_A (x) V acting on B
  const rows = 2 * 2 * envDim;
  const embed = mat(rows, 4);
  for (let bOut = 0; bOut < 2; bOut++) {
    for (let e = 0; e < envDim; e++) {
      for (let bIn = 0; bIn < 2; bIn++) {
        const v = V.V.re[((bOut * envDim + e) * 2 + bIn)] as number;
        const vi = V.V.im[((bOut * envDim + e) * 2 + bIn)] as number;
        // input index (a, bIn): all a
        for (let a = 0; a < 2; a++) {
          const row = ((a * 2 + bOut) * envDim + e);
          const col = a * 2 + bIn;
          embed.re[row * 4 + col] = v;
          embed.im[row * 4 + col] = vi;
        }
      }
    }
  }
  return (r: CMat): CMat => partialTrace(mMul(mMul(embed, r), mDagger(embed)), [2, 2, envDim], [2]);
}

// --- C2: the order register --------------------------------------------------

export function orderBlindnessMax(): number {
  const plus = { rows: 2, cols: 2, re: Float64Array.from([0.5, 0.5, 0.5, 0.5]), im: new Float64Array(4) } as CMat;
  const basis = (i: number): CMat => {
    const m = mat(2, 2);
    m.re[i * 2 + i] = 1;
    return m;
  };
  const rng = makeRng(777);
  const pairs = [
    makeSwitchedChannel(krausToStinespring(completelyDepolarizingKraus(2)), krausToStinespring(completelyDepolarizingKraus(2))),
    makeSwitchedChannel(krausToStinespring(replacerKraus(2)), krausToStinespring(replacerKraus(2))),
    makeSwitchedChannel(randomChannelStinespring(rng, 2, 3), randomChannelStinespring(rng, 2, 3)),
  ];
  const inputs = [basis(0), basis(1), plus];
  let worst = 0;
  for (const sc of pairs) {
    const dists = inputs.map((x) => {
      const s = readoutSlices(sc, plus, x);
      // the CONTROL MARGINAL (2x2), not joint elements — P(c=0) is the
      // diagonal of the receiver's own register
      return [(s.control.re[0] as number), (s.control.re[3] as number)] as const;
    });
    for (const a of dists) {
      for (const b of dists) {
        worst = Math.max(worst, Math.abs((a[0]) - (b[0])), Math.abs((a[1]) - (b[1])));
      }
    }
  }
  return worst;
}

// --- C3: the HJW ensembles ---------------------------------------------------

/** Density matrix of |Phi+> = (|00> + |11>)/sqrt(2). */
export const PHI_PLUS: CMat = (() => {
  const m = mat(4, 4);
  m.re[0] = 0.5;
  m.re[3 * 4 + 3] = 0.5;
  return m;
})();

/** Bob's ensemble-averaged state when Alice measures along axis a: sum_outcome p * conditional. */
export function hjwAverage(a: readonly [number, number, number]): CMat {
  return bMarginal(PHI_PLUS, a);
}

/**
 * The OCB causal game ("guess your partner's input"), executable.
 *
 * Oreshkov-Costa-Brukner, Nat. Commun. 3, 1092 (2012):
 * Alice generates bit a; Bob generates bits b and b′. If b′ = 0, Bob's task is
 * to communicate b to Alice (her guess x must equal b); if b′ = 1, Bob's task
 * is to guess a (his guess y must equal a). Success probability
 *
 *   p_succ = ½ P(x = b | b′=0) + ½ P(y = a | b′=1)   (OCB Eq. (1)),
 *
 * capped by 3/4 for every causal (definite-order, shared-randomness)
 * strategy (OCB Eq. (2)); the OCB process matrix reaches (2+√2)/4.
 *
 * This module contains: the game's strategies in CJ form (OCB Methods
 * Eqs. (20)-(23)), the game success as a LINEAR FUNCTIONAL (witness) on
 * process space, and the EXHAUSTIVE deterministic classical census.
 */

import { type CMat, type CVec, identity, kron, mat, mScale } from '../core/cmat.js';
import { KET0, PLUS, vecToRho } from '../core/states.js';
import { marginalProbs } from '../core/channels.js';
import { krausToStinespring, makeSwitchedChannel } from '../switch/isometry.js';
import { kronRho } from '../switch/witnesses.js';
import { cjMatrix, measurePrepareKraus, processProbability } from './cj.js';

export const HALF = 1 / 2;
/** (2+√2)/4 = cos²(π/8) — the OCB quantum value; also √2/2 + 1/2. */
export const OCB_QUANTUM_VALUE = (2 + Math.SQRT2) / 4;
/** The classical causal cap. */
export const CLASSICAL_CAP = 3 / 4;
/** Witness gap: (2+√2)/4 − 3/4 = (√2−1)/4. */
export const WITNESS_GAP = OCB_QUANTUM_VALUE - CLASSICAL_CAP;

function projectorZ(sign: number): CMat {
  // ½[𝟙 + (−1)^s σ_z]
  const p = mat(2, 2);
  p.re[0] = (1 + sign) * HALF;
  p.re[3] = (1 - sign) * HALF;
  return p;
}

function projectorX(sign: number): CMat {
  // ½[𝟙 + (−1)^s σ_x]
  const p = mat(2, 2);
  p.re[0] = HALF;
  p.re[1] = sign * HALF;
  p.re[2] = sign * HALF;
  p.re[3] = HALF;
  return p;
}

/**
 * Alice's operation, OCB Eq. (20): measure A1 in the z basis (guess x = 0 for
 * |z+⟩, 1 for |z−⟩), prepare A2 = |z_a⟩ encoding her own bit a.
 */
export function aliceCJ(x: number, a: number): CMat {
  return kron(projectorZ(x === 0 ? 1 : -1), projectorZ(a === 0 ? 1 : -1));
}

/**
 * Bob's operation for b′ = 1, OCB Eq. (22): measure B1 in z (y = outcome),
 * prepare an arbitrary fixed state on B2 (the choice is irrelevant).
 */
export function bobReadCJ(y: number, _b: number): CMat {
  return kron(projectorZ(y === 0 ? 1 : -1), mScale(identity(2), HALF));
}

/**
 * Bob's operation for b′ = 0, OCB Eq. (23): measure B1 in x (label y), encode
 * b ⊕ y in the z basis on B2 — the ±y XOR undoes the random measurement label.
 */
export function bobSendCJ(y: number, b: number): CMat {
  return kron(projectorX(y === 0 ? 1 : -1), projectorZ((b ^ y) === 0 ? 1 : -1));
}

export function bobCJ(y: number, b: number, bPrime: number): CMat {
  return bPrime === 0 ? bobSendCJ(y, b) : bobReadCJ(y, b);
}

/** Game score of one outcome/setting tuple (OCB Eq. (1)). */
export function gameScore(x: number, y: number, a: number, b: number, bPrime: number): number {
  return bPrime === 0 ? (x === b ? 1 : 0) : (y === a ? 1 : 0);
}

/**
 * The game success as a linear functional on process space:
 *   S_game = (1/8) Σ_{a,b,b′} Σ_{x,y} score · ξ(x,a) ⊗ η(y,b,b′),
 * so that p_succ(W) = Tr[W · S_game] for EVERY process W (linearity). The
 * (1/8) is the uniform input distribution P(a,b,b′); the two ½ task weights
 * are absorbed because each (a,b,b′) tuple belongs to exactly one task.
 * (The previous build carried an extra ½ — every value halved; caught by the
 * W_OCB anchor p_succ = (2+√2)/4, which is OCB's Eq. (8).)
 * The causal witness is S = (3/16)·𝟙 − S_game: for every VALID process
 * (Tr W = d_{A2}d_{B2} = 4, OCB Methods) Tr[S W] = ¾ − p_succ(W), so
 * Tr[S W] ≥ 0 on every causally separable W (OCB Eq. (2)), while
 * Tr[S W_OCB] = −(√2−1)/4.
 */
export function gameWitnessFunctional(): CMat {
  const s = mat(16, 16);
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            const wgt = (1 / 8) * gameScore(x, y, a, b, bp);
            if (wgt === 0) continue;
            const m = kron(aliceCJ(x, a), bobCJ(y, b, bp));
            for (let k = 0; k < 256; k++) s.re[k] = s.re[k]! + wgt * m.re[k]!;
          }
        }
      }
    }
  }
  return s;
}

/**
 * The causal-witness operator S = (3/16)·𝟙 − S_game. On every valid process
 * (trace-4, per OCB Methods) Tr[S W] = ¾ − p_succ(W); negative ⇔ the OCB
 * causal inequality is violated ⇔ W is causally nonseparable.
 */
export function causalWitness(): CMat {
  const s = mat(16, 16);
  const g = gameWitnessFunctional();
  for (let k = 0; k < 256; k++) s.re[k] = (k % 17 === 0 ? 3 / 16 : 0) - g.re[k]!;
  return s;
}

/** p_succ of an arbitrary process under the OCB strategies, from scratch:
 * every joint probability recomputed from the process matrix by the Born
 * rule — independent of the linear-functional representation above. */
export function psuccOCBStrategies(w: CMat): number {
  let acc = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            const wgt = (1 / 8) * gameScore(x, y, a, b, bp);
            if (wgt === 0) continue;
            const p = processProbability(w, aliceCJ(x, a), bobCJ(y, b, bp));
            acc += wgt * p;
          }
        }
      }
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Exhaustive deterministic classical census.
//
// Under a definite causal order, a deterministic classical strategy is: the
// first-acting party's message m = g(own bits), the first party's own output,
// and the second party's output as a function of (own bits, message).
//   Order B-first: y = h(b,b′) [Bob acts first], m = g(b,b′), x = f(a,m).
//   Order A-first: x = h(a)    [Alice acts first], m = g(a),   y = f(b,b′,m).
// Shared randomness = convex mixtures; p_succ is linear in the joint
// behavior, so the maximum over mixtures is attained at a deterministic
// vertex. The census enumerates ALL vertices of BOTH orders.
// ---------------------------------------------------------------------------

export interface ClassicalStrategyPoint {
  readonly order: 'A-first' | 'B-first';
  readonly label: string;
  readonly psucc: number;
}

/** p_succ of a deterministic strategy given as outcome functions. */
function psuccDeterministic(
  xOf: (a: number, m: number) => number,
  yOf: (b: number, bp: number) => number,
  mOf: (b: number, bp: number, a: number) => number,
): number {
  let acc = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        const m = mOf(b, bp, a);
        const x = xOf(a, m);
        const y = yOf(b, bp);
        acc += (1 / 8) * gameScore(x, y, a, b, bp);
      }
    }
  }
  return acc;
}

/**
 * The exhaustive deterministic census: 4096 B-first + 4096 A-first = 8192
 * vertices (B-first: y,m functions of (b,b′) 16×16, x of (a,m) 16;
 * A-first: x,m functions of a 4×4, y of (b,b′,m) 256). Returns every point
 * sorted by p_succ descending.
 */
export function classicalCensus(): ClassicalStrategyPoint[] {
  const points: ClassicalStrategyPoint[] = [];
  const fn1 = (t: number): ((u: number) => number) => (u: number): number => (t >> u) & 1;
  // functions of 2 bits: 16 truth tables; of 3 bits: 256
  const fn2 = (t: number): ((u: number, v: number) => number) =>
    (u: number, v: number): number => (t >> (u * 2 + v)) & 1;
  const fn3 = (t: number): ((u: number, v: number, w: number) => number) =>
    (u: number, v: number, w: number): number => (t >> (u * 4 + v * 2 + w)) & 1;

  // B-first: y = h(b,b′), m = g(b,b′), x = f(a,m)
  for (let ht = 0; ht < 16; ht++) {
    const h = fn2(ht);
    for (let gt = 0; gt < 16; gt++) {
      const g = fn2(gt);
      for (let ft = 0; ft < 16; ft++) {
        const f = fn2(ft);
        const p = psuccDeterministic(f, h, (b, bp, _a) => g(b, bp));
        points.push({ order: 'B-first', label: `B:h${ht},g${gt},f${ft}`, psucc: p });
      }
    }
  }
  // A-first: x = h(a), m = g(a), y = f(b,b′,m)
  for (let ht = 0; ht < 4; ht++) {
    const h = fn1(ht);
    for (let gt = 0; gt < 4; gt++) {
      const g = fn1(gt);
      for (let ft = 0; ft < 256; ft++) {
        const f = fn3(ft);
        const p = psuccAFirst(h, g, f);
        points.push({ order: 'A-first', label: `A:h${ht},g${gt},f${ft}`, psucc: p });
      }
    }
  }
  points.sort((p, q) => q.psucc - p.psucc);
  return points;
}

function psuccAFirst(
  xOf: (a: number) => number,
  mOf: (a: number) => number,
  yOf: (b: number, bp: number, m: number) => number,
): number {
  let acc = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        const m = mOf(a);
        acc += (1 / 8) * gameScore(xOf(a), yOf(b, bp, m), a, b, bp);
      }
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Smuggling-trial checker #1: census records must survive recomputation.
// ---------------------------------------------------------------------------

export interface CensusRecord {
  readonly familySize: number;
  readonly maxPsucc: number;
  readonly argmaxLabel: string;
}

export interface CensusVerdict {
  readonly ok: boolean;
  readonly reason: string;
}

/**
 * Verify a claimed classical-census record by recomputing the census from
 * scratch. A counterfeit record (inflated cap, wrong argmax, truncated
 * family) is NAMED and REJECTED — the number on trial never enters the
 * reports unverified.
 */
export function verifyClassicalCensus(claimed: CensusRecord): CensusVerdict {
  const truth = classicalCensus();
  const best = truth[0]!;
  if (claimed.familySize !== truth.length) {
    return {
      ok: false,
      reason: `CLASSICAL-CENSUS-COUNTERFEIT: claimed ${claimed.familySize} deterministic strategies, machine census has ${truth.length}`,
    };
  }
  if (Math.abs(claimed.maxPsucc - best.psucc) > 1e-12) {
    return {
      ok: false,
      reason: `CLASSICAL-CENSUS-COUNTERFEIT: claimed cap ${claimed.maxPsucc.toFixed(6)}, machine cap ${best.psucc.toFixed(6)} — the classical causal bound 3/4 cannot be exceeded`,
    };
  }
  if (claimed.argmaxLabel !== best.label) {
    return {
      ok: false,
      reason: `CLASSICAL-CENSUS-COUNTERFEIT: claimed argmax "${claimed.argmaxLabel}", machine argmax "${best.label}"`,
    };
  }
  return { ok: true, reason: 'verified against exhaustive recomputation' };
}

/** Eigenvalue-free real symmetric check helper reused by judges: Hermitian? */
export function isRealHermitian(w: CMat, tol = 1e-12): boolean {
  if (w.im.some((z) => Math.abs(z) > tol)) return false;
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      if (Math.abs(w.re[i * 16 + j]! - w.re[j * 16 + i]!) > tol) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// The OCB game played through the quantum switch (the T1 machinery).
// ---------------------------------------------------------------------------

/**
 * p_succ of the OCB game when the "process" is the T1 quantum switch itself:
 * control |+⟩, fresh target |0⟩, the canonical OCB instruments as lab Kraus
 * sets (Alice: z-measure outcome x, reprepare |z_a⟩; Bob b′=1: z-measure
 * outcome y; Bob b′=0: x-measure outcome y, reprepare |z_{b⊕y}⟩). The joint
 * outcome probabilities are read off the switch's ENVIRONMENT registers
 * (E_A, E_B) of the full (control, system, E_A, E_B) output — the honest
 * measurement record, no postselection.
 *
 * Machine result (and test anchor): 5/8 — the isolated switch plays the
 * causal game BELOW the classical causal cap 3/4, in line with van der Lugt
 * et al., Nat. Commun. 14, 5807 (2023): order indefiniteness is not causal
 * inequality violation. Scope: canonical instruments, one target state.
 */
export function psuccOCBThroughSwitch(): number {
  const z0: CVec = { n: 2, re: Float64Array.from([1, 0]), im: new Float64Array(2) };
  const z1: CVec = { n: 2, re: Float64Array.from([0, 1]), im: new Float64Array(2) };
  const xp: CVec = { n: 2, re: Float64Array.from([Math.SQRT1_2, Math.SQRT1_2]), im: new Float64Array(2) };
  const xm: CVec = { n: 2, re: Float64Array.from([Math.SQRT1_2, -Math.SQRT1_2]), im: new Float64Array(2) };
  let acc = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        const krausA = [measurePrepareKraus(z0, a === 0 ? z0 : z1)[0]!, measurePrepareKraus(z1, a === 0 ? z0 : z1)[0]!];
        const krausB = bp === 1
          ? [measurePrepareKraus(z0, z0)[0]!, measurePrepareKraus(z1, z0)[0]!]
          : [measurePrepareKraus(xp, (b ^ 0) === 0 ? z0 : z1)[0]!, measurePrepareKraus(xm, (b ^ 1) === 0 ? z0 : z1)[0]!];
        const sc = makeSwitchedChannel(krausToStinespring(krausA), krausToStinespring(krausB));
        const full = sc.channelFull(kronRho(vecToRho(PLUS), vecToRho(KET0)));
        const { probs } = marginalProbs(full, [2, 2, 2, 2], [2, 3]); // (E_A, E_B) = (x, y)
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            acc += (1 / 8) * gameScore(x, y, a, b, bp) * probs[x * 2 + y]!;
          }
        }
      }
    }
  }
  return acc;
}

export { cjMatrix, measurePrepareKraus };

/**
 * THE LAW — a fixed dissipative channel whose absorbing class is the marked
 * world. This is the physics half of the epoch-5 sentence: choice-lang
 * compiled choose() into controlled branching and kept the world stable BY
 * CONSTRUCTION (engineered programs); here the world is stable because the
 * LAW ITSELF flows every state into it. Register: one world qubit (bit = 1
 * means "in the world") ⊗ one data qubit (the cargo), full dim 4.
 *
 * The law is amplitude damping INTO the world sector, quiet on everything
 * already inside:
 *   K0 = (|1><1| + sqrt(1-gamma)|0><0|) ⊗ I,  K1 = sqrt(gamma) |1><0| ⊗ I
 * so a state's complement population decays as (1-gamma)^k, its sector
 * coherence as (sqrt(1-gamma))^k, and its within-world block is untouched.
 * Everything here has a closed form the witnesses re-derive, never assume.
 */
import type { Rng } from "../core/rng.js";
import { type CMat, identity, kron, mat, mAdd, mDagger, mMul, mScale } from "../core/cmat.js";
import { applyKraus, applyUnitary, partialTrace } from "../core/channels.js";
import { vonNeumannEntropy } from "../core/measures.js";

export const GAMMA = 0.25;
export const DATA_DIM = 2;
export const FULL_DIM = 4;

/** Pi_W = |1><1| ⊗ I — the world projector (basis order: world ⊗ data). */
export function worldProjector(): CMat {
  const m = mat(FULL_DIM, FULL_DIM);
  for (let k = 0; k < DATA_DIM; k++) m.re[(DATA_DIM + k) * FULL_DIM + (DATA_DIM + k)] = 1;
  return m;
}

/** Pi_perp = |0><0| ⊗ I. */
export function complementProjector(): CMat {
  const m = mat(FULL_DIM, FULL_DIM);
  for (let k = 0; k < DATA_DIM; k++) m.re[k * FULL_DIM + k] = 1;
  return m;
}

/** The Kraus pair of the law (world damping toward 1, identity on data). */
export function lawKraus(gamma: number = GAMMA): CMat[] {
  const k0w = mat(2, 2);
  k0w.re[0 * 2 + 0] = Math.sqrt(1 - gamma);
  k0w.re[1 * 2 + 1] = 1;
  const k1w = mat(2, 2);
  k1w.re[1 * 2 + 0] = Math.sqrt(gamma); // row 1, col 0: |1><0| moves |0> into the world
  return [kron(k0w, identity(DATA_DIM)), kron(k1w, identity(DATA_DIM))];
}

export function applyLaw(rho: CMat, gamma: number = GAMMA): CMat {
  return applyKraus(rho, lawKraus(gamma));
}

export function iterateLaw(rho: CMat, steps: number, gamma: number = GAMMA): CMat {
  let cur = rho;
  for (let k = 0; k < steps; k++) cur = applyLaw(cur, gamma);
  return cur;
}

/** Membership charge V(rho) = Tr[Pi_W rho] — choice-lang R6's functional. */
export function membershipCharge(rho: CMat): number {
  let v = 0;
  // indices bounded by k < DATA_DIM with FULL_DIM*FULL_DIM storage (max 15 < 16)
  for (let k = 0; k < DATA_DIM; k++) v += rho.re[(DATA_DIM + k) * FULL_DIM + (DATA_DIM + k)]!;
  return v;
}

export function leakage(rho: CMat): number {
  return 1 - membershipCharge(rho);
}

/** Sector coherence: the trace of the (W-row, perp-col) block. */
export function sectorCoherence(rho: CMat): { re: number; im: number } {
  let re = 0;
  let im = 0;
  // indices bounded by k < DATA_DIM with FULL_DIM*FULL_DIM storage (max 11 < 16)
  for (let k = 0; k < DATA_DIM; k++) {
    re += rho.re[(DATA_DIM + k) * FULL_DIM + k]!;
    im += rho.im[(DATA_DIM + k) * FULL_DIM + k]!;
  }
  return { re, im };
}

/** The k->infinity state: both diagonal blocks SUMMED INTO the world, sector
 * coherences dead. The complement block does not stay in place — K1 carries
 * |0,x> to |1,x>, so the cargo rides into the world with its data intact.
 * This is what the law converges to: the CONTENTS are the initial diagonal
 * blocks (path-dependent), never chosen by the law. */
export function collapseIntoWorld(rho: CMat): CMat {
  const out = mat(FULL_DIM, FULL_DIM);
  for (let a = 0; a < DATA_DIM; a++) {
    for (let b = 0; b < DATA_DIM; b++) {
      const inWorld = (DATA_DIM + a) * FULL_DIM + (DATA_DIM + b);
      const inComp = a * FULL_DIM + b;
      // a,b < DATA_DIM bound both indices below 16 (FULL_DIM*FULL_DIM)
      out.re[inWorld] = rho.re[inWorld]! + rho.re[inComp]!;
      out.im[inWorld] = rho.im[inWorld]! + rho.im[inComp]!;
    }
  }
  return out;
}

/** Embed a data state inside the world: |1><1| ⊗ rho_data. */
export function inWorldState(rhoData: CMat): CMat {
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  return kron(p1, rhoData);
}

/** Embed a data state outside the world: |0><0| ⊗ rho_data. */
export function outOfWorldState(rhoData: CMat): CMat {
  const p0 = mat(2, 2);
  p0.re[0] = 1;
  return kron(p0, rhoData);
}

/** Random unitary by complex Gram-Schmidt (QR) on Gaussian columns, each
 * orthonormalized column then re-phased by an independent random phase.
 * Deliberately NOT exp(iH): the family eigensolver's reconstruction check is
 * PSD-only and rejects indefinite spectra. */
export function randomUnitary(rng: Rng, d: number): CMat {
  const cols: Array<{ re: Float64Array; im: Float64Array }> = [];
  for (let j = 0; j < d; j++) {
    const v = { re: new Float64Array(d), im: new Float64Array(d) };
    for (let i = 0; i < d; i++) {
      v.re[i] = rng.normal();
      v.im[i] = rng.normal();
    }
    for (let pass = 0; pass < 2; pass++) {
      for (const q of cols) {
        let dr = 0;
        let di = 0;
        for (let i = 0; i < d; i++) {
          // <q, v> = sum conj(q_i) v_i — i < d bounds every access (arrays length d)
          dr += q.re[i]! * v.re[i]! + q.im[i]! * v.im[i]!;
          di += q.re[i]! * v.im[i]! - q.im[i]! * v.re[i]!;
        }
        for (let i = 0; i < d; i++) {
          v.re[i] = v.re[i]! - (dr * q.re[i]! - di * q.im[i]!);
          v.im[i] = v.im[i]! - (dr * q.im[i]! + di * q.re[i]!);
        }
      }
    }
    let nrm = 0;
    for (let i = 0; i < d; i++) nrm += v.re[i]! * v.re[i]! + v.im[i]! * v.im[i]!;
    nrm = Math.sqrt(nrm);
    if (nrm < 1e-12) throw new Error("randomUnitary: degenerate draw");
    const phase = rng() * 2 * Math.PI;
    const c = Math.cos(phase) / nrm;
    const s = Math.sin(phase) / nrm;
    for (let i = 0; i < d; i++) {
      const re = v.re[i]!;
      const im = v.im[i]!;
      v.re[i] = c * re - s * im;
      v.im[i] = s * re + c * im;
    }
    cols.push(v);
  }
  const u = mat(d, d);
  // cols holds exactly d columns (one pushed per j-iteration), each length d
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < d; i++) {
      u.re[i * d + j] = cols[j]!.re[i]!;
      u.im[i * d + j] = cols[j]!.im[i]!;
    }
  }
  return u;
}

/**
 * A random branch-block unitary — choice-lang's engineered program, one step:
 * its own unitary on data inside the world, its own outside, control spared.
 * Block-diagonal in the world bit: U = |1><1|⊗A + |0><0|⊗B.
 */
export function randomBranchUnitary(rng: Rng): CMat {
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  const p0 = mat(2, 2);
  p0.re[0] = 1;
  return mAdd(kron(p1, randomUnitary(rng, DATA_DIM)), kron(p0, randomUnitary(rng, DATA_DIM)));
}

/**
 * Random CPTP Kraus set via Stinespring: a random unitary on system ⊗ env,
 * sliced over the env preparation |0>. Completeness Sum K†K = I is asserted
 * by the tests, not assumed here.
 */
export function randomCptpKraus(rng: Rng, d: number, envDim: number): CMat[] {
  const big = randomUnitary(rng, d * envDim);
  const kraus: CMat[] = [];
  for (let j = 0; j < envDim; j++) {
    const k = mat(d, d);
    for (let i = 0; i < d; i++) {
      for (let ip = 0; ip < d; ip++) {
        // big is (d*envDim) square; max index = (d*envDim)^2 - envDim < length
        k.re[i * d + ip] = big.re[(i * envDim + j) * (d * envDim) + ip * envDim]!;
        k.im[i * d + ip] = big.im[(i * envDim + j) * (d * envDim) + ip * envDim]!;
      }
    }
    kraus.push(k);
  }
  return kraus;
}

/** The perturbed law Phi_eps = (1-eps) Phi + eps N as one application. */
export function applyPerturbed(rho: CMat, nKraus: readonly CMat[], eps: number, gamma: number = GAMMA): CMat {
  const viaLaw = applyKraus(rho, lawKraus(gamma));
  const viaN = applyKraus(rho, nKraus);
  return mAdd(mScale(viaLaw, 1 - eps), mScale(viaN, eps));
}

/** The exact algebra bound on asymptotic leakage under the perturbed law. */
export function perturbedLeakageBound(eps: number, gamma: number = GAMMA): number {
  return eps / (1 - (1 - eps) * (1 - gamma));
}

/** Binary entropy, log2 route (the ln route lives in the tests' dual check). */
export function h2(q: number): number {
  if (q <= 0 || q >= 1) return 0;
  return -q * Math.log2(q) - (1 - q) * Math.log2(1 - q);
}

/** Two-rate escape chain (classical, on the world bit): W -> perp at rate r,
 * perp -> W at rate gamma. In-world probability after k steps from W. */
export function twoRateInWorld(k: number, r: number, gamma: number = GAMMA): number {
  const wStar = gamma / (r + gamma);
  return wStar + (1 - r - gamma) ** k * (1 - wStar);
}

export function twoRateRecursion(k: number, r: number, gamma: number = GAMMA): number {
  let w = 1;
  for (let step = 0; step < k; step++) w = (1 - r) * w + gamma * (1 - w);
  return w;
}

/**
 * ===== The sixty-visit additions: the authored Hamiltonian's two faces =====
 *
 * The register carries ONE authored Hamiltonian H = ΔE·Pi_perp — the
 * complement sits ΔE above the world, the world is the ground sector. Two
 * previously-unpriced boundary sentences hang off it:
 *
 *   AT7 the COHERENT face of the tariff: H is diagonal in the sector basis,
 *      so dephasing preserves <H> exactly and the free-energy identity
 *      F(rho) - F(Delta rho) = kT ln2 * C_rel(rho) is exact, where
 *      C_rel = S(Delta rho) - S(rho) is the relative entropy of SECTOR
 *      coherence. The law is an incoherent operation (each Kraus column
 *      supported on one basis vector), so it can never harvest that value —
 *      it destroys it, monotonically, at exactly twice the classical rate.
 *
 *   AT8 the THERMAL reading: a bath obeying detailed balance
 *      r_up/r_down = e^{-ΔE/kT} turns the escape chain's stationary
 *      occupancy into the Boltzmann logistic 1/(1+e^{-βΔE}), ships the
 *      escape readings, and yields the design rule βΔE >= ln(Kγ/δ).
 */

/** Boltzmann constant, exact SI 2019 (J/K) — the k behind route-price's kT·ln2. */
export const K_B = 1.380649e-23;
/** Planck constant, exact SI 2019 (J·s). */
export const H_PLANCK = 6.62607015e-34;

/** Sector dephasing Delta: kills the two off-diagonal blocks, keeps both
 * diagonal blocks verbatim. C_rel's reference channel. */
export function sectorDephase(rho: CMat): CMat {
  const out = mat(FULL_DIM, FULL_DIM);
  for (let i = 0; i < FULL_DIM; i++) {
    for (let j = 0; j < FULL_DIM; j++) {
      const sameBlock = (i >= DATA_DIM && j >= DATA_DIM) || (i < DATA_DIM && j < DATA_DIM);
      if (sameBlock) {
        out.re[i * FULL_DIM + j] = rho.re[i * FULL_DIM + j]!;
        out.im[i * FULL_DIM + j] = rho.im[i * FULL_DIM + j]!;
      }
    }
  }
  return out;
}

/** The relative entropy of sector coherence C_rel(rho) = S(Delta rho) - S(rho),
 * in bits — the nonequilibrium value the coherent face carries. */
export function coherenceBits(rho: CMat): number {
  return vonNeumannEntropy(sectorDephase(rho)) - vonNeumannEntropy(rho);
}

/** The authored Hamiltonian H = ΔE·Pi_perp (diagonal in the sector basis). */
export function authoredHamiltonian(dE: number): CMat {
  const h = mat(FULL_DIM, FULL_DIM);
  for (let k = 0; k < DATA_DIM; k++) h.re[k * FULL_DIM + k] = dE;
  return h;
}

/** Tr[H rho] for a diagonal H — the expectation dephasing must preserve. */
export function diagonalExpectation(rho: CMat, h: CMat): number {
  let v = 0;
  for (let i = 0; i < FULL_DIM; i++) v += h.re[i * FULL_DIM + i]! * rho.re[i * FULL_DIM + i]!;
  return v;
}

/** Incoherence probe: the max number of basis vectors any column of K
 * feeds (1 = incoherent operator, FULL_DIM = fully coherent). */
export function columnBasisSupport(k: CMat): number {
  let worst = 0;
  for (let c = 0; c < k.cols; c++) {
    let nz = 0;
    for (let r = 0; r < k.rows; r++) {
      if (Math.hypot(k.re[r * k.cols + c] ?? 0, k.im[r * k.cols + c] ?? 0) > 1e-12) nz++;
    }
    worst = Math.max(worst, nz);
  }
  return worst;
}

/** Sector-coherence decay rate −(1/2)ln(1−γ) per law step (the coherent face). */
export function coherenceDecayRate(gamma: number = GAMMA): number {
  return -0.5 * Math.log(1 - gamma);
}

/** Population decay rate −ln(1−γ) per law step (the classical face). */
export function populationDecayRate(gamma: number = GAMMA): number {
  return -Math.log(1 - gamma);
}

/** Detailed-balance up-rate: r_up = γ·e^{−βΔE} with r_up/r_down = e^{−βΔE}. */
export function thermalUpRate(betaGap: number, gamma: number = GAMMA): number {
  return gamma * Math.exp(-betaGap);
}

/** Stationary in-world probability of the two-rate chain (AT6's w*). */
export function stationaryInWorld(r: number, gamma: number = GAMMA): number {
  return gamma / (gamma + r);
}

/** The Boltzmann logistic occupancy 1/(1+e^{−βΔE}) — what w* becomes thermally. */
export function boltzmannOccupancy(betaGap: number): number {
  return 1 / (1 + Math.exp(-betaGap));
}

/** Escape probability at horizon K under up-rate r (AT6's closed form, in the
 * cancellation-free arrangement (1-w*)(1-(1-r-gamma)^K) with 1-w* = r/(r+gamma)
 * computed first — the naive 1 - w(K) underflows at small r: float64 floors at
 * 2.2e-16, the thermal readings go far below). */
export function escapeAtHorizon(K: number, r: number, gamma: number = GAMMA): number {
  const leakShare = r / (gamma + r);
  return leakShare * (1 - Math.pow(1 - r - gamma, K));
}

/** The design rule: the βΔE that holds escape <= δ over horizon K. */
export function escapeDesignRuleBeta(K: number, delta: number, gamma: number = GAMMA): number {
  return Math.log((K * gamma) / delta);
}

/** βΔE = hf/(kT) for a physical gap (exact SI arithmetic on exact constants). */
export function betaGapOfFrequency(freqHz: number, T: number): number {
  return (H_PLANCK * freqHz) / (K_B * T);
}

/**
 * ===== The sixty-first-visit additions: the microscopic bath and the
 * coherent shortcut =====
 *
 * The bath is no longer authored rates — it is COLLISIONS. Resonant bath
 * qubits (same gap ΔE, basis |0_b> excited) arrive in the Gibbs state; the
 * energy-conserving exchange exp(-i theta S) rotates each resonant pair
 * (|0,x;1_b> <-> |1,x;0_b>) and leaves the dark pairs fixed. Out of the
 * machine: detailed balance r/g = e^{-beta dE} EXACTLY for every theta and
 * beta; the world-bit populations follow the two-rate chain per collision;
 * the stationary register is Gibbs-world x cargo; and at T=0 the collision
 * IS the law (sin^2 theta = gamma) — the law is the zero-temperature member
 * of its own bath family.
 *
 * The coherent shortcut is the SAME object at theta = pi/2 against a pure
 * ground weight: an energy-conserving permutation that reaches the law's
 * k->infinity state on the register in ONE step, conserving the full-basis
 * coherence exactly and banking the sector bit on the weight for straddlers
 * — coherent protocols CONSERVE what incoherent laws DISSIPATE.
 */

/** Register (4) x bath (2) basis index. */
function regBathIndex(w: number, x: number, b: number): number {
  return (w * DATA_DIM + x) * 2 + b;
}

/** The energy-conserving exchange exp(-i theta S) on register x bath (8x8):
 * pairs (|0,x;1_b> <-> |1,x;0_b>) rotate by theta; dark pairs fixed. */
export function exchangeUnitary(theta: number): CMat {
  const u = identity(FULL_DIM * DATA_DIM);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  for (let x = 0; x < DATA_DIM; x++) {
    const a = regBathIndex(0, x, 1);
    const b = regBathIndex(1, x, 0);
    u.re[a * 8 + a] = c;
    u.im[a * 8 + a] = 0;
    u.re[b * 8 + b] = c;
    u.im[b * 8 + b] = 0;
    u.re[a * 8 + b] = 0;
    u.im[a * 8 + b] = -s;
    u.re[b * 8 + a] = 0;
    u.im[b * 8 + a] = -s;
  }
  return u;
}

/** The Gibbs state of a resonant bath qubit (basis |0_b> excited first). */
export function bathGibbs(betaGap: number): CMat {
  const q = Math.exp(-betaGap) / (1 + Math.exp(-betaGap));
  const rho = mat(DATA_DIM, DATA_DIM);
  rho.re[0] = q;
  rho.re[3] = 1 - q;
  return rho;
}

/** The collision channel's exact world-bit rates: into-world (gamma-tilde,
 * de-excitation) and out-of-world (r-tilde, excitation). Ratio exactly
 * e^{-beta dE} whatever theta. */
export function collisionRates(theta: number, betaGap: number): { into: number; outOf: number } {
  const s2 = Math.sin(theta) ** 2;
  return { into: s2 / (1 + Math.exp(-betaGap)), outOf: (s2 * Math.exp(-betaGap)) / (1 + Math.exp(-betaGap)) };
}

/** One collision: Phi(rho) = Tr_B[U (rho x rho_B) U^dag]. */
export function applyCollision(rho: CMat, theta: number, betaGap: number): CMat {
  const full = applyUnitary(kron(rho, bathGibbs(betaGap)), exchangeUnitary(theta));
  return partialTrace(full, [FULL_DIM, DATA_DIM], [1]);
}

/** The coherent shortcut: the theta = pi/2 exchange against a pure GROUND
 * weight — an energy-conserving permutation of the register x weight basis. */
export function coherentShortcut(rho: CMat): { register: CMat; weight: CMat; total: CMat } {
  const ground = mat(DATA_DIM, DATA_DIM);
  ground.re[3] = 1; // |1_w> ground
  const total = applyUnitary(kron(rho, ground), exchangeUnitary(Math.PI / 2));
  return {
    register: partialTrace(total, [FULL_DIM, DATA_DIM], [1]),
    weight: partialTrace(total, [FULL_DIM, DATA_DIM], [0]),
    total,
  };
}

/** Relative entropy of coherence w.r.t. the FULL diagonal basis of any
 * square state (the conserved charge of incoherent permutations). */
export function totalCoherenceBits(rho: CMat): number {
  const n = rho.rows;
  const d = mat(n, n);
  for (let i = 0; i < n; i++) d.re[i * n + i] = rho.re[i * n + i]!;
  return vonNeumannEntropy(d) - vonNeumannEntropy(rho);
}

/**
 * ===== The sixty-second-visit additions: the continuum limit executed and
 * the shortcut's audit ledger =====
 *
 * The continuum (Davies) limit is executed as a DISCRETE convergence
 * theorem: at every finite coupling the populations follow the two-rate
 * recursion with NO higher corrections, the within-block cargo coherences
 * mix by the 2x2 matrix M (columns sum 1, eigenvalues {1, 1-s^2}), and the
 * sector coherence dies at cos(theta)^n — all exact. The limit t = n s^2
 * only replaces geometrics by exponentials ((1-s^2)^n -> e^{-t},
 * cos^n -> e^{-t/2}) with error exactly O(t s^2) — and RESTORES the
 * textbook Davies coherence rate (gamma-down + gamma-up)/2 = 1/2 that
 * every finite coupling hides (cos theta is temperature-free; the limit
 * absorbs p_b + q_b = 1 into the clock).
 *
 * The audit ledger: the shortcut's output satisfies the exact three-term
 * decomposition C^8 = C^4(register) + C^2(weight) + (I - J_c) — local
 * coherences plus the coherence of correlation (I >= J_c by data
 * processing) — and V-star is a permutation, so its inverse restores the
 * input exactly: what the law burns is reconstructible from the records.
 */

/** The exact closed form of the within-block cargo-coherence mixing under n
 * collisions: M^n = (q,p)^T (1,1) + (1-s^2)^n [I - (q,p)^T (1,1)]. */
export function collisionBlockMixing(
  n: number,
  theta: number,
  betaGap: number,
  ss0: number,
  ww0: number,
): { ss: number; ww: number } {
  const pB = 1 / (1 + Math.exp(-betaGap));
  const qB = 1 - pB;
  const lam = Math.pow(1 - Math.sin(theta) ** 2, n);
  const tot = ss0 + ww0;
  return { ss: qB * tot + lam * (ss0 - qB * tot), ww: pB * tot + lam * (ww0 - pB * tot) };
}

/**
 * ===== The sixty-third-visit additions: the generator's Lindblad form and
 * the phase-alignment banking =====
 *
 * (1) The extraction limit (Phi_theta - id)/sin^2(theta) IS the Lindblad
 * operator with the Davies rates — L-down = sqrt(p_b)|1><0|(x)I,
 * L-up = sqrt(q_b)|0><1|(x)I, interaction picture (no free rotation
 * between instantaneous collisions). The machine verifies the match at
 * O(theta^2) on arbitrary states, and the composition convergence is
 * UNIFORM over the state space (sup over pure states, census).
 *
 * (2) The correlation term of AT12's ledger is one-shot bankable IN PART by
 * an INCOHERENT controlled-phase controller: the shortcut's output has
 * weight-coherence elements sigma_r (r in the world block), the naive bank
 * is |sum_r sigma_r|, and the controller diag(1, e^{i arg(sigma_r)})_r —
 * diagonal in the product basis, hence incoherent — raises the bank to
 * sum_r |sigma_r| EXACTLY (the triangle inequality attained). The residual
 * gap to C_total is the genuine correlation coherence: quantum-side-
 * information territory (WY16, cited).
 */

/** The Lindblad RHS with the Davies rates (interaction picture): jump-down
 * sqrt(pDown)|1><0| and jump-up sqrt(pUp)|0><1|, identity on cargo. */
export function lindbladRhs(rho: CMat, pDown: number, pUp: number): CMat {
  const l1 = mat(2, 2);
  l1.re[1 * 2 + 0] = Math.sqrt(pDown);
  const l2 = mat(2, 2);
  l2.re[0 * 2 + 1] = Math.sqrt(pUp);
  const big1 = kron(l1, identity(DATA_DIM));
  const big2 = kron(l2, identity(DATA_DIM));
  const term = (L: CMat): CMat =>
    mAdd(
      mMul(L, mMul(rho, mDagger(L))),
      mScale(mAdd(mMul(mDagger(L), mMul(L, rho)), mMul(rho, mMul(mDagger(L), L))), -0.5),
    );
  return mAdd(term(big1), term(big2));
}

/** The extraction (Phi_theta(rho) - rho)/sin^2(theta): converges to the
 * Lindblad operator as theta -> 0 at O(theta^2). */
export function extractedGenerator(rho: CMat, theta: number, betaGap: number): CMat {
  return mScale(mAdd(applyCollision(rho, theta, betaGap), mScale(rho, -1)), 1 / Math.sin(theta) ** 2);
}

/** The phase-alignment bank: the l1-optimal weight coherence sum_r |sigma_r|
 * and the controller's realized bank after alignment (they agree exactly). */
export function alignedBank(total: CMat): { naive: number; aligned: number; l1: number } {
  const elem = (r: number): { re: number; im: number } => ({
    re: total.re[(r * 2 + 0) * 8 + (r * 2 + 1)] ?? 0,
    im: total.im[(r * 2 + 0) * 8 + (r * 2 + 1)] ?? 0,
  });
  const worldRs = [DATA_DIM, DATA_DIM + 1];
  let naiveRe = 0;
  let naiveIm = 0;
  let l1 = 0;
  const u = identity(FULL_DIM * DATA_DIM);
  for (const r of worldRs) {
    const e = elem(r);
    naiveRe += e.re;
    naiveIm += e.im;
    l1 += Math.hypot(e.re, e.im);
    const phase = Math.atan2(e.im, e.re); // U rho U^dag multiplies sigma_r by e^{-i phi}: phi = +arg aligns
    const c = Math.cos(phase);
    const s = Math.sin(phase);
    const d = (r * 2 + 1) * 8 + (r * 2 + 1);
    u.re[d] = c;
    u.im[d] = s;
  }
  const alignedState = applyUnitary(total, u);
  let aRe = 0;
  let aIm = 0;
  for (let r = 0; r < FULL_DIM; r++) {
    aRe += alignedState.re[(r * 2 + 0) * 8 + (r * 2 + 1)] ?? 0;
    aIm += alignedState.im[(r * 2 + 0) * 8 + (r * 2 + 1)] ?? 0;
  }
  return { naive: Math.hypot(naiveRe, naiveIm), aligned: Math.hypot(aRe, aIm), l1 };
}

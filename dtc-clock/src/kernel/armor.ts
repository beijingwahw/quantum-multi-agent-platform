/**
 * THE ARMOR — v0.5.0, the priced boundary of TC17/TC24 ("noise and error
 * correction unmodeled — that wall is priced by the epoch it belongs to"):
 * the Hamming armor's full dynamics under SUSTAINED fire. Three laws:
 *
 *   (A1) THE ABSORPTION RADIUS (EXACT): the clock register is the REPETITION
 *        CODE [n, 1, n] and the keying layer is its MAJORITY DECODER — the
 *        absorption radius is exactly r = floor((n-1)/2). X-type noise on a
 *        FIXED set S of qubits (any flip rate, all positions, all histories)
 *        leaves the token exactly on schedule for every |S| <= r, because
 *        the corrupted orbit |pole(t) XOR mask> never leaves the keying
 *        sector: at even strobes popcount = popcount(mask) <= r < n/2, at
 *        odd strobes n - popcount(mask) >= n - r > n/2. A full-strength
 *        depolarizing channel on the same set is absorbed for the same
 *        reason (every Kraus image of a basis state stays within the set's
 *        popcount band). The wall is real: |S| >= n/2 (even n) can plant
 *        popcount exactly n/2 and the keying MISFIRES — the negative
 *        control. The radius law r = floor((d-1)/2) for distance d is the
 *        classical correction-radius theorem (HAM50) holding here for a
 *        QUANTUM clock register at the keying layer.
 *   (A2) THE CLASSICAL SHADOW (EXACT): under delocalized X-noise (each
 *        clock qubit flips independently with prob p per period) the token
 *        process is EXACTLY classical — a functional of the popcount random
 *        walk of the accumulated mask. The dense (CD)^2 density-matrix
 *        census and a dynamic program over (popcount, token drift) agree to
 *        the rounding floor; the clock marginal is diagonal at every strobe
 *        (its entropy is the Shannon entropy of the mask distribution).
 *        The fire rule is parity-quantized: period t fires iff
 *        (t even AND w < n/2) OR (t odd AND w > n/2) — so an excursion into
 *        the INVERTED sector refunds its even-strobe misses with odd-strobe
 *        advances: the armor erodes AND PARTIALLY SELF-HEALS (fidelity
 *        strictly above sector survival — the numbers, not the intuition).
 *   (A3) THE REPAIR TARIFF: majority decoding executed as a 1-bit sector
 *        read at each period top plus a conditional global flip (unitary)
 *        resets the mask to the clean pole's side. At ODD n the decoder can
 *        never tie (n/2 is not an integer): the repaired token fidelity is
 *        EXACTLY 1 under sustained delocalized fire — error correction at
 *        the clock layer, priced, not free. The price: the syndrome bit's
 *        Shannon entropy per cycle, 0 in the noiseless ideal, metered under
 *        fire (the B4 maintenance row). At EVEN n the tie set
 *        {popcount = n/2} is the decoder's own dead zone — the honest
 *        boundary, censused.
 */
import { type CMat, basisVec, kron, vKron } from "../core/cmat.js";
import { vecToRho } from "../core/states.js";
import { vonNeumannEntropy } from "../core/measures.js";
import { popcount, type RevGate } from "./compile.js";
import { polarizedRho } from "./beat.js";
import {
  clockReduced,
  compositePeriod,
  makeComposite,
  tokenProb,
  type CompositeDims,
} from "./clock.js";

// ---------------------------------------------------------------------------
// The radius law — fixed before the censuses (the number is law, the census
// checks it, the negative control convicts the off-by-one).
// ---------------------------------------------------------------------------

/** The absorption radius of the n-qubit clock register: r = floor((n-1)/2). */
export function absorptionRadius(n: number): number {
  return Math.floor((n - 1) / 2);
}

// ---------------------------------------------------------------------------
// Structured per-qubit channels on the composite (clock bit i of the clock
// index z; all O((CD)^2) index/sign maps, never dense multiplies).
// ---------------------------------------------------------------------------

function bitFlipChannel(rho: CMat, dims: CompositeDims, qubit: number, q: number): CMat {
  const out: CMat = {
    rows: rho.rows,
    cols: rho.cols,
    re: new Float64Array(rho.re.length),
    im: new Float64Array(rho.im.length),
  };
  const b = 1 << qubit;
  const d = rho.cols;
  for (let z1 = 0; z1 < dims.clockDim; z1++) {
    const f1 = z1 ^ b;
    for (let d1 = 0; d1 < dims.runnerDim; d1++) {
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const f2 = z2 ^ b;
        for (let d2 = 0; d2 < dims.runnerDim; d2++) {
          const dst = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
          const src = (f1 * dims.runnerDim + d1) * d + (f2 * dims.runnerDim + d2);
          out.re[dst] = (1 - q) * rho.re[dst]! + q * rho.re[src]!;
          out.im[dst] = (1 - q) * rho.im[dst]! + q * rho.im[src]!;
        }
      }
    }
  }
  return out;
}

/**
 * Depolarizing on clock qubit i: rho -> (1-p) rho + (p/3)(X r X + Y r Y +
 * Z r Z). With s(z1)s(z2) the Z-conjugation sign and srcX the X-conjugation
 * source, Y = XZ composes them — one pass, O((CD)^2).
 */
function depolarizeChannel(rho: CMat, dims: CompositeDims, qubit: number, p: number): CMat {
  const out: CMat = {
    rows: rho.rows,
    cols: rho.cols,
    re: new Float64Array(rho.re.length),
    im: new Float64Array(rho.im.length),
  };
  const b = 1 << qubit;
  const d = rho.cols;
  for (let z1 = 0; z1 < dims.clockDim; z1++) {
    const f1 = z1 ^ b;
    const s1 = ((z1 >> qubit) & 1) === 1 ? -1 : 1;
    for (let d1 = 0; d1 < dims.runnerDim; d1++) {
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const f2 = z2 ^ b;
        const s2 = ((z2 >> qubit) & 1) === 1 ? -1 : 1;
        const s = s1 * s2;
        for (let d2 = 0; d2 < dims.runnerDim; d2++) {
          const dst = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
          const src = (f1 * dims.runnerDim + d1) * d + (f2 * dims.runnerDim + d2);
          const xTerm = rho.re[src]!;
          const yTerm = s * rho.re[src]!;
          out.re[dst] = (1 - p) * rho.re[dst]! + (p / 3) * (s * rho.re[dst]! + xTerm + yTerm);
          out.im[dst] = (1 - p) * rho.im[dst]! + (p / 3) * (s * rho.im[dst]! + rho.im[src]! + s * rho.im[src]!);
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Censuses under localized fire (fixed noisy set S) — the radius layer.
// ---------------------------------------------------------------------------

export interface ArmorRow {
  readonly probe: string;
  readonly beat: number;
  readonly advanceFidelity: number;
  readonly clockEntropyBits: number;
}

function armorCensus(
  n: number,
  subset: readonly number[],
  strength: number,
  gates: readonly RevGate[],
  m: number,
  kind: "flip" | "depol",
): ArmorRow[] {
  const rows: ArmorRow[] = [];
  const dims = makeComposite(n, gates, m);
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  const periods = gates.length * 2;
  for (let t = 1; t <= periods; t++) {
    rho = compositePeriod(rho, dims);
    for (const qubit of subset) {
      rho =
        kind === "flip"
          ? bitFlipChannel(rho, dims, qubit, strength)
          : depolarizeChannel(rho, dims, qubit, strength);
    }
    if (t % 2 === 0) {
      const red = clockReduced(rho, dims);
      rows.push({
        probe: `${kind} S={${subset.join(",")}} s=${strength}`,
        beat: t / 2,
        advanceFidelity: tokenProb(rho, dims, m, t / 2),
        clockEntropyBits: vonNeumannEntropy(red),
      });
    }
  }
  return rows;
}

/** X-flips on every qubit of `subset`, each with prob q per period. */
export function localizedFlipCensus(
  n: number,
  subset: readonly number[],
  q: number,
  gates: readonly RevGate[],
  m: number,
): ArmorRow[] {
  return armorCensus(n, subset, q, gates, m, "flip");
}

/** Full depolarizing (p) on every qubit of `subset`, per period. */
export function localizedDepolCensus(
  n: number,
  subset: readonly number[],
  p: number,
  gates: readonly RevGate[],
  m: number,
): ArmorRow[] {
  return armorCensus(n, subset, p, gates, m, "depol");
}

/** All subsets of {0..n-1} of the given size (combinations, index order). */
export function subsetsOfSize(n: number, size: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];
  const walk = (start: number): void => {
    if (cur.length === size) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < n; i++) {
      cur.push(i);
      walk(i + 1);
      cur.pop();
    }
  };
  walk(0);
  return out;
}

export interface RadiusRow {
  readonly n: number;
  readonly size: number; // |S|
  readonly subsets: number; // how many probed (C(n, size) when exhaustive)
  readonly worstFidelity: number; // min last-beat advance fidelity over the subsets
  readonly worstEntropyBits: number; // max clock entropy over the subsets
}

/** The radius census: every |S|-subset under X-fire at rate q, worst case. */
export function radiusCensus(
  n: number,
  size: number,
  q: number,
  gates: readonly RevGate[],
  m: number,
): RadiusRow {
  const subsets = subsetsOfSize(n, size);
  let worstFidelity = 1;
  let worstEntropy = 0;
  for (const s of subsets) {
    const rows = localizedFlipCensus(n, s, q, gates, m);
    const last = rows[rows.length - 1]!;
    worstFidelity = Math.min(worstFidelity, last.advanceFidelity);
    worstEntropy = Math.max(worstEntropy, last.clockEntropyBits);
  }
  return { n, size, subsets: subsets.length, worstFidelity, worstEntropyBits: worstEntropy };
}

// ---------------------------------------------------------------------------
// (A2) The classical shadow — the exact DP, and the quantum censuses it must
// match to the rounding floor.
// ---------------------------------------------------------------------------

/**
 * The armor fire rule (law): period t (1-indexed) fires the runner advance
 * iff the pre-noise mask popcount w sits strictly on the strobe-parity's
 * clean side of the keying boundary — (t even AND w < n/2) OR (t odd AND
 * w > n/2). Injecting a different rule is the forgery the equivalence
 * witness must convict.
 */
export type FireRule = (w: number, period: number) => boolean;

export function armorFireRule(n: number): FireRule {
  return (w: number, period: number) =>
    (period % 2 === 0 && w < n / 2) || (period % 2 === 1 && w > n / 2);
}

export interface ShadowResult {
  /** fidelity[t-1] = P(token drift D_t = 0) after period t. */
  readonly fidelity: readonly number[];
  /** survival[t-1] = P(popcount < n/2 at every top up to t). */
  readonly survival: readonly number[];
  /** mean H2(P(wrong sector at top)) in bits — the repair tariff's meter. */
  readonly meanSyndromeBits: number;
  /** mean [H2(P(tie)) + P(tie) * log2C(n,n/2)] — the tie tariff's meter. */
  readonly meanTieBits: number;
}

function binomials(n: number): Float64Array[] {
  const rows: Float64Array[] = [];
  for (let k = 0; k <= n; k++) {
    const row = new Float64Array(k + 1);
    row[0] = 1;
    for (let j = 1; j <= k; j++) row[j] = (row[j - 1]! * (k - j + 1)) / j;
    rows.push(row);
  }
  return rows;
}

/**
 * The exact shadow: a DP over (popcount w, drift D) — the token process of
 * the noisy clock. Noise transitions are the independent-bit flip law
 * w -> w + a - b with prob C(n-w,a)C(w,b) p^{a+b} (1-p)^{n-a-b}; the fire
 * rule is injected so the honest law and forgeries share one machine.
 * With repair=true, each period top applies w <- min(w, n-w) (the majority
 * decode) and the syndrome bit's entropy is metered.
 */
export function popcountShadow(
  n: number,
  p: number,
  periods: number,
  fire: FireRule = armorFireRule(n),
  repair = false,
  tieReset = false,
): ShadowResult {
  const binom = binomials(n);
  const width = 2 * periods + 1; // drift D in [-periods, periods]
  let dist = new Float64Array((n + 1) * width); // [w * width + (D + periods)]
  dist[periods] = 1; // w = 0, D = 0
  // the pure chain: popcount only, absorbing at w >= n/2 (the strict armor)
  let pure = new Float64Array(n + 1);
  pure[0] = 1;
  const fidelity: number[] = [];
  const survival: number[] = [];
  let entropySum = 0;
  let tieSum = 0;
  const tieTariff = tieResetBits(n);
  for (let t = 1; t <= periods; t++) {
    const next = new Float64Array((n + 1) * width);
    const nextPure = new Float64Array(n + 1);
    for (let w = 0; w <= n; w++) {
      // independent-bit noise: w -> w + a - b with the binomial pair law
      for (let a = 0; a <= n - w; a++) {
        for (let b = 0; b <= w; b++) {
          const wNext = w + a - b;
          const prob =
            binom[n - w]![a]! * binom[w]![b]! * Math.pow(p, a + b) * Math.pow(1 - p, n - a - b);
          if (prob === 0) continue;
          const fired = fire(w, t);
          const shift = (fired ? 1 : 0) - (t % 2 === 0 ? 1 : 0);
          for (let dd = 0; dd < width; dd++) {
            const mass = dist[w * width + dd]!;
            if (mass === 0) continue;
            const idx = wNext * width + dd + shift;
            next[idx] = next[idx]! + mass * prob;
          }
          nextPure[wNext] = nextPure[wNext]! + pure[w]! * prob;
        }
      }
    }
    dist = next;
    pure = nextPure;
    // the syndrome meter reads the POST-noise, PRE-repair clock: wrong
    // sector at top t means (t even AND w >= n/2) OR (t odd AND w > n/2)
    let wrongProb = 0;
    for (let w = 0; w <= n; w++) {
      const wrong = t % 2 === 0 ? w >= n / 2 : w > n / 2;
      if (!wrong) continue;
      for (let dd = 0; dd < width; dd++) wrongProb += dist[w * width + dd]!;
    }
    entropySum +=
      wrongProb > 0 && wrongProb < 1
        ? -(wrongProb * Math.log2(wrongProb) + (1 - wrongProb) * Math.log2(1 - wrongProb))
        : 0;
    // the tie meter reads the same POST-noise, PRE-repair clock: the amortized
    // erasure H2(p_tie) + p_tie * log2C(n, n/2) (exact by exchangeability)
    let pTie = 0;
    if (n % 2 === 0) {
      for (let dd = 0; dd < width; dd++) pTie += dist[(n / 2) * width + dd]!;
    }
    tieSum +=
      pTie > 0 && pTie < 1
        ? -(pTie * Math.log2(pTie) + (1 - pTie) * Math.log2(1 - pTie)) + pTie * tieTariff
        : 0;
    if (repair) {
      // majority decode at the top: w <- min(w, n - w); with tieReset the
      // tie n/2 is reset to the pole outright (w <- 0), else it passes
      // through unrepaired (the v0.5.0 dead zone)
      const repairedDist = new Float64Array((n + 1) * width);
      const repairedPure = new Float64Array(n + 1);
      for (let w = 0; w <= n; w++) {
        const target = tieReset && w === n / 2 ? 0 : Math.min(w, n - w);
        for (let dd = 0; dd < width; dd++) {
          repairedDist[target * width + dd] = repairedDist[target * width + dd]! + dist[w * width + dd]!;
        }
        repairedPure[target] = repairedPure[target]! + pure[w]!;
      }
      dist = repairedDist;
      pure = repairedPure;
      // survival under repair = 1 - the dead-zone occupancy
      let alive = 1;
      for (let dd = 0; dd < width; dd++) alive -= dist[(n / 2) * width + dd]!;
      survival.push(Math.max(alive, 0));
    } else {
      // strict armor: absorb the crossed mass, report the never-crossed
      let alive = 0;
      for (let w = 0; w < n / 2; w++) alive += pure[w]!;
      for (let w = Math.ceil(n / 2); w <= n; w++) pure[w] = 0;
      survival.push(alive);
    }
    let fid = 0;
    for (let w = 0; w <= n; w++) fid += dist[w * width + periods]!;
    fidelity.push(fid);
  }
  return { fidelity, survival, meanSyndromeBits: entropySum / periods, meanTieBits: tieSum / periods };
}

/** Delocalized X-fire: every clock qubit flips with prob p per period. */
export function delocalizedFlipCensus(
  n: number,
  p: number,
  gates: readonly RevGate[],
  m: number,
): ArmorRow[] {
  const rows: ArmorRow[] = [];
  const dims = makeComposite(n, gates, m);
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  let rho = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  const periods = gates.length * 2;
  for (let t = 1; t <= periods; t++) {
    rho = compositePeriod(rho, dims);
    for (let qubit = 0; qubit < n; qubit++) rho = bitFlipChannel(rho, dims, qubit, p);
    if (t % 2 === 0) {
      const red = clockReduced(rho, dims);
      rows.push({
        probe: `delocalized p=${p.toFixed(3)}`,
        beat: t / 2,
        advanceFidelity: tokenProb(rho, dims, m, t / 2),
        clockEntropyBits: vonNeumannEntropy(red),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// (A3) The repair — parity-aware majority decoding at every period top.
// ---------------------------------------------------------------------------

/**
 * The repair map at top t: measure the clock's sector (1 bit, projective),
 * then flip the clock globally on the WRONG-sector block — a conditional
 * unitary. Cross-sector coherences are dephased by the measurement (the
 * honest cost of reading); the runner is untouched.
 */
function repairMap(rho: CMat, dims: CompositeDims, period: number): CMat {
  const out: CMat = {
    rows: rho.rows,
    cols: rho.cols,
    re: new Float64Array(rho.re.length),
    im: new Float64Array(rho.im.length),
  };
  const n = dims.n;
  const cleanIsPlus = period % 2 === 0;
  const d = rho.cols;
  for (let z1 = 0; z1 < dims.clockDim; z1++) {
    const s1 = popcount(z1) < n / 2;
    const m1 = s1 === cleanIsPlus ? z1 : (~z1 & (dims.clockDim - 1));
    for (let d1 = 0; d1 < dims.runnerDim; d1++) {
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const s2 = popcount(z2) < n / 2;
        if (s1 !== s2) continue; // the measurement dephases cross-sector terms
        const m2 = s2 === cleanIsPlus ? z2 : (~z2 & (dims.clockDim - 1));
        for (let d2 = 0; d2 < dims.runnerDim; d2++) {
          const src = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
          const dst = (m1 * dims.runnerDim + d1) * d + (m2 * dims.runnerDim + d2);
          out.re[dst] = out.re[dst]! + rho.re[src]!;
          out.im[dst] = out.im[dst]! + rho.im[src]!;
        }
      }
    }
  }
  return out;
}

/** P(clock in the wrong sector for top t) — the syndrome's meter reading. */
function wrongSectorProb(rho: CMat, dims: CompositeDims, period: number): number {
  const n = dims.n;
  const cleanIsPlus = period % 2 === 0;
  let acc = 0;
  for (let z = 0; z < dims.clockDim; z++) {
    const wrong = popcount(z) < n / 2 !== cleanIsPlus;
    if (!wrong) continue;
    for (let dd = 0; dd < dims.runnerDim; dd++) {
      const i = (z * dims.runnerDim + dd) * rho.cols + (z * dims.runnerDim + dd);
      acc += rho.re[i]!;
    }
  }
  return acc;
}

export interface RepairVerdict {
  readonly rows: readonly ArmorRow[];
  readonly meanSyndromeBits: number; // mean per-period syndrome entropy, the tariff meter
  readonly unrepairedWorstFidelity: number; // the passive twin, same fire
}/**
 * The repaired census: parity-aware majority repair at EVERY period top
 * (after the noise), against its unrepaired twin under the same fire.
 */
export function repairCensus(
  n: number,
  p: number,
  gates: readonly RevGate[],
  m: number,
): RepairVerdict {
  const dims = makeComposite(n, gates, m);
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  const start = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  let rho = start;
  let twin = start;
  const rows: ArmorRow[] = [];
  const periods = gates.length * 2;
  let entropySum = 0;
  let twinWorst = 1;
  const applyNoise = (r: CMat): CMat => {
    let out = r;
    for (let qubit = 0; qubit < n; qubit++) out = bitFlipChannel(out, dims, qubit, p);
    return out;
  };
  for (let t = 1; t <= periods; t++) {
    rho = compositePeriod(rho, dims);
    rho = applyNoise(rho);
    const wrong = wrongSectorProb(rho, dims, t);
    entropySum += wrong > 0 && wrong < 1 ? -(wrong * Math.log2(wrong) + (1 - wrong) * Math.log2(1 - wrong)) : 0;
    rho = repairMap(rho, dims, t);
    twin = compositePeriod(twin, dims);
    twin = applyNoise(twin);
    if (t % 2 === 0) {
      const red = clockReduced(rho, dims);
      rows.push({
        probe: `repaired p=${p.toFixed(3)}`,
        beat: t / 2,
        advanceFidelity: tokenProb(rho, dims, m, t / 2),
        clockEntropyBits: vonNeumannEntropy(red),
      });
      twinWorst = Math.min(twinWorst, tokenProb(twin, dims, m, t / 2));
    }
  }
  return { rows, meanSyndromeBits: entropySum / periods, unrepairedWorstFidelity: twinWorst };
}

// ---------------------------------------------------------------------------
// v0.6.0 — THE TIE RESET (the priced next step of TC27): at even n the tie
// set {popcount = n/2} is the majority decoder's blind spot — the global
// flip Xbar fixes it (n/2 -> n/2), and the token drifts. The cure is an
// EXACT-POLE reset: measure the tie (1 bit), and on the tie branch replace
// the clock with the top's clean pole outright. That reset is NOT unitary —
// it erases WHICH tie state the register was in. By exchangeability of the
// delocalized noise (all qubits flip iid), the mask conditioned on
// popcount = n/2 is UNIFORM over the C(n, n/2) tie states, so the erased
// information is exactly log2 C(n, n/2) bits — the Landauer price of the
// decoder's blind spot, asymptotically the whole register (n - O(log n)).
// With the reset, the repaired token fidelity is EXACTLY 1 at EVERY n,
// even included, forever in-model — the v0.5.0 even-n long-horizon
// liability (10x worse than passive) is cured, and what remains of the
// odd/even dichotomy is a PRICE dichotomy, metered below.
// ---------------------------------------------------------------------------

/** log2 C(n, n/2) — the tie reset's erasure, exact by exchangeability. */
export function tieResetBits(n: number): number {
  if (n % 2 === 1) return 0; // no tie exists at odd n
  let c = 1;
  for (let k = 0; k < n / 2; k++) c = (c * (n - k)) / (k + 1);
  return Math.log2(c);
}

/**
 * The tie reset map at top t: measure {tie, non-tie} on the clock (the
 * cross terms dephased), then on the tie branch replace the clock with the
 * clean pole of the parity (|0..0> at even tops, |1..1> at odd) — the tie
 * branch's runner block survives, summed onto the pole. O((CD)^2).
 */
function tieResetMap(rho: CMat, dims: CompositeDims, period: number): CMat {
  const out: CMat = {
    rows: rho.rows,
    cols: rho.cols,
    re: new Float64Array(rho.re.length),
    im: new Float64Array(rho.im.length),
  };
  const n = dims.n;
  const pole = period % 2 === 0 ? 0 : dims.clockDim - 1; // |0..0> or |1..1>
  const d = rho.cols;
  for (let z1 = 0; z1 < dims.clockDim; z1++) {
    const tie1 = popcount(z1) === n / 2;
    for (let d1 = 0; d1 < dims.runnerDim; d1++) {
      for (let z2 = 0; z2 < dims.clockDim; z2++) {
        const tie2 = popcount(z2) === n / 2;
        if (tie1 !== tie2) continue; // the measurement dephases the branches
        for (let d2 = 0; d2 < dims.runnerDim; d2++) {
          const src = (z1 * dims.runnerDim + d1) * d + (z2 * dims.runnerDim + d2);
          const c1 = tie1 ? pole : z1;
          const c2 = tie2 ? pole : z2;
          const dst = (c1 * dims.runnerDim + d1) * d + (c2 * dims.runnerDim + d2);
          out.re[dst] = out.re[dst]! + rho.re[src]!;
          out.im[dst] = out.im[dst]! + rho.im[src]!;
        }
      }
    }
  }
  return out;
}

/** P(clock in the tie set at top t) — the tie meter's probability reading. */
function tieProb(rho: CMat, dims: CompositeDims): number {
  const n = dims.n;
  if (n % 2 === 1) return 0;
  let acc = 0;
  for (let z = 0; z < dims.clockDim; z++) {
    if (popcount(z) !== n / 2) continue;
    for (let dd = 0; dd < dims.runnerDim; dd++) {
      const i = (z * dims.runnerDim + dd) * rho.cols + (z * dims.runnerDim + dd);
      acc += rho.re[i]!;
    }
  }
  return acc;
}

export interface FullRepairVerdict {
  readonly rows: readonly ArmorRow[];
  readonly meanSyndromeBits: number; // the 1-bit sector read's entropy, as in TC27
  readonly meanTieBits: number; // amortized tie tariff: mean [H2(p_tie) + p_tie * log2C(n,n/2)]
  readonly tieTariffBits: number; // the constant log2 C(n, n/2)
  readonly unrepairedWorstFidelity: number;
}

/**
 * The full-repair census: sector repair (TC27) PLUS the tie reset — exact
 * at every n. Meters both tariff faces: the syndrome bit and the tie's
 * amortized erasure.
 */
export function fullRepairCensus(
  n: number,
  p: number,
  gates: readonly RevGate[],
  m: number,
): FullRepairVerdict {
  const dims = makeComposite(n, gates, m);
  const dataDim = 1 << m;
  const tokenCount = gates.length + 1;
  const psi = basisVec(dataDim, 0b101);
  const start = kron(polarizedRho(n), vecToRho(vKron(basisVec(tokenCount, 0), psi)));
  let rho = start;
  let twin = start;
  const rows: ArmorRow[] = [];
  const periods = gates.length * 2;
  const tariff = tieResetBits(n);
  let syndromeSum = 0;
  let tieSum = 0;
  let twinWorst = 1;
  const applyNoise = (r: CMat): CMat => {
    let out = r;
    for (let qubit = 0; qubit < n; qubit++) out = bitFlipChannel(out, dims, qubit, p);
    return out;
  };
  for (let t = 1; t <= periods; t++) {
    rho = compositePeriod(rho, dims);
    rho = applyNoise(rho);
    const wrong = wrongSectorProb(rho, dims, t);
    syndromeSum += wrong > 0 && wrong < 1 ? -(wrong * Math.log2(wrong) + (1 - wrong) * Math.log2(1 - wrong)) : 0;
    const pTie = tieProb(rho, dims);
    tieSum +=
      pTie > 0 && pTie < 1
        ? -(pTie * Math.log2(pTie) + (1 - pTie) * Math.log2(1 - pTie)) + pTie * tariff
        : 0;
    rho = repairMap(rho, dims, t);
    rho = tieResetMap(rho, dims, t);
    twin = compositePeriod(twin, dims);
    twin = applyNoise(twin);
    if (t % 2 === 0) {
      const red = clockReduced(rho, dims);
      rows.push({
        probe: `full-repair p=${p.toFixed(3)}`,
        beat: t / 2,
        advanceFidelity: tokenProb(rho, dims, m, t / 2),
        clockEntropyBits: vonNeumannEntropy(red),
      });
      twinWorst = Math.min(twinWorst, tokenProb(twin, dims, m, t / 2));
    }
  }
  return {
    rows,
    meanSyndromeBits: syndromeSum / periods,
    meanTieBits: tieSum / periods,
    tieTariffBits: tariff,
    unrepairedWorstFidelity: twinWorst,
  };
}

// ---------------------------------------------------------------------------
// v0.7.0 — THE BINOMIAL SHADOW LAW (the priced next step of TC28: the
// analytic faces of the passive shadow). Under delocalized X-fire each
// clock bit's flip history is INDEPENDENT of every other's, and after t
// periods a given bit has been flipped an odd number of times with
// probability q_t = (1 - (1-2p)^t)/2 exactly — so the passive mask
// popcount is EXACTLY binomial:
//     w_t ~ Bin(n, q_t),  q_t = (1 - (1-2p)^t)/2.
// Every passive face then closes: the tie occupancy
//     P(w_t = n/2) = C(n, n/2) (q_t (1-q_t))^{n/2},
// the per-strobe breach tail P(w_t >= n/2) (a finite binomial sum), and
// the stationary faces as t -> inf (q_t -> 1/2 geometrically at rate 1-2p):
//     stationary breach = 1/2 + C(n,n/2)/2^{n+1},  stationary tie = C(n,n/2)/2^n.
// The naive relaxation q'_t = 1-(1-p)^t (flips treated as absorbing) is
// WRONG by O(0.3) — the identity is contentful, and the negative control
// convicts it. Boundary: these are the PASSIVE chain's faces; the repaired
// chain's meters (TC28) stay machine-exact via the DP — the repair resets
// the walk, no binomial law survives it.
// ---------------------------------------------------------------------------

/** q_t = (1 - (1-2p)^t)/2 — the odd-flip probability after t periods. */
export function shadowQ(p: number, t: number): number {
  return (1 - Math.pow(1 - 2 * p, t)) / 2;
}

/** The binomial pmf Bin(n, q) over k = 0..n. */
export function binomialPmfClosed(n: number, q: number): Float64Array {
  const crow = binomRowLocal(n)[n]!;
  const out = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) out[k] = crow[k]! * Math.pow(q, k) * Math.pow(1 - q, n - k);
  return out;
}

/** P(Bin(n, q) >= threshold), the finite binomial sum. */
export function binomialUpperTail(n: number, threshold: number, q: number): number {
  const pmf = binomialPmfClosed(n, q);
  let acc = 0;
  for (let k = Math.ceil(threshold); k <= n; k++) acc += pmf[k]!;
  return acc;
}

/** The machine road: the passive w-marginal after t periods (no repair). */
export function maskPopcountMarginal(n: number, p: number, t: number): Float64Array {
  const binom = binomRowLocal(n);
  let m = new Float64Array(n + 1);
  m[0] = 1;
  for (let s = 0; s < t; s++) {
    const next = new Float64Array(n + 1);
    for (let w = 0; w <= n; w++) {
      if (m[w]! === 0) continue;
      for (let a = 0; a <= n - w; a++) {
        for (let b = 0; b <= w; b++) {
          const pr = binom[n - w]![a]! * binom[w]![b]! * Math.pow(p, a + b) * Math.pow(1 - p, n - a - b);
          next[w + a - b] = next[w + a - b]! + m[w]! * pr;
        }
      }
    }
    m = next;
  }
  return m;
}

/** The stationary breach face 1/2 + C(n,n/2)/2^{n+1} (even n). */
export function stationaryBreach(n: number): number {
  const c = binomRowLocal(n)[n]![n / 2]!;
  return 1 / 2 + c / Math.pow(2, n + 1);
}

/** The stationary tie face C(n,n/2)/2^n (even n). */
export function stationaryTie(n: number): number {
  const c = binomRowLocal(n)[n]![n / 2]!;
  return c / Math.pow(2, n);
}

function binomRowLocal(n: number): Float64Array[] {
  const rows: Float64Array[] = [];
  for (let k = 0; k <= n; k++) {
    const row = new Float64Array(k + 1);
    row[0] = 1;
    for (let j = 1; j <= k; j++) row[j] = (row[j - 1]! * (k - j + 1)) / j;
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// v0.8.0 — THE SPECTRAL SURVIVAL LAW (the priced next step of TC29/TC30:
// the first-passage face). The strict armor's survival
//     survival(T) = P(w_s < n/2 for all s <= T)
// is the absorbing-chain problem of the substochastic Q on {0..n/2-1} (one
// noise period, the jumps landing >= n/2 absorbed away). The hypercube
// flip chain is reversible w.r.t. uniform and the popcount lumping is
// equitable, so m_i Q_ij = m_j Q_ji with m_w = C(n,w) to the rounding
// floor — Q is similar to the SYMMETRIC S = D^(1/2) Q D^(-1/2), the house
// Jacobi solver applies, and the survival series is the eigen-expansion
//     survival(T) = sum_j c_j lambda_j^T,
//     c_j = [(D^(-1/2) e_0) . r_j] [r_j . (D^(1/2) 1)],
// exact to the rounding floor. The top eigenvalue lambda_1 IS the armor's
// decay constant: survival(T+1)/survival(T) -> lambda_1 (witnessed to 12
// decimals), and the half-life is ln 2 / -ln lambda_1 periods.
// The repaired chain's stationary faces complete the picture: the meter
// sequence converges to the stationary value of the repaired small chain
// (the DP mean lags below through the transient — stated, not hidden).
// ---------------------------------------------------------------------------

import { jacobiEigen, realSymmetricPack } from "./tombstone.js";
import { mat } from "../core/cmat.js";

function fullBinomRow(n: number): Float64Array {
  const row = new Float64Array(n + 1);
  row[0] = 1;
  for (let j = 1; j <= n; j++) row[j] = (row[j - 1]! * (n - j + 1)) / j;
  return row;
}

/** The substochastic Q on {0..n/2-1} (n even) or {0..(n-1)/2} (n odd). */
function buildAbsorbingQ(n: number, p: number): { q: number[][]; m: Float64Array } {
  const binom: Float64Array[] = [];
  for (let k = 0; k <= n; k++) {
    const row = new Float64Array(k + 1);
    row[0] = 1;
    for (let j = 1; j <= k; j++) row[j] = (row[j - 1]! * (k - j + 1)) / j;
    binom.push(row);
  }
  const dim = Math.ceil(n / 2);
  const q: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (let w = 0; w < dim; w++) {
    for (let a = 0; a <= n - w; a++) {
      for (let b = 0; b <= w; b++) {
        const wNext = w + a - b;
        if (wNext < 0 || wNext >= dim) continue;
        q[w]![wNext]! += binom[n - w]![a]! * binom[w]![b]! * Math.pow(p, a + b) * Math.pow(1 - p, n - a - b);
      }
    }
  }
  const m = new Float64Array(dim);
  for (let w = 0; w < dim; w++) m[w] = fullBinomRow(n)[w]!;
  return { q, m };
}

export interface SpectralArmor {
  readonly lambda1: number; // the decay constant
  readonly spectrum: readonly number[]; // ascending
  /** the eigen-expansion series survival(T), T = 1..periods */
  survivalSeries(periods: number): readonly number[];
}

/** The spectral decomposition of the strict armor's survival. */
export function spectralArmor(n: number, p: number): SpectralArmor {
  const { q, m } = buildAbsorbingQ(n, p);
  const dim = q.length;
  const sm = mat(dim, dim);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) sm.re[i * dim + j] = q[i]![j]! * Math.sqrt(m[i]! / m[j]!);
  }
  const eig = jacobiEigen(realSymmetricPack(sm), dim);
  const spectrum = Array.from(eig.values).sort((a, b) => a - b);
  const coeffs: number[] = [];
  for (let j = 0; j < dim; j++) {
    let v0 = 0;
    let v1 = 0;
    for (let i = 0; i < dim; i++) {
      const vij = eig.vectors[j * dim + i]!;
      v0 += (i === 0 ? 1 : 0) * vij / Math.sqrt(m[i]!);
      v1 += vij * Math.sqrt(m[i]!);
    }
    coeffs.push(v0 * v1);
  }
  return {
    lambda1: spectrum[spectrum.length - 1]!,
    spectrum,
    survivalSeries(periods: number): readonly number[] {
      const out: number[] = [];
      for (let t = 1; t <= periods; t++) {
        let acc = 0;
        for (let j = 0; j < dim; j++) acc += coeffs[j]! * Math.pow(spectrum[j]!, t);
        out.push(acc);
      }
      return out;
    },
  };
}

export interface RepairedStationary {
  readonly pTie: number;
  readonly syndromeMeter: number; // mean over the two top parities
  readonly tieMeter: number;
  readonly tariffConstant: number; // log2 C(n, n/2)
}

/** The repaired chain's stationary meter faces (n even; iterate the small chain). */
export function repairedStationary(n: number, p: number, iterations = 2000): RepairedStationary {
  const binom: Float64Array[] = [];
  for (let k = 0; k <= n; k++) {
    const row = new Float64Array(k + 1);
    row[0] = 1;
    for (let j = 1; j <= k; j++) row[j] = (row[j - 1]! * (k - j + 1)) / j;
    binom.push(row);
  }
  let pi = new Float64Array(n + 1);
  pi[0] = 1;
  let faces = { pTie: 0, syndromeMeter: 0, tieMeter: 0 };
  const h2 = (q: number): number =>
    q > 0 && q < 1 ? -(q * Math.log2(q) + (1 - q) * Math.log2(1 - q)) : 0;
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(n + 1);
    for (let w = 0; w <= n; w++) {
      if (pi[w]! === 0) continue;
      for (let a = 0; a <= n - w; a++) {
        for (let b = 0; b <= w; b++) {
          next[w + a - b]! += pi[w]! * binom[n - w]![a]! * binom[w]![b]! * Math.pow(p, a + b) * Math.pow(1 - p, n - a - b);
        }
      }
    }
    if (n % 2 === 0) {
      const pTie = next[n / 2]!;
      let wrongEven = 0;
      let wrongOdd = 0;
      for (let w = n / 2; w <= n; w++) wrongEven += next[w]!;
      for (let w = n / 2 + 1; w <= n; w++) wrongOdd += next[w]!;
      const tariff = Math.log2(fullBinomRow(n)[n / 2]!);
      faces = {
        pTie,
        syndromeMeter: (h2(wrongEven) + h2(wrongOdd)) / 2,
        tieMeter: h2(pTie) + pTie * tariff,
      };
    } else {
      let wrongEven = 0;
      for (let w = Math.ceil(n / 2); w <= n; w++) wrongEven += next[w]!;
      faces = { pTie: 0, syndromeMeter: h2(wrongEven), tieMeter: 0 };
    }
    const rep = new Float64Array(n + 1);
    for (let w = 0; w <= n; w++) rep[w === n / 2 ? 0 : Math.min(w, n - w)]! += next[w]!;
    pi = rep;
  }
  return { ...faces, tariffConstant: n % 2 === 0 ? Math.log2(fullBinomRow(n)[n / 2]!) : 0 };
}

// ---------------------------------------------------------------------------
// v0.9.0 — THE UNIVERSAL DECAY RATE (the priced next step of TC31: the
// perturbative face of lambda_1). At p = 0 the absorbing Q is the identity
// (maximally degenerate), so the first-order correction is the spectrum of
// the ONE-FLIP generator: the amputated Ehrenfest birth-death matrix B on
// {0..n/2-1} (birth n-w, death w, the top row's birth amputated — it exits
// into the absorbing set). THE CLOSED FORM: u_w = n - 2w is a POSITIVE
// eigenvector of B with eigenvalue EXACTLY n - 2, every row including both
// boundaries —
//   interior/zero rows: (Bu)_w = (n-w)(n-2w-2) + w(n-2w+2) = (n-2)(n-2w);
//   the amputated top row r = n/2-1: (Bu)_r = r*(n-2(r-1)) = 4r = 2(n-2)
//     = (n-2)*(n-2r)  [since n-2r = 2].
// Positivity on {0..r} (u_r = 2 > 0) plus Perron-Frobenius makes u the TOP
// eigenvector: mu_1 = n - 2 exactly, hence the decay-rate constant
//   gamma_n = n - mu_1 = 2   for EVERY n,
// and lambda_1(p) = 1 - 2p + O(p^2) is n-INDEPENDENT to first order: at
// small fire rates the strict armor's half-life is ln 2 / (2p) + O(p)
// periods regardless of register size — the n-dependence in the TC31 grid
// (0.656 -> 0.691 at p = 0.2) is entirely the O(p^2) face.
// ---------------------------------------------------------------------------

import { jacobiEigen as jacobiEigenTomb, realSymmetricPack as packTomb } from "./tombstone.js";

/** The amputated birth-death matrix B on {0..n/2-1} (n even), rows as arrays. */
function amputatedBirthDeath(n: number): number[][] {
  const dim = n / 2;
  const b: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0));
  for (let w = 0; w < dim; w++) {
    if (w + 1 < dim) b[w]![w + 1] = n - w; // birth stays inside
    if (w - 1 >= 0) b[w]![w - 1] = w; // death
  }
  return b;
}

/** The algebraic face, solver-free: max |B u - (n-2) u| for u_w = n-2w. */
export function decayEigenpairResidual(n: number): number {
  const b = amputatedBirthDeath(n);
  const dim = b.length;
  let worst = 0;
  for (let w = 0; w < dim; w++) {
    let bu = 0;
    for (let j = 0; j < dim; j++) bu += b[w]![j]! * (n - 2 * j);
    worst = Math.max(worst, Math.abs(bu - (n - 2) * (n - 2 * w)));
  }
  return worst;
}

/** gamma_n = n - mu_1(B), mu_1 through the house Jacobi (B is binomial-reversible). */
export function decayRateConstant(n: number): number {
  const b = amputatedBirthDeath(n);
  const dim = b.length;
  const bin: number[] = [1];
  for (let k = 1; k <= n; k++) bin[k] = (bin[k - 1]! * (n - k + 1)) / k;
  const s = mat(dim, dim);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) s.re[i * dim + j] = b[i]![j]! * Math.sqrt(bin[i]! / bin[j]!);
  }
  const eig = jacobiEigenTomb(packTomb(s), dim);
  return n - Math.max(...Array.from(eig.values));
}

// ---------------------------------------------------------------------------
// v0.10.0 — THE KRAWTCHOUK SPECTRUM (the priced next step of TC33: the
// amputated generator's FULL spectrum, closed form). The amputation (the
// top row's birth exits into the absorbing set) is a Dirichlet boundary
// condition at the tie plane w = n/2, and the ODD Krawtchouk modes are
// antisymmetric under the reflection w <-> n-w — they vanish at the tie
// plane exactly, so they survive the amputation INTACT with their
// full-chain eigenvalues:
//     spectrum(B) = { n - 4k + 2 : k = 1..n/2 }  — INTEGERS, an arithmetic
//     progression with common difference EXACTLY 4.
// TC33's gamma = 2 is the k = 1 member (eigenvalue n-2); the spectral gap
// between adjacent surviving modes is exactly 4 — the ratio test's
// convergence constant. The second-order face: c_2(n) = lim_{p->0}
// (2 - (1 - lambda_1(p))/p)/p, evaluated by Richardson extrapolation on
// the EXACT eigenvalue (rational in the limit; the observed (pi/4)*sqrt(n)
// scaling is labeled OBSERVED, never claimed).
// ---------------------------------------------------------------------------

/** The Krawtchouk vector K_j(w) for w = 0..dim-1, by the three-term recurrence. */
export function krawtchoukVector(n: number, j: number, dim: number): Float64Array {
  if (j === 0) {
    const v = new Float64Array(dim);
    v.fill(1);
    return v;
  }
  if (j === 1) {
    const v = new Float64Array(dim);
    for (let w = 0; w < dim; w++) v[w] = n - 2 * w;
    return v;
  }
  const prev2 = krawtchoukVector(n, j - 2, dim);
  const prev1 = krawtchoukVector(n, j - 1, dim);
  const v = new Float64Array(dim);
  for (let w = 0; w < dim; w++) {
    // (j) K_j(w) = (n-2w) K_{j-1}(w) - (n-j+2) K_{j-2}(w)  (the binary
    // Krawtchouk three-term recurrence, K_0 = 1, K_1 = n-2w)
    v[w] = ((n - 2 * w) * prev1[w]! - (n - j + 2) * prev2[w]!) / j;
  }
  return v;
}

/** Solver-free: max_w |B K_j - (n-2j) K_j| over the amputated chain (j odd). */
export function krawtchoukResidual(n: number, j: number): number {
  const dim = n / 2;
  const b = amputatedBirthDeath(n);
  const v = krawtchoukVector(n, j, dim);
  let worst = 0;
  for (let w = 0; w < dim; w++) {
    let bv = 0;
    for (let c = 0; c < dim; c++) bv += b[w]![c]! * v[c]!;
    worst = Math.max(worst, Math.abs(bv - (n - 2 * j) * v[w]!));
  }
  return worst;
}

/** The closed-form amputated spectrum: the odd Krawtchouk eigenvalues {n-2, n-6, ...}, descending. */
export function amputatedSpectrumClosed(n: number): readonly number[] {
  return Array.from({ length: n / 2 }, (_, k) => n - 2 * (2 * k + 1));
}

/** The second-order coefficient by Richardson extrapolation on the exact lambda_1. */
export function secondOrderCoefficient(n: number, p = 0.01): number {
  const c2At = (q: number): number => (2 - (1 - spectralArmor(n, q).lambda1) / q) / q;
  return 2 * c2At(p / 2) - c2At(p);
}

// ---------------------------------------------------------------------------
// v0.11.0 — THE RAYLEIGH-SCHRODINGER CLOSED FORM FOR c_2 (the priced next
// step of TC35). Q(p) = sum_k p^k Q^(k) on the surviving block; at p = 0
// the identity is maximally degenerate, the first-order splitting is the
// odd-Krawtchouk spectrum (TC34), and the level-repulsion term vanishes
// IDENTICALLY because A_1 is diagonal in its own eigenbasis — so the
// second-order coefficient of the top branch is the single Rayleigh
// quotient with the binomial-weighted left eigenvector:
//     c_2(n) = u^T D Q^(2) u / u^T D u,   u_w = n - 2w,  D = diag(C(n,w)),
// where Q^(2) is the EXACT p^2 coefficient of Q(p): every transition's
// probability is C(n-w,a) C(w,b) p^{a+b} (1-p)^{n-a-b}, and the (1-p)
// factor expands too — the coefficient is
//     [two-flip counts] - (n-1) [one-flip counts] + C(n,2) [the diagonal],
// Dirichlet-truncated at the absorbing boundary. All entries integer;
// the quotient is rational, machine-exact to the floating floor.
// ---------------------------------------------------------------------------

/** c_2(n) by the RS Rayleigh quotient (repulsion-free by TC34). */
export function secondOrderClosed(n: number): number {
  const dim = n / 2;
  const bin = new Float64Array(n + 1);
  bin[0] = 1;
  for (let k = 1; k <= n; k++) bin[k] = (bin[k - 1]! * (n - k + 1)) / k;
  const u = (w: number): number => n - 2 * w;
  const applyQ2 = (w: number): number => {
    let acc = 0;
    if (w + 2 < dim && n - w >= 2) acc += (((n - w) * (n - w - 1)) / 2) * u(w + 2);
    if (w - 2 >= 0) acc += ((w * (w - 1)) / 2) * u(w - 2);
    if (n - w >= 1 && w >= 1) acc += (n - w) * w * u(w);
    if (w + 1 < dim) acc += -(n - 1) * (n - w) * u(w + 1);
    if (w - 1 >= 0) acc += -(n - 1) * w * u(w - 1);
    acc += ((n * (n - 1)) / 2) * u(w);
    return acc;
  };
  let num = 0;
  let den = 0;
  for (let w = 0; w < dim; w++) {
    num += bin[w]! * u(w) * applyQ2(w);
    den += bin[w]! * u(w) * u(w);
  }
  return num / den;
}

// ---------------------------------------------------------------------------
// v0.12.0 — THE GENERAL-n LAW FOR c_2 (the priced next step of TC36). The
// rationals 3/2, 15/8, 35/16, 315/128, 693/256 at n = 4..12 are ONE object:
// with m = (n-2)/2,
//     c_2(n) = (n-1) C(n-2, m) / 2^(n-2) = (2m+1) C(2m,m) / 4^m,
// the PARTIAL SUM of the scaled central binomials
//     sum_{k=0}^{m} C(2k,k) / 4^k
// (each term C(2k,k)/4^k is the return probability P(S_2k = 0) of the
// simple symmetric walk — c_2 is the walk's cumulative return count). The
// identity's induction step is integer-exact:
//     2(m+1) C(2m+2, m+1) = 4(2m+1) C(2m, m),
// machine-checked per m; the law is BigInt-equal to TC36's RS quotient at
// every n (cross-multiplied residue zero). The asymptotic face RETIRES the
// TC35 pi/4 numerology:
//     c_2(n) = sqrt(2n/pi) (1 - 1/(4n) + 1/(32 n^2) + O(n^-3)),
// so c_2/sqrt(n) -> sqrt(2/pi) = 0.797884561..., NOT pi/4 = 0.785398163...
// (the census curve crosses pi/4 near n = 16 — inside TC35's grid; the
// observation was a horizon artifact, honestly labeled then, retired now).
// ---------------------------------------------------------------------------

/** An exact rational (the v0.12.0 layer runs in BigInt, solver-free). */
export interface BigRational {
  readonly num: bigint;
  readonly den: bigint;
}

/** The binomial coefficient C(n, k) in exact BigInt. */
export function binomialBig(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let r = 1n;
  for (let i = 0; i < k; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
  return r;
}

/** The cross-multiplied residue a.num/a.den - b.num/b.den (zero ⟺ equal). */
export function rationalResidue(a: BigRational, b: BigRational): bigint {
  return a.num * b.den - a.den * b.num;
}

/** TC36's RS quotient as an EXACT BigInt rational (mirror of secondOrderClosed). */
export function secondOrderRSRational(n: number): BigRational {
  const dim = n / 2;
  const bin = (w: number): bigint => binomialBig(n, w);
  const u = (w: number): bigint => BigInt(n - 2 * w);
  const applyQ2 = (w: number): bigint => {
    let acc = 0n;
    if (w + 2 < dim && n - w >= 2) acc += ((BigInt(n - w) * BigInt(n - w - 1)) / 2n) * u(w + 2);
    if (w - 2 >= 0) acc += ((BigInt(w) * BigInt(w - 1)) / 2n) * u(w - 2);
    if (n - w >= 1 && w >= 1) acc += BigInt(n - w) * BigInt(w) * u(w);
    if (w + 1 < dim) acc += -BigInt(n - 1) * BigInt(n - w) * u(w + 1);
    if (w - 1 >= 0) acc += -BigInt(n - 1) * BigInt(w) * u(w - 1);
    acc += ((BigInt(n) * BigInt(n - 1)) / 2n) * u(w);
    return acc;
  };
  let num = 0n;
  let den = 0n;
  for (let w = 0; w < dim; w++) {
    num += bin(w) * u(w) * applyQ2(w);
    den += bin(w) * u(w) * u(w);
  }
  return { num, den };
}

/** The partial sum sum_{k=0}^{m} C(2k,k)/4^k as an exact BigInt rational. */
export function centralBinomialSumRational(m: number): BigRational {
  let num = 0n;
  const den = 4n ** BigInt(m);
  for (let k = 0; k <= m; k++) num += binomialBig(2 * k, k) * 4n ** BigInt(m - k);
  return { num, den };
}

/** The general-n law c_2(n) = (n-1) C(n-2, (n-2)/2) / 2^(n-2), exact (even n >= 4). */
export function secondOrderGeneralRational(n: number): BigRational {
  if (n < 4 || n % 2 !== 0) throw new Error(`secondOrderGeneralRational: even n >= 4 required, got ${n}`);
  return { num: BigInt(n - 1) * binomialBig(n - 2, (n - 2) / 2), den: 2n ** BigInt(n - 2) };
}

/** The general-n law as a float (exact rational evaluated at the float floor). */
export function secondOrderGeneral(n: number): number {
  const r = secondOrderGeneralRational(n);
  return Number(r.num) / Number(r.den);
}

/** The partial-sum identity's induction step residue: 2(m+1)C(2m+2,m+1) - 4(2m+1)C(2m,m). */
export function centralBinomialStepResidue(m: number): bigint {
  return 2n * BigInt(m + 1) * binomialBig(2 * m + 2, m + 1) - 4n * BigInt(2 * m + 1) * binomialBig(2 * m, m);
}

// ---------------------------------------------------------------------------
// v0.13.0 — THE THIRD-ORDER COEFFICIENT c_3 (the priced next step of TC38's
// arc: where the level repulsion FIRST enters). Q(p) = I + pQ_1 + p^2Q_2 +
// p^3Q_3 on the Dirichlet block; the top branch is
//     lambda_1(p) = 1 - 2p + c_2 p^2 + c_3 p^3 + O(p^4),
// and the Rayleigh-Schrodinger hierarchy in the D-inner product (D =
// diag C(n,w); the block is reversible) gives
//     c_3(n) = <u, Q_3 u>/<u,u> + sum_{odd j>=3} <K_j, Q_2 u>^2
//                                     / (2(j-1) <K_j,K_j> <u,u>),
// with u_w = n-2w and K_j the ODD Krawtchouk modes — the surviving
// eigenbasis of the block (TC34), theta_j - theta_1 = -2(j-1). The first
// term is the plain quotient face; the second is the FIRST NON-VANISHING
// LEVEL-REPULSION FACE — TC36's repulsion-free gift ends at second order:
// from c_3 on, the whole odd-Krawtchouk spectrum participates in the decay
// law. Q_3 is the exact p^3 coefficient: three-flip counts, minus (n-2)
// times the two-flip counts, plus C(n-1,2) times the one-flip counts, minus
// C(n,3) on the diagonal — every factor of (1-p)^{n-a-b} expanded —
// Dirichlet-truncated. All pieces integer; the total is an exact rational.
// Adjudicated by the series-vs-eigenvalue residual: the three-term series
// reproduces lambda_1(1/100) to 1e-11..1e-8 (the c_4 p^4 face) at
// n = 4..16.
// ---------------------------------------------------------------------------

/** The odd Krawtchouk vector K_j on the block w = 0..dim-1, exact BigInt. */
export function krawtchoukBigVector(n: number, j: number, dim: number): bigint[] {
  if (j === 0) return Array.from({ length: dim }, () => 1n);
  if (j === 1) return Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  const p2 = krawtchoukBigVector(n, j - 2, dim);
  const p1 = krawtchoukBigVector(n, j - 1, dim);
  return Array.from({ length: dim }, (_, w) => (BigInt(n - 2 * w) * p1[w]! - BigInt(n - j + 2) * p2[w]!) / BigInt(j));
}

export function applyQ2Big(n: number, dim: number, x: readonly bigint[]): bigint[] {
  const out: bigint[] = [];
  for (let w = 0; w < dim; w++) {
    let acc = 0n;
    if (w + 2 < dim && n - w >= 2) acc += ((BigInt(n - w) * BigInt(n - w - 1)) / 2n) * x[w + 2]!;
    if (w - 2 >= 0) acc += ((BigInt(w) * BigInt(w - 1)) / 2n) * x[w - 2]!;
    if (n - w >= 1 && w >= 1) acc += BigInt(n - w) * BigInt(w) * x[w]!;
    if (w + 1 < dim) acc += -BigInt(n - 1) * BigInt(n - w) * x[w + 1]!;
    if (w - 1 >= 0) acc += -BigInt(n - 1) * BigInt(w) * x[w - 1]!;
    acc += ((BigInt(n) * BigInt(n - 1)) / 2n) * x[w]!;
    out.push(acc);
  }
  return out;
}

export function applyQ3Big(n: number, dim: number, x: readonly bigint[]): bigint[] {
  const out: bigint[] = [];
  for (let w = 0; w < dim; w++) {
    let acc = 0n;
    // three-flip counts, coefficient +1
    if (w + 3 < dim && n - w >= 3) acc += ((BigInt(n - w) * BigInt(n - w - 1) * BigInt(n - w - 2)) / 6n) * x[w + 3]!;
    if (w + 1 < dim && n - w >= 2 && w >= 1) acc += ((BigInt(n - w) * BigInt(n - w - 1)) / 2n) * BigInt(w) * x[w + 1]!;
    if (w - 1 >= 0 && n - w >= 1 && w >= 2) acc += BigInt(n - w) * ((BigInt(w) * BigInt(w - 1)) / 2n) * x[w - 1]!;
    if (w - 3 >= 0) acc += ((BigInt(w) * BigInt(w - 1) * BigInt(w - 2)) / 6n) * x[w - 3]!;
    // two-flip counts, coefficient -(n-2)
    let t2 = 0n;
    if (w + 2 < dim && n - w >= 2) t2 += ((BigInt(n - w) * BigInt(n - w - 1)) / 2n) * x[w + 2]!;
    if (w - 2 >= 0) t2 += ((BigInt(w) * BigInt(w - 1)) / 2n) * x[w - 2]!;
    if (n - w >= 1 && w >= 1) t2 += BigInt(n - w) * BigInt(w) * x[w]!;
    acc += -BigInt(n - 2) * t2;
    // one-flip counts, coefficient +C(n-1,2)
    let t1 = 0n;
    if (w + 1 < dim) t1 += BigInt(n - w) * x[w + 1]!;
    if (w - 1 >= 0) t1 += BigInt(w) * x[w - 1]!;
    acc += ((BigInt(n - 1) * BigInt(n - 2)) / 2n) * t1;
    // zero-flip, coefficient -C(n,3)
    acc += -((BigInt(n) * BigInt(n - 1) * BigInt(n - 2)) / 6n) * x[w]!;
    out.push(acc);
  }
  return out;
}

/** The two faces of c_3: the plain quotient and the FIRST level-repulsion sum (exact rationals). */
export function thirdOrderFaces(n: number): { quotient: BigRational; repulsion: BigRational } {
  if (n < 4 || n % 2 !== 0) throw new Error(`thirdOrderFaces: even n >= 4 required, got ${n}`);
  const dim = n / 2;
  const m = (w: number): bigint => binomialBig(n, w);
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  const dotD = (a: readonly bigint[], b: readonly bigint[]): bigint => {
    let s = 0n;
    for (let w = 0; w < dim; w++) s += m(w) * a[w]! * b[w]!;
    return s;
  };
  const uu = dotD(u, u);
  const quotient: BigRational = { num: dotD(u, applyQ3Big(n, dim, u)), den: uu };
  const q2u = applyQ2Big(n, dim, u);
  let repNum = 0n;
  let repDen = 1n;
  for (let j = 3; j <= 2 * dim - 1; j += 2) {
    const vj = krawtchoukBigVector(n, j, dim);
    const cpl = dotD(vj, q2u);
    const vv = dotD(vj, vj);
    // c_3's repulsion addend: cpl^2 / (2(j-1) * vv * uu)
    repNum = repNum * (2n * BigInt(j - 1) * vv * uu) + cpl * cpl * repDen;
    repDen = repDen * (2n * BigInt(j - 1) * vv * uu);
  }
  return { quotient, repulsion: { num: repNum, den: repDen } };
}

/** c_3(n) as an exact BigInt rational (even n >= 4). */
export function thirdOrderClosedRational(n: number): BigRational {
  const { quotient, repulsion } = thirdOrderFaces(n);
  return {
    num: quotient.num * repulsion.den + repulsion.num * quotient.den,
    den: quotient.den * repulsion.den,
  };
}

/** c_3(n) as a float (exact rational evaluated at the float floor). */
export function thirdOrderClosed(n: number): number {
  const r = thirdOrderClosedRational(n);
  return Number(r.num) / Number(r.den);
}

/**
 * ===== The sixty-fifth-visit additions: the quotient-face law and the
 * cancellation face =====
 *
 * TC39's exact heart: u is a JOINT Rayleigh vector for the second- and
 * third-order faces — 3<u,Q3 u> + (n-2)<u,Q2 u> = 0 as an integer identity
 * for every even n >= 4, so the quotient face of c_3 inherits TC37's law
 * verbatim: q(n) = -(n-2)/3 * c2(n) = -(n-1)(n-2) C(n-2,m) / (3 * 2^(n-2)).
 *
 * The cancellation face (DATA): the repulsion term cancels the quotient
 * face's growth so heavily that the combined c_3 is a small difference of
 * large terms; the naive 2/3-share hypothesis is REFUTED on the grid — the
 * share 9r/(2(n-2)c2) crosses 1 between n=18 and n=20 and keeps rising
 * (1.0240 at n=30). The inter-face asymptotics stay open, re-priced.
 */

/** The D-weighted inner product of two dim-vectors (the RS metric). */
export function dotDBig(n: number, dim: number, a: readonly bigint[], b: readonly bigint[]): bigint {
  let s = 0n;
  for (let w = 0; w < dim; w++) s += binomialBig(n, w) * a[w]! * b[w]!;
  return s;
}

/** The TC39 identity residue 3<u,Q3 u> + (n-2)<u,Q2 u> — zero for every
 * even n >= 4 (cheap path: no Krawtchouk vectors, runs to large n). */
export function quotientFaceIdentityResidue(n: number): bigint {
  const dim = n / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  return 3n * dotDBig(n, dim, u, applyQ3Big(n, dim, u)) + BigInt(n - 2) * dotDBig(n, dim, u, applyQ2Big(n, dim, u));
}

/** The cancellation deficit c_3(n) + (n-2)c_2(n)/9 as an exact rational —
 * negative through n=18, positive from n=20 on the grid (the sign crossing
 * that refutes the naive 2/3-share hypothesis at its own game). */
export function cancellationDeficit(n: number): BigRational {
  const f = thirdOrderFaces(n);
  const c2 = secondOrderGeneralRational(n);
  const c3num = f.quotient.num * f.repulsion.den + f.repulsion.num * f.quotient.den;
  const c3den = f.quotient.den * f.repulsion.den;
  return { num: c3num * 9n * c2.den + BigInt(n - 2) * c2.num * c3den, den: 9n * c3den * c2.den };
}

/** The repulsion share 9r / (2(n-2)c2) as an exact rational — crosses 1
 * between n=18 and n=20 and rises past it (grid horizon: the repulsion
 * sum's exact BigInt cost). */
export function repulsionShare(n: number): BigRational {
  const f = thirdOrderFaces(n);
  const c2 = secondOrderGeneralRational(n);
  return { num: 9n * f.repulsion.num * c2.den, den: 2n * BigInt(n - 2) * c2.num * f.repulsion.den };
}

/**
 * ===== The sixty-sixth-visit additions: the coupling closed forms =====
 *
 * TC40's exact heart — the repulsion face collapses to pure binomials:
 *   vv(n, j) = C(n, j) * 2^(n-1)   — the TRUNCATED Krawtchouk norms equal
 *                                    the classical full norms on the
 *                                    Dirichlet half-block (the odd modes'
 *                                    antisymmetric reflection doubles the
 *                                    missing half exactly);
 *   uu(n)    = n * 2^(n-1)          — u = K_1's norm, same family;
 *   |cpl(n, j)| = 2n(n-1) * C(n-2, m) * C(dim-1, (j-1)/2)
 *                                 — the coupling is PROPORTIONAL to c_2's
 *                                    central binomial, with the mode
 *                                    structure a clean C(dim-1, k).
 * All three verified by BigInt zero-residue over n = 4..36, every odd j.
 * The horizon push (pure substitution, no matrices, n -> 1024): the share
 * 9r/(2(n-2)c2) rises monotonically past 1 and extrapolates to 9/8 under
 * a/sqrt(n) corrections — IDENTIFIED BY EXTRAPOLATION, not a theorem.
 */

/** The closed-form addend c_k(n) of the repulsion face as an exact BigInt
 * rational (k = 1..dim-1, mode j = 2k+1): [2n(n-1) C(n-2,m) C(dim-1,k)]^2
 * / (2(2k) * C(n,2k+1) 2^(n-1) * n 2^(n-1)). */
export function repulsionAddendClosedRational(n: number, k: number): BigRational {
  if (n < 4 || n % 2 !== 0) throw new Error(`repulsionAddendClosedRational: even n >= 4 required, got ${n}`);
  const dim = n / 2;
  const m = (n - 2) / 2;
  if (k < 1 || k > dim - 1) throw new Error(`k out of the odd-mode range 1..dim-1`);
  const cpl = 2n * BigInt(n) * BigInt(n - 1) * binomialBig(n - 2, m) * binomialBig(dim - 1, k);
  const den = 2n * BigInt(2 * k) * binomialBig(n, 2 * k + 1) * 2n ** BigInt(n - 1) * BigInt(n) * 2n ** BigInt(n - 1);
  return { num: cpl * cpl, den };
}

/** The EXACT central-binomial factorization of the mode ratio:
 * C(dim-1,k)^2 / C(n,2k+1) = [(dim-1)!^2/(2dim)!] * (2k+1)C(2k,k) *
 * (2j+1)C(2j,j) with j = dim-1-k — verified by BigInt cross-multiplication
 * (TC41's exact heart: the share reduces to central binomials only). */
export function modeRatioFactorResidue(n: number, k: number): bigint {
  if (n < 4 || n % 2 !== 0 || k < 1 || k > n / 2 - 1) {
    throw new Error("modeRatioFactorResidue: even n >= 4, k in 1..dim-1");
  }
  const dim = n / 2;
  const j = dim - 1 - k;
  const lhsNum = binomialBig(dim - 1, k) ** 2n;
  const lhsDen = binomialBig(n, 2 * k + 1);
  const rhs = BigInt(2 * k + 1) * binomialBig(2 * k, k) * BigInt(2 * j + 1) * binomialBig(2 * j, j);
  let factDim1 = 1n;
  for (let i = 2; i <= dim - 1; i++) factDim1 *= BigInt(i);
  let fact2dim = 1n;
  for (let i = 2; i <= 2 * dim; i++) fact2dim *= BigInt(i);
  return lhsNum * fact2dim - rhs * lhsDen * factDim1 ** 2n;
}

/** The share 9r/(2(n-2)c2) as a float by pure substitution of the closed
 * forms (no matrices; log-space). Spot-checked against the exact BigInt
 * rationals at n=6/24 to all digits. */
export function shareFloat(n: number): number {
  const dim = n / 2;
  const m = (n - 2) / 2;
  const lf: number[] = [0];
  for (let i = 1; i <= 2 * n; i++) lf[i] = lf[i - 1]! + Math.log(i);
  const lb = (a: number, b: number): number => lf[a]! - lf[b]! - lf[a - b]!;
  const lnC = lb(n - 2, m);
  let lnr = -Infinity;
  for (let k = 1; k <= dim - 1; k++) {
    const lnCk =
      2 * (Math.log(2 * n * (n - 1)) + lnC + lb(dim - 1, k)) -
      (Math.log(2 * (2 * k)) + lb(n, 2 * k + 1) + 2 * (n - 1) * Math.LN2 + Math.log(n));
    lnr = lnr === -Infinity ? lnCk : Math.log(Math.exp(lnr) + Math.exp(lnCk));
  }
  const lnc2 = Math.log(n - 1) + lnC - (n - 2) * Math.LN2;
  return (9 * Math.exp(lnr)) / (2 * (n - 2) * Math.exp(lnc2));
}

/** The first correction constant a(n) = (9/8 - share(n)) * sqrt(n) —
 * converges to ~0.55091 on the grid (identified by convergence). */
export function correctionConstant(n: number): number {
  return (1.125 - shareFloat(n)) * Math.sqrt(n);
}

/** The chain identity's pieces: S(n) = sum_k (1/k) C(dim-1,k)^2/C(n,2k+1),
 * A(n) = C(n-2,m)/2^(n-2), P(n) = 9n(n-1)/(2(n-2)) — with
 * share(n) = P(n)·A(n)·S(n)/4 EXACTLY (algebraic in the TC40 forms). */
export function shareChainPieces(n: number): { S: number; A: number; P: number; chainShare: number } {
  if (n < 4 || n % 2 !== 0) throw new Error("shareChainPieces: even n >= 4 required");
  const dim = n / 2;
  const m = (n - 2) / 2;
  const lf: number[] = [0];
  for (let i = 1; i <= n; i++) lf[i] = lf[i - 1]! + Math.log(i);
  const lb = (a: number, b: number): number => lf[a]! - lf[b]! - lf[a - b]!;
  let lnS = -Infinity;
  for (let k = 1; k <= dim - 1; k++) {
    const t = 2 * lb(dim - 1, k) - lb(n, 2 * k + 1) - Math.log(k);
    lnS = lnS === -Infinity ? t : Math.log(Math.exp(lnS) + Math.exp(t));
  }
  const A = Math.exp(lb(n - 2, m) - (n - 2) * Math.LN2);
  const P = (9 * n * (n - 1)) / (2 * (n - 2));
  return { S: Math.exp(lnS), A, P, chainShare: (P * A * Math.exp(lnS)) / 4 };
}

/** sigma1(n) = (share/(9/8) - 1)·sqrt(n) — the 1/sqrt(n) face of the
 * share's expansion: sigma1(n) = sigma1 + O(1/n), sigma1 = -0.4896664762
 * (Richardson over n <= 2^18), so a = -(9/8)·sigma1 = 0.550874786. */
export function sigmaFirst(n: number): number {
  return (shareFloat(n) / 1.125 - 1) * Math.sqrt(n);
}

/** The EXACT fixed-k edge law: summand(n,k)·dim -> (2k+1)C(2k,k)/(2·4^k·k)
 * as dim -> n/2 -> infinity with k fixed — the endpoint mass that the
 * singular Euler-Maclaurin machinery must regularize (each coefficient is
 * an exact rational multiple of C(2k,k)/4^k). */
export function edgeAsymptoticCoefficient(k: number): number {
  let c = 1n;
  for (let i = 0; i < k; i++) c = (c * BigInt(2 * k - i)) / BigInt(i + 1);
  return (Number(2 * k + 1) * Number(c)) / (2 * 4 ** k * k);
}

/** The measured summand·dim at (n,k) — converges to the edge coefficient
 * from above as n grows (the machine-verifiable face of the edge law). */
export function summandTimesDim(n: number, k: number): number {
  const dim = n / 2;
  const lf: number[] = [0];
  for (let i = 1; i <= n; i++) lf[i] = lf[i - 1]! + Math.log(i);
  const lb = (a: number, b: number): number => lf[a]! - lf[b]! - lf[a - b]!;
  return Math.exp(2 * lb(dim - 1, k) - lb(n, 2 * k + 1) - Math.log(k) + Math.log(dim));
}

/** The arcsine law: S(n)·sqrt(dim)·sqrt(pi) — converges to pi/2 (the
 * k-profile integral int_0^1 sqrt((1-x)/x) dx = Beta(1/2, 3/2) = pi/2),
 * which reproduces the 9/8 limit through the chain identity. */
export function arcsineLaw(n: number): number {
  const dim = n / 2;
  return shareChainPieces(n).S * Math.sqrt(dim) * Math.sqrt(Math.PI);
}

/** The Richardson limit of a sequence under the model v(n) = v + c/n^pow. */
export function richardsonLimit(values: ReadonlyArray<{ n: number; v: number }>, pow: number): number {
  let vals = [...values];
  let p = pow;
  while (vals.length > 1) {
    const next: Array<{ n: number; v: number }> = [];
    for (let i = 0; i + 1 < vals.length; i++) {
      const r = Math.pow(vals[i + 1]!.n / vals[i]!.n, p);
      next.push({ n: vals[i + 1]!.n, v: (r * vals[i + 1]!.v - vals[i]!.v) / (r - 1) });
    }
    vals = next;
    p += pow;
  }
  return vals[0]!.v;
}

/** The zero-residue verifier for the three closed forms over a grid: every
 * odd mode's vv, uu, and |cpl| must match. Returns the worst violation
 * (0n when all hold). */
export function couplingClosedFormResidue(n: number, j: number): bigint {
  if (n < 4 || n % 2 !== 0 || j < 3 || j % 2 === 0) throw new Error("couplingClosedFormResidue: even n >= 4, odd j >= 3");
  const dim = n / 2;
  const m = (n - 2) / 2;
  const u = Array.from({ length: dim }, (_, w) => BigInt(n - 2 * w));
  let s = 0n;
  for (let w = 0; w < dim; w++) s += binomialBig(n, w) * u[w]! * u[w]!;
  const uuResidue = s - BigInt(n) * 2n ** BigInt(n - 1);
  const vj = krawtchoukBigVector(n, j, dim);
  let vv = 0n;
  for (let w = 0; w < dim; w++) vv += binomialBig(n, w) * vj[w]! * vj[w]!;
  const vvResidue = vv - binomialBig(n, j) * 2n ** BigInt(n - 1);
  const q2u = applyQ2Big(n, dim, u);
  let cpl = 0n;
  for (let w = 0; w < dim; w++) cpl += binomialBig(n, w) * vj[w]! * q2u[w]!;
  const cplForm = 2n * BigInt(n) * BigInt(n - 1) * binomialBig(n - 2, m) * binomialBig(dim - 1, (j - 1) / 2);
  const cplResidue = cpl * (cpl < 0n ? -1n : 1n) - cplForm;
  return uuResidue !== 0n || vvResidue !== 0n || cplResidue !== 0n ? 1n : 0n;
}

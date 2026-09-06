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
    if (repair) {
      // majority decode at the top: w <- min(w, n - w); the tie n/2 is the
      // decoder's own dead zone and passes through unrepaired
      const repairedDist = new Float64Array((n + 1) * width);
      const repairedPure = new Float64Array(n + 1);
      for (let w = 0; w <= n; w++) {
        const target = Math.min(w, n - w);
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
  return { fidelity, survival, meanSyndromeBits: entropySum / periods };
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
}

/**
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

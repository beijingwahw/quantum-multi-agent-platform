/**
 * The checker — the market laws, and the witnesses that re-derive every
 * MARKET-EXACT number from the market machinery itself.
 *
 * Laws enforced:
 *   M1. every good carries a price — unpriced goods do not ship;
 *   M2. an unpriceable ("flat supply") claim must cite an invariance witness
 *       that exists — an asserted impossibility without a witness is
 *       marketing;
 *   M3. anchor repos exist on disk (quantum-mech, nosignal-tariff);
 *   M4. tags are MARKET-EXACT or DATA;
 *   M5. ids unique.
 *
 * Witnesses:
 *   W-A the one-coin identity (pass - 1/2 = a.r/2, swept);
 *   W-B the flat supply (strategy families -> marginal I/2, reveal 1/2);
 *   W-C the classical frontier (slack == loss on the grid);
 *   W-D the sellable goods' curves (detection, two paths);
 *   W-E the constants on two paths;
 *   W-F the flat supply over the CONTINUOUS parameterized family (v0.2.0);
 *   W-G the one-coin identity under a noisy commit channel (v0.2.0 census);
 *   W-H the two-coin bounded census (v0.2.0).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { traceDistance, traceReal } from "../core/measures.js";
import { applyNoise, type NoiseName, partialTrace } from "../core/channels.js";
import {
  type EnsembleMember,
  HALF_MIXED,
  blochOf,
  blochState,
  coinReveal,
  concealmentLoss,
  continuousStrategies,
  jointAverage,
  jointProductReveal,
  marginal,
  passProbability,
  pureState,
  revealStats,
  strategyFamilies,
  twoCoinStrategies,
} from "./market.js";
import {
  MARKET,
  QUOTED_CHEAT_CONST,
  QUOTED_CHEAT_CONST_DEV,
  QUOTED_CONFISCATION_DEV,
  QUOTED_CONT_FLAT_DEV,
  QUOTED_CONT_STRATEGIES,
  QUOTED_DETECTION_M,
  QUOTED_FLAT_DEV,
  QUOTED_IDENTITY_DEV,
  QUOTED_JOINT_SPREAD_MIN,
  QUOTED_NOISE_IDENTITY_DEV,
  type MarketRow,
} from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G", "W-H"];

/**
 * A MarketRow as it crosses the untrusted boundary into the checker: the
 * compile-time `Exactness` union proves nothing at runtime (rows can arrive
 * parsed or mutated), so the tag is an unvalidated string until M4 has run.
 * `MarketRow` remains assignable (Exactness ⊂ string).
 */
export type UntrustedMarketRow = Omit<MarketRow, "exactness"> & { readonly exactness: string };

export function checkMarket(rows: readonly UntrustedMarketRow[] = MARKET): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "M5", detail: "duplicate market row id" });
    seen.add(r.id);
    if (r.price.trim().length === 0) {
      violations.push({ row: r.id, law: "M1", detail: "an unpriced good — the market does not ship it" });
    }
    if (r.exactness !== "MARKET-EXACT" && r.exactness !== "DATA") {
      violations.push({ row: r.id, law: "M4", detail: `illegal tag "${r.exactness}"` });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "M2", detail: `cites unknown witness "${r.witness}" — an asserted impossibility without a witness is marketing` });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "M3", detail: `anchor repo missing on disk: ${a}` });
      }
    }
  }
  return violations;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

function witnessIdentity(): WitnessResult {
  let worst = 0;
  for (let t = 0; t < 200; t++) {
    const th1 = (t * 0.31) % Math.PI;
    const ph1 = (t * 0.73) % (2 * Math.PI);
    const th2 = (t * 0.57) % Math.PI;
    const ph2 = (t * 0.41) % (2 * Math.PI);
    const s1 = Math.sin(th1);
    const s2 = Math.sin(th2);
    const a = pureState([s1 * Math.cos(ph1), s1 * Math.sin(ph1), Math.cos(th1)]);
    const rho = blochState([0.3 * s2 * Math.cos(ph2), 0.3 * s2 * Math.sin(ph2), 0.3 * Math.cos(th2)]);
    const p = passProbability(a, rho);
    const av = blochOf(a);
    const rv = blochOf(rho);
    const dot = (av[0]) * (rv[0]) + (av[1]) * (rv[1]) + (av[2]) * (rv[2]);
    worst = Math.max(worst, Math.abs(p - 0.5 - dot / 2));
  }
  const ok = worst <= QUOTED_IDENTITY_DEV;
  return { name: "W-A one-coin identity", pass: ok, detail: `pass - 1/2 vs a.r/2 over 200 points: maxdev ${worst.toExponential(3)}` };
}

function witnessFlatSupply(): WitnessResult {
  const families = strategyFamilies();
  let worstTV = 0;
  let worstDev = 0;
  for (const fam of families) {
    const m = marginal(fam.members);
    worstTV = Math.max(worstTV, traceDistance(m, HALF_MIXED));
    const { worst: w, average } = revealStats(fam.members, m);
    worstDev = Math.max(worstDev, Math.abs(w - 0.5), Math.abs(average - 0.5));
  }
  const ok = worstTV <= QUOTED_FLAT_DEV + 1e-15 && worstDev <= QUOTED_FLAT_DEV + 1e-15;
  return {
    name: "W-B flat supply",
    pass: ok,
    detail: `${families.length} promisor strategies: worst marginal TV ${worstTV.toExponential(3)}, worst reveal deviation ${worstDev.toExponential(3)} — no decomposition moves it`,
  };
}

function witnessFrontier(): WitnessResult {
  const grid = [0, 0.2, 0.5, Math.SQRT1_2, 1];
  let worstSlack = 0;
  let cheatOk = false;
  const lines: string[] = [];
  for (const r of grid) {
    const rho = blochState([0, 0, r]);
    const p = passProbability(pureState([0, 0, 1]), rho);
    const loss = concealmentLoss(rho);
    worstSlack = Math.max(worstSlack, Math.abs(p - 0.5 - loss));
    if (Math.abs(r - Math.SQRT1_2) < 1e-15) {
      cheatOk = Math.abs(p - QUOTED_CHEAT_CONST) < QUOTED_CHEAT_CONST_DEV;
      lines.push(`cheat point: ${p.toFixed(12)}`);
    }
  }
  const ok = worstSlack < 1e-15 && cheatOk;
  return { name: "W-C classical frontier", pass: ok, detail: `slack == loss at every grid point (maxdev ${worstSlack.toExponential(3)}); ${lines.join("")}` };
}

function witnessDetection(): WitnessResult {
  let worst = 0;
  for (let m = 1; m <= QUOTED_DETECTION_M; m++) {
    const closed = 1 - Math.pow(3 / 4, m);
    let product = 1;
    for (let i = 0; i < m; i++) product *= 3 / 4;
    worst = Math.max(worst, Math.abs(closed - (1 - product)));
  }
  const ok = worst < 1e-15;
  return { name: "W-D detection curve (two paths)", pass: ok, detail: `1 - (3/4)^m for m = 1..${QUOTED_DETECTION_M}: closed vs recursive product, maxdev ${worst.toExponential(3)}` };
}

function witnessConstants(): WitnessResult {
  const symbolic = (2 + Math.SQRT2) / 4;
  const numeric = (1 + 1 / Math.SQRT2) / 2;
  const ok = Math.abs(symbolic - QUOTED_CHEAT_CONST) < QUOTED_CHEAT_CONST_DEV && Math.abs(symbolic - numeric) < 1e-15;
  return { name: "W-E constants on two paths", pass: ok, detail: `(2+sqrt(2))/4 = ${symbolic.toFixed(12)} = (1+1/sqrt(2))/2 = ${numeric.toFixed(12)}` };
}

/** W-F: the flat supply over the CONTINUOUS parameterized family. */
function witnessContinuousSupply(): WitnessResult {
  const strategies = continuousStrategies();
  let worstTV = 0;
  let worstDev = 0;
  let worstWeight = 0;
  let worstPurity = 0;
  for (const fam of strategies) {
    const w = fam.members.reduce((s, x) => s + x.weight, 0);
    worstWeight = Math.max(worstWeight, Math.abs(w - 1));
    for (const m of fam.members) {
      // a pure member must have trace 1 (the mixed refinement member I/2 included)
      worstPurity = Math.max(worstPurity, Math.abs(traceReal(m.state) - 1));
    }
    const marg = marginal(fam.members);
    worstTV = Math.max(worstTV, traceDistance(marg, HALF_MIXED));
    const { worst, average } = revealStats(fam.members, marg);
    worstDev = Math.max(worstDev, Math.abs(worst - 0.5), Math.abs(average - 0.5));
  }
  const ok =
    strategies.length === QUOTED_CONT_STRATEGIES &&
    worstWeight <= 1e-15 &&
    worstPurity <= 1e-12 &&
    worstTV <= QUOTED_CONT_FLAT_DEV &&
    worstDev <= QUOTED_CONT_FLAT_DEV;
  return {
    name: "W-F continuous flat supply",
    pass: ok,
    detail: `${strategies.length} parameterized ensembles (antipodal-pair products 61x25, geodesic interpolations 91, convex refinements 21x25): worst weight defect ${worstWeight.toExponential(2)}, worst marginal TV ${worstTV.toExponential(3)}, worst reveal deviation ${worstDev.toExponential(3)} — exhaustive over the stated family`,
  };
}

const DEPHASE_GRID: readonly number[] = [0, 0.125, 0.25, 0.375, 0.5];
const DAMP_GRID: readonly number[] = [0, 0.25, 0.5, 0.75, 1];

/** W-G: the one-coin identity under a noisy commit channel — the exact census.
 *  Survives / bends / breaks are all ASSERTED as measured findings (a broken
 *  identity reported as found is a first-class result, not a failure). */
function witnessNoiseCensus(): WitnessResult {
  const channels: ReadonlyArray<{ noise: NoiseName; grid: readonly number[] }> = [
    { noise: "dephase", grid: DEPHASE_GRID },
    { noise: "ampdamp", grid: DAMP_GRID },
  ];
  // (a) the identity as an equation of the OUTPUT marginal: survives everywhere
  let worstIdentity = 0;
  for (const { noise, grid } of channels) {
    for (const gamma of grid) {
      for (let i = 0; i < 16; i++) {
        for (let j = 0; j < 16; j++) {
          const a = fibDir(i, 16, 0);
          const r = fibDir(j, 16, 0.5);
          const out = applyNoise(blochState([0.7 * r[0], 0.7 * r[1], 0.7 * r[2]]), noise, gamma);
          const p = passProbability(pureState(a), out);
          const rv = blochOf(out);
          const dot = a[0] * rv[0] + a[1] * rv[1] + a[2] * rv[2];
          worstIdentity = Math.max(worstIdentity, Math.abs(p - 0.5 - dot / 2));
        }
      }
    }
  }
  // (b) the flat supply survives every channel: every decomposition of I/2
  //     lands on E_gamma(I/2) identically (CPTP linearity), sampled every 5th
  const sample = continuousStrategies().filter((_, i) => i % 5 === 0);
  let worstFlatUnderNoise = 0;
  let dephaseWorstLevel = 0;
  let dampWorstLevel = 0;
  for (const { noise, grid } of channels) {
    for (const gamma of grid) {
      const eHalf = applyNoise(HALF_MIXED, noise, gamma);
      for (const fam of sample) {
        const marg = applyNoise(marginal(fam.members), noise, gamma);
        worstFlatUnderNoise = Math.max(worstFlatUnderNoise, traceDistance(marg, eHalf));
        const { worst } = revealStats(fam.members, marg);
        if (noise === "dephase") dephaseWorstLevel = Math.max(dephaseWorstLevel, Math.abs(worst - 0.5));
        else dampWorstLevel = Math.max(dampWorstLevel, Math.abs(worst - 0.5));
      }
    }
  }
  // (c) the bend: dephasing rotates oblique polarizations away from the
  //     input-aligned announcement — wedge (loss - slack) at gamma = 1/2
  const q = Math.SQRT1_2;
  const rho45 = blochState([q, 0, q]);
  const out45 = applyNoise(rho45, "dephase", 0.5);
  const p45 = passProbability(pureState([q, 0, q]), out45);
  const wedge45 = concealmentLoss(out45) - (p45 - 0.5);
  // (d) the break: damping mints polarization from a perfectly concealed input
  let worstConfiscation = 0;
  let worstMintSlack = 0;
  for (const gamma of DAMP_GRID) {
    const out = applyNoise(HALF_MIXED, "ampdamp", gamma);
    worstConfiscation = Math.max(worstConfiscation, Math.abs(concealmentLoss(out) - gamma / 2));
    // announcing along the minted axis: slack gamma/2 (the minted pair is
    // (loss, slack) = (gamma/2, gamma/2) from a (0,0) input)
    worstMintSlack = Math.max(worstMintSlack, Math.abs(passProbability(pureState([0, 0, 1]), out) - 0.5 - gamma / 2));
  }
  // (e) the tilted floor, exactly: under damping the verifier's register is
  //     E_gamma(I/2) for every strategy, so each PURE member's reveal is
  //     (1 + gamma * m_z)/2 — the level leaves 1/2 memberwise, by announcement
  let worstMemberFormula = 0;
  for (const gamma of DAMP_GRID) {
    const eHalf = applyNoise(HALF_MIXED, "ampdamp", gamma);
    for (const fam of sample) {
      for (const m of fam.members) {
        const r = blochOf(m.state);
        const norm = Math.hypot(r[0], r[1], r[2]);
        if (norm < 1 - 1e-9) continue; // mixed refinement member: not a physical announcement
        worstMemberFormula = Math.max(worstMemberFormula, Math.abs(passProbability(pureState(r), eHalf) - (1 + gamma * r[2]) / 2));
      }
    }
  }
  const ok =
    worstIdentity <= QUOTED_NOISE_IDENTITY_DEV &&
    worstFlatUnderNoise <= 1e-15 &&
    dephaseWorstLevel <= 1e-15 &&
    wedge45 > 0.1 &&
    worstConfiscation <= QUOTED_CONFISCATION_DEV &&
    worstMintSlack <= 1e-15 &&
    worstMemberFormula <= 1e-15;
  return {
    name: "W-G identity under noise census",
    pass: ok,
    detail: `output identity survives every channel/strength (maxdev ${worstIdentity.toExponential(2)} over ${DEPHASE_GRID.length + DAMP_GRID.length} settings x 256 pairs); flat supply flat under every channel (${sample.length} strategies x 10 settings: worst TV to E(I/2) ${worstFlatUnderNoise.toExponential(2)}), dephase level stays 1/2 (${dephaseWorstLevel.toExponential(2)}), damping level leaves 1/2 memberwise as (1 + gamma m_z)/2 (maxdev ${worstMemberFormula.toExponential(2)}, worst sampled departure ${dampWorstLevel.toFixed(3)} at gamma=1); the bend: dephased oblique input wedge ${wedge45.toFixed(6)} at gamma=1/2; the break: damping confiscates gamma/2 of concealment from a perfectly concealed input (maxdev ${worstConfiscation.toExponential(2)}) and mints the matching slack (maxdev ${worstMintSlack.toExponential(2)})`,
  };
}

/** Equal-area Fibonacci direction (deterministic, shared by the census grids). */
function fibDir(i: number, n: number, offset: number): [number, number, number] {
  const z = 1 - (2 * (i + 0.5)) / n;
  const s = Math.sqrt(Math.max(0, 1 - z * z));
  const phi = (i + offset) * 2.399963229728653;
  return [s * Math.cos(phi), s * Math.sin(phi), z];
}

/** W-H: the two-coin bounded census — per-coin flat, joint movable. */
function witnessTwoCoins(): WitnessResult {
  const strategies = twoCoinStrategies();
  const dirs: ReadonlyArray<[number, number, number]> = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
    [Math.SQRT1_2, 0, Math.SQRT1_2],
    [-Math.SQRT1_2, 0, Math.SQRT1_2],
    [Math.SQRT1_2, Math.SQRT1_2, 0],
  ];
  const zz = pureState([0, 0, 1]);
  let worstCoinTV = 0;
  let worstCoinDev = 0;
  let flatJointWorst = 0;
  let jointMin = 1;
  let jointMax = 0;
  let zzMin = 1;
  let zzMax = 0;
  for (const s of strategies) {
    const joint = jointAverage(s.members);
    for (const coin of [0, 1] as const) {
      const marg = partialTrace(joint, [2, 2], [coin === 0 ? 1 : 0]);
      worstCoinTV = Math.max(worstCoinTV, traceDistance(marg, HALF_MIXED));
      for (const a of dirs) {
        worstCoinDev = Math.max(worstCoinDev, Math.abs(coinReveal(joint, coin, pureState(a)) - 0.5));
      }
    }
    for (const a of dirs) {
      for (const b of dirs) {
        const p = jointProductReveal(joint, pureState(a), pureState(b));
        jointMin = Math.min(jointMin, p);
        jointMax = Math.max(jointMax, p);
        if (s.jointFlat) flatJointWorst = Math.max(flatJointWorst, Math.abs(p - 0.25));
      }
    }
    // the joint good at ONE fixed announcement (z,z): what a perfectly
    // concealing promisor can still move
    const pzz = jointProductReveal(joint, zz, zz);
    zzMin = Math.min(zzMin, pzz);
    zzMax = Math.max(zzMax, pzz);
  }
  const fixedSpread = zzMax - zzMin;
  const ok = worstCoinTV <= 1e-15 && worstCoinDev <= 1e-15 && flatJointWorst <= 1e-15 && fixedSpread >= QUOTED_JOINT_SPREAD_MIN;
  return {
    name: "W-H two-coin census",
    pass: ok,
    detail: `${strategies.length} two-coin strategies: per-coin marginal worst TV ${worstCoinTV.toExponential(2)}, per-coin reveal worst dev ${worstCoinDev.toExponential(2)}; I/4-decomposition joint reveal worst dev from 1/4 ${flatJointWorst.toExponential(2)}; joint product-announce pass spans ${jointMin.toFixed(6)}..${jointMax.toFixed(6)} over the announcement grid, and at the FIXED announcement (z,z) spans ${zzMin.toFixed(6)}..${zzMax.toFixed(6)} (spread ${fixedSpread.toFixed(6)}) across perfectly concealing strategies — per-coin flat, joint movable`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessIdentity(),
    witnessFlatSupply(),
    witnessFrontier(),
    witnessDetection(),
    witnessConstants(),
    witnessContinuousSupply(),
    witnessNoiseCensus(),
    witnessTwoCoins(),
  ];
}

// ---------------------------------------------------------------------------
// v0.2.0 — claim verifiers: a witness handed in from outside is re-derived,
// never trusted. The checker NAMES the counterfeit and rejects it.
// ---------------------------------------------------------------------------

export interface ClaimVerdict {
  readonly ok: boolean;
  readonly code: string;
  readonly detail: string;
}

/** A handed-in flat-supply claim: a "family" plus its claimed census numbers. */
export interface SupplyClaim {
  readonly familyName: string;
  readonly members: readonly EnsembleMember[];
  readonly claimedTV: number;
  readonly claimedRevealDev: number;
}

/** Re-derives the census from the machinery; names every counterfeit kind. */
export function verifySupplyClaim(claim: SupplyClaim): ClaimVerdict {
  for (const m of claim.members) {
    if (m.state.rows !== 2 || m.state.cols !== 2) {
      return { ok: false, code: "MEMBER-FRAUD", detail: `family "${claim.familyName}": a member is ${m.state.rows}x${m.state.cols}, not a qubit state` };
    }
    if (Math.abs(traceReal(m.state) - 1) > 1e-9) {
      return { ok: false, code: "MEMBER-FRAUD", detail: `family "${claim.familyName}": a member has trace ${traceReal(m.state).toFixed(9)} — not a state` };
    }
  }
  const weightSum = claim.members.reduce((s, m) => s + m.weight, 0);
  if (Math.abs(weightSum - 1) > 1e-12) {
    return { ok: false, code: "WEIGHT-FRAUD", detail: `family "${claim.familyName}": weights sum to ${weightSum.toFixed(9)} — a decomposition this is not` };
  }
  const marg = marginal(claim.members);
  const tv = traceDistance(marg, HALF_MIXED);
  if (tv > 1e-12) {
    return { ok: false, code: "NOT-A-DECOMPOSITION", detail: `family "${claim.familyName}": marginal is TV ${tv.toFixed(9)} from I/2 — a flat-supply witness must decompose I/2, and this family does not` };
  }
  const { worst, average } = revealStats(claim.members, marg);
  const revealDev = Math.max(Math.abs(worst - 0.5), Math.abs(average - 0.5));
  if (revealDev > 1e-12) {
    return { ok: false, code: "NON-FLAT-REVEAL", detail: `family "${claim.familyName}": reveal deviates ${revealDev.toFixed(9)} from 1/2 — the supply is not flat here` };
  }
  if (Math.abs(claim.claimedTV - tv) > 1e-9) {
    return { ok: false, code: "FORGED-TV", detail: `family "${claim.familyName}": claimed TV ${claim.claimedTV}, the machine measures ${tv.toExponential(3)}` };
  }
  if (Math.abs(claim.claimedRevealDev - revealDev) > 1e-9) {
    return { ok: false, code: "FORGED-REVEAL", detail: `family "${claim.familyName}": claimed reveal dev ${claim.claimedRevealDev}, the machine measures ${revealDev.toExponential(3)}` };
  }
  return { ok: true, code: "VERIFIED", detail: `re-derived: TV ${tv.toExponential(3)}, reveal dev ${revealDev.toExponential(3)}` };
}

/** A handed-in noise-identity claim: channel, input, announcement, claimed pass. */
export interface NoiseIdentityClaim {
  readonly noise: NoiseName;
  readonly gamma: number;
  readonly inputBloch: readonly [number, number, number];
  readonly announceBloch: readonly [number, number, number];
  readonly claimedPass: number;
  /** claims pass - 1/2 still equals the concealment loss one-to-one */
  readonly claimedSlackEqualsLoss: boolean;
}

/** Re-derives the noisy reveal; names a forged pass or a denied wedge. */
export function verifyNoiseIdentityClaim(claim: NoiseIdentityClaim): ClaimVerdict {
  const rhoOut = applyNoise(blochState([...claim.inputBloch] as [number, number, number]), claim.noise, claim.gamma);
  const pass = passProbability(pureState([...claim.announceBloch] as [number, number, number]), rhoOut);
  const slack = pass - 0.5;
  const loss = concealmentLoss(rhoOut);
  if (Math.abs(claim.claimedPass - pass) > 1e-9) {
    return { ok: false, code: "FORGED-PASS", detail: `${claim.noise}(gamma=${claim.gamma}): claimed pass ${claim.claimedPass}, the channel gives ${pass.toFixed(12)}` };
  }
  if (claim.claimedSlackEqualsLoss && Math.abs(slack - loss) > 1e-12) {
    return {
      ok: false,
      code: "WEDGE-DENIED",
      detail: `${claim.noise}(gamma=${claim.gamma}): slack ${slack.toFixed(9)} != loss ${loss.toFixed(9)} — the one-to-one holds only when the announcement aligns with the OUTPUT polarization; the wedge is ${(loss - slack).toFixed(9)}`,
    };
  }
  return { ok: true, code: "VERIFIED", detail: `re-derived: pass ${pass.toFixed(12)}, slack ${slack.toFixed(9)}, loss ${loss.toFixed(9)}` };
}

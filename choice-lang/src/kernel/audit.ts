/**
 * The checker — the model laws, and the witnesses that re-derive every
 * MODEL-EXACT number from the language itself.
 *
 * Laws enforced:
 *   P1. every claim names its program family (engineered / random / both) —
 *       naked stability claims do not ship;
 *   P2. the exactness tag is MODEL-EXACT or DATA, and every row cites a
 *       witness that exists — this repo's vocabulary deliberately has no
 *       physics-verdict words; the epoch-5 question is not claimable here;
 *   P3. anchor repos exist on disk — the toll, the clone mark and the
 *       Noether-shape note stay anchored where they were verified;
 *   P4. ids unique.
 *
 * Witnesses:
 *   W-A stability split (engineered drift vs random decay);
 *   W-B the denotation compiles (pattern weights + conditional states);
 *   W-C the certification toll (weights exact, MC vs 1/P);
 *   W-D the covariance order split (steer order 1, clone order 2 — both read
 *       off real matrices, never composed from the expected answer);
 *   W-E the membership charge conserved for every input.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, identity, kron, mat, mAdd, mDagger, mMul } from "../core/cmat.js";
import { makeRng } from "../core/rng.js";
import { branchProduct, conditionOnPattern, membershipExpectation, runProgram, type ChooseStep, type Program } from "./lang.js";
import { DATA_DIM, engineeredUnitary, randomBranchUnitary, worldProjector, worldState } from "./fixtures.js";
import {
  MODEL,
  QUOTED_CONSERVATION_DEV,
  QUOTED_DENOTATION_DEV,
  QUOTED_RANDOM_MAX,
  QUOTED_RANDOM_MEAN,
  QUOTED_RANDOM_MIN,
  QUOTED_STABILITY_DRIFT,
  QUOTED_TOLL_MC_TOL,
  type ModelRow,
} from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E"];

/**
 * A ModelRow as it crosses the untrusted boundary into the checker: the
 * compile-time unions prove nothing at runtime (rows can arrive parsed or
 * mutated), so `family` and `exactness` are unvalidated strings until P1/P2
 * have run. `ModelRow` remains assignable (both unions ⊂ string).
 */
export type UntrustedModelRow = Omit<ModelRow, "family" | "exactness"> & {
  readonly family: string;
  readonly exactness: string;
};

export function checkModel(rows: readonly UntrustedModelRow[] = MODEL): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "P4", detail: "duplicate model row id" });
    seen.add(r.id);
    if (r.family !== "engineered" && r.family !== "random" && r.family !== "both") {
      violations.push({ row: r.id, law: "P1", detail: `unnamed program family "${r.family}" — naked stability does not ship` });
    }
    if (r.exactness !== "MODEL-EXACT" && r.exactness !== "DATA") {
      violations.push({ row: r.id, law: "P2", detail: `illegal tag "${r.exactness}" — this repo's vocabulary has no physics-verdict words` });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "P2", detail: `cites unknown witness "${r.witness}" — unwitnessed exactness is hearsay` });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "P3", detail: `anchor repo missing on disk: ${a}` });
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

function engineeredProgram(len: number, seedBase: number): Program {
  const steps: ChooseStep[] = [];
  for (let i = 0; i < len; i++) {
    steps.push({ theta: 0.3 + 0.1 * (i % 5), u0: engineeredUnitary(seedBase + i * 7), u1: engineeredUnitary(seedBase + 100 + i * 13) });
  }
  return steps;
}

/** W-A: engineered drift + random decay (the stability split). */
function witnessStability(): WitnessResult {
  const piW = worldProjector();
  const rho0 = worldState();
  let worst = 0;
  for (let len = 1; len <= 6; len++) {
    const out = runProgram(engineeredProgram(len, 101), rho0);
    worst = Math.max(worst, Math.abs(1 - membershipExpectation(out, piW, DATA_DIM)));
  }
  let sum = 0;
  let mn = 1;
  let mx = 0;
  for (let t = 0; t < 12; t++) {
    const steps: ChooseStep[] = [];
    for (let i = 0; i < 6; i++) {
      steps.push({ theta: 0.7, u0: randomBranchUnitary(1000 + t * 17 + i), u1: randomBranchUnitary(2000 + t * 23 + i) });
    }
    const m = membershipExpectation(runProgram(steps, rho0), piW, DATA_DIM);
    sum += m;
    mn = Math.min(mn, m);
    mx = Math.max(mx, m);
  }
  const mean = sum / 12;
  const ok = worst <= QUOTED_STABILITY_DRIFT && Math.abs(mean - QUOTED_RANDOM_MEAN) < 0.02 && mn >= QUOTED_RANDOM_MIN - 0.02 && mx <= QUOTED_RANDOM_MAX + 0.02;
  return {
    name: "W-A stability split",
    pass: ok,
    detail: `engineered drift ${worst.toExponential(3)} (floor ${QUOTED_STABILITY_DRIFT.toExponential(2)}); random mean ${mean.toFixed(4)} range [${mn.toFixed(4)}, ${mx.toFixed(4)}] vs dimension ratio 0.5`,
  };
}

/** W-B: the denotation compiles. */
function witnessDenotation(): WitnessResult {
  const rho0 = worldState();
  const steps: Program = [
    { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    { theta: 1.0, u0: randomBranchUnitary(9), u1: randomBranchUnitary(10) },
    { theta: 0.2, u0: engineeredUnitary(11), u1: engineeredUnitary(12) },
  ];
  const pattern: ReadonlyArray<0 | 1> = [1, 0, 1];
  const { p, conditional } = conditionOnPattern(runProgram(steps, rho0), 3, pattern, DATA_DIM);
  const closed = Math.sin(0.6) ** 2 * Math.cos(1.0) ** 2 * Math.sin(0.2) ** 2;
  const u = branchProduct(steps, pattern);
  const denoted = mMul(mMul(u, rho0), mDagger(u));
  let dev = 0;
  for (let k = 0; k < denoted.re.length; k++) {
    dev = Math.max(dev, Math.abs(conditional.re[k]! - denoted.re[k]!), Math.abs(conditional.im[k]! - denoted.im[k]!));
  }
  const ok = Math.abs(p - closed) < 1e-15 && dev <= QUOTED_DENOTATION_DEV;
  return { name: "W-B denotation compiles", pass: ok, detail: `weight ${p.toFixed(15)} vs closed ${closed.toFixed(15)}; conditional deviation ${dev.toExponential(3)}` };
}

/** W-C: the certification toll. */
function witnessToll(): WitnessResult {
  const rho0 = worldState();
  const rng = makeRng(4242);
  let ok = true;
  const lines: string[] = [];
  for (const theta of [0.4, 0.9, 1.2]) {
    const single: Program = [{ theta, u0: engineeredUnitary(31), u1: engineeredUnitary(32) }];
    const P = Math.sin(theta) ** 2;
    const { p } = conditionOnPattern(runProgram(single, rho0), 1, [1], DATA_DIM);
    if (Math.abs(p - P) > 1e-15) ok = false;
    let attempts = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) {
      let got = 0;
      let tries = 0;
      while (got !== 1) {
        got = rng() < P ? 1 : 0;
        tries++;
        if (tries > 5000) break;
      }
      attempts += tries;
    }
    const mc = attempts / N;
    if (Math.abs(mc / (1 / P) - 1) > QUOTED_TOLL_MC_TOL) ok = false;
    lines.push(`P=${P.toFixed(6)}: E[attempts] ${mc.toFixed(4)} vs 1/P=${(1 / P).toFixed(4)}`);
  }
  return { name: "W-C certification toll", pass: ok, detail: lines.join("; ") };
}

/** The control marginal of an 8x8 state on (control, data). */
function controlMarginal(rho: CMat): CMat {
  const out = mat(2, 2);
  for (let c1 = 0; c1 < 2; c1++) {
    for (let c2 = 0; c2 < 2; c2++) {
      let re = 0;
      let im = 0;
      for (let j = 0; j < 4; j++) {
        re += rho.re[(c1 * 4 + j) * 8 + (c2 * 4 + j)]!;
        im += rho.im[(c1 * 4 + j) * 8 + (c2 * 4 + j)]!;
      }
      out.re[c1 * 2 + c2] = re;
      out.im[c1 * 2 + c2] = im;
    }
  }
  return out;
}

/** W-D: covariance order split — steer order 1 (from the joint state), clone order 2 (from the CNOT pair). */
function witnessCovariance(): WitnessResult {
  const rho0 = worldState();
  const single: Program = [{ theta: 0.8, u0: engineeredUnitary(51), u1: engineeredUnitary(52) }];
  const fin = runProgram(single, rho0); // (control, data), 8x8

  // steer term, read off the joint matrix: sum_j rho[(1,j),(0,j)]
  const steer = (m: CMat): { re: number; im: number } => {
    let re = 0;
    let im = 0;
    for (let j = 0; j < 4; j++) {
      re += m.re[(4 + j) * 8 + j]!;
      im += m.im[(4 + j) * 8 + j]!;
    }
    return { re, im };
  };

  // clone pair: the ACTUAL 4x4 state CNOT_{c1->c2} (rho_c (x) |0><0|) CNOT,
  // rephased by R_phi (x) R_phi, with the pair term read off the matrix
  const rhoC = controlMarginal(fin);
  const cnot = cnot2();
  const zero2 = mat(2, 2);
  zero2.re[0] = 1;
  const pair = mMul(mMul(cnot, kron(rhoC, zero2)), mDagger(cnot));
  // read the |11><00| element: after CNOT it equals the steer coherence EXACTLY
  // (same block, not its conjugate), and under R (x) R it rotates at order 2
  const pairTerm = (m: CMat): { re: number; im: number } => ({ re: m.re[3 * 4 + 0]!, im: m.im[3 * 4 + 0]! });
  const rPhi = (phi: number): CMat => {
    const m = mat(2, 2);
    m.re[0] = 1;
    m.re[3] = Math.cos(phi);
    m.im[3] = Math.sin(phi);
    return m;
  };
  const rBoth = (phi: number): CMat => kron(rPhi(phi), rPhi(phi));

  let ok = true;
  const lines: string[] = [];
  for (const phi of [0.3, 0.7, 1.1]) {
    const R = mat(8, 8);
    for (let i = 0; i < 4; i++) R.re[i * 8 + i] = 1;
    for (let i = 4; i < 8; i++) {
      R.re[i * 8 + i] = Math.cos(phi);
      R.im[i * 8 + i] = Math.sin(phi);
    }
    const rotated = mMul(mMul(R, fin), mDagger(R));
    const s0 = steer(fin);
    const s1 = steer(rotated);
    const ph = Math.atan2(s1.im, s1.re) - Math.atan2(s0.im, s0.re);
    const mag = Math.hypot(s1.re, s1.im) / Math.hypot(s0.re, s0.im);
    if (Math.abs(ph - phi) > 1e-12 || Math.abs(mag - 1) > 1e-12) ok = false;
    lines.push(`steer phi=${phi}: phase ${ph.toFixed(12)} mag ${mag.toFixed(12)}`);
  }
  // clone: value equality (CNOT copies the coherence) + order 2 under R (x) R
  const c0 = pairTerm(pair);
  const s0 = steer(fin);
  const valueEq = Math.abs(c0.re - s0.re) < 1e-15 && Math.abs(c0.im - s0.im) < 1e-15;
  if (!valueEq) ok = false;
  for (const phi of [0.3, 0.7]) {
    const rotated = mMul(mMul(rBoth(phi), pair), mDagger(rBoth(phi)));
    const c1 = pairTerm(rotated);
    const ph = Math.atan2(c1.im, c1.re) - Math.atan2(c0.im, c0.re);
    const mag = Math.hypot(c1.re, c1.im) / Math.hypot(c0.re, c0.im);
    if (Math.abs(ph - 2 * phi) > 1e-12 || Math.abs(mag - 1) > 1e-12) ok = false;
  }
  lines.push("clone pair: value equality exact, order 2 exact");
  return { name: "W-D covariance order split", pass: ok, detail: lines.join("; ") };
}

function cnot2(): CMat {
  // on (c1, c2): |0><0| (x) I + |1><1| (x) X
  const p0 = mat(2, 2);
  p0.re[0] = 1;
  const p1 = mat(2, 2);
  p1.re[3] = 1;
  const x = mat(2, 2);
  x.re[1] = 1;
  x.re[2] = 1;
  return mAdd(kron(p0, identity(2)), kron(p1, x));
}

/** W-E: the membership charge conserved for every input under engineered programs. */
function witnessConservation(): WitnessResult {
  const piW = worldProjector();
  const prog = engineeredProgram(4, 909);
  const inputs: CMat[] = [worldState(), perpendicularState(), randomSuperposition(5)];
  let worst = 0;
  for (const rho of inputs) {
    const before = membershipExpectation(rho, piW, DATA_DIM);
    const out = runProgram(prog, rho);
    const after = membershipExpectation(out, piW, DATA_DIM);
    worst = Math.max(worst, Math.abs(before - after));
  }
  const rhoMix = randomSuperposition(6);
  const randProg: Program = [
    { theta: 0.5, u0: randomBranchUnitary(71), u1: randomBranchUnitary(72) },
    { theta: 0.9, u0: randomBranchUnitary(73), u1: randomBranchUnitary(74) },
  ];
  const b = membershipExpectation(rhoMix, piW, DATA_DIM);
  const a = membershipExpectation(runProgram(randProg, rhoMix), piW, DATA_DIM);
  const violated = Math.abs(a - b) > 1e-3;
  const ok = worst <= QUOTED_CONSERVATION_DEV && violated;
  return {
    name: "W-E membership charge",
    pass: ok,
    detail: `engineered conservation drift ${worst.toExponential(3)} over in-W, in-Wperp, random inputs; random program moves the charge by ${Math.abs(a - b).toFixed(6)} (violation real)`,
  };
}

function perpendicularState(): CMat {
  const m = mat(4, 4);
  m.re[1 * 4 + 1] = 1;
  return m;
}

function randomSuperposition(seed: number): CMat {
  const rng = makeRng(seed);
  const a = rng() * 2 - 1;
  const b = rng() * 2 - 1;
  const n = Math.sqrt(a * a + b * b);
  const v = mat(4, 1);
  v.re[0] = a / n;
  v.re[2] = b / n;
  return mMul(v, mDagger(v));
}

export function runWitnesses(): WitnessResult[] {
  return [witnessStability(), witnessDenotation(), witnessToll(), witnessCovariance(), witnessConservation()];
}

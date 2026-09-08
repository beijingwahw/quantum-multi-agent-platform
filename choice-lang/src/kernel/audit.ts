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
 *   P4. ids unique;
 *   P5. law citations (cites) must be ids of the machine-verified law
 *       registry — counterfeit composition identities and fake toll laws
 *       are named and rejected, the true law quoted in the detail.
 *
 * Witnesses:
 *   W-A stability split (engineered drift vs random decay);
 *   W-B the denotation compiles (pattern weights + conditional states);
 *   W-C the certification toll (weights exact, MC vs 1/P);
 *   W-D the covariance order split (steer order 1, clone order 2 — both read
 *       off real matrices, never composed from the expected answer);
 *   W-E the membership charge conserved for every input;
 *   W-F sequential composition laws (S1 product measure, S2 chained
 *       conditioning, S3 associating denotation products, T-MULT the
 *       multiplicative toll, Q-COMP the charge under composition);
 *   W-G nested composition laws (N1 context-freedom, N2 the pricing
 *       counterexample — exact identity AND exact gap);
 *   W-H the bounded loop (L-TELE telescoping charge ledger, L-TOLL the
 *       compounding loop toll);
 *   W-I the two-player census (G-TOLL strategy-proof toll, the attack and
 *       lock censuses as data).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, identity, kron, mat, mAdd, mDagger, mMul } from "../core/cmat.js";
import { makeRng, type Rng } from "../core/rng.js";
import { branchProduct, conditionOnPattern, membershipExpectation, runProgram, type ChooseStep, type Program } from "./lang.js";
import { concatProgram, registerPattern, node, leaf, termPaths, termIsometry, runTerm, conditionTermOnPath, type Term } from "./compose.js";
import { loopTrajectory, iteratedProgram } from "./iterate.js";
import { gameCensus, lockCensus, ADVERSARY_THETA, CENSUS_SIZE } from "./game.js";
import { DATA_DIM, engineeredUnitary, randomBranchUnitary, worldProjector, worldState } from "./fixtures.js";
import {
  MODEL,
  KNOWN_COUNTERFEITS,
  LAW_REGISTRY,
  QUOTED_ASSOC_DEV,
  QUOTED_COMPOSED_CHARGE_DEV,
  QUOTED_CONSERVATION_DEV,
  QUOTED_DENOTATION_DEV,
  QUOTED_GAME_ATTACK_MAX,
  QUOTED_GAME_ATTACK_MIN,
  QUOTED_GAME_CENSUS_TOL,
  QUOTED_GAME_LOCK_MIN,
  QUOTED_ISOMETRY_DEV,
  QUOTED_LOOP_FLOOR,
  QUOTED_NESTED_DEV,
  QUOTED_PRICE_GAP,
  QUOTED_RANDOM_MAX,
  QUOTED_RANDOM_MEAN,
  QUOTED_RANDOM_MIN,
  QUOTED_SEQ_DEV,
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

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G", "W-H", "W-I"];

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
    for (const id of r.cites ?? []) {
      if (!LAW_REGISTRY.includes(id)) {
        const named = KNOWN_COUNTERFEITS[id];
        violations.push({
          row: r.id,
          law: "P5",
          detail:
            `cites law "${id}" outside the machine-verified registry (${LAW_REGISTRY.join(" ")})` +
            (named === undefined ? " — an unregistered law is not a law of this language" : ` — ${named}`),
        });
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

/** Max cell deviation of two same-shape matrices. */
function matDev(a: CMat, b: CMat): number {
  let d = 0;
  for (let k = 0; k < a.re.length; k++) {
    d = Math.max(d, Math.abs(a.re[k]! - b.re[k]!), Math.abs(a.im[k]! - b.im[k]!));
  }
  return d;
}

/**
 * Monte-Carlo E[attempts] until a control pattern hits: each attempt draws
 * one control bit per step (Bernoulli sin^2(theta)) and succeeds when all
 * bits match the target. Targets are in STEP order; draws are independent,
 * so order does not matter to the law.
 */
function mcAttempts(
  thetas: readonly number[],
  target: ReadonlyArray<0 | 1>,
  seed: number,
  n: number,
): number {
  const rng: Rng = makeRng(seed);
  let attempts = 0;
  for (let i = 0; i < n; i++) {
    let tries = 0;
    for (;;) {
      let hit = true;
      for (let j = 0; j < thetas.length; j++) {
        if ((rng() < Math.sin(thetas[j]!) ** 2 ? 1 : 0) !== target[j]) {
          hit = false;
          break;
        }
      }
      tries++;
      if (hit || tries > 20000) break;
    }
    attempts += tries;
  }
  return attempts / n;
}

/** W-F: the sequential composition laws (S1, S2, S3, T-MULT, Q-COMP). */
function witnessSequential(): WitnessResult {
  const rho0 = worldState();
  const p: Program = [
    { theta: 0.6, u0: engineeredUnitary(7), u1: engineeredUnitary(8) },
    { theta: 1.0, u0: randomBranchUnitary(9), u1: randomBranchUnitary(10) },
  ];
  const q: Program = [
    { theta: 0.35, u0: engineeredUnitary(300), u1: randomBranchUnitary(301) },
    { theta: 0.8, u0: engineeredUnitary(302), u1: engineeredUnitary(303) },
  ];
  const pBits: ReadonlyArray<0 | 1> = [1, 0]; // step order; the register is newest-first
  const qBits: ReadonlyArray<0 | 1> = [0, 1];
  const composedPat: ReadonlyArray<0 | 1> = [...registerPattern(qBits), ...registerPattern(pBits)];

  // S1: the composed weight is the product measure, on two input states
  const partP = conditionOnPattern(runProgram(p, rho0), 2, registerPattern(pBits), DATA_DIM);
  const partQ = conditionOnPattern(runProgram(q, rho0), 2, registerPattern(qBits), DATA_DIM);
  const direct = conditionOnPattern(runProgram(concatProgram(p, q), rho0), 4, composedPat, DATA_DIM);
  const directPerp = conditionOnPattern(runProgram(concatProgram(p, q), perpendicularState()), 4, composedPat, DATA_DIM);
  const s1 = Math.max(Math.abs(direct.p - partP.p * partQ.p), Math.abs(directPerp.p - partP.p * partQ.p));

  // S2: conditioning chains — (condition P, then run-and-condition Q) is the composed conditioning
  const chained = conditionOnPattern(runProgram(q, partP.conditional), 2, registerPattern(qBits), DATA_DIM);
  const s2 = Math.max(Math.abs(chained.p - partQ.p), matDev(chained.conditional, direct.conditional));

  // S3: denotation products associate — den(Q)*den(P), a second parenthesization, and the flat product
  const uP = branchProduct(p, pBits);
  const uQ = branchProduct(q, qBits);
  const flat = branchProduct(concatProgram(p, q), [...pBits, ...qBits]);
  const s3 = Math.max(matDev(mMul(uQ, uP), flat), matDev(mMul(mMul(uQ, identity(DATA_DIM)), uP), flat));

  // T-MULT: the toll multiplies — exact weights, MC against 1/(PQ), and the product of the parts' own tolls
  const mcP = mcAttempts([0.6, 1.0], pBits, 8801, 200000);
  const mcQ = mcAttempts([0.35, 0.8], qBits, 8802, 200000);
  const mcC = mcAttempts([0.6, 1.0, 0.35, 0.8], [...pBits, ...qBits], 8803, 200000);
  const tollExact = Math.abs(direct.p - partP.p * partQ.p);
  const tollMc = Math.abs(mcC * direct.p - 1);
  const tollProduct = Math.abs((mcP * mcQ) / (1 / direct.p) - 1);

  // Q-COMP: the charge under sequential composition — engineered conserved for every input, random violated
  const ep: Program = [
    { theta: 0.5, u0: engineeredUnitary(77), u1: engineeredUnitary(78) },
    { theta: 0.9, u0: engineeredUnitary(79), u1: engineeredUnitary(80) },
  ];
  const eq: Program = [
    { theta: 0.3, u0: engineeredUnitary(87), u1: engineeredUnitary(88) },
    { theta: 0.7, u0: engineeredUnitary(89), u1: engineeredUnitary(90) },
  ];
  let chargeWorst = 0;
  for (const rho of [worldState(), perpendicularState(), randomSuperposition(5)]) {
    const before = membershipExpectation(rho, worldProjector(), DATA_DIM);
    const after = membershipExpectation(runProgram(concatProgram(ep, eq), rho), worldProjector(), DATA_DIM);
    chargeWorst = Math.max(chargeWorst, Math.abs(before - after));
  }
  // and under NESTED composition: a choose inside a choose, all branches engineered
  const nestedTree: Term = node(0.6, node(0.9, leaf(engineeredUnitary(411)), leaf(engineeredUnitary(412))), leaf(engineeredUnitary(413)));
  let nestedWorst = 0;
  for (const rho of [worldState(), perpendicularState(), randomSuperposition(9)]) {
    const before = membershipExpectation(rho, worldProjector(), DATA_DIM);
    const after = membershipExpectation(runTerm(nestedTree, rho), worldProjector(), DATA_DIM);
    nestedWorst = Math.max(nestedWorst, Math.abs(before - after));
  }
  const rr = concatProgram(
    [
      { theta: 0.5, u0: randomBranchUnitary(71), u1: randomBranchUnitary(72) },
      { theta: 0.9, u0: randomBranchUnitary(73), u1: randomBranchUnitary(74) },
    ],
    [{ theta: 0.4, u0: randomBranchUnitary(75), u1: randomBranchUnitary(76) }],
  );
  const rhoMix = randomSuperposition(6);
  const randomShift = Math.abs(
    membershipExpectation(runProgram(rr, rhoMix), worldProjector(), DATA_DIM) -
      membershipExpectation(rhoMix, worldProjector(), DATA_DIM),
  );

  const ok =
    s1 <= QUOTED_SEQ_DEV &&
    s2 <= QUOTED_SEQ_DEV &&
    s3 <= QUOTED_ASSOC_DEV &&
    tollExact <= QUOTED_SEQ_DEV &&
    tollMc <= QUOTED_TOLL_MC_TOL &&
    tollProduct <= QUOTED_TOLL_MC_TOL &&
    chargeWorst <= QUOTED_COMPOSED_CHARGE_DEV &&
    nestedWorst <= QUOTED_COMPOSED_CHARGE_DEV &&
    randomShift > 1e-3;
  return {
    name: "W-F sequential composition",
    pass: ok,
    detail: `S1 product measure ${s1.toExponential(2)}; S2 chained conditioning ${s2.toExponential(2)}; S3 associating products ${s3.toExponential(2)}; toll multiplies: exact ${tollExact.toExponential(2)}, E[attempts] ${mcC.toFixed(4)} vs ${partP.p.toFixed(6)}*${partQ.p.toFixed(6)} -> 1/(PQ) ${(1 / direct.p).toFixed(4)}, parts' tolls ${mcP.toFixed(4)}*${mcQ.toFixed(4)} = ${(mcP * mcQ).toFixed(4)}; composed charge drift ${chargeWorst.toExponential(2)} sequential, ${nestedWorst.toExponential(2)} nested; random composition moves it ${randomShift.toFixed(4)}`,
  };
}

/** W-G: the nested composition laws (N1 context-freedom, N2 the pricing counterexample). */
function witnessNested(): WitnessResult {
  const rho0 = worldState();
  const theta1 = 0.7;
  const theta2 = 1.1;
  // ONE object per leaf, shared by both nestings — N2's "same leaves" is an
  // identity claim about the same unitaries, not a value coincidence
  const A = engineeredUnitary(401);
  const B = engineeredUnitary(402);
  const C = engineeredUnitary(403);
  const left: Term = node(theta1, node(theta2, leaf(A), leaf(B)), leaf(C));
  const right: Term = node(theta1, leaf(A), node(theta2, leaf(B), leaf(C)));

  // the execution isometry is an isometry: V-dagger V = I for both nestings
  let isoDev = 0;
  for (const t of [left, right]) {
    const v = termIsometry(t, DATA_DIM);
    isoDev = Math.max(isoDev, matDev(mMul(mDagger(v), v), identity(DATA_DIM)));
  }

  // N1: every live path of both trees conditions to its leaf's action, weighted
  let n1 = 0;
  for (const t of [left, right]) {
    for (const path of termPaths(t)) {
      const { p, conditional } = conditionTermOnPath(t, rho0, path.bits);
      const denoted = mMul(mMul(path.leafUnitary, rho0), mDagger(path.leafUnitary));
      n1 = Math.max(n1, Math.abs(p - path.weight), matDev(conditional, denoted));
    }
  }

  // context-freedom: the embedded/standalone weight ratio is cos^2(theta1) on every path under the context
  const sub = node(theta2, leaf(engineeredUnitary(401)), leaf(engineeredUnitary(402)));
  const subA = conditionTermOnPath(sub, rho0, [0]);
  const leftA = conditionTermOnPath(left, rho0, [0, 0]);
  const leftB = conditionTermOnPath(left, rho0, [0, 1]);
  const ctx = Math.max(Math.abs(leftA.p / subA.p - Math.cos(theta1) ** 2), Math.abs(leftB.p / (1 - subA.p) - Math.cos(theta1) ** 2));

  // N2: same denotations on common leaves (N1 covers both trees), different prices
  const lp = termPaths(left);
  const rp = termPaths(right);
  const sameLeaves = lp.length === rp.length && lp.every((path, i) => path.leafUnitary === rp[i]!.leafUnitary);
  const gapA = Math.abs(lp[0]!.weight - rp[0]!.weight);
  const gapAClosed = Math.abs(gapA - Math.cos(theta1) ** 2 * Math.sin(theta2) ** 2);

  const ok = isoDev <= QUOTED_ISOMETRY_DEV && n1 <= QUOTED_NESTED_DEV && ctx <= 1e-15 && sameLeaves && gapAClosed <= 1e-15 && Math.abs(gapA - QUOTED_PRICE_GAP) <= 1e-9;
  return {
    name: "W-G nested composition",
    pass: ok,
    detail: `isometry deviation ${isoDev.toExponential(2)}; N1 all-paths deviation ${n1.toExponential(2)}; context factor cos^2(t1) exact to ${ctx.toExponential(2)}; N2 same leaves ${sameLeaves ? "yes" : "NO"}, pricing gap ${gapA.toFixed(12)} vs closed ${QUOTED_PRICE_GAP} (denotations compose, prices do not)`,
  };
}

/** W-H: the bounded loop (L-TELE telescoping ledger, L-TOLL compounding toll). */
function witnessLoop(): WitnessResult {
  const piW = worldProjector();
  const rho0 = worldState();
  const body: Program = [{ theta: 0.75, u0: engineeredUnitary(501), u1: engineeredUnitary(502) }];
  const k = 5;

  // L-TELE: the charge ledger across iterations
  const traj = loopTrajectory(body, rho0, k, piW);
  const maxDelta = Math.max(...traj.deltas.map(Math.abs));
  const total = Math.abs(traj.membership[k]! - traj.membership[0]!);

  // L-TOLL: certifying after k coherent iterations costs w^k
  const w = Math.sin(0.75) ** 2;
  const flat = iteratedProgram(body, k);
  const cond = conditionOnPattern(runProgram(flat, rho0), k, Array<0 | 1>(k).fill(1), DATA_DIM);
  const wkDev = Math.abs(cond.p - w ** k);
  const mc = mcAttempts(
    Array<number>(k).fill(0.75),
    Array<0 | 1>(k).fill(1),
    777,
    200000,
  );
  const mcDev = Math.abs(mc * w ** k - 1);

  // random bodies decay over iterations (data)
  let sum = 0;
  for (let t = 0; t < 12; t++) {
    const rbody: Program = [{ theta: 0.7, u0: randomBranchUnitary(9000 + t), u1: randomBranchUnitary(9500 + t) }];
    sum += loopTrajectory(rbody, rho0, 5, piW).membership[5]!;
  }
  const randomMean = sum / 12;

  const ok = maxDelta <= QUOTED_LOOP_FLOOR && total <= QUOTED_LOOP_FLOOR && traj.telescopeResidual <= 1e-15 && wkDev <= QUOTED_SEQ_DEV && mcDev <= QUOTED_TOLL_MC_TOL;
  return {
    name: "W-H bounded loop",
    pass: ok,
    detail: `charge ledger over ${k} iterations: max delta ${maxDelta.toExponential(2)}, total drift ${total.toExponential(2)}, telescoping residual ${traj.telescopeResidual.toExponential(2)} (the ledger does not accumulate rounding); loop toll w^k exact ${wkDev.toExponential(2)}, E[attempts] ${mc.toFixed(4)} vs 1/w^k ${(1 / w ** k).toFixed(4)}; random bodies mean ${randomMean.toFixed(4)} after 5 iterations`,
  };
}

/** W-I: the two-player census (G-TOLL strategy-proof toll; attack and lock as data). */
function witnessGame(): WitnessResult {
  const piW = worldProjector();
  const rho0 = worldState();
  const first: Program = [{ theta: 0.8, u0: engineeredUnitary(210), u1: engineeredUnitary(211) }];
  const firstBits: ReadonlyArray<0 | 1> = [1];
  const advBit: 0 | 1 = 1;

  // attack census: the engineered move first, every adversary strategy last
  const attack = gameCensus(first, firstBits, advBit, rho0, piW);
  const fins = attack.map((c) => c.final);
  const attackMin = Math.min(...fins);
  const attackMax = Math.max(...fins);

  // G-TOLL: the composed pattern weight is w1*w2 in every census cell
  const wTarget = Math.sin(0.8) ** 2 * Math.sin(ADVERSARY_THETA) ** 2;
  const tollDev = Math.max(...attack.map((c) => Math.abs(c.patternWeight - wTarget)));
  const mc = mcAttempts([0.8, ADVERSARY_THETA], [1, advBit], 31337, 200000);
  const mcDev = Math.abs(mc * wTarget - 1);

  // lock census: the adversary first, the engineered answer locks the charge wherever it is
  const locks = lockCensus(first, rho0, piW);
  let lockWorst = 0;
  for (const r of locks) lockWorst = Math.max(lockWorst, Math.abs(r.final - r.afterAdversary));
  const lockMin = Math.min(...locks.map((r) => r.final));

  const ok =
    tollDev <= QUOTED_SEQ_DEV &&
    mcDev <= QUOTED_TOLL_MC_TOL &&
    lockWorst <= QUOTED_SEQ_DEV &&
    Math.abs(attackMin - QUOTED_GAME_ATTACK_MIN) <= QUOTED_GAME_CENSUS_TOL &&
    Math.abs(attackMax - QUOTED_GAME_ATTACK_MAX) <= QUOTED_GAME_CENSUS_TOL &&
    Math.abs(lockMin - QUOTED_GAME_LOCK_MIN) <= QUOTED_GAME_CENSUS_TOL &&
    attack.length === CENSUS_SIZE;
  return {
    name: "W-I two-player census",
    pass: ok,
    detail: `${CENSUS_SIZE}-strategy census: toll branch-blind to ${tollDev.toExponential(2)} in every cell (E[attempts] ${mc.toFixed(4)} vs 1/(w1*w2) ${(1 / wTarget).toFixed(4)}); attack (adversary last): charge ${attackMin.toFixed(4)}..${attackMax.toFixed(4)} over the census; lock (adversary first): final = after-adversary to ${lockWorst.toExponential(2)}, min ${lockMin.toFixed(4)} — the attack surface is the charge, never the toll`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessStability(),
    witnessDenotation(),
    witnessToll(),
    witnessCovariance(),
    witnessConservation(),
    witnessSequential(),
    witnessNested(),
    witnessLoop(),
    witnessGame(),
  ];
}

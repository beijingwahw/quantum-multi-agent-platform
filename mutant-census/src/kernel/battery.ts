/**
 * THE PROPERTY BATTERY — ten properties, each holding for EVERY seeded input
 * the generator can draw (a property is not an example: >= 60 inputs per row,
 * worst deviation booked, Q3). The battery is pointed at the canonical family
 * (census) and at each mutant (kill): a mutant dies when a named property
 * fails against it — by crash, by exact arithmetic, or statistically (DATA
 * grade, the 5-sigma criterion). Every property names its TRIPPER (Q4): the
 * mutant that kills it, or a synthetic violator the negative controls fire —
 * a "pass" that nothing can ever move is a constructed zero.
 */
import {
  basisVec,
  eigenvaluesHermitian,
  identity,
  isHermitian,
  kron,
  mat,
  matEq,
  mDagger,
  mMul,
  mScale,
  vec,
  vKron,
} from "../core/cmat.js";
import { applyUnitary, filterBasisDigit, partialTrace } from "../core/channels.js";
import { makeRng } from "../core/rng.js";
import { maximallyMixed, PLUS, randomStateVec, vecToRho } from "../core/states.js";
import { traceDistance, traceReal } from "../core/measures.js";
import {
  GAMMA,
  membershipCharge,
  randomCptpKraus,
  randomUnitary,
  sectorCoherentState,
  twoRateInWorld,
} from "./law.js";
import { canonicalFamily, mutantFamily, MUTANTS, type Family, type MutantSpec } from "./family.js";

export type Grade = "EXACT" | "DATA";

export interface PropResult {
  readonly id: string;
  readonly name: string;
  readonly grade: Grade;
  readonly inputs: number;
  readonly worst: number;
  readonly pass: boolean;
  readonly detail: string;
  readonly tripper: string;
}

export interface KillRow {
  readonly id: string;
  readonly killer: string;
  readonly actual: "EXACT-KILL" | "CRASH-KILL" | "DATA-KILL" | "SURVIVED";
  readonly margin: number;
  readonly detail: string;
}

const charge = membershipCharge;

/** P1 — the shape guard: mismatched products must THROW, matched must not. */
function p1(f: Family): PropResult {
  const rng = makeRng(101);
  let threw = 0;
  const mismatches = 120;
  for (let t = 0; t < mismatches; t++) {
    const k = 2 + rng.int(3);
    const m = 2 + rng.int(3);
    const n = 2 + rng.int(3);
    const a = mat(k, m + 1); // a.cols = m+1 against b.rows = m — always mismatched
    const b = mat(m, n);
    try {
      f.mMul(a, b);
    } catch {
      threw++;
    }
  }
  let shapeOk = 0;
  const matches = 60;
  for (let t = 0; t < matches; t++) {
    const k = 2 + rng.int(3);
    const m = 2 + rng.int(3);
    const n = 2 + rng.int(3);
    const a = mat(k, m);
    const b = mat(m, n);
    const out = f.mMul(a, b);
    if (out.rows === k && out.cols === n) shapeOk++;
  }
  const pass = threw === mismatches && shapeOk === matches;
  return {
    id: "P1",
    name: "shape guard: mismatched mMul throws, matched shapes produce the declared shape",
    grade: "EXACT",
    inputs: mismatches + matches,
    worst: threw === mismatches ? 0 : 1,
    pass,
    detail: `${threw}/${mismatches} mismatched products threw; ${shapeOk}/${matches} matched products returned the declared shape`,
    tripper: "NC-P1 (a shape-blind mMul returns garbage without a word)",
  };
}

/** P2 — statehood: vecToRho Hermitian/trace-1/PSD, vInner dual-path identity,
 * embedWorld lands on the declared register. Kills MU1, MU2, MU3. */
function p2(f: Family): PropResult {
  const rng = makeRng(202);
  let worstHermitian = 0;
  let worstTrace = 0;
  let worstPsD = 0;
  let worstInner = 0;
  let worstEmbed = 0;
  let worstPhase = 0;
  const inputs = 160;
  for (let t = 0; t < inputs; t++) {
    const d = t % 2 === 0 ? 2 : 4;
    const psi = randomStateVec(rng, d);
    const rho = f.vecToRho(psi);
    if (!isHermitian(rho, 0)) {
      // measure the violation instead of the boolean
      let dv = 0;
      for (let i = 0; i < d; i++)
        for (let j = 0; j < d; j++) {
          dv = Math.max(
            dv,
            Math.abs(rho.re[i * d + j]! - rho.re[j * d + i]!),
            Math.abs(rho.im[i * d + j]! + rho.im[j * d + i]!),
          );
        }
      worstHermitian = Math.max(worstHermitian, dv);
    }
    worstTrace = Math.max(worstTrace, Math.abs(traceReal(rho) - 1));
    const eig = eigenvaluesHermitian(rho);
    for (const l of eig) worstPsD = Math.min(worstPsD, -l); // positive when PSD is violated
    // vInner against an independent elementwise second path (batch 10/28/29's class)
    const phi = randomStateVec(rng, d);
    const got = f.vInner(psi, phi);
    let re = 0;
    let im = 0;
    for (let i = 0; i < d; i++) {
      re += psi.re[i]! * phi.re[i]! + psi.im[i]! * phi.im[i]!;
      im += psi.re[i]! * phi.im[i]! - psi.im[i]! * phi.re[i]!;
    }
    worstInner = Math.max(worstInner, Math.abs(got.re - re), Math.abs(got.im - im));
    // the cargo embedding lands on the world(x)data register, 4x4
    const cargo = f.vecToRho(randomStateVec(rng, 2));
    const e = f.embedWorld(cargo);
    const dimDev = e.rows === 4 && e.cols === 4 ? 0 : Math.abs(e.rows - 4);
    worstEmbed = Math.max(worstEmbed, dimDev, e.rows === 4 ? Math.abs(traceReal(e) - 1) : 0);
    // PHASE-SENSITIVE coherence (the batch-20 class): rho* passes Hermiticity,
    // trace and PSD — only the sector block's PHASE sees it. ((|0>+e^{i phi}|1>)/sqrt2)(x)c
    const ang = rng() * 2 * Math.PI;
    const w = vec(2);
    w.re[0] = 1 / Math.SQRT2;
    w.re[1] = Math.cos(ang) / Math.SQRT2;
    w.im[1] = Math.sin(ang) / Math.SQRT2;
    const coh = f.vecToRho(vKron(w, randomStateVec(rng, 2)));
    let sRe = 0;
    let sIm = 0;
    for (let b = 0; b < 2; b++) {
      sRe += coh.re[(2 + b) * 4 + b]!;
      sIm += coh.im[(2 + b) * 4 + b]!;
    }
    worstPhase = Math.max(worstPhase, Math.abs(sRe - Math.cos(ang) / 2), Math.abs(sIm - Math.sin(ang) / 2));
  }
  const pass =
    worstHermitian <= 1e-14 &&
    worstTrace <= 1e-14 &&
    worstPsD <= 1e-12 &&
    worstInner <= 1e-15 &&
    worstEmbed <= 1e-14 &&
    worstPhase <= 1e-15;
  return {
    id: "P2",
    name: "statehood AND phase: rho Hermitian, trace 1, PSD; vInner matches the elementwise second path; the embedding lands on the declared register; the sector coherence carries its phase (e^{i phi}/2 exactly — conjugation survives statehood, not the phase)",
    grade: "EXACT",
    inputs,
    worst: Math.max(worstHermitian, worstTrace, worstPsD, worstInner, worstEmbed, worstPhase),
    pass,
    detail: `Hermitian deviation ${worstHermitian.toExponential(2)}; trace ${worstTrace.toExponential(2)}; worst negative eigenvalue ${worstPsD.toExponential(2)}; dual-path vInner ${worstInner.toExponential(2)}; embedding ${worstEmbed.toExponential(2)}; sector phase ${worstPhase.toExponential(2)}`,
    tripper: "MU1 (conjugated vInner), MU2 (conjugated vecToRho — invisible to statehood, killed by the phase), MU3 (8x8 embedding)",
  };
}

/** P3 — algebra: outer(a,b)-dagger = outer(b,a); random unitaries unitary;
 * unitary action preserves statehood. Family baseline. */
function p3(f: Family): PropResult {
  const rng = makeRng(303);
  let worstOuter = 0;
  let worstUnitary = 0;
  let worstAction = 0;
  const inputs = 120;
  for (let t = 0; t < inputs; t++) {
    const a = randomStateVec(rng, 3);
    const b = randomStateVec(rng, 3);
    if (!matEq(mDagger(f.outer(a, b)), f.outer(b, a), 0)) {
      const oa = f.outer(a, b);
      const ob = f.outer(b, a);
      const dag = mDagger(oa);
      let dv = 0;
      for (let k = 0; k < oa.re.length; k++) {
        dv = Math.max(dv, Math.abs(dag.re[k]! - ob.re[k]!), Math.abs(dag.im[k]! - ob.im[k]!));
      }
      worstOuter = Math.max(worstOuter, dv);
    }
    if (t % 2 === 0) {
      const u = randomUnitary(rng, 3);
      const prod = mMul(mDagger(u), u);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const want = i === j ? 1 : 0;
          worstUnitary = Math.max(worstUnitary, Math.abs(prod.re[i * 3 + j]! - want), Math.abs(prod.im[i * 3 + j]!));
        }
      const rho = vecToRho(randomStateVec(rng, 3));
      const out = applyUnitary(rho, u);
      let asym = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          asym = Math.max(
            asym,
            Math.abs(out.re[i * 3 + j]! - out.re[j * 3 + i]!),
            Math.abs(out.im[i * 3 + j]! + out.im[j * 3 + i]!),
          );
        }
      }
      worstAction = Math.max(worstAction, Math.abs(traceReal(out) - 1), asym);
    }
  }
  const pass = worstOuter <= 1e-14 && worstUnitary <= 1e-13 && worstAction <= 1e-13;
  return {
    id: "P3",
    name: "algebra: outer(a,b)|dagger = outer(b,a) elementwise; random unitaries unitary to the rounding floor; unitary action preserves statehood",
    grade: "EXACT",
    inputs,
    worst: Math.max(worstOuter, worstUnitary, worstAction),
    pass,
    detail: `outer identity ${worstOuter.toExponential(2)}; U|dagger U = I ${worstUnitary.toExponential(2)}; action statehood ${worstAction.toExponential(2)}`,
    tripper: "NC-P3 (an outer that conjugates the wrong side breaks the identity)",
  };
}

/** P4 — CPTP: random Stinespring maps preserve trace, Hermiticity, positivity. */
function p4(f: Family): PropResult {
  const rng = makeRng(404);
  let worstTrace = 0;
  let worstPsD = 0;
  let hermitianOk = true;
  const inputs = 60;
  for (let t = 0; t < inputs; t++) {
    const kraus = randomCptpKraus(rng, 4, 2);
    const rho = vecToRho(randomStateVec(rng, 4));
    const out = f.applyKraus(rho, kraus);
    worstTrace = Math.max(worstTrace, Math.abs(traceReal(out) - 1));
    if (!isHermitian(out, 1e-14)) hermitianOk = false;
    for (const l of eigenvaluesHermitian(out)) worstPsD = Math.min(worstPsD, -l);
  }
  const pass = worstTrace <= 1e-14 && worstPsD <= 1e-12 && hermitianOk;
  return {
    id: "P4",
    name: "CPTP: random Stinespring Kraus sets preserve trace, Hermiticity and positivity on every input",
    grade: "EXACT",
    inputs,
    worst: Math.max(worstTrace, worstPsD),
    pass,
    detail: `trace drift ${worstTrace.toExponential(2)}; worst negative eigenvalue ${worstPsD.toExponential(2)}; Hermitian ${hermitianOk ? "everywhere" : "BROKEN"}`,
    tripper: "NC-P4 (Kraus scaled by 1.1 — trace 1.1, not a channel)",
  };
}

/** P5 — measurement and conditioning: world-qubit readout sums to 1 and
 * matches the independent block masses; the conditional is normalized by the
 * BLOCK TRACE and equals the family's filter. Kills MU4 (crash), MU5. */
function p5(f: Family): PropResult {
  const rng = makeRng(505);
  let worstSum = 0;
  let worstDual = 0;
  let worstCond = 0;
  const inputs = 140;
  for (let t = 0; t < inputs; t++) {
    const rho = vecToRho(randomStateVec(rng, 4));
    const [p0, p1] = f.measureWorldQubit(rho);
    worstSum = Math.max(worstSum, Math.abs(p0 + p1 - 1));
    let block1 = 0;
    for (let a = 0; a < 2; a++) block1 += rho.re[(2 + a) * 4 + (2 + a)]!;
    worstDual = Math.max(worstDual, Math.abs(p1 - block1));
    for (const digit of [0, 1]) {
      const block = digit === 1 ? block1 : 1 - block1;
      if (block < 1e-9) continue;
      const cond = f.conditionalOn(rho, digit);
      worstCond = Math.max(worstCond, Math.abs(traceReal(cond) - 1));
      const want = filterBasisDigit(rho, [2, 2], 0, digit).conditional;
      if (!matEq(cond, want, 0)) {
        let dv = 0;
        for (let k = 0; k < 16; k++) dv = Math.max(dv, Math.abs(cond.re[k]! - want.re[k]!), Math.abs(cond.im[k]! - want.im[k]!));
        worstCond = Math.max(worstCond, dv);
      }
    }
  }
  const pass = worstSum <= 1e-12 && worstDual <= 1e-14 && worstCond <= 1e-12;
  return {
    id: "P5",
    name: "measurement: world-qubit Born probabilities sum to 1 and match the block masses; the conditional state is trace-1 and equals the block-trace filter",
    grade: "EXACT",
    inputs,
    worst: Math.max(worstSum, worstDual, worstCond),
    pass,
    detail: `probability sum ${worstSum.toExponential(2)}; dual-path block mass ${worstDual.toExponential(2)}; conditional normalization ${worstCond.toExponential(2)}`,
    tripper: "MU4 (bare projector without (x)I — crashes on the shape guard), MU5 (joint-element denominator)",
  };
}

/** P6 — absorption: the charge is monotone under the law for EVERY input,
 * in-world states are fixed, leakage follows (1-gamma)^k (1-p0). Kills MU6. */
function p6(f: Family): PropResult {
  const rng = makeRng(606);
  let worstDrop = 0;
  let worstQuiet = 0;
  let worstLeak = 0;
  const inputs = 200;
  for (let t = 0; t < inputs; t++) {
    const rho =
      t % 3 === 0
        ? sectorCoherentState(rng, randomStateVec(rng, 2))
        : vecToRho(randomStateVec(rng, 4));
    const p = charge(rho);
    const p1 = charge(f.applyLaw(rho));
    worstDrop = Math.min(worstDrop, p1 - p);
    const leak0 = 1 - p;
    for (const k of [1, 3, 7]) {
      let cur2 = rho; // independent per-k evolution — NOT cumulative (a real bug this battery later booked)
      for (let s = 0; s < k; s++) cur2 = f.applyLaw(cur2);
      worstLeak = Math.max(worstLeak, Math.abs(1 - charge(cur2) - Math.pow(1 - GAMMA, k) * leak0));
    }
    if (t % 5 === 0) {
      const p1proj = mat(2, 2);
      p1proj.re[3] = 1;
      const inWorld = kron(p1proj, vecToRho(randomStateVec(rng, 2)));
      const out = f.applyLaw(inWorld);
      for (let k = 0; k < 16; k++) {
        worstQuiet = Math.max(worstQuiet, Math.abs(out.re[k]! - inWorld.re[k]!), Math.abs(out.im[k]! - inWorld.im[k]!));
      }
    }
  }
  const pass = worstDrop >= -1.5e-15 && worstQuiet <= 1.5e-15 && worstLeak <= 1e-14;
  return {
    id: "P6",
    name: "absorption: the membership charge never drops under the law, in-world states are fixed points, leakage is (1-gamma)^k (1-p0) exactly",
    grade: "EXACT",
    inputs,
    worst: Math.max(-worstDrop, worstQuiet, worstLeak),
    pass,
    detail: `worst charge drop ${worstDrop.toExponential(2)} (monotone at the floor); quiet-on-world ${worstQuiet.toExponential(2)}; leakage identity ${worstLeak.toExponential(2)}`,
    tripper: "MU6 (transposed Kraus index — the law damps OUT of the world)",
  };
}

/** P7 — the asymptote: k=200 of the law equals the into-world collapse of the
 * INITIAL state. Kills MU7 (the dephased-twin limit object). */
function p7(f: Family): PropResult {
  const rng = makeRng(707);
  let worst = 0;
  const inputs = 60;
  for (let t = 0; t < inputs; t++) {
    const rho =
      t % 3 === 0
        ? sectorCoherentState(rng, randomStateVec(rng, 2))
        : vecToRho(randomStateVec(rng, 4));
    let cur = rho;
    for (let k = 0; k < 200; k++) cur = f.applyLaw(cur);
    worst = Math.max(worst, traceDistance(cur, f.limitObject(rho)));
  }
  const pass = worst <= 1e-12;
  return {
    id: "P7",
    name: "asymptote: 200 steps of the law land on the into-world collapse of the initial state (blocks summed into the world, cargo riding) — not the dephased twin",
    grade: "EXACT",
    inputs,
    worst,
    pass,
    detail: `worst trace distance to the declared limit ${worst.toExponential(2)}`,
    tripper: "MU7 (the limit object written as the dephased twin — blocks staying in place)",
  };
}

/** P8 — same-event statistics: the MC censuses 'outside AT step K', the same
 * event the closed form prices, within 5 sigma. Kills MU8 (DATA-grade). */
function p8(f: Family): PropResult {
  const trials = 150000;
  const K = 40;
  const r = 0.01;
  const est = f.mcOutsideAtK(makeRng(808), trials, K, r);
  const exact = 1 - twoRateInWorld(K, r);
  const sigma = Math.sqrt((exact * (1 - exact)) / trials);
  const sigmaDist = Math.abs(est - exact) / sigma;
  const pass = sigmaDist <= 5;
  return {
    id: "P8",
    name: "same-event MC: the simulated frequency of 'outside the world AT step K' matches the two-rate closed form within 5 sigma",
    grade: "DATA",
    inputs: trials,
    worst: sigmaDist,
    pass,
    detail: `MC ${est.toFixed(6)} vs closed form ${exact.toFixed(6)} at ${sigmaDist.toFixed(2)} sigma`,
    tripper: "MU8 (the MC counts 'EVER left by K' — a different event, an order of magnitude apart)",
  };
}

/** P9 — postselected denominator: the conditional frequency divides by the
 * ACCEPTED count and lands on the exact conditional probability. Kills MU9. */
function p9(f: Family): PropResult {
  const trials = 20000;
  const { est, exact } = f.postselectedFreq(makeRng(909), trials);
  const accepted = 0.3 * trials;
  const sigma = Math.sqrt((exact * (1 - exact)) / accepted);
  const sigmaDist = Math.abs(est - exact) / sigma;
  const pass = sigmaDist <= 5;
  return {
    id: "P9",
    name: "postselected frequency: successes divided by ACCEPTED samples land on the exact conditional probability within 5 sigma",
    grade: "DATA",
    inputs: trials,
    worst: sigmaDist,
    pass,
    detail: `estimate ${est.toFixed(6)} vs exact ${exact.toFixed(6)} at ${sigmaDist.toFixed(2)} sigma`,
    tripper: "MU9 (the total-count denominator — 0.18 against 0.6)",
  };
}

/** P10 — no-signaling measured on SETTINGS (batch 20/21/24's wrong-object
 * lesson), with the CNOT negative control proving the checker can move. */
function p10(_f: Family): PropResult {
  // the no-signaling object is built on the core directly — no family member is on trial here
  const rng = makeRng(1010);
  let worst = 0;
  const states = 20;
  const settings = 40;
  // |Phi+> = (|00> + |11>)/sqrt2
  const phiPlus = vec(4);
  phiPlus.re[0] = 1 / Math.SQRT2;
  phiPlus.re[3] = 1 / Math.SQRT2;
  const base = vecToRho(phiPlus);
  for (let s = 0; s < states; s++) {
    // LOCAL unitaries preserve maximal entanglement — a generic global U(4) does not
    const u = kron(randomUnitary(rng, 2), randomUnitary(rng, 2));
    const rho = applyUnitary(base, u);
    for (let a = 0; a < settings; a++) {
      const v = randomUnitary(rng, 2);
      const acted = applyUnitary(rho, kron(v, identity(2)));
      const marginal = partialTrace(acted, [2, 2], [0]);
      const want = maximallyMixed(2);
      for (let k = 0; k < 4; k++) worst = Math.max(worst, Math.abs(marginal.re[k]! - want.re[k]!));
    }
  }
  // negative control: a NONLOCAL gate (CNOT, control A target B) moves B's marginal
  const cnot = mat(4, 4);
  cnot.re[0 * 4 + 0] = 1;
  cnot.re[1 * 4 + 1] = 1;
  cnot.re[2 * 4 + 3] = 1;
  cnot.re[3 * 4 + 2] = 1;
  const plus0 = vKron(PLUS, basisVec(2, 0));
  const before = partialTrace(vecToRho(plus0), [2, 2], [0]);
  const after = partialTrace(applyUnitary(vecToRho(plus0), cnot), [2, 2], [0]);
  const moved = traceDistance(before, after);
  const controlFires = moved > 0.4; // the CNOT moves B's marginal by EXACTLY 1/2 (|0> -> I/2)
  const pass = worst <= 1e-14 && controlFires;
  return {
    id: "P10",
    name: "no-signaling on SETTINGS: B's marginal is invariant under every A-side unitary on every maximally entangled state — and the CNOT control proves the checker can move",
    grade: "EXACT",
    inputs: states * settings,
    worst,
    pass,
    detail: `marginal deviation ${worst.toExponential(2)} over ${states}x${settings}; CNOT negative control moves B's marginal by ${moved.toFixed(3)} (the zero is measured, not constructed)`,
    tripper: "NC-P10 (the CNOT copier — a nonlocal gate the checker must catch)",
  };
}

const PROPERTIES: Record<string, (f: Family) => PropResult> = {
  P1: p1,
  P2: p2,
  P3: p3,
  P4: p4,
  P5: p5,
  P6: p6,
  P7: p7,
  P8: p8,
  P9: p9,
  P10: p10,
};

export const PROPERTY_IDS: readonly string[] = Object.keys(PROPERTIES);

export function runProperty(id: string, f: Family = canonicalFamily()): PropResult {
  const prop = PROPERTIES[id];
  if (!prop) throw new Error(`unknown property ${id}`);
  return prop(f);
}

export function runBattery(f: Family = canonicalFamily()): PropResult[] {
  // v0.13.0: per-property crash containment — a construction that crashes a
  // property (the shape-guard refusals, the crash-mutant class) records that
  // property as FAILING at infinite worst instead of taking the whole battery
  // down; the J-board's bit-exact prints can then compare crash-shaped
  // constructions against their crash-shaped prototypes (b24#0 IS MU4).
  return PROPERTY_IDS.map((id) => {
    try {
      return runProperty(id, f);
    } catch (err) {
      // the property is a closure over its own metadata; a crashed run
      // completed ZERO inputs and failed deterministically — the crash is
      // its own tripper
      return {
        id,
        name: `${id} (crashed before completing)`,
        grade: "EXACT",
        inputs: 0,
        worst: Number.POSITIVE_INFINITY,
        pass: false,
        detail: `crashed: ${(err as Error).message}`,
        tripper: "the crash itself — the composition refused",
      } satisfies PropResult;
    }
  });
}

/** The kill census: every mutant against its declared killer. */
export function runKillCensus(specs: readonly MutantSpec[] = MUTANTS): KillRow[] {
  const rows: KillRow[] = [];
  for (const spec of specs) {
    const fam = mutantFamily(spec);
    try {
      const r = runProperty(spec.killer, fam);
      rows.push(
        r.pass
          ? { id: spec.id, killer: spec.killer, actual: "SURVIVED", margin: r.worst, detail: `${spec.killer} PASSED against the mutant — blind spot, booked` }
          : {
              id: spec.id,
              killer: spec.killer,
              actual: r.grade === "DATA" ? "DATA-KILL" : "EXACT-KILL",
              margin: r.worst,
              detail: `${spec.killer} failed: ${r.detail}`,
            },
      );
    } catch (e) {
      rows.push({
        id: spec.id,
        killer: spec.killer,
        actual: "CRASH-KILL",
        margin: Number.POSITIVE_INFINITY,
        detail: `${spec.killer} crashed: ${(e as Error).message}`,
      });
    }
  }
  return rows;
}

export interface ControlResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** The synthetic negative controls: each proves a property can FAIL — a
 * property nothing can move is a constructed zero. */
export function runNegativeControls(): ControlResult[] {
  const out: ControlResult[] = [];
  // NC-P1: a shape-blind product — garbage without a word
  const blind: Family = {
    ...canonicalFamily(),
    mMul: (a, b) => {
      const m = mat(a.rows, b.cols);
      for (let k = 0; k < Math.min(a.re.length, m.re.length); k++) {
        m.re[k] = a.re[k]! + b.re[k % b.re.length]!;
      }
      return m;
    },
  };
  out.push({
    name: "NC-P1 shape-blind product",
    pass: !p1(blind).pass,
    detail: `P1 against the shape-blind product: ${p1(blind).detail} — the guard property fires`,
  });
  // NC-P3: a LOPSIDED outer (element (0,1) doubled). NOTE: the mirror-symmetric
  // corruption (daggering outer) does NOT fire this mirror-symmetric identity —
  // that blindness is real and recorded; conjugation is killed by P2's PHASE
  // check, exactly as history taught. The control here proves the identity
  // check is not vacuous, no more.
  const lopsided: Family = {
    ...canonicalFamily(),
    outer: (a, b) => {
      const o = canonicalFamily().outer(a, b);
      o.re[0 * b.n + 1] = o.re[0 * b.n + 1]! * 2;
      return o;
    },
  };
  out.push({
    name: "NC-P3 lopsided outer (element (0,1) doubled)",
    pass: !p3(lopsided).pass,
    detail: `P3 against the lopsided outer: ${p3(lopsided).detail} — the algebra identity fires; mirror-symmetric corruptions are invisible to it and are killed by P2's phase instead`,
  });
  // NC-P4: Kraus scaled by 1.1 — not a channel
  const rngNc = makeRng(4040);
  const kraus = randomCptpKraus(rngNc, 4, 2).map((k) => mScale(k, 1.1));
  const scaled: Family = {
    ...canonicalFamily(),
    applyKraus: (rho) => canonicalFamily().applyKraus(rho, kraus),
  };
  out.push({
    name: "NC-P4 non-CPTP Kraus (x1.1)",
    pass: !p4(scaled).pass,
    detail: `P4 against the scaled Kraus set: ${p4(scaled).detail} — trace preservation fires`,
  });
  return out;
}

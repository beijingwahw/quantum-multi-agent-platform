/**
 * The checker — the exchange laws, and the witnesses that re-derive every
 * EXACT number from physics (never from the ledger's own text).
 *
 * Laws enforced:
 *   C1. an exchange books BOTH columns — a trade with only a GET or only a
 *       PAY fails the build (knowledge never travels without its price);
 *   C2. the exactness tag is EXACT or DATA, and every row cites a witness
 *       that exists — an EXACT claim without a re-derivation is hearsay;
 *   C3. every anchor repo exists on disk — the physics stays anchored to the
 *       repos that verified it;
 *   C5. the id is one of E1..E6 and unique (numbering discipline — v0.2.0
 *       also enforces the range at runtime, not just the uniqueness).
 *
 * Witnesses (independent re-derivations):
 *   W-A collapse identity — dephased switch = classical mixture, second path
 *       built from the fixed-order channels themselves;
 *   W-B ESC18 re-derivation — T_full, chi_joint coherent vs readout, and the
 *       order-bit blindness, from the constructed channels;
 *   W-C complementarity face — control information before/after z-readout;
 *   W-D the weak-readout interior theorem — closed form vs simulation at
 *       every grid point (data), then exact monotonicity+convexity
 *       certificates on both ln-series paths (v0.2.0);
 *   W-E the k=3 face — six-order mixture identity, the triple's chi, and the
 *       k=3 weak-readout closed form with its own certificates (v0.2.0);
 *   W-F the exchange-rate frontier — both censuses' Pareto certificates and
 *       the replacer closed form vs simulation (v0.2.0).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, mAdd, mDagger, mMul, mScale, mat } from "../core/cmat.js";
import { partialTrace } from "../core/channels.js";
import { refuse } from "../core/errors.js";
import { PLUS, vecToRho, uniformVec, uniformOrthVec } from "../core/states.js";
import { holevo, traceDistance } from "../core/measures.js";
import { makeRng } from "../core/rng.js";
import { krausToStinespring, makeSwitchedChannel, type Stinespring } from "../switch/isometry.js";
import { completelyDepolarizingKraus, replacerKraus, randomChannelStinespring } from "../switch/chanlib.js";
import { classicalMixture, dephase, kronRho, partialDephase, readoutSlices } from "./collapse.js";
import { switch3, uniformControl6, type Switch3 } from "./kswitch3.js";
import { fr, fToNumber, iMid, type Ivl } from "./rational.js";
import {
  esc18Certificate,
  esc18Chi,
  familyOk,
  frontierCertificate,
  GRID_N,
  gridPoints,
  k3Certificate,
  k3Chi,
  replacerCertificate,
  replacerChi,
} from "./theorem.js";
import {
  EXCHANGE,
  QUOTED_CURVE,
  QUOTED_ESC18_CHI,
  QUOTED_FIRST_BIT_COST,
  QUOTED_K3_CHI,
  QUOTED_REPLACER_CHI_CONTROL_CLOSED,
  QUOTED_REPLACER_FIRST_BIT_COST,
  type ExchangeRow,
} from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F"];
/** The witness roster — exported so the no-dead-witness trial reads the truth,
 * not a test-local copy of it. */
export const WITNESS_ROSTER: readonly string[] = WITNESS_IDS;
const EXCHANGE_IDS: readonly string[] = ["E1", "E2", "E3", "E4", "E5", "E6"];

/**
 * An ExchangeRow as it crosses the untrusted boundary into the checker: the
 * compile-time `Exactness` union proves nothing at runtime (rows can arrive
 * parsed or mutated), so the tag is an unvalidated string until C2 has run.
 * `ExchangeRow` remains assignable (Exactness ⊂ string).
 */
export type UntrustedExchangeRow = Omit<ExchangeRow, "exactness"> & { readonly exactness: string };

export function checkExchange(rows: readonly UntrustedExchangeRow[] = EXCHANGE): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "C5", detail: "duplicate exchange id" });
    if (!EXCHANGE_IDS.includes(r.id)) {
      violations.push({ row: r.id, law: "C5", detail: `id "${r.id}" outside the E1..E6 numbering discipline` });
    }
    seen.add(r.id);
    if (r.get.trim().length === 0 || r.pay.trim().length === 0) {
      violations.push({ row: r.id, law: "C1", detail: "a trade must book both columns (get | pay)" });
    }
    if (r.exactness !== "EXACT" && r.exactness !== "DATA") {
      violations.push({ row: r.id, law: "C2", detail: `illegal exactness tag "${r.exactness}"` });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "C2", detail: `cites unknown witness "${r.witness}" — EXACT without re-derivation is hearsay` });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "C3", detail: `anchor repo missing on disk: ${a}` });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function basisRho(i: number): CMat {
  const m = mat(2, 2);
  m.re[i * 2 + i] = 1;
  return m;
}

const PLUS_RHO = vecToRho(PLUS);

function chiBinary(f: (x: number) => CMat): number {
  return holevo([
    { key: "0", state: f(0), weight: 0.5 },
    { key: "1", state: f(1), weight: 0.5 },
  ]);
}

function maxAbs(m: CMat): number {
  let s = 0;
  for (const v of m.re) s = Math.max(s, Math.abs(v));
  for (const v of m.im) s = Math.max(s, Math.abs(v));
  return s;
}

export interface WitnessResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** W-A: dephased switch == classical mixture, second path from the fixed orders. */
function witnessCollapseIdentity(): WitnessResult {
  const rng = makeRng(20260906);
  const pairs: Array<[string, Stinespring, Stinespring]> = [
    ["depol x depol", krausToStinespring(completelyDepolarizingKraus(2)), krausToStinespring(completelyDepolarizingKraus(2))],
    ["replacer x replacer", krausToStinespring(replacerKraus(2)), krausToStinespring(replacerKraus(2))],
  ];
  for (let t = 0; t < 3; t++) {
    pairs.push([`random#${t}`, randomChannelStinespring(rng, 2, 3), randomChannelStinespring(rng, 2, 3)]);
  }
  const inputs = [vecToRho(uniformVec(2)), basisRho(0), basisRho(1)];
  let worst = 0;
  for (const [name, va, vb] of pairs) {
    const sc = makeSwitchedChannel(va, vb);
    for (const rs of inputs) {
      const r = readoutSlices(sc, PLUS_RHO, rs);
      const mix = classicalMixture(sc, PLUS_RHO, rs, (r) => sc.fixedAB(r), (r) => sc.fixedBA(r));
      worst = Math.max(worst, maxAbs(mAdd(r.readout, mScale(mix, -1))));
      if (worst > 1e-12) return { name: "W-A collapse identity", pass: false, detail: `${name}: deviation ${worst.toExponential(3)}` };
    }
  }
  return { name: "W-A collapse identity (readout = classical mixture)", pass: true, detail: `${pairs.length} pairs x ${inputs.length} inputs, maxdev ${worst.toExponential(3)}` };
}

/** W-B: the ESC18 exchange numbers, from the constructed channels. */
function witnessEsc18(): WitnessResult {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  const tFull = traceDistance(readoutSlices(sc, PLUS_RHO, basisRho(0)).full, readoutSlices(sc, PLUS_RHO, basisRho(1)).full);
  const chiCoh = chiBinary((x) => readoutSlices(sc, PLUS_RHO, basisRho(x)).full);
  const chiRead = chiBinary((x) => readoutSlices(sc, PLUS_RHO, basisRho(x)).readout);
  const blind = Math.max(
    Math.abs(readoutSlices(sc, PLUS_RHO, basisRho(0)).control.re[0]! - 0.5),
    Math.abs(readoutSlices(sc, PLUS_RHO, basisRho(1)).control.re[0]! - 0.5),
  );
  const ok =
    Math.abs(tFull - 0.25) < 1e-12 &&
    Math.abs(chiCoh - QUOTED_ESC18_CHI) < 1e-12 &&
    chiRead < 1e-12 &&
    blind < 1e-12;
  return {
    name: "W-B ESC18 exchange",
    pass: ok,
    detail: `T_full ${tFull.toFixed(15)}, chi ${chiCoh.toFixed(15)} -> ${chiRead.toFixed(15)}, order-bit blindness ${blind.toExponential(2)}`,
  };
}

/** W-C: complementarity — control info before/after the z-readout. */
function witnessComplementarity(): WitnessResult {
  const sc = makeSwitchedChannel(krausToStinespring(replacerKraus(2)), krausToStinespring(replacerKraus(2)));
  const a = readoutSlices(sc, PLUS_RHO, vecToRho(uniformVec(2)));
  const b = readoutSlices(sc, PLUS_RHO, vecToRho(uniformOrthVec(2)));
  const tBefore = traceDistance(a.control, b.control);
  const zProj = (m: CMat): CMat => {
    // z-readout keeps only the control's diagonal — the 2x2 register this witness reads
    if (m.rows !== 2 || m.cols !== 2) refuse("WC_ZPROJ_SHAPE", "W-C zProj: expected the 2x2 control block");
    const z = mat(2, 2);
    z.re[0] = m.re[0]!;
    z.re[3] = m.re[3]!;
    return z;
  };
  const tAfter = traceDistance(zProj(a.control), zProj(b.control));
  const chiControl = chiBinary((x) => readoutSlices(sc, PLUS_RHO, vecToRho(x === 0 ? uniformVec(2) : uniformOrthVec(2))).control);
  const ok =
    Math.abs(tBefore - 0.5) < 1e-12 &&
    tAfter < 1e-12 &&
    Math.abs(chiControl - QUOTED_REPLACER_CHI_CONTROL_CLOSED) < 1e-4; // quoted at 6 decimals
  return {
    name: "W-C complementarity face",
    pass: ok,
    detail: `T(control) ${tBefore.toFixed(15)} -> z-readout ${tAfter.toFixed(15)}; chi_control ${chiControl.toFixed(9)} vs H2(1/4)-1/2`,
  };
}

/** W-D: the weak-readout interior theorem — closed form checked against the
 * simulation at every grid point (data agreement), then certified exactly. */
function witnessInterpolation(): WitnessResult {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  // the v0.1.0 data row stays checked (continuity of the quoted digits) ...
  const grid = [0, 0.25, 0.5, 0.75, 1];
  // the weak-readout state at strength lambda is partialDephase — the single
  // source (v0.4.0's C face); every witness below flows through it, never
  // through a recomposed (1-l)*rho + l*Delta inline
  const vals = grid.map((lambda) =>
    chiBinary((x) => partialDephase(readoutSlices(sc, PLUS_RHO, basisRho(x)).full, [2, sc.sw.d], 0, lambda)),
  );
  const quotedOk =
    Math.abs(vals[0]! - QUOTED_ESC18_CHI) < 1e-12 &&
    vals[4]! < 1e-12 &&
    QUOTED_CURVE.every((q, i) => Math.abs(q - vals[i + 1]!) < 1e-6);
  // ... and v0.2.0 adds the closed form F1, re-derived by the simulation at
  // every grid point lambda = i/20 (never copied from the theorem module)
  let maxDev = 0;
  let worstAt = "";
  for (const lambda of gridPoints()) {
    const l = fToNumber(lambda);
    const sim = chiBinary((x) => partialDephase(readoutSlices(sc, PLUS_RHO, basisRho(x)).full, [2, sc.sw.d], 0, l));
    const iv = esc18Chi(lambda);
    const mid = fToNumber(iMid(iv));
    const dev = Math.abs(sim - mid);
    if (dev > maxDev) {
      maxDev = dev;
      worstAt = `lambda=${l}`;
    }
  }
  const cert = esc18Certificate();
  const ok =
    quotedOk &&
    maxDev < 1e-12 &&
    familyOk(cert) &&
    cert.monotone.every((m) => m.ok) &&
    cert.convex.every((c) => c.ok);
  return {
    name: "W-D weak-readout interior theorem",
    pass: ok,
    detail: `closed form vs sim maxdev ${maxDev.toExponential(3)} (worst ${worstAt}, ${GRID_N + 1} pts); exact: monotone (min gap ${fToNumber(cert.minGap ?? fr(0)).toExponential(3)}) + convex (min dd ${fToNumber(cert.minDD ?? fr(0)).toExponential(3)}), 2 ln paths, widths <= ${fToNumber(cert.maxWidth).toExponential(3)}`,
  };
}

/**
 * The uniform six-order classical mixture Σ_π (1/6)·Tr_env[W_π ρ_S W_π†],
 * block-diagonal in the order register — the second path of the k=3 collapse
 * identity, always built from the branch isometries themselves (never by
 * dephasing the switched output). Single source: the depolarizing and the
 * complex-random trials below share it bit-for-bit.
 */
function sixOrderMixture(sw: Switch3, rhoS: CMat, envDims: readonly [number, number, number]): CMat {
  const dims = [2, envDims[0], envDims[1], envDims[2]];
  const mix = mat(12, 12);
  for (let p = 0; p < 6; p++) {
    const W = sw.branches[p]!; // p < 6 = PERMUTATIONS.length
    const blk = partialTrace(mMul(mMul(W, rhoS), mDagger(W)), dims, [1, 2, 3]);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        mix.re[(p * 2 + i) * 12 + (p * 2 + j)] = blk.re[i * 2 + j]! / 6;
        mix.im[(p * 2 + i) * 12 + (p * 2 + j)] = blk.im[i * 2 + j]! / 6;
      }
    }
  }
  return mix;
}

/** W-E: the k=3 face — six-order mixture identity + the triple's chi. */
function witnessK3(): WitnessResult {
  const v3 = [
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  ];
  const sw = switch3(v3);
  const u6 = uniformControl6();
  const uc = mat(6, 6);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) uc.re[i * 6 + j] = u6.re[i]! * u6.re[j]!;
  const joint3 = (x: number): CMat => partialTrace(mMul(mMul(sw.M, kronRho(uc, basisRho(x))), mDagger(sw.M)), [6, 2, 4, 4, 4], [2, 3, 4]);
  const chiCoh = chiBinary(joint3);
  const chiRead = chiBinary((x) => dephase(joint3(x), [6, 2], 0));
  // mixture identity, second path from the six branch isometries
  const mix = sixOrderMixture(sw, basisRho(0), [4, 4, 4]);
  const dev = maxAbs(mAdd(dephase(joint3(0), [6, 2], 0), mScale(mix, -1)));
  // the complex face: random CPTP triples have complex Stinespring factors —
  // a real-only accumulator would pass the depol check above while corrupting
  // every complex branch (batch 9's anchor-blindspot class, closed here)
  const rng = makeRng(0x5ead07);
  let devComplex = 0;
  for (let t = 0; t < 2; t++) {
    const rc = [randomChannelStinespring(rng, 2, 2), randomChannelStinespring(rng, 2, 2), randomChannelStinespring(rng, 2, 2)];
    const swc = switch3(rc);
    const input = vecToRho(uniformVec(2));
    const dims = [6, 2, rc[0]!.envDim, rc[1]!.envDim, rc[2]!.envDim];
    const out = partialTrace(mMul(mMul(swc.M, kronRho(uc, input)), mDagger(swc.M)), dims, [2, 3, 4]);
    const mixc = sixOrderMixture(swc, input, [rc[0]!.envDim, rc[1]!.envDim, rc[2]!.envDim]);
    devComplex = Math.max(devComplex, maxAbs(mAdd(dephase(out, [6, 2], 0), mScale(mixc, -1))));
  }
  const ok = Math.abs(chiCoh - QUOTED_K3_CHI) < 1e-12 && chiRead < 1e-12 && dev < 1e-12 && devComplex < 1e-12;
  // v0.2.0: the k=3 weak-readout closed form F3 — the simulation re-derives it
  // at every grid point (member/average eigenvalues affine in the coherence),
  // then the exact certificates apply to the family on both ln paths
  let k3MaxDev = 0;
  for (const lambda of gridPoints()) {
    const l = fToNumber(lambda);
    const sim = chiBinary((x) => partialDephase(joint3(x), [6, 2], 0, l));
    const iv = k3Chi(lambda);
    const mid = fToNumber(iMid(iv));
    k3MaxDev = Math.max(k3MaxDev, Math.abs(sim - mid));
  }
  const k3Cert = k3Certificate();
  const k3Ok = k3MaxDev < 1e-12 && familyOk(k3Cert);
  return {
    name: "W-E k=3 face (six orders)",
    pass: ok && k3Ok,
    detail: `chi ${chiCoh.toFixed(15)} -> ${chiRead.toFixed(15)}; mixture identity ${dev.toExponential(3)} (depol), ${devComplex.toExponential(3)} (complex random triples); weak-readout closed form vs sim maxdev ${k3MaxDev.toExponential(3)}, certified monotone+convex (2 paths, min dd ${fToNumber(k3Cert.minDD ?? fr(0)).toExponential(3)})`,
  };
}

/** W-F: the exchange-rate frontier — replacer closed form vs simulation, both
 * censuses' Pareto certificates, first-touch dominance, and the quoted
 * first-bit prices. */
function witnessFrontier(): WitnessResult {
  const sc = makeSwitchedChannel(
    krausToStinespring(replacerKraus(2)),
    krausToStinespring(replacerKraus(2)),
  );
  // the replacer family F2 re-derived by the control-marginal simulation
  let maxDev = 0;
  for (const lambda of gridPoints()) {
    const l = fToNumber(lambda);
    const sim = chiBinary((x) => {
      const s = readoutSlices(sc, PLUS_RHO, vecToRho(x === 0 ? uniformVec(2) : uniformOrthVec(2)));
      return partialDephase(s.control, [2], 0, l);
    });
    const iv = replacerChi(lambda);
    const mid = fToNumber(iMid(iv));
    maxDev = Math.max(maxDev, Math.abs(sim - mid));
  }
  const replCert = replacerCertificate();
  const fw = frontierCertificate();
  // the first marginal price = chi(0) - chi(1/20): quote from the enclosure's
  // midpoint (display only; the pass check compares against the quoted digits)
  const midNum = (iv: Ivl | undefined): number => {
    if (iv === undefined) refuse("WF_MARGINAL_LIST_EMPTY", "W-F: marginal price list is empty");
    return fToNumber(iMid(iv));
  };
  const escFirst = midNum(fw.esc18.marginal[0]);
  const replFirst = midNum(fw.replacer.marginal[0]);
  const ok =
    maxDev < 1e-12 &&
    familyOk(replCert) &&
    fw.ok &&
    fw.esc18.antichain.ok &&
    fw.replacer.antichain.ok &&
    Math.abs(escFirst - QUOTED_FIRST_BIT_COST) < 1e-9 &&
    Math.abs(replFirst - QUOTED_REPLACER_FIRST_BIT_COST) < 1e-9;
  return {
    name: "W-F exchange-rate frontier",
    pass: ok,
    detail: `replacer closed form vs sim maxdev ${maxDev.toExponential(3)} (${GRID_N + 1} pts); Pareto: no census point dominates (both families, exact); first-touch dominance: first bit costs ${escFirst.toFixed(9)} (ESC18 joint) / ${replFirst.toFixed(9)} (replacer control), every next bit strictly less`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessCollapseIdentity(),
    witnessEsc18(),
    witnessComplementarity(),
    witnessInterpolation(),
    witnessK3(),
    witnessFrontier(),
  ];
}

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
 *   C5. the id is one of E1..E5 and unique (numbering discipline).
 *
 * Witnesses (independent re-derivations):
 *   W-A collapse identity — dephased switch = classical mixture, second path
 *       built from the fixed-order channels themselves;
 *   W-B ESC18 re-derivation — T_full, chi_joint coherent vs readout, and the
 *       order-bit blindness, from the constructed channels;
 *   W-C complementarity face — control information before/after z-readout;
 *   W-D weak-readout interpolation, endpoints asserted, curve as data;
 *   W-E the k=3 face — six-order mixture identity and the triple's chi.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, mAdd, mDagger, mMul, mScale } from "../core/cmat.js";
import { partialTrace } from "../core/channels.js";
import { PLUS, vecToRho, uniformVec, uniformOrthVec } from "../core/states.js";
import { holevo, traceDistance } from "../core/measures.js";
import { makeRng } from "../core/rng.js";
import { krausToStinespring, makeSwitchedChannel } from "../switch/isometry.js";
import { completelyDepolarizingKraus, replacerKraus, randomChannelStinespring } from "../switch/chanlib.js";
import { classicalMixture, dephase, kronRho, readoutSlices } from "./collapse.js";
import { switch3, uniformControl6 } from "./kswitch3.js";
import {
  EXCHANGE,
  QUOTED_CURVE,
  QUOTED_ESC18_CHI,
  QUOTED_K3_CHI,
  QUOTED_REPLACER_CHI_CONTROL_CLOSED,
  type ExchangeRow,
} from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E"];

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
  const m = { rows: 2, cols: 2, re: new Float64Array(4), im: new Float64Array(4) } as CMat;
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
  const pairs: Array<[string, ReturnType<typeof krausToStinespring>, ReturnType<typeof krausToStinespring>]> = [
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
    Math.abs((readoutSlices(sc, PLUS_RHO, basisRho(0)).control.re[0] as number) - 0.5),
    Math.abs((readoutSlices(sc, PLUS_RHO, basisRho(1)).control.re[0] as number) - 0.5),
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
    if (m.rows !== 2 || m.cols !== 2) throw new Error("W-C zProj: expected the 2x2 control block");
    const z = { rows: 2, cols: 2, re: new Float64Array(4), im: new Float64Array(4) } as CMat;
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

/** W-D: the weak-readout interpolation — endpoints asserted, curve as data. */
function witnessInterpolation(): WitnessResult {
  const sc = makeSwitchedChannel(
    krausToStinespring(completelyDepolarizingKraus(2)),
    krausToStinespring(completelyDepolarizingKraus(2)),
  );
  const grid = [0, 0.25, 0.5, 0.75, 1];
  const vals = grid.map((lambda) =>
    chiBinary((x) => {
      const s = readoutSlices(sc, PLUS_RHO, basisRho(x));
      return lambda === 0 ? s.full : lambda === 1 ? s.readout : mAdd(mScale(s.full, 1 - lambda), mScale(s.readout, lambda));
    }),
  );
  const ok =
    Math.abs((vals[0] as number) - QUOTED_ESC18_CHI) < 1e-12 &&
    (vals[4] as number) < 1e-12 &&
    QUOTED_CURVE.every((q, i) => Math.abs(q - (vals[i + 1] as number)) < 1e-6);
  const curve = grid.map((g, i) => `${g}:${(vals[i] as number).toFixed(9)}`).join(" ");
  return { name: "W-D weak-readout interpolation (data)", pass: ok, detail: curve };
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
  const uc = { rows: 6, cols: 6, re: new Float64Array(36), im: new Float64Array(36) } as CMat;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) uc.re[i * 6 + j] = (u6.re[i] as number) * (u6.re[j] as number);
  const joint3 = (x: number): CMat => partialTrace(mMul(mMul(sw.M, kronRho(uc, basisRho(x))), mDagger(sw.M)), [6, 2, 4, 4, 4], [2, 3, 4]);
  const chiCoh = chiBinary(joint3);
  const chiRead = chiBinary((x) => dephase(joint3(x), [6, 2], 0));
  // mixture identity, second path from the six branch isometries
  const mix = { rows: 12, cols: 12, re: new Float64Array(144), im: new Float64Array(144) } as CMat;
  for (let p = 0; p < 6; p++) {
    const W = sw.branches[p] as CMat;
    const blk = partialTrace(mMul(mMul(W, basisRho(0)), mDagger(W)), [2, 4, 4, 4], [1, 2, 3]);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        mix.re[(p * 2 + i) * 12 + (p * 2 + j)] = (blk.re[i * 2 + j] as number) / 6;
        mix.im[(p * 2 + i) * 12 + (p * 2 + j)] = (blk.im[i * 2 + j] as number) / 6;
      }
    }
  }
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
    const dims = [6, 2, (rc[0] as { envDim: number }).envDim, (rc[1] as { envDim: number }).envDim, (rc[2] as { envDim: number }).envDim];
    const out = partialTrace(mMul(mMul(swc.M, kronRho(uc, input)), mDagger(swc.M)), dims, [2, 3, 4]);
    const mixc = { rows: 12, cols: 12, re: new Float64Array(144), im: new Float64Array(144) } as CMat;
    for (let p = 0; p < 6; p++) {
      const W = swc.branches[p] as CMat;
      const blk = partialTrace(mMul(mMul(W, input), mDagger(W)), dims.slice(1), [1, 2, 3]);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          mixc.re[(p * 2 + i) * 12 + (p * 2 + j)] = (blk.re[i * 2 + j] as number) / 6;
          mixc.im[(p * 2 + i) * 12 + (p * 2 + j)] = (blk.im[i * 2 + j] as number) / 6;
        }
      }
    }
    devComplex = Math.max(devComplex, maxAbs(mAdd(dephase(out, [6, 2], 0), mScale(mixc, -1))));
  }
  const ok = Math.abs(chiCoh - QUOTED_K3_CHI) < 1e-12 && chiRead < 1e-12 && dev < 1e-12 && devComplex < 1e-12;
  return {
    name: "W-E k=3 face (six orders)",
    pass: ok,
    detail: `chi ${chiCoh.toFixed(15)} -> ${chiRead.toFixed(15)}; mixture identity ${dev.toExponential(3)} (depol), ${devComplex.toExponential(3)} (complex random triples)`,
  };
}

export function runWitnesses(): WitnessResult[] {
  return [witnessCollapseIdentity(), witnessEsc18(), witnessComplementarity(), witnessInterpolation(), witnessK3()];
}

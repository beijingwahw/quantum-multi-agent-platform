/**
 * The checker — the tariff laws, and the witnesses that re-derive every
 * number from physics (never from the schedule's own text).
 *
 * Laws enforced:
 *   N1. every item carries a price — an item without a price fails the build;
 *   N2. a zero or EXACT claim must cite a witness that exists (and that
 *       passes, checked where the ledger gates rendering) — an unwitnessed
 *       zero is marketing;
 *   N3. anchor repos exist on disk — physics stays where it was verified;
 *   N4. exactness tag is EXACT or DATA;
 *   N5. ids unique.
 *
 * Witnesses:
 *   W-A cache leakage (24 axes, local unitaries, Stinespring CPTP);
 *   W-B order-bit blindness (pairs x inputs);
 *   W-C HJW ensemble equivalence (Z/X/Y pairwise TV, avg = I/2);
 *   W-D the withdrawal schedule (anchors exact, grid monotone, values match);
 *   W-E h2 two-path (closed form vs Taylor series, open grid);
 *   W-F the interior theorem (monotonicity as an exact machine certificate);
 *   W-G the convexity face (grid second differences + the citation formula);
 *   W-H the tetrahedral SIC census (the fifth payer, floor unchanged).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type CMat, identity, mScale } from "../core/cmat.js";
import { traceDistance } from "../core/measures.js";
import { F_ZERO, fCmp, fDecimal, fToNumber, frDec } from "./rational.js";
import { convexityCertificate, monoCertificate } from "./theorem.js";
import {
  SINGLET,
  TETRAHEDRAL_AXES,
  tetraStructureDeviation,
  cacheLeakage,
  randomBUnitary,
  randomBCPTP,
  orderBlindnessMax,
  hjwAverage,
} from "./nosignal.js";
import {
  TARIFF,
  QUOTED_CACHE_LEAK,
  QUOTED_ORDER_BLIND,
  QUOTED_NET_GRID,
  QUOTED_NET_P0,
  QUOTED_NET_P05,
  QUOTED_NET_P1,
  QUOTED_H2_GRID_MAXDEV,
  QUOTED_MONO_GRID_N,
  QUOTED_MONO_MIN_GAP,
  QUOTED_MONO_MAX_WIDTH,
  QUOTED_CONVEX_MIN_DD,
  QUOTED_DERIV_MAX_DIST,
  QUOTED_SECOND_DERIV_MAX_DIST,
  QUOTED_SIC_LEAK,
  type TariffRow,
} from "./ledger.js";

const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

/**
 * A TariffRow as it crosses the untrusted boundary into the checker: the
 * compile-time `Exactness` union proves nothing at runtime (rows can arrive
 * parsed or mutated), so the tag is an unvalidated string until N4 has run.
 * `TariffRow` remains assignable (Exactness ⊂ string).
 */
export type UntrustedTariffRow = Omit<TariffRow, "exactness"> & { readonly exactness: string };

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E", "W-F", "W-G", "W-H"];

export function checkTariff(rows: readonly UntrustedTariffRow[] = TARIFF): Violation[] {
  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) violations.push({ row: r.id, law: "N5", detail: "duplicate tariff id" });
    seen.add(r.id);
    if (r.price.trim().length === 0) {
      violations.push({ row: r.id, law: "N1", detail: "an item without a price — the schedule does not ship" });
    }
    if (r.exactness !== "EXACT" && r.exactness !== "DATA") {
      violations.push({ row: r.id, law: "N4", detail: `illegal exactness tag "${r.exactness}"` });
    }
    if (!WITNESS_IDS.includes(r.witness)) {
      violations.push({ row: r.id, law: "N2", detail: `cites unknown witness "${r.witness}" — an unwitnessed zero is marketing` });
    }
    for (const a of r.anchors) {
      if (!existsSync(resolve(WORKSPACE_ROOT, a, "package.json"))) {
        violations.push({ row: r.id, law: "N3", detail: `anchor repo missing on disk: ${a}` });
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

const AXES: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI;
    for (let j = 0; j < 3; j++) {
      const ph = (j / 3) * 2 * Math.PI;
      const s = Math.sin(t);
      out.push([s * Math.cos(ph), s * Math.sin(ph), Math.cos(t)]);
    }
  }
  return out;
})();

function witnessCacheLeak(): WitnessResult {
  let plain = 0;
  let withU = 0;
  let withC = 0;
  for (const a of AXES) {
    for (const b of AXES) {
      plain = Math.max(plain, cacheLeakage(SINGLET, a, b));
      withU = Math.max(withU, cacheLeakage(SINGLET, a, b, randomBUnitary(a[0] * 97 + 5)));
      withC = Math.max(withC, cacheLeakage(SINGLET, a, b, randomBCPTP(a[1] * 131 + 9, 2)));
    }
  }
  const worst = Math.max(plain, withU, withC);
  const ok = worst <= QUOTED_CACHE_LEAK;
  return {
    name: "W-A cache leakage (24 axes x local maps)",
    pass: ok,
    detail: `plain ${plain.toExponential(3)}, unitary ${withU.toExponential(3)}, CPTP ${withC.toExponential(3)} — floor ${QUOTED_CACHE_LEAK.toExponential(2)}`,
  };
}

function witnessOrderBlind(): WitnessResult {
  const worst = orderBlindnessMax();
  const ok = worst <= QUOTED_ORDER_BLIND;
  return { name: "W-B order-bit blindness", pass: ok, detail: `max deviation ${worst.toExponential(3)}` };
}

function witnessHjw(): WitnessResult {
  const z = hjwAverage([0, 0, 1]);
  const x = hjwAverage([1, 0, 0]);
  const y = hjwAverage([0, 1, 0]);
  const half = mScale(identity(2), 0.5);
  const dev = (m: CMat): number => {
    let s = 0;
    for (let k = 0; k < m.re.length; k++) {
      s = Math.max(s, Math.abs(m.re[k]! - half.re[k]!), Math.abs(m.im[k]! - half.im[k]!));
    }
    return s;
  };
  const tvs = [traceDistance(z, x), traceDistance(z, y), traceDistance(x, y)];
  const worstI = Math.max(dev(z), dev(x), dev(y));
  const ok = tvs.every((t) => t < 1e-15) && worstI < 1e-15;
  return {
    name: "W-C HJW ensemble equivalence",
    pass: ok,
    detail: `pairwise TV max ${Math.max(...tvs).toExponential(3)}, |avg - I/2| max ${worstI.toExponential(3)} over Z/X/Y commitments`,
  };
}

const h2 = (q: number): number => (q <= 0 || q >= 1 ? 0 : -q * Math.log2(q) - (1 - q) * Math.log2(1 - q));
const net = (p: number): number => (1 - h2((1 - p) / 2)) / 2;

function witnessSchedule(): WitnessResult {
  const anchorsOk = Math.abs(net(0) - QUOTED_NET_P0) < 1e-15 && Math.abs(net(0.5) - QUOTED_NET_P05) < 1e-9 && Math.abs(net(1) - QUOTED_NET_P1) < 1e-15;
  let gridOk = true;
  let monoOk = true;
  const grid: number[] = [];
  for (let i = 1; i <= 9; i++) {
    const p = i / 10;
    const v = net(p);
    grid.push(v);
    if (Math.abs(v - QUOTED_NET_GRID[i - 1]!) > 1e-9) gridOk = false;
  }
  const full = [net(0), ...grid, net(1)];
  for (let i = 1; i < full.length; i++) {
    if (full[i]! <= full[i - 1]!) monoOk = false;
  }
  const ok = anchorsOk && gridOk && monoOk;
  return {
    name: "W-D withdrawal schedule",
    pass: ok,
    detail: `anchors ${net(0).toFixed(12)} / ${net(0.5).toFixed(9)} / ${net(1).toFixed(12)}, grid match ${gridOk}, strictly monotone ${monoOk}`,
  };
}

function witnessH2TwoPath(): WitnessResult {
  const series = (q: number, terms = 400): number => {
    let s = 1;
    const d = 1 - 2 * q;
    let dk = d * d;
    for (let k = 1; k <= terms; k++) {
      s -= dk / (2 * Math.LN2 * k * (2 * k - 1));
      dk *= d * d;
    }
    return s;
  };
  let worst = 0;
  for (let i = 5; i <= 45; i++) {
    const q = i / 100; // q in [0.05, 0.45] — where 400 terms hit machine precision
    worst = Math.max(worst, Math.abs(h2(q) - series(q)));
  }
  const ok = worst <= QUOTED_H2_GRID_MAXDEV;
  return { name: "W-E h2 two-path (closed vs series)", pass: ok, detail: `max deviation ${worst.toExponential(3)} on the open grid` };
}

export function runWitnesses(): WitnessResult[] {
  return [
    witnessCacheLeak(),
    witnessOrderBlind(),
    witnessHjw(),
    witnessSchedule(),
    witnessH2TwoPath(),
    witnessMonotonicity(),
    witnessConvexity(),
    witnessSicCensus(),
  ];
}

// --- W-F/W-G: the interior theorem (exact rational certificates) -----------------------------

function witnessMonotonicity(): WitnessResult {
  const c = monoCertificate();
  const quotedMinGap = frDec(QUOTED_MONO_MIN_GAP);
  const quotedMaxWidth = frDec(QUOTED_MONO_MAX_WIDTH);
  const minGap = c.closed.minGap ?? F_ZERO; // ok implies non-null; the quotes double-check
  const ok =
    c.ok &&
    c.closed.ok &&
    c.series.ok &&
    c.crossOverlapAll &&
    c.gaps.length === QUOTED_MONO_GRID_N &&
    fCmp(minGap, quotedMinGap) >= 0 &&
    fCmp(c.series.minGap ?? F_ZERO, quotedMinGap) >= 0 &&
    fCmp(c.maxWidth, quotedMaxWidth) <= 0;
  return {
    name: "W-F interior monotonicity (exact interval certificate)",
    pass: ok,
    detail: `strictly increasing on p = i/${QUOTED_MONO_GRID_N}, both h2 paths; min gap ${fDecimal(minGap, 12)} (pair 0->1), widest enclosure ${fToNumber(c.maxWidth).toExponential(2)} (quote ${QUOTED_MONO_MAX_WIDTH}), cross-path overlap ${c.crossOverlapAll}`,
  };
}

function witnessConvexity(): WitnessResult {
  const c = convexityCertificate();
  const ok =
    c.ok &&
    c.convex.ok &&
    c.quotientsPositive &&
    c.formulaPositive &&
    c.secondFormulaPositive &&
    c.inflectionCells.length === 0 &&
    fCmp(c.minDD ?? F_ZERO, frDec(QUOTED_CONVEX_MIN_DD)) >= 0 &&
    fCmp(c.derivMaxDist, frDec(QUOTED_DERIV_MAX_DIST)) <= 0 &&
    fCmp(c.secondDerivMaxDist, frDec(QUOTED_SECOND_DERIV_MAX_DIST)) <= 0;
  return {
    name: "W-G convexity / inflection face",
    pass: ok,
    detail: `grid Delta^2 lower bounds all positive (min ${fDecimal(c.minDD ?? F_ZERO, 9)}), inflection cells named: ${c.inflectionCells.length === 0 ? "none" : c.inflectionCells.join(",")}; citation formula positive at every sample; agreement (data) actuals 1st ${fDecimal(c.derivMaxDist, 9)}, 2nd ${fDecimal(c.secondDerivMaxDist, 9)} vs quoted ceilings ${QUOTED_DERIV_MAX_DIST} / ${QUOTED_SECOND_DERIV_MAX_DIST} at h = 1/100`,
  };
}

function witnessSicCensus(): WitnessResult {
  let plain = 0;
  let withU = 0;
  let withC = 0;
  for (const a of TETRAHEDRAL_AXES) {
    for (const b of TETRAHEDRAL_AXES) {
      plain = Math.max(plain, cacheLeakage(SINGLET, a, b));
      withU = Math.max(withU, cacheLeakage(SINGLET, a, b, randomBUnitary(a[0] * 89 + 7)));
      withC = Math.max(withC, cacheLeakage(SINGLET, a, b, randomBCPTP(a[1] * 113 + 3, 2)));
    }
  }
  const structure = tetraStructureDeviation();
  const worst = Math.max(plain, withU, withC);
  const ok = worst <= QUOTED_SIC_LEAK && structure < 1e-15;
  return {
    name: "W-H tetrahedral SIC census (fifth payer)",
    pass: ok,
    detail: `plain ${plain.toExponential(3)}, unitary ${withU.toExponential(3)}, CPTP ${withC.toExponential(3)} over the 4-axis tetrahedron — floor ${QUOTED_SIC_LEAK.toExponential(2)}; structure dev |n.n'+1/3|, |overlap-1/3| ${structure.toExponential(3)}`,
  };
}

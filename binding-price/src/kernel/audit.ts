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
 *   W-E the constants on two paths.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { traceDistance } from "../core/measures.js";
import {
  HALF_MIXED,
  blochOf,
  blochState,
  concealmentLoss,
  marginal,
  passProbability,
  pureState,
  revealStats,
  strategyFamilies,
} from "./market.js";
import {
  MARKET,
  QUOTED_CHEAT_CONST,
  QUOTED_CHEAT_CONST_DEV,
  QUOTED_DETECTION_M,
  QUOTED_FLAT_DEV,
  QUOTED_IDENTITY_DEV,
  type MarketRow,
} from "./ledger.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");

export interface Violation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

const WITNESS_IDS: readonly string[] = ["W-A", "W-B", "W-C", "W-D", "W-E"];

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

export function runWitnesses(): WitnessResult[] {
  return [witnessIdentity(), witnessFlatSupply(), witnessFrontier(), witnessDetection(), witnessConstants()];
}

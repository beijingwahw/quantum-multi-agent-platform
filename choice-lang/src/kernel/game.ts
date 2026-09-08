/**
 * The two-player face — choose against choose, as a bounded game census.
 *
 * Player 1 moves first with a fixed choose; player 2 (the ADVERSARY) answers
 * with a choose from a bounded strategy set: a fixed theta and a census of
 * seeded random branch pairs. The adversary's best response is the strategy
 * minimizing the final membership charge. What the census measures:
 *
 *   G-TOLL  the toll is STRATEGY-PROOF — the composed pattern weight equals
 *           w1·w2 exactly in EVERY census cell: the certification price of
 *           the joint pattern is branch-blind (control diagonals are
 *           untouchable even by an adversary), so no strategy haggles the
 *           toll down. The attack surface is the charge, never the price.
 *
 *   charge  (census DATA) — with an engineered first move the charge after
 *           the first move is conserved (its own law), and the adversary's
 *           random branches then degrade the final charge cell by cell; with
 *           the engineered move LAST, the engineered body LOCKS whatever
 *           charge the adversary left: final = after-adversary per cell, to
 *           the rounding floor. Outcomes are data over the census; the lock
 *           identity per cell is machine-exact.
 */
import { type CMat } from "../core/cmat.js";
import { conditionOnPattern, membershipExpectation, runProgram, type Program } from "./lang.js";
import { runOnRegister, registerPattern } from "./compose.js";
import { randomBranchUnitary } from "./fixtures.js";

/** The adversary's fixed control angle across the whole census. */
export const ADVERSARY_THETA = 0.9;
/** The bounded strategy set's size: seeded random branch pairs. */
export const CENSUS_SIZE = 24;

/** Strategy s of the adversary: one choose with seeded random branches. */
export function adversaryStrategy(s: number): Program {
  return [{ theta: ADVERSARY_THETA, u0: randomBranchUnitary(5000 + s * 3), u1: randomBranchUnitary(6000 + s * 5) }];
}

export interface GameCell {
  readonly strategy: number;
  /** membership charge after the FIRST mover only */
  readonly afterFirst: number;
  /** membership charge after both moves */
  readonly final: number;
  /** the cell's composed pattern weight, read off its own run */
  readonly patternWeight: number;
}

/**
 * One census pass: `first` moves, then every adversary strategy answers.
 * `firstBits` is the first mover's target control pattern, `advBit` the
 * adversary's; the weight read in each cell is the composed pattern's.
 */
export function gameCensus(
  first: Program,
  firstBits: ReadonlyArray<0 | 1>,
  advBit: 0 | 1,
  rho: CMat,
  piW: CMat,
): GameCell[] {
  const d = rho.rows;
  const afterFirst = membershipExpectation(runProgram(first, rho), piW, d);
  const cells: GameCell[] = [];
  for (let s = 0; s < CENSUS_SIZE; s++) {
    const adv = adversaryStrategy(s);
    const composed = [...first, ...adv];
    const fin = runProgram(composed, rho);
    // register order: adversary's control sits in FRONT of first's controls
    const { p } = conditionOnPattern(fin, composed.length, [advBit, ...registerPattern(firstBits)], d);
    cells.push({ strategy: s, afterFirst, final: membershipExpectation(fin, piW, d), patternWeight: p });
  }
  return cells;
}

/** The charge-lock census: the adversary moves FIRST, the fixed program answers. */
export function lockCensus(
  second: Program,
  rho: CMat,
  piW: CMat,
): Array<{ strategy: number; afterAdversary: number; final: number }> {
  const d = rho.rows;
  const rows: Array<{ strategy: number; afterAdversary: number; final: number }> = [];
  for (let s = 0; s < CENSUS_SIZE; s++) {
    const mid = runProgram(adversaryStrategy(s), rho); // (adversary control, data)
    const afterAdversary = membershipExpectation(mid, piW, d);
    const after = runOnRegister(second, mid, 1); // answer prepends its controls
    const final = membershipExpectation(after.reg, piW, d);
    rows.push({ strategy: s, afterAdversary, final });
  }
  return rows;
}

/**
 * EXP7 — the kink locus as piecewise-smooth Noether (v0.3.0): K4 executed.
 *
 * JUMP REGIME: the second-price mechanism as two polynomial patches over
 * Q[s, t, w] — the chain per patch (zero polynomials), the COMMON gauge
 * (p + W_-i = the pivot w on both patches), the gluing identity
 * [u] = t*[x] - [p] with [x] = 1, [p] = w, [u] = t - w priced exactly, the
 * charge's one-sided limits at the kink, and the across-kink integration
 * step (the Milgrom-Segal envelope MS02) on crossing and non-crossing pairs.
 * Negative controls: FIRST PRICE passes the gluing identity and is convicted
 * on the patch (residual exactly -1); ALL-PAY is convicted on the losing
 * patch — the counterfeit certificate "gluing => DSIC" is named and rejected.
 *
 * CONTINUITY REGIME: the capacity wall of the quadratic family (types
 * widened to [1/2, 5/2]^2 — the wall v0.2.0's interior guard existed to
 * avoid). The interior patch carries a NONCONSTANT rule (the chain runs
 * nontrivially), the wall patch a constant one; x, p, and the CHARGE are
 * continuous at the kink (zero polynomials, w symbolic), while the charge's
 * FLUX jumps by exactly (t-w+1)/2 = x(t) — the surface term of the piecewise
 * conservation law. The wall-to-wall block is a WEAK-DSIC flat (charge 0),
 * counted honestly in the grid witness.
 */
import {
  pEval,
  pIsZero,
  pSub,
  rCmp,
  rStr,
  rSub,
  rat,
  type Poly,
  type Rat,
} from "../src/continuum/poly.js";
import * as k from "../src/continuum/kink.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const require = (name: string, ok: boolean, detail: string): boolean => {
    if (!ok) failures.push(`${name} — ${detail}`);
    return ok;
  };
  const exact = (name: string, p: Poly): boolean => {
    const zero = pIsZero(p);
    return require(name, zero, zero ? "0 (coefficient-wise)" : "NONZERO residual");
  };
  const lines: string[] = [];

  // ---------- jump regime: per-patch chain ----------
  const patchRows: string[][] = [];
  {
    const { win, lose } = k.secondPricePatches();
    exact("JUMP [E] winning patch", k.patchEnvelopeResidual(win));
    exact("JUMP [E] losing patch", k.patchEnvelopeResidual(lose));
    patchRows.push(["win: x = 1, p = w", "0 (coefficient-wise)", "clean"]);
    patchRows.push(["lose: x = 0, p = 0", "0 (coefficient-wise)", "clean"]);
    exact("JUMP [G] winning patch: p + W_-i = pivot w", k.patchGrovesResidual(win));
    exact("JUMP [G] losing patch: p + W_-i = pivot w", k.patchGrovesResidual(lose));
    require("JUMP [I] readoff clean on win", k.patchReadoff(win).clean, "s-monomials");
    require("JUMP [I] readoff clean on lose", k.patchReadoff(lose).clean, "s-monomials");
  }

  // ---------- jump regime: gluing + charge + across-kink [I] ----------
  const gluingRows: string[][] = [];
  {
    const pairs: ReadonlyArray<readonly [Rat, Rat]> = [
      [rat(7, 10), rat(1, 2)],
      [rat(2, 5), rat(1, 2)],
    ];
    for (const [t, w] of pairs) {
      const j = k.kinkJumps(t, w);
      require(`JUMP gluing (${rStr(t)}, ${rStr(w)}): [x]=1`, rCmp(j.jumpX, rat(1)) === 0, rStr(j.jumpX));
      require(`JUMP gluing: [p]=w`, rCmp(j.jumpP, w) === 0, rStr(j.jumpP));
      require(`JUMP gluing: [u]=t-w`, rCmp(j.jumpU, rSub(t, w)) === 0, rStr(j.jumpU));
      require(`JUMP gluing identity [u] = t[x] - [p]`, j.ok, rStr(j.gluingResidual));
    }
    gluingRows.push(["jumps at the kink", "[x] = 1, [p] = w, [u] = t - w", "exact rationals"]);
    gluingRows.push(["gluing identity", "[u] = t*[x] - [p]", "residual 0 exact"]);
    const winner = k.chargeOneSided(rat(7, 10), rat(1, 2));
    const minusGap = rSub(rat(0), rSub(rat(7, 10), rat(1, 2))); // -(t-w) = -1/5
    require("JUMP charge one-sided (true winner): 0 / -(t-w)", winner.fromWin.n === 0n && rCmp(winner.fromLose, minusGap) === 0, `${rStr(winner.fromWin)}, ${rStr(winner.fromLose)}`);
    const loser = k.chargeOneSided(rat(2, 5), rat(1, 2));
    require("JUMP charge one-sided (true loser): -(t-w) signed / 0", rCmp(loser.fromWin, rSub(rat(2, 5), rat(1, 2))) === 0 && loser.fromLose.n === 0n, `${rStr(loser.fromWin)}, ${rStr(loser.fromLose)}`);
    gluingRows.push(["charge one-sided limits", "winner: 0 and -(t-w); loser: -(t-w) and 0", "DSIC across, exact"]);
    const envPairs: ReadonlyArray<readonly [Rat, Rat, Rat]> = [
      [rat(2, 5), rat(4, 5), rat(1, 2)],
      [rat(1, 20), rat(9, 20), rat(1, 2)],
      [rat(11, 20), rat(49, 50), rat(1, 2)],
      [rat(4, 5), rat(2, 5), rat(1, 2)],
    ];
    for (const [t0, t1, w] of envPairs) {
      const e = k.acrossKinkEnvelope(t0, t1, w);
      require(`JUMP across-kink [I] (${rStr(t0)} -> ${rStr(t1)})`, e.ok, `${rStr(e.uDiff)} != ${rStr(e.integral)}`);
    }
    gluingRows.push(["across-kink [I] (MS02)", "U(t1)-U(t0) = signed measure above w", "exact on 4 pairs (crossing, below, above, reversed)"]);
  }

  // ---------- jump regime: convictions ----------
  const convictRows: string[][] = [];
  {
    const t = rat(7, 10);
    const w = rat(1, 2);
    const fp = k.firstPriceComposite(t, w);
    require("CONVICTION first price passes the kink gluing", rCmp(fp.gluingResidual, rat(0)) === 0, "unexpectedly failed gluing");
    const resAt = pEval(fp.winPatchResidual, [w, t, w]);
    require("CONVICTION first price: winning-patch [E] residual == -1", rCmp(resAt, rat(-1)) === 0, rStr(resAt));
    convictRows.push(["first price p = s", "kink gluing HOLDS ([p] = w at s = w)", "patch [E] residual exactly -1: convicted"]);
    const { lose } = k.allPayPatches();
    const apAt = pEval(k.patchEnvelopeResidual(lose), [w, t, w]);
    require("CONVICTION all-pay: losing-patch [E] residual == -1", rCmp(apAt, rat(-1)) === 0, rStr(apAt));
    convictRows.push(["all-pay p = s (both patches)", "loses without paying? no — pays s", "losing-patch [E] residual exactly -1: convicted"]);
  }

  // ---------- continuity regime: the wall ----------
  const wallRows: string[][] = [];
  {
    const inside = k.wallInteriorPatch();
    const walled = k.wallWallPatch();
    require("WALL interior rule is nonconstant", !pIsZero(inside.x), "vacuous witness");
    exact("WALL [E] interior patch", k.wallEnvelopeResidual(inside));
    exact("WALL [E] wall patch", k.wallEnvelopeResidual(walled));
    exact("WALL [G] interior patch: p + W_2 = w - 1/2", k.wallGrovesResidual(inside));
    exact("WALL [G] wall patch: p + W_2 = w - 1/2", k.wallGrovesResidual(walled));
    require("WALL [I] interior readoff clean", k.wallGaugeReadoff().clean, "s-monomials");
    wallRows.push(["interior patch x = (s-w+1)/2", "[E] 0, [G] 0, readoff clean", "nonconstant rule — chain nontrivial"]);
    wallRows.push(["wall patch x = 0", "[E] 0, [G] 0", "constant rule"]);
    const g = k.wallGluing();
    exact("WALL x continuous at s* = w-1", g.xJump);
    exact("WALL p continuous at s*", g.pJump);
    exact("WALL charge continuous at s*", g.chargeJump);
    wallRows.push(["gluing at s* = w - 1 (w symbolic)", "[x] = [p] = [charge] = 0", "zero polynomials"]);
    const fj = k.wallFluxJump();
    exact("WALL flux jump == (t-w+1)/2", pSub(fj.jump, fj.expected));
    wallRows.push(["charge FLUX at s*", "dG/ds jumps by (t-w+1)/2 = x(t)", "exact (the surface term)"]);
    const blocks = k.wallChargeBlocks();
    exact("WALL interior charge == -(s-t)^2/4", pSub(blocks.interior, blocks.interiorClosedForm));
    exact("WALL wall-block charge == 0 (the weak-DSIC flat)", blocks.wallBlock);
    exact("WALL cross charge == -(t-w+1)^2/4", pSub(blocks.crossBlock, blocks.crossClosedForm));
    const grid = k.wallGridWitness(rat(5, 2), 8);
    require("WALL grid never positive", grid.worst.n === 0n, rStr(grid.worst));
    require("WALL grid interior off-diagonal < 0", rCmp(grid.worstInteriorOff, rat(0)) < 0, rStr(grid.worstInteriorOff));
    require("WALL grid cross < 0", rCmp(grid.worstCross, rat(0)) < 0, rStr(grid.worstCross));
    wallRows.push(["piecewise charge on the grid (81x81)", `never > 0; interior ${rStr(grid.worstInteriorOff)}; cross ${rStr(grid.worstCross)}`, `${grid.flatPairs} wall-to-wall flat pairs (weak DSIC)`]);
  }

  // ---------- the report ----------
  lines.push(
    "# EXP7 — the kink locus as piecewise-smooth Noether: K4 executed",
    "",
    "v0.2.0 stopped where the allocation jumps. v0.3.0 runs the chain on each smooth piece and",
    "prices the gluing. Two regimes, one discipline: per-patch zero polynomials PLUS exact",
    "kink conditions — the piecewise face of the Noether conservation.",
    "",
    "## JUMP regime — the second-price kink",
    "",
    "The mechanism is two polynomial patches over Q[s, t, w]; the patch rules are constant, so",
    "the per-patch links hold trivially (labelled honestly) — the content is at the kink:",
    "",
    table(["patch", "[E] / [G]", "[I] readoff"], patchRows),
    "",
    "Both patches are Groves under the SAME gauge h = w (the Clarke pivot): second price is",
    "piecewise-Groves with a common gauge; the kink only switches the selection.",
    "",
    table(["probe", "law", "machine"], gluingRows),
    "",
    "The utility jumps at the kink by exactly t - w (the true-type gap), the payment by w, the",
    "allocation by 1 — and the gluing identity [u] = t*[x] - [p] closes exactly. The charge's",
    "one-sided limits are 0 and -(t-w) for a true winner (and the signed -(t-w), 0 for a true",
    "loser — forcing a win you should not take costs exactly the true-type gap). The",
    "across-kink integration step is the Milgrom-Segal envelope (MS02), executed exactly.",
    "",
    table(["mechanism", "the counterfeit's cover", "the conviction"], convictRows),
    "",
    "First price PASSES the gluing identity (it pays s, which equals w at the kink) — kink",
    "conditions alone do not certify DSIC. The composite checker demands per-patch [E] AND",
    "gluing; first price's winning patch carries residual exactly -1. The counterfeit",
    "certificate 'gluing => DSIC' is named and rejected.",
    "",
    "## CONTINUITY regime — the capacity wall of the quadratic family",
    "",
    "Types widened to [1/2, 5/2]^2 so the capacity wall binds at s* = w - 1 (the region",
    "v0.2.0's interior guard was built to avoid). The efficient allocation is the clamp",
    "max(0, (s-w+1)/2):",
    "",
    table(["probe", "chain", "machine"], wallRows),
    "",
    "Here NOTHING jumps: x, p, and the charge are continuous at the wall kink (zero",
    "polynomials with w symbolic). What jumps is the charge's FLUX — dG/ds breaks by exactly",
    "(t-w+1)/2 = x(t), the true allocation: the piecewise conservation law carries a surface",
    "term at the interface, the exact analog of a Rankine-Hugoniot condition. The interior",
    "charge is the SAME -(s-t)^2/4 as the unconstrained family; the wall-to-wall block is the",
    "weak-DSIC flat (charge 0 — every walled report is as good as truth), counted in the",
    "grid witness rather than hidden.",
    "",
    "## Honest boundary",
    "",
    "PROVED, machine-exact: per-patch chains and gluing in both regimes; the common-gauge",
    "structure of second price; the across-kink envelope (MS02) on rational pairs; the flux",
    "surface term at the wall. The per-patch second-price links are trivially zero (constant",
    "patch rules) — labelled, not inflated. NOT proved: the general measurable-space",
    "Green-Laffont theorem on the kink locus (GL79, cited); tie-breaking AT the kink point",
    "itself (the repo stays tie-free by construction — the wall flat is indifference, not a",
    "tie); the multi-agent wall combinatorics (here one wall, n = 2).",
    "",
  );
  const file = writeReport("exp7-kink.md", lines.join("\n"));

  if (failures.length > 0) {
    console.error("EXP7 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP7 OK — ${file}`);
  }
}

run();

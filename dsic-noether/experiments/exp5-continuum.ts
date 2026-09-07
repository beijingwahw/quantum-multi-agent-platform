/**
 * EXP5 — the continuum derivation, executed: Noether 1918 -> Green-Laffont.
 *
 * The excluded boundary of v0.1.0 ("a formal derivation of Green-Laffont
 * from Noether's 1918 continuum theorem is NOT proved") is executed here at
 * the smooth layer, on the quadratic divisible-good family, in EXACT
 * rational polynomial arithmetic — every identity is the ZERO POLYNOMIAL,
 * which proves it for every type profile in the region at once.
 *
 * Sections: T5 the continuum forms + Helmholtz; T6 Noether I (charge
 * conservation along the gauge orbit); T7 Noether II (the gauge identity +
 * the classification = Green-Laffont uniqueness); T8 the assembled chain;
 * K1-K4 the four boundary controls.
 */
import { Rng } from "../src/core/rng.js";
import { pAdd, pConst, pDeriv, pIsZero, pScale, pSub, pSubstRat, pVar, rMul, rStr, rSub, rat, type Poly, type Rat } from "../src/continuum/poly.js";
import * as gl from "../src/continuum/green-laffont.js";
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

  // ---------- T5: the continuum forms + Helmholtz ----------
  const t5Rows: string[][] = [];
  {
    const eff3 = gl.twoGoodOwnAllocation(3);
    exact("T5 efficient two-good Jacobian symmetric (d alpha = 0)", gl.allocationClosednessResidual(eff3.x1, eff3.x2));
    t5Rows.push(["efficient rule (n=3, 2 goods)", "d alpha = 0", "0 (coefficient-wise)"]);
    for (const c of [rat(1, 7), rat(-2, 9)]) {
      const skew = gl.skewRule(c);
      const res = gl.allocationClosednessResidual(skew.x1, skew.x2);
      const expected = pConst(skew.x1.vars, rMul(rat(-2), c));
      exact(`T5 skew c=${rStr(c)} closedness residual == -2c`, pSub(res, expected));
      const loop = gl.rectangleCycleIntegral(skew.x1, skew.x2, rat(2, 5), rat(2, 5), rat(1, 5), rat(1, 5), rat(1, 2), rat(1, 2));
      const expectedLoop = rMul(rMul(rMul(rat(-2), c), rat(1, 5)), rat(1, 5));
      require(`T5 skew c=${rStr(c)} rectangle cycle == -2cwh`, rSub(loop, expectedLoop).n === 0n, `${rStr(loop)}`);
      // the positive cycle: same loop, opposite orientation
      const positive = loop.n < 0n ? rMul(loop, rat(-1)) : loop;
      require(`T5 skew c=${rStr(c)} positive cycle exists`, positive.n > 0n, rStr(positive));
      t5Rows.push([`skew rule c=${rStr(c)}`, `residual -2c = ${rStr(rMul(rat(-2), c))}`, `cycle -2cwh = ${rStr(loop)}; +${rStr(positive)} on the reversed orientation`]);
    }
    const loop0 = gl.rectangleCycleIntegral(eff3.x1, eff3.x2, rat(2, 5), rat(2, 5), rat(1, 5), rat(1, 5), rat(1, 2), rat(1, 2));
    require("T5 efficient rectangle cycle exactly 0", rSub(loop0, rat(0)).n === 0n, rStr(loop0));
    t5Rows.push(["efficient rule rectangle loop", "exact edge integration", `${rStr(loop0)} (exact 0)`]);
  }

  // ---------- the chain [E][I][S][G], n = 2, 3 ----------
  const chainRows: string[][] = [];
  for (const n of [2, 3]) {
    const f = gl.makeFamily(n);
    const s0 = rat(2, 5);
    exact(`[E] envelope n=${n}`, gl.envelopeResidual(f, gl.grovesPayment(f)));
    const readoff = gl.gaugeReadoff(f, gl.grovesPayment(f), s0);
    require(`[I] gauge readoff n=${n} carries no own-report monomials`, glReadoffClean(readoff), "s-monomials present");
    exact(`[I] readoff == anchored Groves payment n=${n}`, pSub(readoff, pSubstRat(gl.grovesPayment(f), 0, s0)));
    exact(`[S] welfare stationarity n=${n}`, gl.welfareStationarityResidual(f));
    const gres = gl.grovesFormResidual(f, gl.grovesPayment(f));
    require(`[G] Groves form n=${n}: p + W_-i free of own-report monomials`, glReadoffClean(gres), "s-monomials present");
    exact(`[G] Groves residual == Clarke pivot n=${n}`, pSub(gres, gl.pivotH(f)));
    chainRows.push([String(n), "0 (coefficient-wise)", "0 (coefficient-wise)", "0 (coefficient-wise)", "clean (no s-monomials)"]);
  }

  // ---------- T6: the charge ----------
  const chargeRows: string[][] = [];
  for (const n of [2, 3]) {
    const f = gl.makeFamily(n);
    exact(`charge identity G = -(n-1)(s-t)^2/(2n), n=${n}`, gl.chargeIdentityResidual(n));
    exact(`charge == welfare-gap form Phi_t(x(s)) - Phi_t(x(t)), n=${n}`, pSub(gl.deviationGain(f, gl.grovesPayment(f)), gl.welfareGapForm(f)));
    const guard = gl.interiorGuard(n);
    require(`interior guard n=${n}`, guard.ok, `x range [${rStr(guard.lo)}, ${rStr(guard.hi)}]`);
    const grid = gl.chargeGridWitness(n, 8);
    require(`grid witness n=${n}: worst on-diagonal == 0`, grid.worst.n === 0n, rStr(grid.worst));
    require(`grid witness n=${n}: worst off-diagonal < 0`, grid.worstOffDiag.n < 0n, rStr(grid.worstOffDiag));
    chargeRows.push([String(n), `-(n-1)(s-t)^2/(2n) exact`, "0 (coefficient-wise)", `${rStr(grid.worstOffDiag)} < 0 at 81 grid points`]);
  }

  // ---------- T6: Noether I — gauge-orbit conservation ----------
  const rng = new Rng(20260907);
  const orbitRows: string[][] = [];
  for (let trial = 0; trial < 3; trial++) {
    const fExt = gl.makeFamily(3, ["eps"]);
    const g = gl.randomGauge(fExt, rng, 5);
    const touches = usesVar(g, 0) || usesVar(g, 1);
    require(`gauge trial ${trial} touches neither s nor t`, !touches, "gauge leaked into the report coordinate");
    exact(`N-I dG/deps = 0 (gauge-orbit charge conservation), trial ${trial}`, gl.gaugeOrbitDerivative(3, g));
    orbitRows.push([String(trial), "no s/t monomials", "0 (coefficient-wise)"]);
  }

  // ---------- T7: Noether II — the gauge identity + the classification ----------
  const classRows: string[][] = [];
  for (let trial = 0; trial < 3; trial++) {
    const f = gl.makeFamily(3);
    const g = gl.randomGauge(f, rng, 4);
    const p = pAdd(gl.grovesPayment(f), g);
    const cls = gl.classifyPayment(f, p, rat(2, 5));
    require(`N-II classify trial ${trial}: gauge kind`, cls.kind === "gauge", "convicted a legal gauge payment");
    if (cls.kind === "gauge") {
      exact(`N-II recovered h == anchored payment, trial ${trial}`, pSub(cls.h, pSubstRat(p, 0, rat(2, 5))));
      classRows.push([String(trial), "gauge", "recovered exactly (0 residual)"]);
    }
  }
  {
    const f = gl.makeFamily(3);
    const crime = pAdd(gl.grovesPayment(f), pScale(pVar(f.vars, 0), rat(3, 7)));
    const cls = gl.classifyPayment(f, crime, rat(2, 5));
    require("N-II conviction: p + (3/7)s is not on the orbit", cls.kind === "not-dsic", "smuggled through");
    classRows.push(["control p + (3/7)s", "NOT-DSIC", `convicted (${cls.kind === "not-dsic" ? cls.offending : 0} own-report monomials)`]);
  }

  // ---------- K1: the off-gauge crime ----------
  const k1Rows: string[][] = [];
  {
    const res = gl.offGaugeEnvelopeResidual(3);
    require("K1 envelope residual eps-coefficient == -1", res.epsCoeff.n === -1n && res.epsCoeff.d === 1n, rStr(res.epsCoeff));
    require("K1 constant term == 0", res.constantTerm.n === 0n, rStr(res.constantTerm));
    k1Rows.push(["envelope residual of p + eps*s", "exactly -eps", rStr(res.epsCoeff)]);
    const eps = rat(1, 20);
    const crime = gl.offGaugeCrime(3, eps);
    exact("K1 crime price is constant along the truthful fiber", pDeriv(crime.substituted, crime.f.tIdx));
    require("K1 crime price == eps^2 n/(2(n-1))", rSub(crime.gainAt, crime.expected).n === 0n, `${rStr(crime.gainAt)} vs ${rStr(crime.expected)}`);
    k1Rows.push([`profitable deviation at eps=${rStr(eps)}`, `s* = t - eps*n/(n-1), worth eps^2 n/(2(n-1))`, `${rStr(crime.gainAt)} (exact)`]);
  }

  // ---------- K2: non-efficient rules ----------
  const k2Rows: string[][] = [];
  {
    const f = gl.makeFamily(3);
    const s0 = rat(2, 5);
    for (const kappa of [rat(1, 2), rat(1), rat(2)]) {
      exact(`K2 kappa=${rStr(kappa)}: own envelope holds (implementable)`, gl.envelopeResidual(f, gl.kappaPayment(f, kappa, s0), gl.kappaRule(f, kappa)));
      const expected = pScale(pVar(f.vars, 0), rMul(rMul(kappa, rSub(rat(1), kappa)), rat(2, 3)));
      exact(`K2 kappa=${rStr(kappa)}: Groves drift == kappa(1-kappa)(n-1)/n * s`, pSub(gl.kappaGrovesDrift(f, kappa, s0), expected));
      k2Rows.push([`kappa = ${rStr(kappa)}`, "0 (coefficient-wise)", kappa.n === kappa.d ? "0 (the kappa = 1 slice IS Groves)" : rStr(rMul(rMul(kappa, rSub(rat(1), kappa)), rat(2, 3))) + " * s"]);
    }
    const c = rat(1, 5);
    const d = rat(9, 10);
    const cyc = gl.decreasingRuleCycle(rat(3, 5), rat(2, 5), c);
    require("K2 decreasing rule: positive 2-cycle", cyc.n > 0n, rStr(cyc));
    k2Rows.push(["decreasing rule x = 9/10 - s/5", "2-cycle gain", `${rStr(cyc)} > 0 (not implementable, ROC87)`]);
    const beta = rat(0);
    const dev = gl.decreasingProfitableDeviation(rat(1, 2), c, d, beta);
    require("K2 decreasing rule: profitable deviation against beta = 0 payment", dev.gain.n > 0n, rStr(dev.gain));
    k2Rows.push(["same rule, any affine payment", "exact deviation witness", `beta=0: s=${rStr(dev.s)}, gain ${rStr(dev.gain)}`]);
  }

  // ---------- K3: the annulus ----------
  const k3Rows: string[][] = [];
  {
    exact("K3 curl(omega) numerator == 0 (closed)", gl.windingCurlNumerator());
    const qt = gl.windingQuarterTurnCheck();
    exact("K3 quarter-turn dx-component", qt.pbPminusP);
    exact("K3 quarter-turn dy-component", qt.pbQminusQ);
    const ds = gl.diamondSideIdentities();
    exact("K3 diamond-side pullback numerator == 1", pSub(ds.pullbackNumerator, pConst(ds.pullbackNumerator.vars, rat(1))));
    exact("K3 antiderivative identity d/dt atan(2t-1) = 1/(2t^2-2t+1)", ds.antiderivativeCheck);
    const side = gl.diamondSideSimpson(4000);
    require("K3 side integral numeric == pi/2 (12 digits)", Math.abs(side - Math.PI / 2) < 1e-11, side.toPrecision(13));
    const total = 4 * side;
    require("K3 diamond loop == 2*pi (11 digits)", Math.abs(total - 2 * Math.PI) < 1e-10, total.toPrecision(13));
    k3Rows.push([
      "curl (closedness)", "0 (coefficient-wise)", "closed on the punctured plane",
    ], [
      "quarter-turn symmetry", "0 (coefficient-wise)", "all four sides integrate equally",
    ], [
      "side antiderivative", "2(2t^2-2t+1) - (1+(2t-1)^2) = 0 exact", `side = pi/2 numeric ${side.toPrecision(12)}`,
    ], [
      "diamond loop total", "4 * pi/2 = 2*pi exact", `numeric ${total.toPrecision(12)}`,
    ]);
  }

  // ---------- K4: the kink ----------
  const k4Rows: string[][] = [];
  {
    const pairs: Array<[Rat, Rat]> = [[rat(3, 5), rat(11, 20)], [rat(5, 8), rat(9, 16)]];
    for (const [a, b] of pairs) {
      const r = gl.secondPriceEnvelopePair(a, b, rat(1, 2));
      require(`K4 winning-region pairwise envelope (${rStr(a)} -> ${rStr(b)})`, r.ok, `${rStr(r.uDiff)} vs ${rStr(r.xStep)}`);
    }
    const jump = gl.secondPriceKinkJump(rat(1, 2), rat(1, 100));
    require("K4 kink jump == exactly 1", jump.n === 1n && jump.d === 1n, rStr(jump));
    k4Rows.push(["winning region theta_1 > theta_2", "U(theta') - U(theta) == theta' - theta", "bitwise on rational pairs"], ["crossing the diagonal by any eps > 0", "allocation jumps by exactly 1", rStr(jump)]);
  }

  // ---------- the report ----------
  lines.push(
    "# EXP5 — the continuum derivation, executed: Noether 1918 -> Green-Laffont",
    "",
    "The excluded boundary of v0.1.0, executed at the smooth layer. Stage: the quadratic",
    "divisible-good family (v = theta*a - a^2/2, sum a = 1) on Theta = [2/5, 3/5]^n — the",
    "efficient allocation x_j = theta_j - thetabar + 1/n is affine, and EVERY identity below",
    "is verified as the ZERO POLYNOMIAL in exact rational arithmetic: it holds for EVERY type",
    "profile in the region at once. The interior guard holds x in [" +
      rStr(gl.interiorGuard(3).lo) + ", " + rStr(gl.interiorGuard(3).hi) + "] (corners, exact).",
    "",
    "## T5 — the continuum 1-forms: closedness is the Helmholtz face",
    "",
    table(["rule", "closedness of alpha = x.ds", "witness"], t5Rows),
    "",
    "The report action S[gamma] = integral of x.ds along report paths has as its",
    "Euler-Lagrange equations the closedness d alpha = 0 (the inverse-problem face,",
    "OLV86) — and a payment with alpha = dp exists exactly when the Jacobian of x is",
    "symmetric. The efficient family's Jacobian is symmetric coefficient-wise; the skew",
    "family crosses the implementable locus exactly at c = 0 with cycle integral -2cwh.",
    "",
    "## The chain, assembled (T8): [E]nvelope -> [I]ntegration -> [S]tationarity -> [G]roves",
    "",
    table(["n", "[E] residual", "[S] residual", "[I] readoff", "[G] form"], chainRows),
    "",
    "- [E] DSIC => the payment's own-report derivative equals dV/da . dx/ds on the",
    "  truthful diagonal — residual the zero polynomial.",
    "- [I] fiber integration (the Poincare/FTC step) exhibits the gauge h(theta_-i):",
    "  the readoff p - (antiderivative) carries no own-report monomials and equals the",
    "  anchored Groves payment exactly.",
    "- [S] efficiency enters: sum_j (theta_j - x_j) . dx_j/ds = 0 (all marginal gaps",
    "  equal lambda and the allocations sum to 1) — residual the zero polynomial.",
    "- [G] p + W_-i(x) = the Clarke pivot exactly: p = h(theta_-i) - W_-i(x), the",
    "  Groves form, with exactly the gauge freedom (KSS11's second-theorem class).",
    "",
    "## T6 — Noether I, mechanism-native: the charge and its orbit conservation",
    "",
    table(["n", "charge closed form", "G == welfare gap", "grid witness"], chargeRows),
    "",
    "The charge (deviation gain) has the closed form -(n-1)(s-t)^2/(2n) — DSIC for this",
    "family by ordered-field arithmetic, equality iff s = t, independently witnessed on",
    "exact rational grids. Under the one-parameter gauge orbit p -> p + eps*g(theta_-i)",
    "the charge is CONSERVED: dG/deps is the zero polynomial for seeded random gauges —",
    "the Noether-I implication shape (invariance => conserved quantity), executed.",
    "",
    table(["gauge trial", "gauge purity", "dG/deps"], orbitRows),
    "",
    "## T7 — Noether II: the gauge identity and the classification (uniqueness, executed)",
    "",
    "The gauge group is C^infinity(Theta_-i) — transformations by arbitrary functions,",
    "Noether's second-theorem class. The identity it buys: the fiber derivative of every",
    "differential incentive identity annihilates the gauge direction (g has no s-monomials,",
    "so d/ds vanishes on it — the constraint system cannot see the gauge). The",
    "classification corollary IS Green-Laffont uniqueness: the solver reads the gauge",
    "off ANY DSIC payment exactly, and convicts off-orbit payments on sight.",
    "",
    table(["payment", "verdict", "evidence"], classRows),
    "",
    "## K1 — the off-gauge crime and its exact price",
    "",
    table(["probe", "law", "machine"], k1Rows),
    "",
    "p + eps*s (a payment that moves along the OWN-report coordinate) breaks the envelope",
    "by exactly -eps and buys a profitable deviation at s* = t - eps*n/(n-1) worth",
    "eps^2 n/(2(n-1)) — the crime and its price in closed form, exact.",
    "",
    "## K2 — efficiency is load-bearing: the kappa family and the decreasing rule",
    "",
    table(["rule", "own envelope", "Groves drift d/ds[p + W_-i]"], k2Rows),
    "",
    "The kappa-rule (efficient for the discounted profile kappa*s) is implementable —",
    "its own envelope holds for every kappa — but its Groves drift is exactly",
    "kappa(1-kappa)(n-1)/n * s: the Groves form holds ONLY on the kappa = 1 slice.",
    "The decreasing rule is not implementable at all: 2-cycle gain c(a-b)^2 > 0 exact.",
    "",
    "## K3 — topology is load-bearing: closed does NOT imply exact on an annulus",
    "",
    table(["probe", "law", "machine"], k3Rows),
    "",
    "The form (x dy - y dx)/(x^2+y^2) is closed (curl = 0 coefficient-wise) yet integrates",
    "to exactly 2*pi around the unit diamond — four equal sides by the quarter-turn",
    "symmetry (exact), each side pi/2 by the atan(2t-1) antiderivative identity (exact),",
    "numeric cross-check 6.2831853071796. On a NON-CONVEX type region the Poincare step",
    "[I] fails: closedness does not produce a potential — and no FINITE report set can",
    "host this phenomenon (every cycle through finitely many reports decomposes into",
    "triangles, so closed => exact always at the T2 layer). The annulus witness marks a",
    "theorem-shape that exists ONLY in the continuum.",
    "",
    "## K4 — smoothness is load-bearing: the kink locus of the second-price auction",
    "",
    table(["probe", "law", "machine"], k4Rows),
    "",
    "On both open regions of the second-price auction the envelope holds bitwise on",
    "rational pairs — the smooth chain runs; the diagonal (where the allocation jumps by",
    "exactly 1) is where the chain's hypotheses fail and the general measurable-space",
    "theorem (GL79, cited) takes over.",
    "",
    "## Honest boundary",
    "",
    "PROVED here, machine-exact: every link of the chain on the smooth convex layer,",
    "both directions (Groves form => DSIC by the closed-form charge; DSIC => Groves form",
    "by [E]+[I]+[S]); Noether I as orbit conservation of the charge; Noether II as the",
    "gauge identity whose moduli reading is uniqueness; the four controls marking where",
    "gauge-orthogonality (K1), efficiency (K2), convexity (K3), and smoothness (K4) are",
    "load-bearing. NOT proved, quoted: the general Green-Laffont theorem for measurable",
    "type spaces and nonsmooth mechanisms (GL79) — the kink locus K4 is its territory;",
    "Green/Poincare as general analytic theorems (SPI65) — here they are executed as",
    "exact polynomial integration on a convex box; Noether's theorems as general",
    "statements (NOE18, KSS11) — their mechanism INSTANCES are what the machine holds.",
    "",
  );
  const file = writeReport("exp5-continuum.md", lines.join("\n"));

  if (failures.length > 0) {
    console.error("EXP5 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP5 OK — ${file}`);
  }
}

function glReadoffClean(p: Poly): boolean {
  // the readoff/gauge must carry no monomial that involves the own-report
  // coordinate (variable index 0)
  for (const k of p.mono.keys()) {
    if (Number(k.split(",")[0]) > 0) return false;
  }
  return true;
}

function usesVar(p: Poly, idx: number): boolean {
  for (const k of p.mono.keys()) {
    if (Number(k.split(",")[idx]) > 0) return true;
  }
  return false;
}

run();

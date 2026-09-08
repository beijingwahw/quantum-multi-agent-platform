/**
 * EXP6 — the non-quadratic face (v0.3.0): the quartic family on both sides of
 * the polynomial boundary.
 *
 * T9-A: the chain closes on the uncoupled quartic family (v = tau^3 a - a^4/4,
 * one private good per agent, tau = theta^(1/3) — the reparametrization under
 * which the efficient allocation is polynomial). Every link the zero
 * polynomial; the charge -(s-t)^2(s^2+2st+3t^2)/4 with a sum-of-squares
 * factor; Noether I orbit conservation; Noether II classification; the kappa
 * control with Groves drift exactly kappa(1-kappa^3) s^3.
 *
 * T9-B: the no-polynomial certificate — on the COUPLED stage (sum a = 1, the
 * v0.2.0 stage) the quartic efficient allocation is NOT a polynomial in the
 * types: the chain does not break at a link, the ring cannot state it. Every
 * algebraic step of the refutation is machine-held, with controls proving the
 * checker sharp (degree-3 soluble accepted; the quadratic family's linear FOC
 * not convicted).
 */
import { Rng } from "../src/core/rng.js";
import {
  pAdd,
  pIsZero,
  pMono,
  pScale,
  pSub,
  pSubstRat,
  pVar,
  rCmp,
  rMul,
  rStr,
  rSub,
  rat,
  type Poly,
} from "../src/continuum/poly.js";
import * as gl from "../src/continuum/green-laffont.js";
import * as q from "../src/continuum/quartic.js";
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

  // ---------- T9-A: the chain on the uncoupled quartic family ----------
  const chainRows: string[][] = [];
  for (const n of [2, 3]) {
    const f = gl.makeFamily(n);
    const p = q.qGrovesPayment(f);
    exact(`T9-A [E] envelope n=${n}`, q.qEnvelopeResidual(f, p));
    const s0 = rat(1, 2);
    const readoff = q.qGaugeReadoff(f, p, s0);
    exact(`T9-A [I] readoff == anchored payment n=${n}`, pSub(readoff, pSubstRat(p, 0, s0)));
    const cls = q.qClassifyPayment(f, p, s0);
    require(`T9-A [I] readoff clean n=${n}`, cls.kind === "gauge", "own-report monomials present");
    exact(`T9-A [S] welfare stationarity n=${n}`, q.qWelfareStationarityResidual(f));
    exact(`T9-A [G] residual == the smooth gauge n=${n}`, pSub(q.qGrovesFormResidual(f, p), q.qDefaultGaugeH(f)));
    chainRows.push([String(n), "0 (coefficient-wise)", "0 (coefficient-wise)", "clean (no s-monomials)"]);
  }

  // ---------- T9-A: the charge ----------
  const chargeRows: string[][] = [];
  for (const n of [2, 3]) {
    const f = gl.makeFamily(n);
    exact(`T9-A charge identity n=${n}`, q.qChargeIdentityResidual(n));
    exact(`T9-A charge == welfare-gap form n=${n}`, pSub(q.qDeviationGain(f, q.qGrovesPayment(f)), q.qWelfareGapForm(f)));
    exact(`T9-A sum-of-squares factor n=${n}`, q.qChargeSosResidual(f));
    const grid = q.qChargeGridWitness(n, 8);
    require(`T9-A grid witness n=${n}: on-diagonal 0`, grid.worst.n === 0n, rStr(grid.worst));
    require(`T9-A grid witness n=${n}: off-diagonal < 0`, grid.worstOffDiag.n < 0n, rStr(grid.worstOffDiag));
    chargeRows.push([String(n), "-(s-t)^2(s^2+2st+3t^2)/4 exact", "(s+t)^2+2t^2 exact", `${rStr(grid.worstOffDiag)} < 0 at 81 grid points`]);
  }

  // ---------- T9-A: Noether I ----------
  const rng = new Rng(20260908);
  const orbitRows: string[][] = [];
  for (let trial = 0; trial < 3; trial++) {
    const fExt = gl.makeFamily(3, ["eps"]);
    const g = q.qRandomGauge(fExt, rng, 5);
    let touches = false;
    for (const k of g.mono.keys()) {
      const e = k.split(",").map(Number);
      if ((e[0] as number) > 0 || (e[1] as number) > 0) touches = true;
    }
    require(`T9-A gauge trial ${trial} touches neither s nor t`, !touches, "gauge leaked");
    exact(`T9-A N-I dG/deps = 0, trial ${trial}`, q.qGaugeOrbitDerivative(3, g));
    orbitRows.push([String(trial), "no s/t monomials", "0 (coefficient-wise)"]);
  }

  // ---------- T9-A: Noether II + the kappa control ----------
  const classRows: string[][] = [];
  {
    const f = gl.makeFamily(3);
    const s0 = rat(1, 2);
    const g = q.qRandomGauge(f, rng, 4);
    const withGauge = pAdd(q.qGrovesPayment(f), g);
    const cls = q.qClassifyPayment(f, withGauge, s0);
    require("T9-A N-II random gauge classified as gauge", cls.kind === "gauge", "convicted a legal gauge payment");
    if (cls.kind === "gauge") {
      exact("T9-A N-II recovered h == anchored payment", pSub(cls.h, pSubstRat(withGauge, 0, s0)));
      classRows.push(["random gauge", "gauge", "recovered exactly (0 residual)"]);
    }
    const crime = pAdd(q.qGrovesPayment(f), pScale(pVar(f.vars, 0), rat(3, 7)));
    const clsCrime = q.qClassifyPayment(f, crime, s0);
    require("T9-A N-II conviction: p + (3/7)s off orbit", clsCrime.kind === "not-dsic", "smuggled through");
    classRows.push(["control p + (3/7)s", "NOT-DSIC", "convicted on sight"]);
  }
  const kappaRows: string[][] = [];
  {
    const f = gl.makeFamily(3);
    const s0 = rat(1, 2);
    for (const kappa of [rat(1, 2), rat(1), rat(2)]) {
      exact(`T9-A kappa=${rStr(kappa)}: own envelope holds`, q.qEnvelopeResidual(f, q.qKappaPayment(f, kappa, s0), q.qKappaRule(f, kappa)));
      const coef = rMul(kappa, rSub(rat(1), rMul(kappa, rMul(kappa, kappa))));
      exact(`T9-A kappa=${rStr(kappa)}: Groves drift == kappa(1-kappa^3)s^3`, pSub(q.qKappaGrovesDrift(f, kappa, s0), pScale(pMono(f.vars, [3, 0, 0, 0], rat(1)), coef)));
      kappaRows.push([
        `kappa = ${rStr(kappa)}`,
        "0 (coefficient-wise)",
        kappa.n === kappa.d ? "0 (the kappa = 1 slice IS Groves)" : `${rStr(coef)} * s^3`,
      ]);
    }
    const cyc = q.qKappaTwoCycle(rat(3, 2), rat(1, 2), rat(-1, 5));
    require("T9-A kappa = -1/5: positive 2-cycle -kappa(a-b)^2", rCmp(cyc, rat(0)) > 0, rStr(cyc));
    kappaRows.push(["kappa = -1/5", "2-cycle gain", `${rStr(cyc)} > 0 (not implementable, ROC87)`]);
  }

  // ---------- T9-B: the certificate ----------
  const certRows: string[][] = [];
  {
    exact("T9-B factor identity (P-Q)(P^2+PQ+Q^2) = P^3-Q^3", q.certFactorIdentity());
    certRows.push(["factor identity in Q[P,Q]", "degree bookkeeping basis", "0 (coefficient-wise)"]);
    exact("T9-B sum-of-squares A^2+AB+B^2 = (A+B/2)^2+(3/4)B^2", q.certSosIdentity());
    certRows.push(["leading-coefficient positivity", "(A+B/2)^2+(3/4)B^2 > 0 unless A=B=0", "0 (coefficient-wise)"]);
    for (const d of [1, 2, 3]) {
      const w = q.certTopCoeffSlice(d);
      require(`T9-B top-coefficient slice d=${d}`, w.matches && w.noOvershoot, `maxExp=${w.maxExp}`);
      certRows.push([`generic P, Q of degree ${d}`, `t^${2 * d}-slice = q_d^2+q_d p_d+p_d^2`, "exact, nothing above"]);
    }
    const cert = q.coupledQuarticCertificate(rat(1, 2));
    require("T9-B RHS on the others-fixed line has degree exactly 1", cert.rhsDegree === 1, String(cert.rhsDegree));
    require("T9-B degree arithmetic refutes (no feasible (d, e))", cert.verdict.refuted, JSON.stringify(cert.verdict.feasible));
    require("T9-B the assembled certificate refutes", cert.refuted, "a step was nonzero");
    certRows.push(["degree arithmetic e + 2d = 1, d = 0 => e = 0", "NO solution", "refuted"]);
  }
  const controlRows: string[][] = [];
  {
    const c3 = q.certControlDegreeThree();
    require("T9-B control: degree 3 NOT refuted", !c3.verdict.refuted, "over-refuted");
    exact("T9-B control: (t-1)(t^2+t+1) = t^3-1 (the explicit solution)", c3.solutionResidual);
    controlRows.push(["RHS degree 3", "feasible (d, e) = (1, 1)", "X_1 = 1, X_2 = t solves it exactly"]);
    const cq = q.certControlQuadratic();
    require("T9-B control: quadratic linear FOC soluble", cq.solutionExists, "the quadratic family was wrongly convicted");
    exact("T9-B control: affine allocation satisfies x_2 - x_1 = theta_2 - theta_1", cq.focResidual);
    controlRows.push(["quadratic FOC (linear in x)", "affine solution exists", "0 residual — not convicted"]);
    const fake = q.fakeAffineFOCResidual();
    require("T9-B smuggling control: affine allocation as quartic-efficient is NONZERO", !pIsZero(fake), "counterfeit accepted");
    controlRows.push(["affine allocation vs cubic FOC", "convicted", "nonzero residual (named by pAssertZero)"]);
  }

  // ---------- the report ----------
  lines.push(
    "# EXP6 — the non-quadratic face: the quartic family on both sides of the polynomial boundary",
    "",
    "T9-A: on the uncoupled quartic family (v = tau^3 a - a^4/4, one private good per agent,",
    "tau = theta^(1/3)) the efficient rule x_j = tau_j is polynomial and the WHOLE chain closes",
    "with every identity the zero polynomial. The charge acquires a new closed form — a square",
    "times a positive-definite quadratic — and DSIC is ordered-field arithmetic. HONEST LABEL:",
    "the stage is externality-free (others' reports never move x_i; the Clarke pivot payment is",
    "identically 0); the coupling that the quadratic stage carried is exactly what T9-B proves",
    "unreachable in the polynomial ring for quartic costs.",
    "",
    "## T9-A — the chain, assembled on the quartic family",
    "",
    table(["n", "[E]+[S] residuals", "[I] readoff", "[G] form"], chainRows),
    "",
    "## T9-A — the charge and Noether I",
    "",
    table(["n", "closed form", "positive-definite factor", "grid witness"], chargeRows),
    "",
    "G(s;t) = -(s-t)^2 (s^2+2st+3t^2)/4 with s^2+2st+3t^2 = (s+t)^2 + 2t^2 — a sum of squares,",
    "so G <= 0 with equality iff s = t (global — no region hypothesis needed). This is NOT the",
    "quadratic family's square charge: the quartic wraps the square in a positive-definite form.",
    "",
    table(["gauge trial", "gauge purity", "dG/deps"], orbitRows),
    "",
    "## T9-A — Noether II and the kappa control",
    "",
    table(["payment", "verdict", "evidence"], classRows),
    "",
    table(["rule", "own envelope", "Groves drift d/ds[p + W_-i]"], kappaRows),
    "",
    "The kappa-rule (efficient for the kappa-discounted profile) is implementable for every",
    "kappa > 0 but its Groves drift is exactly kappa(1-kappa^3) s^3 — Groves only on the",
    "kappa = 1 slice (kappa = 0 is the degenerate no-trade slice, noted). kappa < 0 has a",
    "positive Rochet 2-cycle -kappa(a-b)^2.",
    "",
    "## T9-B — the no-polynomial certificate: the coupled quartic stage",
    "",
    "On the v0.2.0 stage (one divisible good, sum a_j = 1, intercept types) the quartic FOC",
    "x_j^3 = theta_j - lambda forces x_2^3 - x_1^3 = theta_2 - theta_1; on the others-fixed",
    "line the RHS has degree exactly 1, while the LHS factors as",
    "(X_2-X_1)(X_2^2+X_2X_1+X_1^2) with the quadratic factor of degree 2d EXACTLY (its",
    "leading coefficient q_d^2+q_d p_d+p_d^2 = (q_d+p_d/2)^2 + (3/4)p_d^2 > 0). Degree",
    "arithmetic e + 2d = 1 with d = 0 => e = 0 has no solution: NO polynomial allocation —",
    "the chain does not break at a link; the polynomial ring cannot state it.",
    "",
    table(["certificate step", "law", "machine"], certRows),
    "",
    "The d-uniformity of the top-coefficient step (i + j = 2d with i, j <= d forces i = j = d)",
    "is witnessed at generic symbolic coefficients for d = 1..3 and holds monomial-wise for",
    "all d. Controls below prove the checker convicts exactly the cubic shape:",
    "",
    table(["control", "verdict", "evidence"], controlRows),
    "",
    "The exponential family (v = theta*a - e^a, x = ln(theta - lambda)) fails one level",
    "earlier — transcendental FOC inversion — and is CITED as outside the certificate's",
    "algebraic scope, not machine-claimed.",
    "",
    "## Honest boundary",
    "",
    "PROVED, machine-exact: the full chain on the uncoupled quartic family (both directions —",
    "Groves form by [E]+[I]+[S]+[G], DSIC by the sum-of-squares charge); Noether I orbit",
    "conservation and Noether II classification on the new family; the no-polynomial",
    "certificate for the coupled quartic stage with sharp controls. NOT proved: polynomial",
    "exactness of any EXTERNALITY-BEARING quartic mechanism (the certificate refutes the",
    "natural one); rational (as opposed to polynomial) non-solvability would need the",
    "arithmetic of the Fermat cubic — CITED, not executed here.",
    "",
  );
  const file = writeReport("exp6-quartic.md", lines.join("\n"));

  if (failures.length > 0) {
    console.error("EXP6 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP6 OK — ${file}`);
  }
}

run();

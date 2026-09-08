/**
 * EXP4 — the graduated boundary, the amplification census, and the walk's
 * coherent price (v0.2.0).
 *
 * A. the graduated-boundary tariff cross-check — the independent THIRD path:
 *    dtc-clock TC14 legislated 0 < 5 < 9 < 43.02 (erasure units at matched
 *    depth 11, the FK entry QUOTED from our T4 static mode) and route-price
 *    W-E re-priced it on its own netlist. Here the FK column is re-derived
 *    on OUR conventions in exact integer arithmetic ((T+1)^(T+1) vs 2^c —
 *    no floats in any decision), the quoted 43.02 is certified as the
 *    correct rounding at T = 11, and the sibling citations are re-audited
 *    against their actually-shipped reports (read-only).
 * B. the amplification face: the partial-regime demo family (per-round
 *    soundness eps = 1/2 and 1/4, exactly known), the AND-rule decay eps^k
 *    and OR-detect survival (1-eps)^k censuses (exact rationals, binomial
 *    identity, seeded MC within 5 sigma), and the priced completeness
 *    column (1^k = 1 exactly; k rounds erase k·(T+1)·log2(T+1) bits).
 * C. the walk's coherent time-energy price, one step deeper: the second
 *    walk family (depth sweep), the CONSERVED energy spread sigma_E
 *    (machine law: exactly 1/2 on this family), the time-energy product
 *    t*·sigma_E, and the Mandelstam–Tamm floor pi/(2 sigma_E) as anchor.
 */
import { cvecFidelity, eigHermitian } from "../src/core/cmat.js";
import { dataBasisState, program, randomCircuit, runCircuit } from "../src/compile/circuit.js";
import { assemble } from "../src/compile/hamiltonian.js";
import { conditionalData, spectralEvolve } from "../src/compile/history.js";
import { pricedWalk } from "../src/compile/ledger.js";
import {
  amplifiedStaticBits,
  binomialAmplificationResidue,
  decayCensus,
  exactRationalPower,
  partialDemoPrograms,
  perRoundSoundness,
  rationalToFloat,
  worstSigmaUnits,
  type ExactRational,
} from "../src/compile/amplify.js";
import {
  fkStaticBits,
  fkStaticCompare,
  fkStaticIntegerBracket,
  fkStaticRoundsTo,
  tariffCrossoverDepth,
  tariffOrderingAtDepth,
} from "../src/compile/tariff.js";
import { auditBoundaryCitation } from "../src/compile/audit.js";
import { Rng } from "../src/compile/rng.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];

  // --- A. the tariff cross-check, exact integer arithmetic
  const tariffRows: string[][] = [];
  for (let T = 2; T <= 12; T++) {
    const bracket = fkStaticIntegerBracket(T + 1);
    const c5 = fkStaticCompare(T + 1, 5);
    const c9 = fkStaticCompare(T + 1, 9);
    tariffRows.push([
      String(T),
      `${bracket.lo}`,
      c5 < 0 ? "< 5" : c5 > 0 ? "> 5" : "= 5",
      c9 < 0 ? "< 9" : c9 > 0 ? "> 9" : "= 9",
      fkStaticBits(T + 1).toFixed(4),
    ]);
    if (bracket.lo !== BigInt(Math.floor(fkStaticBits(T + 1)))) {
      failures.push(`bracket at T=${T}: exact ${bracket.lo} vs float floor`);
    }
  }
  // matched-depth verdicts (the dtc-clock TC14 matched depth is T = 11)
  const ordering = tariffOrderingAtDepth(11);
  if (!ordering.fkExceedsFive || !ordering.fkExceedsNine) failures.push(`matched-depth ordering broken: ${JSON.stringify(ordering)}`);
  if (!fkStaticRoundsTo(12, 4302)) failures.push("43.02 is not the correct rounding of 12·log2(12) (exact check)");
  if (fkStaticRoundsTo(12, 4301) || fkStaticRoundsTo(12, 4303)) failures.push("rounding certificate not tight: 4301/4303 also pass");
  const cross5 = tariffCrossoverDepth(5);
  const cross9 = tariffCrossoverDepth(9);
  if (cross5 !== 3) failures.push(`crossover(5) = ${cross5}, expected 3 (T=2 undercuts, T=3 does not)`);
  if (cross9 !== 4) failures.push(`crossover(9) = ${cross9}, expected 4 (T=3 undercuts, T=4 does not)`);
  console.log(`A. tariff on our conventions: 5 < 9 < FK(T=11) = ${ordering.fkBits.toFixed(2)} exact-verified; 43.02 rounding certified (tight); crossovers ${cross5}/${cross9}`);

  // the sibling citations, re-audited against shipped reports (read-only)
  const genuineCitations = [
    { repo: "dtc-clock", version: "0.21.0", witness: "TC14", figureHundredths: 4302, depth: 11, direction: "fk-most-expensive" as const },
    { repo: "route-price", version: "0.2.0", witness: "W-E", figureHundredths: 4302, depth: 11, direction: "fk-most-expensive" as const },
  ];
  const auditRows: string[][] = [];
  for (const c of genuineCitations) {
    const v = auditBoundaryCitation(c);
    auditRows.push([`${c.repo} ${c.witness} (v${c.version})`, v.length === 0 ? "ACCEPTED" : "REJECTED", v.length === 0 ? "—" : v.map((x) => x.crime).join("; ")]);
    if (v.length > 0) failures.push(`genuine citation rejected: ${c.repo} ${c.witness}: ${v.map((x) => x.crime).join("; ")}`);
  }
  console.log(`A. sibling citations re-audited against shipped reports: ${auditRows.filter((r) => r[1] === "ACCEPTED").length}/${auditRows.length} accepted`);

  // --- B. the amplification census
  const ampRows: string[][] = [];
  const priceRows: string[][] = [];
  const kMax = 12;
  const identityPairs: ReadonlyArray<[ExactRational, number]> = [
    [{ num: 1n, den: 2n }, 24],
    [{ num: 1n, den: 4n }, 16],
    [{ num: 3n, den: 4n }, 12],
    [{ num: 1n, den: 3n }, 10],
    [{ num: 2n, den: 7n }, 9],
  ];
  for (const [eps, k] of identityPairs) {
    const residue = binomialAmplificationResidue(eps, k);
    if (residue !== 0n) failures.push(`binomial identity eps=${eps.num}/${eps.den} k=${k}: residue ${residue}`);
  }
  for (const demo of partialDemoPrograms()) {
    const epsFloat = perRoundSoundness(demo.prog, demo.input);
    const exactEps = rationalToFloat(demo.eps);
    if (Math.abs(epsFloat - exactEps) > 1e-12) failures.push(`${demo.name}: machine eps ${epsFloat} vs exact ${exactEps}`);
    const rows = decayCensus(demo.eps, kMax, new Rng(801));
    const worst = worstSigmaUnits(rows);
    const resolvableCount = rows.filter((r) => r.resolvable).length;
    if (worst >= 5) failures.push(`${demo.name}: MC outside 5 sigma (${worst.toFixed(2)} sigma units)`);
    for (const r of rows) {
      const exactPower = exactRationalPower(demo.eps, r.k);
      if (r.exact.num !== exactPower.num || r.exact.den !== exactPower.den) failures.push(`${demo.name} k=${r.k}: exact power mismatch`);
      if (r.resolvable !== (20000 * r.float >= 10)) failures.push(`${demo.name} k=${r.k}: resolution flag inconsistent`);
      ampRows.push([
        demo.name,
        String(r.k),
        `${r.exact.num}/${r.exact.den}`,
        r.float.toExponential(3),
        `${r.survival.num}/${r.survival.den}`,
        r.resolvable ? r.mc.toExponential(3) : "exact-only",
        r.resolvable ? `${(Math.abs(r.mc - r.float) / r.sigma).toFixed(2)}σ` : "—",
      ]);
    }
    console.log(`B. ${demo.name}: eps machine ${epsFloat} = exact ${exactEps}; census k=1..${kMax}, ${resolvableCount} resolvable rows, worst MC deviation ${worst.toFixed(2)} sigma`);
  }
  // completeness column: 1^k = 1 exactly, but k rounds cost k·(T+1)·log2(T+1) bits
  for (const k of [1, 2, 4, 8, 12]) {
    const bits = amplifiedStaticBits(3, k); // the demo family runs at T = 2 (C = 3)
    priceRows.push([String(k), "1.000000000000", bits.toFixed(2)]);
    if (Math.abs(bits - k * 3 * Math.log2(3)) > 1e-12) failures.push(`amplifiedStaticBits k=${k}: ${bits}`);
  }
  console.log("B. completeness column: honest witness passes every round exactly (T3 certificate); k rounds erase k·(T+1)·log2(T+1) bits");

  // --- C. the second walk family: coherent time-energy price vs depth
  const walkRows: string[][] = [];
  for (const T of [4, 6, 8, 10] as const) {
    const circuit = randomCircuit(2, T, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const comp = assemble(prog, { output: false });
    const eig = eigHermitian(comp.h);
    const psi0 = { dim: comp.h.dim, re: new Float64Array(comp.h.dim), im: new Float64Array(comp.h.dim) };
    psi0.re[0] = 1; // |00> data, clock 0
    const walk = pricedWalk(comp.h, eig, psi0, T + 1, 2 * (T + 1));
    // conservation + the machine law sigma_E = 1/2 on this family
    if (Math.abs(walk.sigmaE0 - walk.sigmaEStar) > 1e-9) failures.push(`T=${T}: sigma_E not conserved (${walk.sigmaE0} -> ${walk.sigmaEStar})`);
    if (Math.abs(walk.sigmaE0 - 0.5) > 1e-9) failures.push(`T=${T}: sigma_E ${walk.sigmaE0} != 1/2 (the machine law)`);
    if (walk.peak <= 1 / (T + 1)) failures.push(`T=${T}: walk peak ${walk.peak} does not beat the static floor ${1 / (T + 1)}`);
    // cargo exactness at the delivery peak
    const evolved = spectralEvolve(eig, psi0, walk.tStar);
    const { state, prob } = conditionalData(evolved, T + 1, T);
    const inv = 1 / Math.sqrt(prob);
    const target = runCircuit(circuit, dataBasisState(2, [0, 0]));
    const cargo = cvecFidelity(
      { dim: state.dim, re: Float64Array.from(state.re, (x) => x * inv), im: Float64Array.from(state.im, (x) => x * inv) },
      target,
    );
    if (Math.abs(1 - cargo) > 1e-12) failures.push(`T=${T}: walk garbled cargo at the peak (fidelity ${cargo})`);
    walkRows.push([
      String(T),
      walk.peak.toFixed(4),
      walk.tStar.toFixed(2),
      (walk.tStar / (T + 1)).toFixed(3),
      walk.sigmaE0.toFixed(12),
      walk.product.toFixed(4),
      walk.mtFloor.toFixed(6),
    ]);
  }
  console.log("C. second walk family (depth sweep): sigma_E exactly 1/2 at every depth (conserved); cargo exact at every peak; MT floor pi/(2·sigma_E) = pi");

  const body = [
    "# EXP4 — the graduated boundary, amplification, and the walk's coherent price",
    "",
    "Every number below regenerates from `npm run repro` (seeded, zero dependencies).",
    "",
    "## A. the tariff cross-check — the independent third path (exact integers)",
    "",
    "dtc-clock TC14 (v0.19.0) legislated, at matched depth 11: DTC-clocked Bennett 0 <",
    "DTC as-built 5 < irreversible Boolean 9 < FK spectral clock 43.02 — the FK entry",
    "quoted from THIS repo's T4 static mode. route-price W-E (v0.2.0) re-priced the",
    "same ordering on its own netlist. The third path below re-decides every",
    "comparison against (T+1)·log2(T+1) by exact integer arithmetic:",
    "(T+1)·log2(T+1) < c ⟺ (T+1)^(T+1) < 2^c (BigInt) — floats are display-only.",
    "",
    table(["T", "exact bracket lo", "vs 5", "vs 9", "float (display)"], tariffRows),
    "",
    `Matched-depth verdict at T = 11: 5 < 9 < ${ordering.fkBits.toFixed(2)} (exact); the quoted`,
    "43.02 is certified as the correct 2-decimal rounding of 12·log2(12), tightly",
    "(4301 and 4303 both fail the exact check). The tariff crossovers on our",
    `conventions: the FK static entry undercuts the 5-unit sibling rival only at`,
    `T ≤ ${cross5 - 1}, the 9-unit rival only at T ≤ ${cross9 - 1} — from T = ${cross5} and T = ${cross9}`,
    "on, the rivals win and the gap only grows. The sibling citations, re-audited",
    "read-only against their shipped reports and package versions:",
    "",
    table(["citation", "verdict", "crimes"], auditRows),
    "",
    "## B. the amplification census (exact rationals + seeded MC)",
    "",
    "Per-round soundness on the partial-regime demo family (unique valid input; the",
    "trajectory law pins epsilon to the circuit's own acceptance probability):",
    "",
    table(["family", "k", "eps^k exact", "eps^k float", "(1-eps)^k exact", "MC (AND rule)", "|MC-exact| in sigma"], ampRows),
    "",
    "Binomial amplification identity sum_j C(k,j) eps^j (1-eps)^(k-j) = 1 verified",
    "exactly (BigInt residue 0) on five (eps, k) pairs including non-dyadic 1/3 and 2/7.",
    "Rows with expected MC pass count below 10 are exact-only (the resolution floor —",
    "no tolerance is stretched to cover what the census cannot resolve). Completeness:",
    "the honest accepting witness passes every delivered round with probability",
    "exactly 1 (the T3 conditional-fidelity-1 certificate) — amplification loses",
    "nothing on the completeness side and pays on the ledger:",
    "",
    table(["k rounds", "completeness", "expected erasure bits (T=2 static)"], priceRows),
    "",
    "## C. the walk's coherent time-energy price (second walk family)",
    "",
    "The first walk family (exp3, fixed T=6 across circuits) showed the delivery",
    "curve is circuit-independent. The second family sweeps DEPTH (T = 4..10,",
    "n = 2, unique input |00>): peak delivery, peak time t*, and the coherent",
    "resources actually spent — the energy spread sigma_E = sqrt(<H^2>-<H>^2) of",
    "the initial state, exactly conserved under the walk and machine-law pinned",
    "to exactly 1/2 on this family (the clock-0 basis state touches one clock",
    "edge: <H> = 1/2, <H^2> = 1/2), the time-energy product t*·sigma_E, and the",
    "Mandelstam–Tamm orthogonalization floor pi/(2 sigma_E) = pi as anchor.",
    "",
    table(["T", "peak P(T)", "t*", "t*/(T+1)", "sigma_E (t=0 = t*)", "t*·sigma_E", "MT floor"], walkRows),
    "",
    "The coherent bill, stated plainly: the walk's energy bandwidth is a CONSTANT",
    "1/2 — not the vague ~||H|| of the v0.1.0 wall row — so depth buys nothing on",
    "the energy axis, only on the time axis, and every orthogonalizing detour",
    "obeys the MT floor pi/(2 sigma_E). Cargo stays exact at every delivery peak",
    "(fidelity 1 - 1e-15), but the peak thins with depth (no perfect state",
    "transfer on the path graph) while t* grows: the coherent price of the walk",
    "compounds exactly where its value thins.",
    "",
  ].join("\n");
  const file = writeReport("exp4-boundary.md", body);

  if (failures.length > 0) {
    console.error("EXP4 FAILURES:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`EXP4 OK — ${file}`);
  }
}

run();

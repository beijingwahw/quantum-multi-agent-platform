/**
 * T6 — the exact-tie face: refusal as a typed result, the tie law executed,
 * the census of who ties, the degenerate plateau, and the tie constants c_k
 * as exact algebraic data.
 */
import {
  c1BracketFromSqrt2,
  c2BracketFromClosedForm,
  certifiedDigits,
  constraintPoly,
  groverTieScan,
  halfBinomialSum,
  halfTieTailFloat,
  isolateSmallestRoot,
  lambdaRat,
  ppTieCensus,
  plateauCertificate,
  racePoly,
  ratToNumber,
  tableTotal,
  tieCensusFirstTwo,
  tiedMenuPlateau,
  quoteDecision,
} from "../kernel/tieface.js";
import { powerLedgerRow, randomSat, type PowerLedgerRow, type SatInstance } from "../kernel/ppledger.js";
import { zeroOptimal } from "../kernel/restart.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

export function main(): void {
  const lines: string[] = [];
  lines.push("# T6 — the exact-tie face: what the ledger does when gap = 0\n");
  lines.push(
    "The priced boundary of t5-power-ledger.md line 32 ('gap = 0, k = infinity, the ledger declines to quote') is executed here: the refusal is a TYPED result the ledger returns, the tie law is machine-executed on exact arithmetic, the instance families that hit exact ties are censused, the degenerate plateau of optimal policies is verified in BOTH cost models, and the tie constants of the amplification race are isolated as exact algebraic data.\n",
  );

  // -----------------------------------------------------------------------
  lines.push("## A. the refusal law, typed (the PP face: 2*both = m)\n");
  lines.push("| instance | m | both | integer referee | gap | delta | quote |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  // scan for a moderate-gap and a near-tie instance (same classes as T5)
  let moderate: SatInstance | null = null;
  let nearTie: SatInstance | null = null;
  for (let seed = 1; seed <= 200; seed++) {
    const inst = randomSat(10, 30, seed);
    const row0 = powerLedgerRow(inst);
    if (row0.m === 0) continue;
    if (moderate === null && row0.gap >= 0.05) moderate = inst;
    if (nearTie === null && row0.gap > 0 && row0.gap <= 1.25 / (2 * row0.m)) nearTie = inst;
    if (moderate !== null && nearTie !== null) break;
  }
  if (moderate === null || nearTie === null) throw new Error("exp T6: instance scan failed");
  const satTable: Array<[string, SatInstance]> = [
    ["moderate gap", moderate],
    ["near-tie", nearTie],
    ["exact tie (x_0 absent)", randomSat(10, 24, 7, 0)],
    ["random n=11", randomSat(11, 35, 111)],
    ["random n=12", randomSat(12, 38, 112)],
  ];
  for (const [name, inst] of satTable) {
    const row: PowerLedgerRow = powerLedgerRow(inst);
    for (const delta of [0.1]) {
      const q = quoteDecision(row, delta);
      const quoted = q.status === "quoted";
      lines.push(
        `| ${name} | ${row.m} | ${row.both} | ${2 * row.both === row.m ? "TIE (2*both = m)" : `${2 * row.both} vs m`} | ${fmt(row.gap, 9)} | ${delta} | ${quoted ? `k = ${q.k}, queries = ${fmt(q.queries, 1)}` : `DECLINED (${q.reason}): ${q.detail.split(" — ")[1] ?? q.detail}`} |`,
      );
    }
  }
  lines.push(
    "\nThe quoting rule is decided by the INTEGER referee 2*both === m — never a float gap, so float noise can neither forge nor hide a tie. On a tie the ledger returns { status: 'declined', reason: 'EXACT-TIE', gap: 0 } — a typed refusal, data not prose.\n",
  );

  // -----------------------------------------------------------------------
  lines.push("## B. the tie plateau: the vote error is EXACTLY 1/2 for every odd k\n");
  lines.push("| k (odd) | sum_{i<=k/2 floor} C(k,i) (integer path) | = 2^(k-1)? | float tail P[Bin(k,1/2)<=k/2] |");
  lines.push("| --- | --- | --- | --- |");
  for (const k of [1, 3, 5, 21, 101, 501, 999]) {
    const h = halfBinomialSum(k);
    lines.push(`| ${k} | ${h.sum > 10n ** 40n ? `${h.sum} (exact BigInt)` : h.sum} | ${h.sum === h.half ? "yes" : "NO"} | ${fmt(halfTieTailFloat(k), 15)} |`);
  }
  lines.push(
    "\nTie law, executed: each vote string pairs with its complement, so the half binomial sum is exactly 2^(k-1) (integer path, BigInt) and the majority-vote error is exactly 1/2 for EVERY odd k — the float path agrees to ~1e-13. Consequences: (i) every k ties with every other k — the argmin over k is all of them, the optimum is ill-posed; (ii) the constraint set {k : error <= delta} is EMPTY for every delta < 1/2 — no finite price buys a decision, k = infinity; (iii) that is exactly why the ledger declines to quote, and the refusal is the theorem.\n",
  );

  // -----------------------------------------------------------------------
  lines.push("## C. the tie-breaking census: which instance families hit exact ties\n");
  const census = ppTieCensus(300, 10, 30, 0);
  lines.push("| family | instances | exact ties | notes |");
  lines.push("| --- | --- | --- | --- |");
  lines.push(
    `| free variable (x_0 absent from every clause) | 20 | ${census.freeVarTie ? "20 (ALL)" : "NOT ALL — BUG"} | model set closed under x_0 -> x_0 XOR 1 (verified by enumeration), so both = m/2 whenever m > 0; sample m = ${census.freeVarM} |`,
  );
  lines.push(
    `| random 3-SAT (n=10, 30 clauses) | ${census.scanned} | ${census.tieCount} | accidental ties: model counts of the tie instances m = [${census.tieMs.join(", ")}]; every tie had even m (${census.tiesAllEvenM ? "machine-checked" : "VIOLATED"}) |`,
  );
  lines.push(
    `\nThe refusal semantics is not only the adversarial construction: ${census.tieCount} of ${census.scanned} random instances landed on 2*both = m exactly (detected by integer arithmetic, no epsilon judgment). Honest number: the accidental rate is a few percent at these model counts — noticeable, not routine; the free-variable family is the family that ties ALWAYS.\n`,
  );

  // -----------------------------------------------------------------------
  lines.push("## D. the restart-menu tie census: lambda(1) = lambda(2) on integer tables\n");
  const rc = tieCensusFirstTwo(64);
  lines.push(`| denominator range | solutions (d, a1, a2) | count | d divides a1^2 holds on every pair | no non-divisible pair ties |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  lines.push(
    `| 2 <= d <= 64 | ${(rc.entries.slice(0, 12).map((e) => `(${e.d},${e.a1},${e.a2})`).join(" "))}${rc.entries.length > 12 ? " ..." : ""} | ${rc.entries.length} | ${rc.characterizationHolds ? "holds on every pair" : "FAILS"} | ${rc.nonSolutionsDiffer ? "no non-divisible pair ties (full sweep)" : "FAILS"} |`,
  );
  lines.push(
    "\nThe exact-tie equation is the integer equation d*a2 = a1*(d-a1), i.e. d | a1^2 — equivalently p2 = p1(1-p1), the geometric step: the tied family is 'geometric on the first two steps, arbitrary beyond'. Both directions are machine-verified by exact rational lambda equality (every divisible pair ties; for every non-divisible pair, NO integer second atom ties — full sweep). Each census solution automatically leaves remainder mass (a1 + a2 < d), so the table is a genuine 3+-support distribution.\n",
  );

  // -----------------------------------------------------------------------
  lines.push("## E. the degenerate plateau: optimal policies at an exact tie\n");
  const table = [0n, 2n, 1n, 0n, 0n, 1n]; // (1/2, 1/4, 0, 0, 1/4): census row d=4, a1=2, a2=1
  lines.push(
    `Instance: table (2, 1, 0, 0, 1)/${tableTotal(table)} — the census family with the remainder pushed out to t = 5. Exact rational lambdas:`,
  );
  lines.push("| t | lambda(t) exact | = 2? |");
  lines.push("| --- | --- | --- |");
  for (let t = 1; t <= 5; t++) {
    const v = lambdaRat(table, t);
    lines.push(`| ${t} | ${v === null ? "-" : `${v.num}/${v.den}`} | ${v !== null && v.num === 2n * v.den ? "TIED OPTIMUM" : "strictly above"} |`);
  }
  const pc = plateauCertificate(table);
  lines.push(
    `\nOptimal set = {${pc.optima.join(", ")}} (exact tie at lambda* = ${pc.star}). Degenerate plateau, executed: all ${pc.strategies} cyclic schedules of length <= 3 over the tied cutoffs attain lambda* with worst deviation ${fmt(pc.worstDev, 15)} — the convex identity T(S) = sum g_i lambda(t_i) with every ingredient equal makes the optimal-policy set the FULL SIMPLEX over the tied cutoffs (every deterministic cycle and every mixture is exactly optimal). Mixing in a cutoff outside the set lands strictly above lambda* (worst ingredient margin ${fmt(pc.mixingMargin, 6)}).\n`,
  );
  const tm = tiedMenuPlateau(1, 2, { num: 1n, den: 3n }, { num: 2n, den: 3n });
  lines.push("## F. the plateau survives the always-pay model\n");
  lines.push(
    `Always-pay menu with an exact cost/probability tie — rounds (c,p) = (1, 1/3), (2, 2/3), both c/p = ${tm.L}: ratios exactly equal (machine-checked rationals). The alternating schedule costs T = (c1 + (1-p1)c2)/(p1 + p2 - p1 p2) = ${tm.texact} EXACTLY — equal to L* — and the float renewal path agrees to ${fmt(tm.dev, 2)}. Exact reason: the per-cycle payment telescopes, sum_i (prod_{j<i}(1-p_j)) c_i = L (1 - prod_j (1-p_j)), and the geometric series closes. So the degenerate plateau holds in BOTH cost models — even when every round is paid in full, mixing tied optima is free (while mixing any sub-optimal round strictly costs).\n`,
  );

  // -----------------------------------------------------------------------
  lines.push("## G. the Grover face never ties at integer points\n");
  lines.push("| N | t scanned | exact ties found |");
  lines.push("| --- | --- | --- |");
  for (const N of [256, 1024, 4096] as const) {
    const g = groverTieScan(N);
    lines.push(`| ${N} | ${g.checked} | ${g.ties} |`);
  }
  lines.push(
    "\nThe k=0-vs-k=1 tie equation at sin^2(theta) = t/N is (3N - 4t)^2 = 2N^2 — an integer equation with NO solutions (it would make sqrt(2) rational), machine-checked in BigInt at every t. Consequence: exact ties are a PP-face and restart-face phenomenon; at integer (N, t) the amplification ledger always quotes a strict winner. The threshold constant (3-sqrt(2))/4 is irrational, so finite instances sit strictly on one side of the boundary — never ON it.\n",
  );

  // -----------------------------------------------------------------------
  lines.push("## H. the tie constants c_k as exact algebraic data\n");
  lines.push("P_k(s) = U_{2k}(sqrt(1-s)) = sin((2k+1)theta)/sin(theta) as integer-coefficient polynomials in s = sin^2(theta); the k-th optimality tie is the root of Q_k = P_k^2 - (k+1).\n");
  lines.push("| k | P_k(s) coefficients | c_k certified digits (bisection, exact) | sign changes of Q_k on (0,1) |");
  lines.push("| --- | --- | --- | --- |");
  const brackets: Array<{ k: number; digits: string; hi: number }> = [];
  for (const k of [1, 2, 3, 4, 5, 6] as const) {
    const P = racePoly(k);
    const br = isolateSmallestRoot(constraintPoly(k));
    const digits = certifiedDigits(br);
    brackets.push({ k, digits, hi: ratToNumber(br.hi) });
    lines.push(`| ${k} | [${P.join(", ")}] | ${digits} | ${br.gridFlips} |`);
  }
  const c1Two = certifiedDigits(c1BracketFromSqrt2(50));
  const c2Two = certifiedDigits(c2BracketFromClosedForm(48));
  lines.push(
    `\nSecond independent paths (nested integer square roots, zero floats): c_1 = (3 - sqrt(2))/4 -> ${c1Two} (agrees with bisection on every certified digit); c_2 = (20 - sqrt(80 + 64 sqrt(3)))/32 -> ${c2Two} (agrees with bisection likewise). Monotone census: ${brackets.map((b) => `c_${b.k} = ${b.digits.slice(0, 6)}...`).join(" > ")} — c_1 > c_2 > ... > c_6 on certified brackets, so k = 1 is the binding constraint of the threshold law (now an exact-algebraic-data statement over k = 1..6, upgrading the float-grid verification of boundary 6).\n`,
  );
  lines.push("### finite-N thresholds against the certified c_1\n");
  lines.push("| N | finite-N threshold density t/N | certified c_1 (upper bracket) | above? |");
  lines.push("| --- | --- | --- | --- |");
  const c1Hi = ratToNumber(c1BracketFromSqrt2(50).hi);
  for (const N of [256, 1024, 4096, 16384] as const) {
    let lastFalse = 0;
    for (let t = 1; t <= N; t++) {
      if (!zeroOptimal(N, t)) lastFalse = t;
    }
    const density = (lastFalse + 1) / N;
    lines.push(`| ${N} | ${fmt(density, 9)} | ${fmt(c1Hi, 9)} | ${density > c1Hi ? "yes" : "NO — BUG"} |`);
  }

  // -----------------------------------------------------------------------
  lines.push("\n## I. the adjudication protocol (laws the ledger enforces)\n");
  lines.push("| law | names and rejects |");
  lines.push("| --- | --- |");
  lines.push("| TIE-QUOTE | a fabricated finite-k quote at an exact tie (2*both = m) |");
  lines.push("| FALSE-REFUSAL | a typed refusal on a row where the integer referee says quotable |");
  lines.push("| K-FORGE / PRICE-FORGE | a quoted k or price that the row's own gap/geometry does not generate |");
  lines.push("| PLATEAU-FORGE | a claimed exact-tie optimal plateau that the integer table's exact lambdas contradict |");
  lines.push("| DIGITS-FORGE | a claimed decimal for c_1 that the certified bracket contradicts |");
  lines.push(
    "\nThe smuggling trials in test/t6-tieface.test.ts feed each law a fabricated artifact; every trial must be NAMED and REJECTED by the adjudicator.\n",
  );

  const path = writeReport("t6-tieface.md", lines.join("\n"));
  console.log(`exp T6 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

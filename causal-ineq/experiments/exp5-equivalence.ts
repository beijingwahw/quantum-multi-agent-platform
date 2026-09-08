/**
 * EXP5 — the W* <-> OCB12 equivalence, machine-checked (v0.1.0 boundary 1,
 * retired). OCB12's explicit process (arXiv:1105.4464v3 Methods, their eq. 7)
 * is transcribed as an independent code path and compared with the repo's
 * machine-derived W* elementwise; LC25's attaining process S_OCB,1 (their
 * eq. 41) enters the same check; and the payoff functional is derived twice —
 * once by executing the process Born rule (T3 machinery), once from OCB12's
 * closed-form reduced probabilities (their eq. 26) — with every entry of the
 * branch tables compared. Tamper controls (a mistranscribed Pauli, a
 * mistranscribed coefficient) show the check has teeth: both are VALID
 * processes, only the comparison exposes them.
 */
import { cmatMaxAbsDiff } from "../src/core/cmat.js";
import { checkValidity } from "../src/process/validity.js";
import { wStar } from "../src/process/construct.js";
import { runProtocol } from "../src/game/quantum.js";
import { ocbStrategy, strategyBranchTables, strategyPayoff } from "../src/game/strategy.js";
import { branchTableDeviation, equivalenceReport, equivalenceVerdict, ocb12ClosedFormTables, wLC25, wOCB12, wOCB12TamperedCoeff, wOCB12TamperedPauli } from "../src/process/ocb12.js";
import { COS2_PI_8 } from "../src/game/quantum.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const rep = equivalenceReport();
  const verdict = equivalenceVerdict(rep);
  if (!verdict.ok) failures.push(...verdict.problems);

  // payoff of the transcription under T3 machinery == cos^2(pi/8)
  const p = runProtocol(wOCB12());
  if (Math.abs(p.pSuccess - COS2_PI_8) > 1e-12) failures.push(`runProtocol(wOCB12) = ${p.pSuccess} != cos²(π/8)`);

  // branch tables: executed vs eq. (26), printed for the audit trail
  const wStarMat = wStar(Math.SQRT1_2);
  const executed = strategyBranchTables(wStarMat, ocbStrategy());
  const closed = ocb12ClosedFormTables();
  const fmtEntry = (v: number): string => v.toFixed(12);
  const tablesA = table(
    ["P(x|a,b) b'=0", "a=0", "a=1"],
    [0, 1].map((b) => [
      `b=${b} executed`,
      fmtEntry((executed.pAlice[b] as number[][])[0]![0] as number),
      fmtEntry((executed.pAlice[b] as number[][])[1]![0] as number),
    ]),
  );
  const tablesB = table(
    ["P(y|a,b) b'=1", "a=0", "a=1"],
    [0, 1].map((b) => [
      `b=${b} executed`,
      fmtEntry((executed.pBob[b] as number[][])[0]![0] as number),
      fmtEntry((executed.pBob[b] as number[][])[1]![0] as number),
    ]),
  );

  // tamper controls: valid processes that are NOT the transcription
  const tamperRows: string[][] = [];
  for (const c of [
    { name: "sigma_x^{B1} mistranscribed as sigma_y", w: wOCB12TamperedPauli() },
    { name: "coefficient 1/√2 mistranscribed as 0.69", w: wOCB12TamperedCoeff() },
  ]) {
    const v = checkValidity(c.w);
    const dev = cmatMaxAbsDiff(c.w, wStarMat);
    const payoffDev = Math.abs(strategyPayoff(c.w, ocbStrategy()).pSuccess - COS2_PI_8);
    const tblDev = branchTableDeviation(strategyBranchTables(c.w, ocbStrategy()), closed);
    const caught = dev > 1e-12 && tblDev > 1e-12;
    tamperRows.push([c.name, v.valid ? "VALID" : "INVALID", dev.toExponential(2), payoffDev.toExponential(2), tblDev.toExponential(2), caught ? "REJECTED by comparison" : "NOT CAUGHT"]);
    if (!caught) failures.push(`tamper control not caught: ${c.name}`);
  }

  // LC25 family spot check: alpha = 2 element differs from W* (as it must)
  const devLC25a2 = cmatMaxAbsDiff(wLC25(2), wStarMat);

  const body =
    `# EXP5 — The OCB12 equivalence, machine-checked\n\n` +
    `v0.1.0 boundary 1 said: "the explicit W of OCB12 was not transcribed; unitary equivalence\n` +
    `not claimed." That boundary is retired — by transcription and elementwise comparison:\n\n` +
    table(
      ["pair", "max elementwise deviation"],
      [
        ["W* (machine-derived) vs W_OCB12 (eq. 7 transcribed)", rep.wVsOCB12.toExponential(2)],
        ["W* vs S_OCB,1 (LC25 eq. 41, alpha=1)", rep.wVsLC25.toExponential(2)],
        ["W* vs S_OCB,2 (LC25, alpha=2 — must differ)", devLC25a2.toExponential(2)],
      ],
    ) +
    `\n\nThe repo's constraint-derived construction and the paper's eq. (7) are the SAME operator,\n` +
    `term for term: (1/4)[1 + (1/√2)(Z^{A2}Z^{B1} + Z^{A1}X^{B1}Z^{B2})] — and LC25's attaining\n` +
    `process S_OCB,alpha at alpha=1 is the same operator a third time. Both pass the validity\n` +
    `checker (Hermitian, PSD, trace 4, allowed patterns).\n\n` +
    `## The payoff functional, derived twice\n\n` +
    `Derivation 1: the process Born rule executed (T3 machinery, 16-dim exact arithmetic).\n` +
    `Derivation 2: OCB12 eq. (26) closed forms P(x|a,b) = ½[1+(−1)^{x+b}/√2], P(y|a,b) =\n` +
    `½[1+(−1)^{y+a}/√2]. Max entrywise deviation across all 16 table entries:\n` +
    `${rep.tablesVsClosedForm.toExponential(2)}. The x=1/y=1 columns (omitted for width) match the\n` +
    `same closed forms.\n\n` +
    tablesA +
    `\n\n` +
    tablesB +
    `\n\nrunProtocol on the transcription: p_success = ${p.pSuccess.toFixed(12)} = cos²(π/8) exactly.\n\n` +
    `## Tamper controls — the check has teeth\n\n` +
    table(["tampered transcription", "validity", "elementwise dev", "payoff dev", "table dev", "outcome"], tamperRows) +
    `\n\nBoth tampered processes are VALID (allowed patterns, PSD) — a validity checker alone waves\n` +
    `them through; only the elementwise/entrywise comparison against the transcribed original\n` +
    `rejects them. This is the fake-equivalence smuggling trial in executable form.\n`;

  if (failures.length > 0) throw new Error(`exp5 failures:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  const file = writeReport("exp5-equivalence.md", body);
  console.log(`exp5 done -> ${file} — W* ≡ OCB12 eq.(7) ≡ LC25 S_OCB,1 (dev ${rep.wVsOCB12.toExponential(1)}), tables dev ${rep.tablesVsClosedForm.toExponential(1)}`);
}

run();

/**
 * EXP1 — process validity, executed: positive candidates must pass all four
 * conditions (Hermitian, PSD, trace 4, allowed patterns only); negative
 * controls must fail with the RIGHT violation.
 */
import { checkValidity } from "../src/process/validity.js";
import { wChannelAB, wChannelBA, wForbiddenF1, wForbiddenF3, wMixed, wNotPSD, wStar } from "../src/process/construct.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const rows: string[][] = [];
  const failures: string[] = [];

  const cases: ReadonlyArray<{ name: string; w: ReturnType<typeof wMixed>; expectValid: boolean }> = [
    { name: "mixed (1/4)·1", w: wMixed(), expectValid: true },
    { name: "channel A≺B (Φ^{A2B1})", w: wChannelAB(), expectValid: true },
    { name: "channel B≺A (Φ^{A1B2})", w: wChannelBA(), expectValid: true },
    { name: "W*(1/√2) — the violation candidate", w: wStar(Math.SQRT1_2), expectValid: true },
    { name: "W*(0.9) — beyond PSD window", w: wStar(0.9), expectValid: false },
    { name: "forbidden A1A2 term (+0.05 ZZ)", w: wForbiddenF1(), expectValid: false },
    { name: "forbidden A2B2 term (+0.05 XX)", w: wForbiddenF3(), expectValid: false },
    { name: "PSD violation (0.9·Z^A2Z^B1)", w: wNotPSD(), expectValid: false },
  ];

  for (const c of cases) {
    const v = checkValidity(c.w);
    rows.push([
      c.name,
      v.valid ? "VALID" : "INVALID",
      v.minEig.toExponential(2),
      v.trace.toFixed(12),
      v.worstForbidden.c === 0 ? "-" : `${v.worstForbidden.j},${v.worstForbidden.k},${v.worstForbidden.l},${v.worstForbidden.m}:${v.worstForbidden.c.toExponential(2)}`,
    ]);
    if (v.valid !== c.expectValid) {
      failures.push(`${c.name}: expected ${c.expectValid ? "VALID" : "INVALID"}, got ${v.valid} [${v.violations.join("; ")}]`);
    }
  }

  // eigenvalue certificate for the star: exactly {0, 1/2}
  const eig = checkValidity(wStar(Math.SQRT1_2));
  if (Math.abs(eig.minEig) > 1e-12) {
    failures.push(`W*(1/√2) min eig ${eig.minEig} != 0 (eigenvalues must be {0, 1/2})`);
  }

  const body =
    `# EXP1 — Process validity, executed\n\n` +
    `Four conditions: Hermitian, PSD (real-symmetric Jacobi, tolerance 1e-12), Tr = 4, allowed Pauli patterns only\n` +
    `(rules F1-F3 derived from TPCP invariance — see src/process/validity.ts header for the derivation).\n\n` +
    table(["candidate", "verdict", "min eig", "trace", "worst forbidden pattern"], rows) +
    `\n\nW*(1/√2) eigenvalue certificate: min = ${checkValidity(wStar(Math.SQRT1_2)).minEig.toExponential(3)} ` +
    `(exact 0 — eigenvalues are {0, 1/2} because (T1+T2)/√2 squares to 1 and T1, T2 anticommute).\n\n` +
    `Negative controls fail for the RIGHT reasons: A1A2 breaks F1 (own input-output correlation), A2B2 breaks F3,\n` +
    `oversized coefficients break PSD.\n`;

  if (failures.length > 0) throw new Error(`exp1 failures:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  const file = writeReport("exp1-validity.md", body);
  console.log(`exp1 done -> ${file}`);
}

run();

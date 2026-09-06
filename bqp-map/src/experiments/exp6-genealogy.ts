/**
 * EXP6 — THE GENEALOGY ENROLLMENTS: two machine certificates executed and
 * reported, plus the full claim-by-claim register of the visitor's letter.
 * (The other genealogy rows enter the atlas on cross-prototype and citation
 * certificates; their numbers live in the sibling prototypes.)
 *
 *   A. postselect-sort  — the many-worlds sorter, audited: certainty
 *      in-branch, the depreciation ledger out-of-branch, counting power.
 *   B. retrocausal-cache — the no-signaling withdrawal clause: marginal
 *      invariance under arbitrary local unitary/CPTP, correlations intact.
 *   C. the register — the letter atomized into claims, every claim mapped
 *      to a verdict-carrying atlas row (unresolved mapping = failure).
 */
import { Rng } from "../core/rng.js";
import { postselectCount, postselectSearch } from "../genealogy/postselect.js";
import { nosignalTrial, singletAnchors } from "../genealogy/nosignal.js";
import { GENEALOGY_CLAIMS, orphanGenealogyRows, unresolvedRows } from "../genealogy/register.js";
import { ATLAS } from "../atlas/entries.js";
import { fmt, table, writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

const TOL = 1e-12;

function run(): void {
  const rng = new Rng(20260905);
  const sections: string[] = [];
  const failures: string[] = [];

  // ---------- A. postselect-sort ----------
  const sizes = [4, 6, 8, 10, 12, 14];
  const markedCounts = [1, 3, 7];

  // A1 + A2: certainty-in-branch and the depreciation ledger
  const rows: string[][] = [];
  for (const n of sizes) {
    for (const t of markedCounts) {
      if (t >= 2 ** n) continue;
      const N = 2 ** n;
      const marked: number[] = [];
      const chosen = new Set<number>();
      while (marked.length < t) {
        const x = rng.int(N);
        if (!chosen.has(x)) {
          chosen.add(x);
          marked.push(x);
        }
      }
      const r = postselectSearch(n, marked);
      const fidelity = Number.isNaN(r.conditionalFidelity) ? "-" : r.conditionalFidelity.toFixed(12);
      rows.push([
        String(n),
        String(t),
        r.pSuccess.toExponential(6),
        (t / N).toExponential(6),
        fidelity,
        r.expectedRepetitions.toFixed(2),
        r.groverRestartQueries.toFixed(2),
        r.classicalExpectedQueries.toFixed(2),
        (r.expectedRepetitions / r.groverRestartQueries).toFixed(2),
      ]);
      if (Math.abs(r.pSuccess - t / N) > TOL) failures.push(`postselect n=${n} t=${t}: P_success != t/N`);
      if (t === 1 && r.conditionalFidelity < 1 - TOL) failures.push(`postselect n=${n}: conditional fidelity != 1`);
      if (r.expectedRepetitions + TOL < r.groverRestartQueries) failures.push(`postselect n=${n} t=${t}: ledger < grover-restart E*`);
      if (Math.abs(r.expectedRepetitions - N / t) > 1e-9) failures.push(`postselect n=${n} t=${t}: ledger != N/t`);
      if (t === 1 && r.expectedRepetitions / r.groverRestartQueries < 2) {
        failures.push(`postselect n=${n}: single-marked ledger/E* below 2 — expected the sqrt(N) gap`);
      }
    }
  }
  sections.push(
    `## A. postselect-sort — the many-worlds sorter, audited\n\n` +
      `One oracle query, then postselect the flag. Executed exactly (amplitude algebra, no sampling):\n\n` +
      table(
        ["n", "t", "P_success", "t/N (closed)", "fidelity(x*)", "ledger 1/P", "grover E*", "classical N/t", "ledger/E*"],
        rows,
      ) +
      `\n\n**A1 certainty-in-branch holds**: for t = 1 the conditional address state is EXACTLY |x*> ` +
      `(fidelity 1.000000000000 — the sorter's truthful half).\n\n` +
      `**A2 the depreciation ledger**: P_success = t/N exactly, so one heralded readout costs ` +
      `1/P_success = N/t expected queries — column-for-column the classical random search rate. The ` +
      `quantum column is Grover compared at the SAME certain-answer standard (k iterations + 1 ` +
      `verification query, restart on failure): E* = min_k (k+1)/p_k. The ledger never beats E* ` +
      `(k = 0 is the random guess, so equality is attainable); for a single marked item the gap grows ` +
      `as ~sqrt(N) (last column). Postselection moves the cost from "queries" to "rejected branches" — ` +
      `the amortized rate repays at classical-random prices, never better.`,
  );

  // A3: counting power in-branch (the executable face of PostBQP = PP)
  const crows: string[][] = [];
  for (const n of [8, 10, 12]) {
    const N = 2 ** n;
    const g: boolean[] = [];
    const h: boolean[] = [];
    for (let x = 0; x < N; x++) {
      g.push(rng.bernoulli(0.4));
      h.push(rng.bernoulli(0.5));
    }
    const r = postselectCount(n, g, h);
    crows.push([String(n), r.pSuccess.toFixed(6), r.conditionalRatio.toFixed(12), r.bruteRatio.toFixed(12), r.deviation.toExponential(2)]);
    if (r.deviation > TOL) failures.push(`postselect-count n=${n}: branch ratio != brute ratio`);
    if (Math.abs(r.pSuccess - g.filter(Boolean).length / N) > 1e-12) failures.push(`postselect-count n=${n}: branch weight != |{g}|/N`);
  }
  sections.push(
    `### A3. Counting power in-branch — why anyone wanted postselection\n\n` +
      `Random predicates g (flag) and h (readout); the postselected branch reads the conditional counting ` +
      `ratio |{g AND h}|/|{g}| in closed form, verified against an independent integer-count referee:\n\n` +
      table(["n", "P_success = |{g}|/N", "P(h=1|flag=1) branch", "brute ratio", "deviation"], crows) +
      `\n\nThis is the amplitude-level content of PostBQP = PP (AAR04, cited): postselection converts ` +
      `counting into a single-branch readout. The branch weight |{g}|/2^n IS the price — the same coin. ` +
      `Power and depreciation are one entry in two columns.`,
  );

  // ---------- B. retrocausal-cache ----------
  const trows: string[][] = [];
  let worstMarginal = 0;
  let minJoint = Number.POSITIVE_INFINITY;
  for (let t = 0; t < 10; t++) {
    const r = nosignalTrial(rng);
    trows.push([
      String(t),
      r.jointUnitary.toFixed(6),
      r.marginalUnitary.toExponential(2),
      r.jointCptp.toFixed(6),
      r.marginalCptp.toExponential(2),
    ]);
    worstMarginal = Math.max(worstMarginal, r.marginalUnitary, r.marginalCptp);
    minJoint = Math.min(minJoint, r.jointUnitary, r.jointCptp);
  }
  if (worstMarginal > TOL) failures.push(`nosignal: B-marginal moved (${worstMarginal.toExponential(2)})`);
  if (minJoint < 0.05) failures.push(`nosignal: joint state did not move enough (${minJoint.toFixed(4)}) — vacuous trial`);
  sections.push(
    `## B. retrocausal-cache — the no-signaling withdrawal clause\n\n` +
      `Registers A (x) B (x) E; random states; the receiver B never appears in any operation.\n\n` +
      table(["trial", "joint HS (unitary)", "B marginal (unitary)", "joint HS (CPTP)", "B marginal (CPTP)"], trows) +
      `\n\n**B1 marginal invariance holds**: arbitrary local unitary AND arbitrary local CPTP map ` +
      `(Stinespring unitary on A + fresh ancilla, traced out) leave the B-side marginal at float zero ` +
      `(worst deviation ${worstMarginal.toExponential(2)}) while the JOINT state visibly moves ` +
      `(min HS distance ${fmt(minJoint, 4)}). The answer exists — in the correlation. The receiver ` +
      `cannot withdraw it: the A half must be delivered, over a classical channel whose latency floor ` +
      `is distance/c.`,
  );

  const sa = singletAnchors(rng, 24);
  if (sa.marginalMaxDev > 1e-15) failures.push(`singlet: marginal != I/2 (${sa.marginalMaxDev.toExponential(2)})`);
  if (sa.correlationMaxErr > 1e-15) failures.push(`singlet: correlation != -a.b (${sa.correlationMaxErr.toExponential(2)})`);
  if (sa.chshErr > 1e-12) failures.push(`singlet: CHSH != 2*sqrt(2) (${sa.chshErr.toExponential(2)})`);
  sections.push(
    `### B2. Correlation-without-signature anchor (singlet)\n\n` +
      `A measured along 24 random axes, outcomes forgotten: B marginal stays EXACTLY I/2 ` +
      `(max deviation ${sa.marginalMaxDev.toExponential(2)}). Correlations follow -a.b in closed form ` +
      `(max error ${sa.correlationMaxErr.toExponential(2)}); CHSH at the standard angles reaches ` +
      `${sa.chsh.toFixed(15)} vs 2*sqrt(2) = ${(2 * Math.SQRT2).toFixed(15)} (error ${sa.chshErr.toExponential(2)}).\n\n` +
      `Correlation is real to 15 decimals; signaling is zero to 15 decimals. The formalism offers both ` +
      `at once — the cache's "hit rate 100%" is the correlation column, its "withdrawal" is blocked by ` +
      `the marginal column.`,
  );

  // ---------- C. the full genealogy register: the letter, atomized ----------
  const unresolved = unresolvedRows();
  if (unresolved.length > 0) failures.push(...unresolved.map((u) => `register: claim row unresolved ${u}`));
  const rowVerdict = new Map(ATLAS.map((e) => [e.id, e.verdict] as const));
  const regRows = GENEALOGY_CLAIMS.map((c) => [
    c.id.replace("claim-", "#"),
    c.epoch,
    c.claim,
    c.rowId,
    rowVerdict.get(c.rowId) ?? "MISSING",
    c.note,
  ]);
  const orphans = orphanGenealogyRows();
  const orphanNote =
    orphans.length === 0
      ? ""
      : `\n\nAudit-added genealogy rows (from the epoch audit, not the letter itself): ${orphans.join(", ")} — kept because their certificates stand on their own.`;
  sections.push(
    `## C. The genealogy register — the letter, atomized\n\n` +
      `The five-epoch letter decomposed into its ${GENEALOGY_CLAIMS.length} separable testable claims; each maps to the ` +
      `atlas row that carries its verdict. No claim unenrolled, no row padded:\n\n` +
      table(["#", "epoch", "the letter's claim", "atlas row", "verdict", "disposition"], regRows) +
      orphanNote +
      `\n\nThe count is auditable: claims 01-04 (epoch 1), 05-06 (epoch 2), 07-08 (epoch 3), 09-13 (epoch 4), ` +
      `14-16 (epoch 5), 17 (conduct rule). Every claim carries the same three-part enrollment as every scheduling ` +
      `row: verdict, certificate, cost.`,
  );

  sections.push(
    `## Honest boundaries\n\n` +
      `- PostBQP = PP is CITED (AAR04), not re-proven. The machine executes the cost accounting of ` +
      `postselected search and the counting-ratio readout — the class equality stays on the citation's ` +
      `authority.\n` +
      `- No-signaling here is quantum mechanics' own (GRW80, cited): the certificate verifies the ` +
      `formalism's marginal invariance on exact instances. Superquantum no-signaling theories are out ` +
      `of scope; nothing here rules them in or out.\n` +
      `- The latency floor distance/c is special relativity QUOTED, not derived in this repo.\n` +
      `- The register maps claims to rows by content; audit-added rows (not lettered) are reported in the ` +
      `register section, never hidden — padding a row to reach a count would show up as an orphan.\n` +
      `- The Grover comparison runs at the certain-answer standard (k iterations + 1 verification, ` +
      `restart on failure; E* = min_k (k+1)/p_k over the repo's exact closed forms); asymptotic ` +
      `constants (the pi/4 prefactor) belong to the cited theorem, per the atlas's existing clause.`,
  );

  const body = `# EXP6 — Genealogy enrollments: postselection ledger + no-signaling withdrawal\n\n${sections.join("\n\n")}\n`;
  if (failures.length > 0) {
    throw new Error(`exp6 certificate failures:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  }
  const file = writeReport("exp6-genealogy.md", body);
  console.log(`exp6 done -> ${file}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}

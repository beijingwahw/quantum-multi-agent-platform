/**
 * THE SELF-REPORT GATE — S1 (the board-order checker) and S2 (the
 * prose-reconciliation gate) enforced against the LIVE artifact on disk and
 * the LIVE arithmetic, plus the smuggling docket: every law convicts by name.
 *
 * The artifact face is the point: out/reports/the-mutant-census.md is a
 * deliverable, and a deliverable that drifts from the data it summarizes is
 * the b36#16/b57#5 class. The suite re-derives the reconciliation from the
 * registry/kernel data on every run — a tampered or stale report fails the
 * build here even though the renderer would never have printed it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ARTIFACT = resolve(process.cwd(), "out", "reports", "the-mutant-census.md");

/** Swap two whole `##` section blocks of a report (heading to next heading). */
function swapSections(text: string, keyA: string, keyB: string): string {
  const headings = [...text.matchAll(/^## (.+)$/gm)];
  const idxA = headings.findIndex((m) => m[1]!.startsWith(keyA));
  const idxB = headings.findIndex((m) => m[1]!.startsWith(keyB));
  if (idxA < 0 || idxB < 0) throw new Error(`section not found: ${keyA}/${keyB}`);
  if (idxA > idxB) throw new Error("swapSections expects keyA before keyB");
  const bounds = (i: number): readonly [number, number] => [
    headings[i]!.index ?? 0,
    i + 1 < headings.length ? headings[i + 1]!.index ?? text.length : text.length,
  ];
  const [sa, ea] = bounds(idxA);
  const [sb, eb] = bounds(idxB);
  return text.slice(0, sa) + text.slice(sb, eb) + text.slice(ea, sb) + text.slice(sa, ea) + text.slice(eb);
}

test("S1/S2 live face: the on-disk artifact is in the legislated order and its numeric prose equals the live arithmetic", async () => {
  const { checkSelfReport, liveProseReconciliation } = await import("../src/kernel/selfreport.js");
  assert.ok(existsSync(ARTIFACT), "the report artifact is missing — npm run repro must render before the suite is green");
  const artifact = readFileSync(ARTIFACT, "utf8");
  const violations = checkSelfReport(artifact, await liveProseReconciliation());
  assert.deepEqual(violations, [], "the rendered report has drifted from the live arithmetic (or its order) — re-derive, then re-render");
});

test("the legislation is on the books: BOARD_ORDER is the statute, the README carries it, and the W-S witness wired the renderer", async () => {
  const { BOARD_ORDER } = await import("../src/kernel/selfreport.js");
  assert.deepEqual(BOARD_ORDER, [
    "M-board", "P-board", "Negative controls", "K-board", "W-board", "E-board", "A-board",
    "G-board", "J-board", "R-board", "T-board", "Witnesses", "Boundaries", "Closing",
  ]);
  const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8");
  assert.match(readme, /S1[\s\S]{0,80}板序/, "the README must carry the S1 board-order legislation");
  assert.match(readme, /S2[\s\S]{0,80}散文对账/, "the README must carry the S2 prose-reconciliation legislation");
  // the renderer refuses to print an illegal SELF-REPORT (the wiring, read from
  // source — the b37#7 precedent: the guard greps the script's own text)
  const render = readFileSync(resolve(process.cwd(), "src", "experiments", "render.ts"), "utf8");
  assert.match(render, /checkSelfReport\(text, recon\)/, "render.ts no longer self-checks its own report — the S1/S2 refusal is unwired");
});

test("absent claims claim nothing: a text without the phrases states no numbers (E7's parser principle)", async () => {
  const { checkProseCounts, liveProseReconciliation } = await import("../src/kernel/selfreport.js");
  assert.deepEqual(checkProseCounts("a page with no census phrases at all", await liveProseReconciliation()), []);
});

// ---- the smuggling docket: every law convicts by name ----

test("smuggle S1-a (板序): a section-shuffled report is convicted by name", async () => {
  const { checkBoardOrder } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  // the E-board block moved AFTER the A-board block: the enrollment census
  // answering to the anchors now prints before the anchors it cites
  const permuted = swapSections(artifact, "E-board", "A-board");
  assert.notEqual(permuted, artifact, "the permutation landed");
  assert.deepEqual(checkBoardOrder(artifact), [], "the real report is in order");
  const hits = checkBoardOrder(permuted).filter((v) => v.law === "S1");
  assert.ok(hits.length > 0, "the permuted report was NOT convicted");
  // the enrollment census, now printing after the anchors it cites, is the
  // named offender: rank(E) < rank(A) and E arrives after A
  assert.ok(hits.some((v) => v.row === "E-board" && /appears after A-board/.test(v.detail)), `convicted by name: ${hits.map((h) => h.row).join(", ")}`);
});

test("smuggle S1-b (板序): an unknown section is convicted, a missing one is convicted", async () => {
  const { checkBoardOrder } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  const smuggled = artifact.replace(/^## R-board /m, "## X-board — a board nobody legislated\n## R-board ");
  const unknown = checkBoardOrder(smuggled).find((v) => /unknown section/.test(v.detail));
  assert.ok(unknown, "the unlegislated section was NOT convicted");
  assert.match(unknown.detail, /vocabulary is closed/);
  const gutted = artifact.replace(/^## T-board[^\n]*\n/gm, "");
  const missing = checkBoardOrder(gutted).find((v) => v.row === "T-board" && /MISSING/.test(v.detail));
  assert.ok(missing, "the silently-swallowed section was NOT convicted");
});

test("smuggle S1-c (板序): M-board rows out of id order are convicted by name (b59#6)", async () => {
  const { checkBoardOrder } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  // swap the MU4 and MU5 rows (two-step replace; both anchors are unique cells)
  const swapped = artifact.replace("| MU4 |", "| MU5 @@SWAP@@ |").replace("| MU5 |", "| MU4 |").replace("| MU5 @@SWAP@@ |", "| MU5 |");
  assert.notEqual(swapped, artifact, "the row swap landed");
  const hit = checkBoardOrder(swapped).find((v) => v.law === "S1" && v.row === "MU4");
  assert.ok(hit, "the out-of-order rows were NOT convicted");
  assert.match(hit.detail, /MU4 follows MU5/);
});

test("smuggle S2-a (散文对账): a tampered rendered number is convicted naming the drifted field", async () => {
  const { checkProseCounts, liveProseReconciliation } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  const recon = await liveProseReconciliation();
  const expected = recon.fixed.find((c) => c.field === "tier-GATE-ENFORCED")!.expected;
  const forged = artifact.replace(`| GATE-ENFORCED | ${expected} |`, `| GATE-ENFORCED | ${expected + 1} |`);
  assert.notEqual(forged, artifact, "the tamper landed");
  const hit = checkProseCounts(forged, recon).find((v) => v.law === "S2" && v.row === "tier-GATE-ENFORCED");
  assert.ok(hit, "the tampered tier count was NOT convicted");
  assert.match(hit.detail, new RegExp(`claims ${expected + 1} but the live arithmetic carries ${expected}`));
});

test("smuggle S2-b (散文对账): a tampered registry count is convicted naming the drifted field", async () => {
  const { checkProseCounts, liveProseReconciliation } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  const recon = await liveProseReconciliation();
  const errors = recon.fixed.find((c) => c.field === "e-registry-errors")!.expected;
  const forged = artifact.replace(`${errors} errors across`, `${errors + 3} errors across`);
  assert.notEqual(forged, artifact, "the tamper landed");
  const hit = checkProseCounts(forged, recon).find((v) => v.law === "S2" && v.row === "e-registry-errors");
  assert.ok(hit, "the tampered registry count was NOT convicted");
  assert.match(hit.detail, new RegExp(`claims ${errors + 3} but the live arithmetic carries ${errors}`));
});

test("smuggle S2-c (散文对账): a tampered family share clause is convicted naming the repo", async () => {
  const { checkProseCounts, liveProseReconciliation } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  const recon = await liveProseReconciliation();
  const live = recon.repoShares.get("quantum-mech");
  assert.ok(live, "quantum-mech is a partial member of the family (the register says so)");
  const honest = `quantum-mech shares ${live.identical} of ${live.present}`;
  const forged = artifact.replace(honest, `quantum-mech shares ${live.identical + 1} of ${live.present}`);
  assert.notEqual(forged, artifact, "the tamper landed");
  const hit = checkProseCounts(forged, recon).find((v) => v.law === "S2" && v.row === "k-shares-quantum-mech");
  assert.ok(hit, "the tampered share was NOT convicted");
  assert.match(hit.detail, /live scan says/);
});

test("smuggle S2-d (散文对账): a tampered category cell is convicted naming the category and cell", async () => {
  const { checkProseCounts, liveProseReconciliation } = await import("../src/kernel/selfreport.js");
  const artifact = readFileSync(ARTIFACT, "utf8");
  const recon = await liveProseReconciliation();
  const live = recon.categoryCells.get("conjugation");
  assert.ok(live, "conjugation is a filed category");
  const honest = `| conjugation | ${live.mutant} | ${live.gate} | ${live.booked} |`;
  const forged = artifact.replace(honest, `| conjugation | ${live.mutant + 1} | ${live.gate} | ${live.booked} |`);
  assert.notEqual(forged, artifact, "the tamper landed");
  const hit = checkProseCounts(forged, recon).find((v) => v.law === "S2" && v.row === "e-category-conjugation");
  assert.ok(hit, "the tampered category cell was NOT convicted");
  assert.match(hit.detail, /mutant cell/);
});

/**
 * R21 omicron — smoke run of the kswitch4 module before the test is written.
 * Prints the machine numbers that the QUOTED_ constants will pin.
 */
import { fCmp, fDecimal, fr } from "../readout-wall/src/kernel/rational.js";
const frDec = (s: string): FracType => {
  const m = /^(\d+)\.(\d+)$/.exec(s);
  if (m === null) return fr(BigInt(s));
  return fr(BigInt(m[1]! + m[2]!), BigInt(10 ** m[2]!.length));
};
type FracType = ReturnType<typeof fr>;
import {
  K4_COEFFICIENTS,
  S4,
  S4_IRREPS,
  K4_BLOCK_TRACES,
  blockTracesOk,
  characterTableCert,
  coefficientsMatchDirect,
  eigenBrackets,
  isotypicTrace,
  k4Chi,
  k4GridCertificate,
  k4WallCertificate,
  leftInvarianceDev,
  spectralClassTable,
  tCross4,
  branch4s,
  branchIsometryOk,
  affineLawDev,
  zeroCoherenceExact,
  memberEntropySymmetryDev,
  QUOTED_K4_MIN_DESCENT_GAP,
  QUOTED_K4_MIN_CONVEX_DD,
  QUOTED_K4_MAX_CHI_WIDTH,
} from "../readout-wall/src/kernel/kswitch4.js";
import { PATH_T, PATH_A } from "../readout-wall/src/kernel/rational.js";

const t0 = Date.now();
console.log(`(0) branches: all 24 isometric = ${branch4s().every(branchIsometryOk)}`);

// coefficient table vs direct tCross re-derivation (exact dyadic equality)
{
  let ok = true;
  const bad: string[] = [];
  const ID = 0;
  for (let t = 0; t < 24; t++) {
    const avg = tCross4(t, ID, [0.5, 0, 0, 0.5]);
    const mem = tCross4(t, ID, [1, 0, 0, 0]);
    const k = K4_COEFFICIENTS[t]!;
    const a = Number(k.a.n) / Number(k.a.d);
    const x = Number(k.x.n) / Number(k.x.d);
    if (avg[0] !== a || avg[1] !== 0 || avg[2] !== 0 || avg[3] !== a) {
      ok = false;
      bad.push(`#${t} avg ${avg.map((v) => v.toFixed(6)).join("/")} vs a=${a}`);
    }
    if (mem[0] !== x || mem[1] !== 0 || mem[2] !== 0 || mem[3] !== 2 * a - x) {
      ok = false;
      bad.push(`#${t} mem ${mem.map((v) => v.toFixed(6)).join("/")} vs x=${x} 2a-x=${2 * a - x}`);
    }
  }
  console.log(`(1) coefficient table re-derivation (exact float equality): ${ok}${bad.length > 0 ? "\n      BAD: " + bad.join(" | ") : ""}`);
}

console.log(`(2) table-vs-direct 576-pair operators match: ${coefficientsMatchDirect()}`);
console.log(`(3) left-invariance dev: avg ${leftInvarianceDev("avg")} member ${leftInvarianceDev("member")}`);
const ct = characterTableCert();
console.log(`(4) character table: ${JSON.stringify(ct)}`);
console.log(`(5) block traces: ok=${blockTracesOk()} values=[${S4_IRREPS.map((R, i) => `${R.name}=${fDecimal(isotypicTrace(R), 8)} (pin ${fDecimal(K4_BLOCK_TRACES[i]!, 8)})`).join(" ")}]`);

for (const family of ["avg", "member"] as const) {
  const sct = spectralClassTable(family);
  console.log(`(6) ${family} spectral class table: pooled dev ${sct.pooledReconstructionDev.toExponential(2)}, chi4(0) = ${sct.chiAtFullCoherence.toFixed(9)}`);
  for (const b of sct.blocks)
    console.log(
      `      ${b.irrep} (dim ${b.dim}, block ${b.blockDim}): multLaw=${b.multiplicityLawHolds} distinct=[${b.distinct.map((d) => `${d.value.toFixed(7)}x${d.multiplicity}${d.pin !== null ? " pin" + fDecimal(d.pin, 5) : ""}`).join(" ")}]`,
    );
}

console.log(`(7) affine law devs: c=0.9 ${affineLawDev(0.9).toExponential(3)}, c=0.5 ${affineLawDev(0.5).toExponential(3)}, c=0.37 ${affineLawDev(0.37).toExponential(3)}`);
console.log(`(8) zero-coherence exact diag(1/48): ${zeroCoherenceExact()}`);
console.log(`(9) member entropy symmetry dev: ${memberEntropySymmetryDev().toExponential(3)}`);

{
  const bAvg = eigenBrackets("avg");
  const bMem = eigenBrackets("member");
  let wAvg = 0;
  let wMem = 0;
  for (const b of bAvg) wAvg = Math.max(wAvg, Number(b.hi.n) / Number(b.hi.d) - Number(b.lo.n) / Number(b.lo.d));
  for (const b of bMem) wMem = Math.max(wMem, Number(b.hi.n) / Number(b.hi.d) - Number(b.lo.n) / Number(b.lo.d));
  console.log(`(10) bracket widths: avg max ${wAvg.toExponential(3)}, member max ${wMem.toExponential(3)}`);
}

{
  const chi0 = k4Chi(frDec("0"), PATH_T);
  const chi1 = k4Chi(frDec("1"), PATH_T);
  console.log(`(11) chi4(0) = [${fDecimal(chi0.lo, 9)}, ${fDecimal(chi0.hi, 9)}]; chi4(1) = [${fDecimal(chi1.lo, 3)}, ${fDecimal(chi1.hi, 3)}]`);
  const chiA = k4Chi(frDec("0"), PATH_A);
  console.log(`(11b) path A chi4(0) = [${fDecimal(chiA.lo, 9)}, ${fDecimal(chiA.hi, 9)}]`);
}

const t1 = Date.now();
const grid = k4GridCertificate();
console.log(`(12) grid cert: ok=${grid.ok} minGap=${grid.minGap === null ? "null" : fDecimal(grid.minGap, 9)} minDD=${grid.minDD === null ? "null" : fDecimal(grid.minDD, 9)} maxWidth=${fDecimal(grid.maxWidth, 9)} cross=${grid.crossOverlapAll} (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
console.log(`     quotes: gap>=${QUOTED_K4_MIN_DESCENT_GAP}: ${grid.minGap !== null && fCmp(grid.minGap, frDec(QUOTED_K4_MIN_DESCENT_GAP)) >= 0}, dd>=${QUOTED_K4_MIN_CONVEX_DD}: ${grid.minDD !== null && fCmp(grid.minDD, frDec(QUOTED_K4_MIN_CONVEX_DD)) >= 0}, w<=${QUOTED_K4_MAX_CHI_WIDTH}: ${fCmp(grid.maxWidth, frDec(QUOTED_K4_MAX_CHI_WIDTH)) <= 0}`);

const t2 = Date.now();
const wall = k4WallCertificate();
console.log(`(13) wall cert: ok=${wall.ok} descent.ok=[${wall.descent.map((d) => d.ok)}] convex.ok=[${wall.convex.map((c) => c.ok)}] (${((Date.now() - t2) / 1000).toFixed(1)}s)`);
for (const d of wall.descent) {
  console.log(`     descent: cells ${d.cells.length} minGap ${d.minGap === null ? "null" : fDecimal(d.minGap, 9)} depth ${d.maxDepthUsed} convicted ${d.convicted === null ? "none" : "YES"}`);
}
for (const c of wall.convex) {
  console.log(`     convex: cells ${c.cells.length} minGap ${c.minGap === null ? "null" : fDecimal(c.minGap, 9)} depth ${c.maxDepthUsed} convicted ${c.convicted === null ? "none" : "YES"}`);
}
console.log(`total smoke time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log("SMOKE_DONE");

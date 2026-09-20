/**
 * R21 omicron — smoke run v2: the quarter-grid certificates' actual numbers.
 */
import { fCmp, fDecimal, fr } from "../readout-wall/src/kernel/rational.js";
const frDec = (s: string) => {
  const m = /^(\d+)\.(\d+)$/.exec(s);
  if (m === null) return fr(BigInt(s));
  return fr(BigInt(m[1]! + m[2]!), BigInt(10 ** m[2]!.length));
};
import {
  blockTracesOk,
  characterTableCert,
  coefficientsMatchDirect,
  k4FloatGrid,
  k4GridCertificate,
  k4WallCertificate,
  leftInvarianceDev,
  QUOTED_K4_FLOAT_MIN_DD,
  QUOTED_K4_FLOAT_MIN_GAP,
  QUOTED_K4_MIN_CONVEX_DD,
  QUOTED_K4_MIN_DESCENT_GAP,
  QUOTED_K4_MAX_CHI_WIDTH,
} from "../readout-wall/src/kernel/kswitch4.js";

console.log(`(1) table-vs-direct: ${coefficientsMatchDirect()}, left-inv: ${leftInvarianceDev("avg")}/${leftInvarianceDev("member")}, chars: ${JSON.stringify(characterTableCert())}, traces: ${blockTracesOk()}`);

const t0 = Date.now();
const grid = k4GridCertificate();
console.log(`(2) quarter-grid cert: ok=${grid.ok} minGap=${grid.minGap === null ? "null" : fDecimal(grid.minGap, 8)} minDD=${grid.minDD === null ? "null" : fDecimal(grid.minDD, 8)} maxWidth=${fDecimal(grid.maxWidth, 8)} cross=${grid.crossOverlapAll} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log(`    quotes: gap>=${QUOTED_K4_MIN_DESCENT_GAP}: ${grid.minGap !== null && fCmp(grid.minGap, frDec(QUOTED_K4_MIN_DESCENT_GAP)) >= 0}, dd>=${QUOTED_K4_MIN_CONVEX_DD}: ${grid.minDD !== null && fCmp(grid.minDD, frDec(QUOTED_K4_MIN_CONVEX_DD)) >= 0}, w<=${QUOTED_K4_MAX_CHI_WIDTH}: ${fCmp(grid.maxWidth, frDec(QUOTED_K4_MAX_CHI_WIDTH)) <= 0}`);

const t1 = Date.now();
const wall = k4WallCertificate();
console.log(`(3) wall cert: ok=${wall.ok} (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
for (const d of wall.descent)
  console.log(`    descent: cells ${d.cells.length} minGap ${d.minGap === null ? "null" : fDecimal(d.minGap, 8)} depth ${d.maxDepthUsed} convicted ${d.convicted === null ? "none" : "YES"}`);
for (const c of wall.convex)
  console.log(`    convex: cells ${c.cells.length} minGap ${c.minGap === null ? "null" : fDecimal(c.minGap, 8)} depth ${c.maxDepthUsed} convicted ${c.convicted === null ? "none" : "YES"}`);

const t2 = Date.now();
const fg = k4FloatGrid();
console.log(`(4) float grid: decreasing=${fg.decreasing} minGap=${fg.minGap.toExponential(6)} convex=${fg.convex} minDD=${fg.minDD.toExponential(6)} chi4(0)=${fg.values[0]!.toFixed(9)} (${((Date.now() - t2) / 1000).toFixed(1)}s)`);
console.log(`    float quotes: gap>=${QUOTED_K4_FLOAT_MIN_GAP}: ${fg.minGap >= Number(frDec(QUOTED_K4_FLOAT_MIN_GAP))}, dd>=${QUOTED_K4_FLOAT_MIN_DD}: ${fg.minDD >= Number(frDec(QUOTED_K4_FLOAT_MIN_DD))}`);
console.log("SMOKE2_DONE");

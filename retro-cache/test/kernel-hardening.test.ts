import test from "node:test";
import assert from "node:assert/strict";
import {
  CHSH_AXES,
  RcError,
  chshStandard,
  cmatAdd,
  cmatMul,
  cmatZero,
  hsDistance,
  jointTable,
  mutualInfoBits,
  entropyBits,
  projector,
  reduceB,
  Rng,
  tvDistance,
  wernerCorrelation,
  wernerPair,
} from "../src/kernel/state.js";
import { cptpOnB, h2, postprocessOutcome, qberOf, withdrawalRow } from "../src/kernel/tariff.js";
import {
  censusCrossingTap,
  chshUnderAttack,
  eveInfoNoisyStorage,
  interceptResendRow,
  qberUnderAttack,
  settingsMutationRow,
} from "../src/kernel/adversary.js";
import { bscBlockInfo, collisionCensus, gfMul, paMeasure, sparseAdversaryInfo } from "../src/kernel/amplify.js";
import { auditRateRow, auditUniformityClaim } from "../src/kernel/audit.js";
import { fmt } from "../src/experiments/report.js";

/** a rejection is only usable if it is NAMED: the throw must be an RcError
 *  carrying the expected stable code, and the message must embed it */
function expectRc(fn: () => unknown, code: string): void {
  assert.throws(
    fn,
    (e: unknown): boolean => e instanceof RcError && e.code === code && e.message.includes(`[${code}]`),
    `expected a named RcError with code ${code}`,
  );
}

test("K.A every kernel throw is a named RcError with a stable code", () => {
  assert.ok(RcError.prototype instanceof Error);
  const e = new RcError("RC_TEST", "probe");
  assert.equal(e.code, "RC_TEST");
  assert.equal(e.name, "RcError");
  assert.ok(e.message.includes("[RC_TEST]"));
});

test("K.B smuggling trials: illegal inputs at every public entry are NAMED and REJECTED", () => {
  // state.ts — matrix shape and axis guards
  expectRc(() => projector([1, 0], 1), "RC_AXIS_LEN");
  expectRc(() => wernerCorrelation(1, [1, 0, 0], [0, 1]), "RC_AXIS_LEN");
  expectRc(() => jointTable(cmatZero(2), [0, 0, 1], [0, 0, 1]), "RC_DIM");
  expectRc(() => reduceB(cmatZero(2)), "RC_DIM");
  expectRc(() => hsDistance(cmatZero(2), cmatZero(3)), "RC_DIM_MISMATCH");
  expectRc(() => cmatAdd(cmatZero(2), cmatZero(3)), "RC_DIM_MISMATCH");
  expectRc(() => cmatMul(cmatZero(2), cmatZero(3)), "RC_DIM_MISMATCH");
  // state.ts — information-table guards
  expectRc(() => mutualInfoBits([]), "RC_EMPTY_TABLE");
  expectRc(() => mutualInfoBits([[1], [1, 2]]), "RC_RAGGED_TABLE");
  expectRc(() => mutualInfoBits([[0, 0], [0, 0]]), "RC_ZERO_TABLE");
  expectRc(() => entropyBits([0.5, -0.1]), "RC_NEG_PROB");
  expectRc(() => entropyBits([0.5, Number.NaN]), "RC_NEG_PROB");
  expectRc(() => tvDistance([0.5, 0.5], [0.5]), "RC_LEN_MISMATCH");
  // tariff.ts — h2 domain, withdrawal entry, CPTP entry
  expectRc(() => h2(1.5), "RC_Q_RANGE");
  expectRc(() => h2(Number.NaN), "RC_Q_RANGE");
  expectRc(() => qberOf(1.2), "RC_P_RANGE");
  expectRc(() => withdrawalRow(cmatZero(2), 1), "RC_DIM");
  expectRc(() => withdrawalRow(wernerPair(1), 1.5), "RC_P_RANGE");
  expectRc(() => cptpOnB(cmatZero(2), new Rng(1)), "RC_DIM");
  // adversary.ts — rate/visibility guards
  expectRc(() => qberUnderAttack(1.2, 0), "RC_P_RANGE");
  expectRc(() => qberUnderAttack(1, -0.1), "RC_ETA_RANGE");
  expectRc(() => chshUnderAttack(1, 1.1), "RC_ETA_RANGE");
  expectRc(() => interceptResendRow(1, -1), "RC_ETA_RANGE");
  expectRc(() => settingsMutationRow(1, 1.5), "RC_MU_RANGE");
  expectRc(() => eveInfoNoisyStorage(2, 0.1), "RC_ETA_RANGE");
  expectRc(() => eveInfoNoisyStorage(1, 0.7), "RC_NU_RANGE");
  expectRc(() => censusCrossingTap(1.2), "RC_P_RANGE");
  expectRc(() => censusCrossingTap(0), "RC_P_RANGE");
  // amplify.ts — field membership, element range, enumeration ranges
  expectRc(() => gfMul(1, 1, 5), "RC_NO_FIELD");
  expectRc(() => gfMul(0x100, 1, 8), "RC_FIELD_ELEM");
  expectRc(() => gfMul(1, -1, 8), "RC_FIELD_ELEM");
  expectRc(() => collisionCensus(8, 9), "RC_K_RANGE");
  expectRc(() => bscBlockInfo(0, 0.25), "RC_M_RANGE");
  expectRc(() => bscBlockInfo(8, 0.75), "RC_EPS_RANGE");
  expectRc(() => paMeasure(20, 4, 0.25), "RC_M_RANGE");
  expectRc(() => paMeasure(8, 9, 0.25), "RC_K_RANGE");
  expectRc(() => paMeasure(8, 4, 0.75), "RC_EPS_RANGE");
  expectRc(() => sparseAdversaryInfo(8, 9, 2), "RC_K_RANGE");
  expectRc(() => sparseAdversaryInfo(8, 4, 9), "RC_KNOWNBITS_RANGE");
});

test("K.C negative controls: every legal boundary value passes its guard", () => {
  // endpoints of every guarded range are legal and behave exactly as before
  assert.equal(h2(0), 0);
  assert.equal(h2(1), 0);
  assert.equal(qberOf(0), 0.5);
  assert.equal(qberOf(1), 0);
  assert.ok(Number.isFinite(withdrawalRow(wernerPair(0), 0).netRate));
  assert.equal(eveInfoNoisyStorage(1, 0.5), 0);
  assert.equal(eveInfoNoisyStorage(1, 0), 0.5);
  assert.ok(qberUnderAttack(0, 1).closed > 0);
  assert.ok(Number.isFinite(interceptResendRow(0.5, 1).netPrePA));
  assert.ok(settingsMutationRow(1, 0).qberClosed === 0);
  assert.notEqual(censusCrossingTap(1 / Math.SQRT2 + 1e-6), null);
  assert.equal(gfMul(0x57, 0x83, 8), 0xc1);
  assert.ok(Number.isFinite(paMeasure(4, 4, 0.5).afterMean));
  assert.ok(Number.isFinite(bscBlockInfo(8, 0).closed));
  assert.ok(sparseAdversaryInfo(8, 4, 0).sets > 0);
  // tvDistance keeps its exact values on matched lengths
  assert.equal(tvDistance([0.75, 0.25], [0.25, 0.75]), 0.5);
  assert.equal(tvDistance([0.5, 0.5], [0.5, 0.5]), 0);
});

test("K.D convicted: NaN and Infinity rows can no longer ride the audit as ok", () => {
  // the hole: every NaN comparison is false, so both rejection branches were
  // skipped and a NaN row returned ok:true (audit.ts auditRateRow/auditUniformityClaim)
  expectRc(() => auditRateRow({ p: 0.9, q: 0.05, line: 1 - h2(0.05), measured: Number.NaN }, 1 - h2(0.05)), "RC_NON_FINITE");
  expectRc(() => auditRateRow({ p: 0.9, q: 0.05, line: 1 - h2(0.05), measured: 1 - h2(0.05) }, Number.NaN), "RC_NON_FINITE");
  expectRc(
    () => auditRateRow({ p: Number.POSITIVE_INFINITY, q: 0.05, line: 1, measured: 1 }, 1),
    "RC_NON_FINITE",
  );
  expectRc(() => auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: Number.NaN }), "RC_NON_FINITE");
  expectRc(() => auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: Number.POSITIVE_INFINITY }), "RC_NON_FINITE");
  // and the honest rows still pass untouched (W5.F's originals)
  const machineR = 1 - h2(0.05) - (1 - h2(0.45));
  const honest = auditRateRow({ p: 0.9, q: 0.05, line: 1 - h2(0.05), measured: machineR }, machineR);
  assert.ok(honest.ok);
  assert.ok(auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: 15 / 255 }).ok);
});

test("K.E single-source identities: qberOf and CHSH_AXES are the one definition every path rides", () => {
  // qberOf(p) = (1-p)/2 at exact float equality, and every module's closed
  // QBER column is the SAME exported number (bit-identical), while each
  // module's table path stays an independent computation
  for (const p of [1, 0.95, 0.9, 0.8, 0.6, 0.5, 0.25, 0]) {
    assert.equal(qberOf(p), (1 - p) / 2);
    assert.equal(withdrawalRow(wernerPair(p), p).qberClosed, qberOf(p));
  }
  assert.equal(settingsMutationRow(1, 0).qberClosed, qberOf(1));
  assert.equal(qberUnderAttack(1, 0).closed, qberOf(1));
  // the standard axes are the frozen literals, exactly once
  const [a0, a1, b0, b1] = CHSH_AXES;
  assert.deepEqual(a0, [1, 0, 0]);
  assert.deepEqual(a1, [0, 1, 0]);
  assert.deepEqual(b0, [Math.SQRT1_2, Math.SQRT1_2, 0]);
  assert.deepEqual(b1, [Math.SQRT1_2, -Math.SQRT1_2, 0]);
  // the W6 table path rides the SAME axes object: at eta = 0 it reproduces
  // the honest W1 channel (the merge's back-stop, alongside W6.A)
  for (const p of [1, 0.9, 0.75, 0.5]) {
    const attacked = chshUnderAttack(p, 0).table;
    const honest = chshStandard(wernerPair(p));
    assert.ok(Math.abs(attacked - honest) < 1e-14, `p=${p}: merged axes keep the eta=0 identity`);
  }
});

test("K.F internal invariants: ragged tables and field elements cannot launder NaN in", () => {
  // the smuggle: a ragged row used to index past its end (undefined operand)
  // and hand entropy a NaN weight; now it is named at the boundary
  expectRc(() => mutualInfoBits([[0.25, 0.25], [0.25, 0.25, 0.25]]), "RC_RAGGED_TABLE");
  // the smuggle: an out-of-range field element used to wrap through the
  // reduction and return a non-element silently
  expectRc(() => gfMul(0x1ff, 0x02, 8), "RC_FIELD_ELEM");
  // legal field arithmetic still distributes (kept from W5.A's spot checks)
  assert.equal(gfMul(0x53, 0xca ^ 0x11, 8), gfMul(0x53, 0xca, 8) ^ gfMul(0x53, 0x11, 8));
});

test("K.G convicted: the report printer would have shipped NaN as prose", () => {
  // the hole (latent, closed v0.2.2): (Number.NaN).toFixed(6) returns "NaN"
  // and Infinity "Infinity" — a non-finite number reaching the renderer would
  // print silently into the ledger, the same rides-past-every-threshold face
  // the audit layer rejects rows for; the printer now rejects by name
  expectRc(() => fmt(Number.NaN), "RC_NON_FINITE");
  expectRc(() => fmt(Number.POSITIVE_INFINITY), "RC_NON_FINITE");
  expectRc(() => fmt(Number.NEGATIVE_INFINITY, 9), "RC_NON_FINITE");
  // negative controls: finite formatting is unchanged to the digit
  assert.equal(fmt(0.5), "0.500000");
  assert.equal(fmt(1 / 3, 4), "0.3333");
  assert.equal(fmt(-2, 3), "-2.000");
  assert.equal(fmt(2 * Math.SQRT2, 12), "2.828427124746");
});

test("K.H postprocessOutcome smuggling trials: malformed tables and maps are NAMED and REJECTED", () => {
  const flip: readonly [readonly number[], readonly number[]] = [[0, 1], [1, 0]];
  // a short or long table row would read undefined (or skip a cell) and
  // launder a silent wrong number into the output column
  expectRc(() => postprocessOutcome([[0.5]], flip), "RC_TABLE_SHAPE");
  expectRc(() => postprocessOutcome([[0.5, 0], [0.5]], flip), "RC_TABLE_SHAPE");
  expectRc(() => postprocessOutcome([[0.5, 0, 0], [0, 0.5, 0]], flip), "RC_TABLE_SHAPE");
  expectRc(() => postprocessOutcome([[0.5, 0.5]], flip), "RC_TABLE_SHAPE");
  // a NaN cell is not a probability; it cannot be postprocessed, only rejected
  expectRc(() => postprocessOutcome([[0.5, 0], [0.5, Number.NaN]], flip), "RC_NON_FINITE");
  // the map side has the same two faces (the tuple type already rejects a
  // 1-row map at compile time for TS callers; the row-length guard fires on
  // short rows, and remains defense-in-depth for untyped JS callers)
  expectRc(() => postprocessOutcome([[0.5, 0.5], [0, 0]], [[1], [0]]), "RC_MAP_SHAPE");
  expectRc(() => postprocessOutcome([[0.5, 0.5], [0, 0]], [[1, 0], [Number.NaN, 0]]), "RC_NON_FINITE");
  // negative controls: the legal calls of W2.E keep their exact values
  assert.deepEqual(postprocessOutcome([[0.25, 0.25], [0.25, 0.25]], flip), [
    [0.25, 0.25],
    [0.25, 0.25],
  ]);
  const tilted: readonly [readonly number[], readonly number[]] = [[1, 0], [0.5, 0.5]];
  // hand-computed: out[x][0] = P(x,0)*1 + P(x,1)*0.5, out[x][1] = P(x,1)*0.5
  assert.deepEqual(postprocessOutcome([[0.5, 0], [0, 0.5]], tilted), [
    [0.5, 0],
    [0.25, 0.25],
  ]);
});

test("K.I single-source sharp anchors: the converged constants are exact at the public boundary", () => {
  // the Tsirelson constant converged to one module-level source (adversary.ts)
  // at v0.2.2 — these EXACT-equality anchors (no tolerance) pin both closed
  // forms to the Math primitives bitwise, so any drift in the constant or the
  // closed-form arithmetic dies here rather than at the tolerance line
  assert.equal(chshUnderAttack(1, 1).closed, -Math.SQRT2, "eta=1, p=1: S = -sqrt(2), bitwise");
  const etaOne = censusCrossingTap(1);
  assert.ok(etaOne !== null);
  assert.equal(etaOne, 2 - Math.SQRT2, "eta*(1) = 2 - sqrt(2), bitwise");
  // the BSC weight row converged to one source (amplify.ts bscWeights) at
  // v0.2.2 — at the noiseless endpoint eps = 0 both paths are exactly m (the
  // table is a point mass of exact powers of two; nothing rounds)
  for (const m of [4, 8]) {
    const r = bscBlockInfo(m, 0);
    assert.equal(r.closed, m, `m=${m}: closed path exactly m`);
    assert.equal(r.table, m, `m=${m}: table path exactly m — one weight definition, exact at the endpoint`);
  }
  // and the weights themselves stay a probability vector: w sums to 1 via the
  // public after-path at the clean endpoint (already exact-zero anchors in W5.B)
  assert.equal(paMeasure(8, 8, 0.5).afterMean, 0);
});

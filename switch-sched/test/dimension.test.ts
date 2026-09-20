import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROL_HELMSTROM,
  CONTROL_T,
  SWEEP_DIMS,
  SWEEP_PS,
  controlChi,
  depolJointLaw,
  replacerConstants,
  verifyDimensionSweep,
} from '../src/switch/dimension.js';

// ---------------------------------------------------------------------------
// The joint-face grid, computed ONCE and shared by every law assertion: the
// depolarizing pair carries env dim d², so the switched full output lives in
// dimension 2d⁵ (d = 6: a 15552² complex matrix, ~16 s and ~3.9 GB dense) —
// the sweep's price is documented here; re-running the grid per test would
// triple the suite's wall clock for no extra evidence.
// ---------------------------------------------------------------------------
const GRID = SWEEP_DIMS.map((d) => ({ d, rows: SWEEP_PS.map((p) => ({ p, ...depolJointLaw(d, p) })) }));
const at = (d: number, p: number): { tFull: number; fixedT: number; closedForm: number } => {
  const rows = GRID.find((g) => g.d === d)?.rows;
  const row = rows?.find((r) => r.p === p);
  if (row === undefined) throw new Error(`grid miss at d=${d} p=${p}`);
  return row;
};

// ---------------------------------------------------------------------------
// Control-face dimension invariance (d = 2..6): the constants are d-free.
// ---------------------------------------------------------------------------

test('dimension: replacer-pair control constants are d-free for d = 2..6 (T, Helstrom, χ)', () => {
  for (const d of SWEEP_DIMS) {
    const r = replacerConstants(d);
    assert.ok(r.singleBoxT < 1e-12, `d=${d} single box transmits (T = ${r.singleBoxT})`);
    assert.ok(r.fixedT < 1e-12, `d=${d} definite order transmits (T = ${r.fixedT})`);
    assert.ok(Math.abs(r.tControl - CONTROL_T) < 1e-12, `d=${d} T_control ${r.tControl} vs 1/2`);
    assert.ok(r.tTarget < 1e-12, `d=${d} target face transmits (T = ${r.tTarget})`);
    assert.ok(Math.abs(r.helstromFull - CONTROL_HELMSTROM) < 1e-12, `d=${d} Helstrom ${r.helstromFull} vs 3/4`);
    assert.ok(Math.abs(r.chiControl - controlChi()) < 1e-10, `d=${d} χ_control ${r.chiControl} vs H₂(¼)−½`);
  }
});

test('dimension: the control-face states behind the constants (constructive check at d = 3)', () => {
  // For input |v_d⟩ the control ends in |+⟩⟨+| (pure); for |v_d⊥⟩ it is
  // maximally mixed — the d-free pair of states every constant derives from.
  const r3 = replacerConstants(3);
  // pure-vs-mixed pair: T = 1/2 exactly; product structure with the common
  // replacer output target: Helstrom_full = (1 + 1/2)/2 = 3/4.
  assert.ok(Math.abs(r3.helstromFull - (1 + r3.tControl) / 2) < 1e-12);
});

test('dimension: χ closed form equals H₂(1/4) − 1/2 to machine precision', () => {
  const h2 = (x: number): number => -x * Math.log2(x) - (1 - x) * Math.log2(1 - x);
  assert.ok(Math.abs(controlChi() - (h2(0.25) - 0.5)) < 1e-15);
});

// ---------------------------------------------------------------------------
// Joint-face law — the machine-corrected general form T_full = p/d².
// ---------------------------------------------------------------------------

test('dimension: joint law T_full = p/d² over the full d × p grid (25 points)', () => {
  for (const { d, rows } of GRID) {
    for (const r of rows) {
      assert.ok(r.fixedT < 1e-12, `d=${d} p=${r.p} definite order transmits (T = ${r.fixedT})`);
      assert.ok(
        Math.abs(r.tFull - r.closedForm) < 1e-14,
        `d=${d} p=${r.p}: T_full ${r.tFull} vs p/d² ${r.closedForm}`,
      );
    }
  }
});

test('dimension: the law is linear in p at every dimension (slope 1/d²)', () => {
  for (const d of SWEEP_DIMS) {
    const r1 = at(d, 1);
    const rHalf = at(d, 0.5);
    assert.ok(Math.abs(rHalf.tFull - r1.tFull / 2) < 1e-14, `d=${d} halving p must halve T_full`);
  }
});

test('dimension: d = 2 recovers the certified p/4 (the R15-anchored instance)', () => {
  for (const p of SWEEP_PS) {
    const r = at(2, p);
    assert.ok(Math.abs(r.tFull - p / 4) < 1e-14, `d=2 p=${p}: ${r.tFull} vs p/4`);
  }
});

test('dimension: negative control — the draft law p/4 is REFUTED at every d ≥ 3', () => {
  // The R18/G4-b spec drafted "T = p/4 的 d 推广"; the machine overruled it:
  // at d ≥ 3 the p/4 form is strictly wrong, and pinning the refutation
  // keeps the corrected law from silently regressing to the seductive d = 2
  // form. The fading itself is the physics: order information through the
  // completely depolarizing endpoint shrinks as 1/d².
  for (const d of [3, 4, 5, 6]) {
    const r = at(d, 1);
    assert.ok(Math.abs(r.tFull - 1 / 4) > 1e-3, `d=${d}: p/4 must FAIL here (T_full = ${r.tFull})`);
    assert.ok(r.tFull < 1 / 4, `d=${d}: order information fades as 1/d² (got ${r.tFull})`);
  }
});

// ---------------------------------------------------------------------------
// Audit face — a claimed sweep is recomputed, forgeries named.
// ---------------------------------------------------------------------------

test('dimension: the honest sweep record verifies', () => {
  const closedForms = SWEEP_DIMS.map((d) => {
    const r = replacerConstants(d);
    return { d, tControl: r.tControl, helstromFull: r.helstromFull, chiControl: r.chiControl };
  });
  const v = verifyDimensionSweep({ closedForms });
  assert.ok(v.ok, v.reason);
  assert.match(v.reason, /verified: 5 dimensions at the d-free closed forms/);
});

test('dimension: forged records die by name (drifting T, wrong Helstrom, wrong χ)', () => {
  const base = SWEEP_DIMS.map((d) => ({ d, tControl: CONTROL_T, helstromFull: CONTROL_HELMSTROM, chiControl: controlChi() }));
  const driftT = verifyDimensionSweep({ closedForms: base.map((r) => (r.d === 4 ? { ...r, tControl: 0.51 } : r)) });
  assert.ok(!driftT.ok);
  assert.match(driftT.reason, /DIMENSION-COUNTERFEIT: d=4 control T claimed 0\.51/);

  const wrongHelm = verifyDimensionSweep({ closedForms: base.map((r) => (r.d === 2 ? { ...r, helstromFull: 0.8 } : r)) });
  assert.ok(!wrongHelm.ok);
  assert.match(wrongHelm.reason, /d=2 Helstrom claimed 0\.8, closed form 0\.75/);

  const wrongChi = verifyDimensionSweep({ closedForms: base.map((r) => (r.d === 6 ? { ...r, chiControl: 0.5 } : r)) });
  assert.ok(!wrongChi.ok);
  assert.match(wrongChi.reason, /d=6 χ claimed 0\.5, closed form/);
});

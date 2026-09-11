/**
 * Smoke gate for the platform-side copy of the QPU cross-validation kernel
 * (GENESIS 目标 B). Pins the interface: if the canonical implementation in
 * wukong-crossval drifts and the copy goes stale, this test names it.
 *
 * The gate pins THREE faces (the copy once lagged the canonical's hardening
 * and the old two-pin version could not name the drift):
 * - the X1/X2 behavior surface (instance set, offline optimize, dry-run
 *   sample, export — all deterministic);
 * - the named-refusal surface (every degenerate boundary throws XvalError
 *   with the canonical's code — never silent NaN / wrapped-shift garbage);
 * - the frozen applyRX sign convention, hand-anchored at θ=π.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyRX,
  enumerateOptimum,
  exportCircuit,
  instanceSet,
  makeRng,
  optimizeOffline,
  quboValue,
  runQaoa,
  sampleWithReadoutNoise,
  uniformState,
  type Instance,
  type QuboSpec,
} from '../experiments/qpu-cross-validation/kernel.js';
import { XvalError } from '../experiments/qpu-cross-validation/error.js';

/** 断言「以规范名拒绝」：XvalError + 指定 code（漂移复发的探测器） */
function assertRefused(fn: () => unknown, code: string, needle: RegExp): void {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof XvalError, `必须是 XvalError（got ${String(caught)}）`);
  assert.equal(caught.code, code);
  assert.match(caught.message, new RegExp(needle));
}

describe('qpu-cross-validation smoke (platform copy)', () => {
  // instanceSet 的 4× n=20 穷举是最贵步骤（~秒级）——全文件共享一份，
  // 确定性断言所需的第二份在 X1 内自取
  const set = instanceSet();

  it('X1: 20 seeded instances, 5 linear + 15 coupled, optima by enumeration', () => {
    assert.equal(set.length, 20);
    assert.equal(set.filter((i) => i.kind === 'linear').length, 5);
    assert.equal(set.filter((i) => i.kind === 'coupled').length, 15);
    // determinism: same set twice, byte-equal optima
    const again = instanceSet();
    assert.deepEqual(
      set.map((i) => [i.id, i.optBits, i.optValue]),
      again.map((i) => [i.id, i.optBits, i.optValue]),
    );
    // referee pin: a hand-checked QUBO — bits 0b11 on linear [1,2] + coupling 3 → 6
    const hand: QuboSpec = {
      id: 'hand',
      n: 2,
      kind: 'coupled',
      linear: [1, 2],
      coupling: [[3], []],
    };
    assert.equal(quboValue(hand, 0b11), 6);
    assert.equal(quboValue(hand, 0b10), 1);
    assert.deepEqual(enumerateOptimum(hand), { optBits: 0b11, optValue: 6 });
  });

  it('X2+X3+X4: offline optimize a small instance, dry-run sample, export', () => {
    const inst = set[0]!;
    const params = optimizeOffline(inst, 1);
    const psi = runQaoa(inst, params);
    const result = sampleWithReadoutNoise(psi, inst.n, inst.optBits, 512, 0.0, makeRng(123));
    assert.ok(result.rawHitRate >= 0 && result.rawHitRate <= 1);
    assert.ok(Math.abs(result.observedHitRate - result.rawHitRate) < 0.05); // zero noise: observed === raw
    const circuit = exportCircuit(inst, params, 512);
    assert.equal(circuit.shots, 512);
    assert.equal(circuit.layers.length, 1);
    // determinism: same instance + depth → byte-equal params (offline reproducibility)
    assert.deepEqual(optimizeOffline(inst, 1), params);
  });

  it('named-refusal surface: degenerate boundaries are refused by code, never silent NaN', () => {
    const inst = set[0]!;
    // short linear row: the pre-sync copy summed undefined → silent NaN optimum
    assertRefused(
      () => quboValue({ id: 'x', n: 2, kind: 'linear', linear: [1], coupling: [[], []] }, 0),
      'XVAL_QUBO_SHAPE',
      /linear must carry n=2/,
    );
    // 1 << n wraps at n=32: the pre-sync copy enumerated 2 of 4B states and
    // shipped a silent wrong "optimum" (the wrapped-shift family)
    assertRefused(
      () => enumerateOptimum({ id: 'x', n: 32, kind: 'linear', linear: [], coupling: [] }),
      'XVAL_N_RANGE',
      /integer in \[0,30\]/,
    );
    assertRefused(() => uniformState(32.5), 'XVAL_N_RANGE', /uniformState/);
    // shots < 1: the pre-sync copy divided by zero → NaN hit rates
    assertRefused(
      () => sampleWithReadoutNoise(uniformState(2), 2, 0, 0, 0, makeRng(1)),
      'XVAL_SHOTS_RANGE',
      /shots must be an integer >= 1/,
    );
    // flipProb outside [0,1]: the pre-sync copy shipped calibratedHitRate NaN
    assertRefused(
      () => sampleWithReadoutNoise(uniformState(2), 2, 0, 4, 1.5, makeRng(1)),
      'XVAL_FLIP_RANGE',
      /must be in \[0,1\]/,
    );
    // unpaired variational params: the pre-sync export silently dropped gamma
    assertRefused(
      () => runQaoa(inst, { betas: [0.1, 0.2], gammas: [0.3] }),
      'XVAL_PARAMS_LENGTH',
      /betas and gammas must be paired/,
    );
    assertRefused(
      () => exportCircuit(inst, { betas: [0.1], gammas: [0.2, 0.3] }, 16),
      'XVAL_PARAMS_LENGTH',
      /exportCircuit/,
    );
    // statevector/layout mismatch and negative depth
    assertRefused(
      () => applyRX(new Float64Array(6), 2, 0, 0.5),
      'XVAL_LAYOUT_MISMATCH',
      /statevector must carry/,
    );
    assertRefused(() => optimizeOffline(inst, -1), 'XVAL_DEPTH_RANGE', /integer >= 0/);
    // qubit index out of [0, n)
    assertRefused(
      () => applyRX(uniformState(2), 2, 2, 0.5),
      'XVAL_N_RANGE',
      /qubit index must be an integer in \[0, n\)/,
    );
  });

  it('applyRX sign convention pinned at the hand anchor θ=π (frozen conjugate mixer)', () => {
    // |0> = real[1,0] | imag[0,0]; θ=π → amp(|1>) = +i EXACTLY (textbook
    // RX(π) would give −i; the kernel's frozen convention is e^{+i(θ/2)X} —
    // the X4 export must be consumed with the same sign)
    const psi = new Float64Array([1, 0, 0, 0]);
    applyRX(psi, 1, 0, Math.PI);
    // cos(π/2) carries float dust (6.1e-17) — assert with tolerance, the SIGN
    // of the imaginary part is the pinned quantity
    assert.ok(Math.abs(psi[0]!) < 1e-15, `Re amp(|0>) = ${String(psi[0])} 应为 0`);
    assert.ok(Math.abs(psi[1]!) < 1e-15, `Re amp(|1>) = ${String(psi[1])} 应为 0`);
    assert.ok(Math.abs(psi[2]!) < 1e-15, `Im amp(|0>) = ${String(psi[2])} 应为 0`);
    assert.ok(
      Math.abs(psi[3]! - 1) < 1e-15,
      `Im amp(|1>) = ${String(psi[3])} 应为 +1 —— 共轭号，非教科书 RX`,
    );
  });

  it('legal neighbors of every guarded kernel stay exact referees', () => {
    // the guards refuse contraband only — legal boundary inputs still work:
    // shots=1, flipProb endpoints 0 and 1 stay legal
    const psi = uniformState(2);
    const zeroNoise = sampleWithReadoutNoise(psi, 2, 0, 1, 0, makeRng(5));
    assert.equal(zeroNoise.shots, 1);
    const fullFlip = sampleWithReadoutNoise(psi, 2, 0, 8, 1, makeRng(5));
    assert.ok(fullFlip.calibratedHitRate >= 0 && fullFlip.calibratedHitRate <= 1);
    // p=0 (uniform-state anchor) is legal
    const inst: Instance = set[0]!;
    assert.deepEqual(optimizeOffline(inst, 0), { betas: [], gammas: [] });
  });
});

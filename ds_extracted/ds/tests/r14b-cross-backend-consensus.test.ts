/**
 * R14 创新 · cross-backend-consensus 钉板（代理 B · QPU+总线域）
 *
 * 覆盖四张面：
 * - 融合与共识胜者（福利优先 → 融合次数 → 字典序的显式平局规则）；
 * - Wilson 区间（手推端点闭式 k=0/k=n 锚 + 收缩单调性 + 非法入参点名拒绝）；
 * - 一致性统计（tau-b 完全一致/完全反序/全并列 null；TVD 相同/不交支撑）；
 * - 与 solve.ts 闸门口径的显式对齐/差异（错长行计非法、非 ±1 按未选中
 *   解码、occurrences 失配点名拒绝——走私审判风格负对照）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { defaultPenalties } from '../src/core/quantum-optimizer.js';
import type { QpuSampleSet } from '../src/core/qpu/quantum-backend.js';
import {
  crossBackendConsensus,
  wilsonInterval,
  WILSON_Z_95,
} from '../src/core/qpu/cross-backend-consensus.js';
import { BackendError, QuantumEstimateError } from '../src/utils/errors.js';

const EPS = 1e-9;

/** 2×3 固定问题：welfare [0,1]=1.7 > [1,2]=0.8 > [2,0]=0.2 */
function makeProblem(): AssignmentProblem {
  const p: AssignmentProblem = {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights: [
      [0.9, 0.5, 0.1],
      [0.1, 0.8, 0.3],
    ],
    ineligible: [
      [false, false, false],
      [false, false, false],
    ],
    couplings: new Map(),
    penaltyOneHot: 0,
    penaltyCapacity: 0,
  };
  const pen = defaultPenalties(p);
  p.penaltyOneHot = pen.oneHot;
  p.penaltyCapacity = pen.capacity;
  return p;
}

function spinsOf(assignment: number[], m: number, n: number): number[] {
  const spins = new Array<number>(m * n).fill(1);
  for (let t = 0; t < m; t++) spins[t * n + assignment[t]!] = -1;
  return spins;
}

function setOf(spins: number[][], occurrences: number[]): QpuSampleSet {
  return { spins, energies: [], occurrences, solver: 'test-stub', realHardware: false };
}

describe('R14B · wilsonInterval（数值锚 + 负对照）', () => {
  it('k=0 端点闭式：low=0，high=z²/(n+z²)（手推特化）', () => {
    // p̂=0 → center=half=z²/(2n+2z²)，high = z²/(n+z²)。z=2, n=100：4/104
    const w = wilsonInterval(0, 100, 2);
    assert.equal(w.low, 0);
    assert.ok(Math.abs(w.high - 4 / 104) < 1e-12, `high=${w.high}`);
  });

  it('k=n 端点闭式：high=1，low=n/(n+z²)', () => {
    const w = wilsonInterval(100, 100, 2);
    assert.equal(w.high, 1);
    assert.ok(Math.abs(w.low - 100 / 104) < 1e-12, `low=${w.low}`);
  });

  it('区间包含 p̂，且同频率下随 n 收缩', () => {
    const a = wilsonInterval(50, 100, WILSON_Z_95);
    assert.ok(a.low <= 0.5 && 0.5 <= a.high);
    const b = wilsonInterval(5, 10, WILSON_Z_95);
    assert.ok(a.high - a.low < b.high - b.low, 'n=100 区间必须窄于 n=10');
  });

  it('负对照：k>n / 非整数 / n=0 / z≤0 被点名拒绝', () => {
    assert.throws(() => wilsonInterval(101, 100, 1.96), QuantumEstimateError);
    assert.throws(() => wilsonInterval(1.5, 100, 1.96), QuantumEstimateError);
    assert.throws(() => wilsonInterval(1, 0, 1.96), QuantumEstimateError);
    assert.throws(
      () => wilsonInterval(1, 10, 0),
      (e: unknown) => {
        assert.ok(e instanceof QuantumEstimateError);
        assert.match(e.message, /positive finite/);
        return true;
      },
    );
    assert.throws(() => wilsonInterval(1, 10, -1), QuantumEstimateError);
  });
});

describe('R14B · 跨后端融合与共识胜者', () => {
  it('福利优先：融合计数更低的最高福利分配胜出；逐后端面齐全', () => {
    const problem = makeProblem();
    // A: [0,1]×60 + [1,2]×30 + 非法(全+1)×10；B: [1,2]×90 + 非法×10
    const a = setOf(
      [spinsOf([0, 1], 2, 3), spinsOf([1, 2], 2, 3), new Array<number>(6).fill(1)],
      [60, 30, 10],
    );
    const b = setOf([spinsOf([1, 2], 2, 3), new Array<number>(6).fill(1)], [90, 10]);
    const r = crossBackendConsensus(problem, [
      { backend: 'local-subspace', samples: a },
      { backend: 'dwave:hybrid', samples: b },
    ]);

    // 共识胜者：[0,1] 融合 60 < [1,2] 融合 120，但福利 1.7 > 0.8 → 福利优先
    assert.deepEqual(r.assignment, [0, 1]);
    assert.ok(Math.abs(r.welfare - 1.7) < EPS);
    assert.equal(r.fusedOccurrences, 60);
    assert.equal(r.totalOccurrences, 200);
    assert.equal(r.fusedFrequency, 0.3);
    assert.ok(r.fusedFrequencyWilson.low <= 0.3 && 0.3 <= r.fusedFrequencyWilson.high);

    // B 的顶层是 [1,2] → 与共识分歧
    assert.equal(r.disagreement, true);
    const statsA = r.perBackend.find((s) => s.backend === 'local-subspace')!;
    const statsB = r.perBackend.find((s) => s.backend === 'dwave:hybrid')!;
    assert.deepEqual(statsA.topAssignment, [0, 1]);
    assert.equal(statsA.agreesWithConsensus, true);
    assert.equal(statsA.validOccurrences, 90);
    assert.equal(statsA.invalidOccurrences, 10);
    assert.equal(statsA.uniqueAssignments, 2);
    assert.equal(statsA.topFrequency, 0.6); // 分母=全部出现次数（solve.ts sampleFrequency 同口径）
    assert.ok(Math.abs(statsA.consensusShare - 60 / 90) < EPS);
    assert.deepEqual(statsB.topAssignment, [1, 2]);
    assert.equal(statsB.agreesWithConsensus, false);
    assert.ok(Math.abs(statsB.consensusShare - 0) < EPS); // B 从未采样到 [0,1]
    // 两两统计恰 1 对
    assert.equal(r.pairwise.length, 1);
  });

  it('平局规则：福利并列 → 融合次数 → 字典序（与传入顺序无关）', () => {
    // 等权问题：[0,1] 与 [1,0] 福利相同
    const problem: AssignmentProblem = {
      ...makeProblem(),
      weights: [
        [0.5, 0.5, 0],
        [0.5, 0.5, 0],
      ],
    };
    const pen = defaultPenalties(problem);
    problem.penaltyOneHot = pen.oneHot;
    problem.penaltyCapacity = pen.capacity;
    const s = setOf([spinsOf([1, 0], 2, 3), spinsOf([0, 1], 2, 3)], [7, 7]);
    const r = crossBackendConsensus(problem, [{ backend: 'x', samples: s }]);
    assert.deepEqual(r.assignment, [0, 1], '次数并列 → 字典序最小');
    // 传入顺序翻转（同一后端拆两条样本的顺序变化）不改变胜者
    const s2 = setOf([spinsOf([0, 1], 2, 3), spinsOf([1, 0], 2, 3)], [7, 7]);
    assert.deepEqual(
      crossBackendConsensus(problem, [{ backend: 'x', samples: s2 }]).assignment,
      [0, 1],
    );
  });

  it('单后端：pairwise 为空，逐后端面仍成立', () => {
    const problem = makeProblem();
    const s = setOf([spinsOf([0, 1], 2, 3)], [42]);
    const r = crossBackendConsensus(problem, [{ backend: 'solo', samples: s }]);
    assert.equal(r.pairwise.length, 0);
    assert.equal(r.perBackend.length, 1);
    assert.equal(r.disagreement, false);
    assert.equal(r.fusedFrequency, 1);
  });
});

describe('R14B · 两两一致性统计（tau-b / TVD）', () => {
  function distOf(counts: Array<[number[], number]>): QpuSampleSet {
    return {
      spins: counts.map(([a]) => spinsOf(a, 2, 3)),
      energies: [],
      occurrences: counts.map(([, c]) => c),
      solver: 'stub',
      realHardware: false,
    };
  }
  const problem = makeProblem();

  it('完全一致的计数分布：tau-b = 1，TVD = 0', () => {
    const r = crossBackendConsensus(problem, [
      {
        backend: 'A',
        samples: distOf([
          [[0, 1] as number[], 6],
          [[1, 2] as number[], 3],
          [[2, 0] as number[], 1],
        ]),
      },
      {
        backend: 'B',
        samples: distOf([
          [[0, 1] as number[], 6],
          [[1, 2] as number[], 3],
          [[2, 0] as number[], 1],
        ]),
      },
    ]);
    const p = r.pairwise[0]!;
    assert.ok(Math.abs(p.kendallTauB! - 1) < EPS);
    assert.ok(Math.abs(p.totalVariation!) < EPS);
  });

  it('完全反序：tau-b = -1；TVD = 1/3（手算）', () => {
    const r = crossBackendConsensus(problem, [
      {
        backend: 'A',
        samples: distOf([
          [[0, 1] as number[], 3],
          [[1, 2] as number[], 2],
          [[2, 0] as number[], 1],
        ]),
      },
      {
        backend: 'B',
        samples: distOf([
          [[0, 1] as number[], 1],
          [[1, 2] as number[], 2],
          [[2, 0] as number[], 3],
        ]),
      },
    ]);
    const p = r.pairwise[0]!;
    assert.ok(Math.abs(p.kendallTauB! - -1) < EPS);
    // p_a=(1/2,1/3,1/6), p_b=(1/6,1/3,1/2) → TVD = 0.5·(1/3+0+1/3) = 1/3
    assert.ok(Math.abs(p.totalVariation! - 1 / 3) < EPS);
  });

  it('一侧全并列：tau-b = null（无定义不伪造 0）；TVD 仍有值', () => {
    // A 两个候选各 1 次（x 全并列）→ 分母 0 → null
    const r = crossBackendConsensus(problem, [
      {
        backend: 'A',
        samples: distOf([
          [[0, 1] as number[], 1],
          [[1, 2] as number[], 1],
        ]),
      },
      {
        backend: 'B',
        samples: distOf([
          [[0, 1] as number[], 2],
          [[1, 2] as number[], 1],
        ]),
      },
    ]);
    const p = r.pairwise[0]!;
    assert.equal(p.kendallTauB, null);
    // p_a=(1/2,1/2), p_b=(2/3,1/3) → TVD = 0.5·(1/6+1/6) = 1/6
    assert.ok(Math.abs(p.totalVariation! - 1 / 6) < EPS);
  });

  it('一侧零合法样本：tau-b 与 TVD 均 null；disagreement=true', () => {
    const r = crossBackendConsensus(problem, [
      { backend: 'A', samples: distOf([[[0, 1] as number[], 5]]) },
      { backend: 'B', samples: setOf([new Array<number>(6).fill(1)], [5]) }, // 全非法
    ]);
    const p = r.pairwise[0]!;
    assert.equal(p.kendallTauB, null); // B 侧全 0 计数 → 全并列 → null
    assert.equal(p.totalVariation, null); // B 合法质量 0 → 分布未定义
    const statsB = r.perBackend.find((s) => s.backend === 'B')!;
    assert.equal(statsB.topAssignment, null);
    assert.equal(statsB.topFrequency, 0);
    assert.equal(statsB.validOccurrences, 0);
    assert.equal(r.disagreement, true);
  });

  it('不交支撑（各自全质量在不同分配上）：TVD = 1', () => {
    const r = crossBackendConsensus(problem, [
      { backend: 'A', samples: distOf([[[0, 1] as number[], 10]]) },
      { backend: 'B', samples: distOf([[[1, 2] as number[], 10]]) },
    ]);
    assert.ok(Math.abs(r.pairwise[0]!.totalVariation! - 1) < EPS);
  });
});

describe('R14B · 与闸门口径的对齐与差异（负对照）', () => {
  const problem = makeProblem();

  it('错长自旋行按非法样本计数（solve.ts 同口径），不拒收', () => {
    const s = setOf(
      [spinsOf([0, 1], 2, 3), new Array<number>(5).fill(1)], // 第二行错长（5≠6）
      [8, 7],
    );
    const r = crossBackendConsensus(problem, [{ backend: 'x', samples: s }]);
    const stats = r.perBackend[0]!;
    assert.equal(stats.validOccurrences, 8);
    assert.equal(stats.invalidOccurrences, 7);
    assert.ok(Math.abs(stats.topFrequency - 8 / 15) < EPS);
    assert.ok(Math.abs(r.fusedFrequency - 8 / 15) < EPS);
  });

  it('非 ±1 值按未选中解码（solve.ts 同口径）：可产出合法分配', () => {
    // t0: a0=-1（选中）、a1=0.5（非 ±1 → 按未选中）；t1: a2=-1 → [0,2] 合法
    const row = [-1, 0.5, 1, 1, 1, -1];
    const s = setOf([row], [3]);
    const r = crossBackendConsensus(problem, [{ backend: 'x', samples: s }]);
    assert.deepEqual(r.assignment, [0, 2]);
    assert.equal(r.perBackend[0]!.invalidOccurrences, 0);
  });

  it('负对照：occurrences 失配点名拒绝（solve.ts 容忍 ?? 1，这里不）', () => {
    const s = setOf([spinsOf([0, 1], 2, 3)], [5]);
    s.occurrences = [5, 3]; // 计数比自旋多一条
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: s }]),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /occurrences/);
        return true;
      },
    );
  });

  it('负对照：空报告 / 空后端名 / 重名 / 零样本 / 非法 z', () => {
    assert.throws(
      () => crossBackendConsensus(problem, []),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /at least one backend report/);
        return true;
      },
    );
    const s = setOf([spinsOf([0, 1], 2, 3)], [1]);
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: '', samples: s }]),
      /non-empty string/,
    );
    assert.throws(
      () =>
        crossBackendConsensus(problem, [
          { backend: 'x', samples: s },
          { backend: 'x', samples: s },
        ]),
      /duplicate backend name/,
    );
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: setOf([], []) }]),
      /returned 0 samples/,
    );
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: s }], { z: 0 }),
      (e: unknown) => {
        assert.ok(e instanceof QuantumEstimateError);
        assert.match(e.message, /positive finite/);
        return true;
      },
    );
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: s }], { z: Number.NaN }),
      QuantumEstimateError,
    );
  });

  it('负对照：伪造计量单位被点名拒绝（负计数 / NaN / 全零计数）', () => {
    const badOcc = setOf([spinsOf([0, 1], 2, 3)], [-1]);
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: badOcc }]),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /negative occurrence count/);
        return true;
      },
    );
    const nanOcc = setOf([spinsOf([0, 1], 2, 3)], [Number.NaN]);
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: nanOcc }]),
      /non-finite or negative occurrence/,
    );
    const zeroOcc = setOf([spinsOf([0, 1], 2, 3)], [0]);
    assert.throws(
      () => crossBackendConsensus(problem, [{ backend: 'x', samples: zeroOcc }]),
      /zero total occurrences/,
    );
  });

  it('非法键备忘：同键重复无效样本按出现次数累计，不重复重验语义面', () => {
    const bad = new Array<number>(6).fill(1); // 空分配 → 非法
    const s = setOf([bad, bad, spinsOf([0, 1], 2, 3)], [4, 6, 5]);
    const r = crossBackendConsensus(problem, [{ backend: 'x', samples: s }]);
    assert.equal(r.perBackend[0]!.invalidOccurrences, 10);
    assert.equal(r.perBackend[0]!.validOccurrences, 5);
    assert.deepEqual(r.assignment, [0, 1]);
  });
});

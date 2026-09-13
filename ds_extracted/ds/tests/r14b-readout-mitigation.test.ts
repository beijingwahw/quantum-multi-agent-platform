/**
 * R14 创新 · readout-mitigation 钉板（代理 B · QPU+总线域）
 *
 * 覆盖四张面：
 * - 闭式块代价 + MAP 解码（手推锚：完美读出 d=0、单比特翻转的 one-hot
 *   违约被解码回真分配 d=1、资格掩码改变最近邻）；
 * - f=0 退化为 naive 计数（无噪声锚点）与 f=0.5 的均匀退化（边界合法）；
 * - f>0 的解析权重（f^d(1−f)^{N−d} 手算值逐位对账）与质量回收率；
 * - 负对照（走私审判风格）：f>0.5 似然反序、非 ±1 自旋、错长行、
 *   空样本、计数失配、非法/错长/空候选清单——全部点名拒绝。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { defaultPenalties } from '../src/core/quantum-optimizer.js';
import type { QpuSampleSet } from '../src/core/qpu/quantum-backend.js';
import {
  hammingBlockCosts,
  mapDecodeAssignment,
  mitigateReadout,
} from '../src/core/qpu/readout-mitigation.js';
import { BackendError, QuantumEstimateError } from '../src/utils/errors.js';

const EPS = 1e-12;

/** 2×3 固定问题：welfare [0,1]=1.7、[1,2]=0.8、[2,0]=0.2 */
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

describe('R14B · 闭式块代价与 MAP 解码', () => {
  it('完美读出：块代价闭式手锚，d([0,1])=0', () => {
    const problem = makeProblem();
    const spins = spinsOf([0, 1], 2, 3); // [-1,1,1, 1,-1,1]
    const costs = hammingBlockCosts(problem, spins);
    // t0 块内 1 个 -1：a0→0、a1→2、a2→2；t1 同构
    assert.deepEqual(costs[0], [0, 2, 2]);
    assert.deepEqual(costs[1], [2, 0, 2]);
    const map = mapDecodeAssignment(problem, spins);
    assert.deepEqual(map.assignment, [0, 1]);
    assert.equal(map.hammingDistance, 0);
  });

  it('单比特翻转的 one-hot 违约：MAP 解码回真分配 [0,1]，d=1', () => {
    const problem = makeProblem();
    // 真 [0,1]，(t0,a1) 被读翻：t0 块 [-1,-1,1]（naive 解码 one-hot 违约 → 非法）
    const spins = [-1, -1, 1, 1, -1, 1];
    const costs = hammingBlockCosts(problem, spins);
    // t0 块 2 个 -1：a0→1、a1→1、a2→3；t1 块 1 个 -1：[2,0,2]
    assert.deepEqual(costs[0], [1, 1, 3]);
    assert.deepEqual(costs[1], [2, 0, 2]);
    const map = mapDecodeAssignment(problem, spins);
    // [0,1]=1+0=1 是唯一最近合法分配（次近 3）
    assert.deepEqual(map.assignment, [0, 1]);
    assert.equal(map.hammingDistance, 1);
  });

  it('资格掩码改变最近邻：a0 无资格时 MAP 避开 a0（手算唯一最近 [2,1]）', () => {
    const problem = makeProblem();
    problem.ineligible = [
      [true, false, false],
      [false, false, false],
    ];
    const spins = spinsOf([0, 1], 2, 3);
    const map = mapDecodeAssignment(problem, spins);
    assert.notEqual(map.assignment[0], 0, '无资格格不得被 MAP 选中');
    // cost0 = [0,2,2]（a0 被掩码排除），cost1 = [2,0,2]：
    // 可行组合最近 = a2 + a1 = 2 + 0 = 2，唯一（其余组合 ≥ 4）
    assert.deepEqual(map.assignment, [2, 1]);
    assert.equal(map.hammingDistance, 2);
    assert.ok(
      map.assignment.every((a) => a >= 0),
      '仍须给出完整合法分配',
    );
  });

  it('负对照：错长自旋 / 非 ±1 自旋被点名拒绝（与 solve.ts 容错姿态的差异面）', () => {
    const problem = makeProblem();
    assert.throws(
      () => hammingBlockCosts(problem, new Array<number>(5).fill(1)),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /spins length 5 != m\*n = 6/);
        return true;
      },
    );
    const bad = spinsOf([0, 1], 2, 3);
    bad[1] = 0.5;
    assert.throws(
      () => hammingBlockCosts(problem, bad),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /must be exactly ±1/);
        return true;
      },
    );
  });
});

describe('R14B · 后验频率估计（mitigateReadout）', () => {
  /** 固定样本集：[0,1]×60（合法）、[1,2]×30（合法）、单翻转移位行×10（非法） */
  function standardSet(): QpuSampleSet {
    return setOf(
      [spinsOf([0, 1], 2, 3), spinsOf([1, 2], 2, 3), [-1, -1, 1, 1, -1, 1]],
      [60, 30, 10],
    );
  }

  it('f=0 锚点：退化为 naive 计数，非法样本零贡献', () => {
    const problem = makeProblem();
    const r = mitigateReadout(problem, standardSet(), 0);
    assert.equal(r.observedInvalidRate, 0.1);
    const top = r.candidates[0]!;
    assert.deepEqual(top.assignment, [0, 1]);
    assert.equal(top.naiveCount, 60);
    assert.equal(top.mitigatedCount, 60);
    assert.ok(Math.abs(top.mitigatedFrequency - 2 / 3) < EPS);
    assert.equal(top.meanHammingDistance, 0);
    const second = r.candidates[1]!;
    assert.equal(second.mitigatedCount, 30);
    // 质量回收：合法样本质量全部落回候选（非法样本在 f=0 下无 d=0 候选）
    assert.ok(Math.abs(r.recoveredMass - 0.9) < EPS);
  });

  it('f=0.1 解析权重：f^d(1−f)^{N−d} 手算值逐位对账', () => {
    const problem = makeProblem();
    // 单条非法样本（d=1 到 [0,1]）：
    //   w([0,1]) = 0.1 · 0.9^5 = 0.059049
    const r = mitigateReadout(problem, setOf([[-1, -1, 1, 1, -1, 1]], [1]), 0.1);
    assert.equal(r.totalReads, 1);
    const top = r.candidates[0]!;
    assert.deepEqual(top.assignment, [0, 1]); // 唯一候选 = MAP 解码
    assert.ok(Math.abs(top.mitigatedCount - 0.1 * 0.9 ** 5) < EPS);
    assert.equal(top.mitigatedFrequency, 1);
    assert.equal(top.meanHammingDistance, 1);
    assert.ok(Math.abs(r.recoveredMass - 0.1 * 0.9 ** 5) < EPS);
    assert.equal(r.observedInvalidRate, 1);
  });

  it('混合样本 + f=0.1：缓解把非法样本质量按似然分回候选（全交叉项手算）', () => {
    const problem = makeProblem();
    const r = mitigateReadout(problem, standardSet(), 0.1);
    const c01 = r.candidates.find((c) => c.assignment.join() === '0,1')!;
    const c12 = r.candidates.find((c) => c.assignment.join() === '1,2')!;
    // 距离矩阵（N=6）：[0,1]样本→[0,1]:0 →[1,2]:4；[1,2]样本→[0,1]:4 →[1,2]:0；
    // 非法行→[0,1]:1 →[1,2]:3。P(s|A) = f^d(1−f)^{6−d}：
    const w01 = 60 * 0.9 ** 6 + 30 * 0.1 ** 4 * 0.9 ** 2 + 10 * 0.1 * 0.9 ** 5;
    const w12 = 60 * 0.1 ** 4 * 0.9 ** 2 + 30 * 0.9 ** 6 + 10 * 0.1 ** 3 * 0.9 ** 3;
    assert.ok(Math.abs(c01.mitigatedCount - w01) < 1e-9, `w01=${w01} got=${c01.mitigatedCount}`);
    assert.ok(Math.abs(c12.mitigatedCount - w12) < 1e-9, `w12=${w12} got=${c12.mitigatedCount}`);
    const total = w01 + w12;
    assert.ok(Math.abs(c01.mitigatedFrequency - w01 / total) < 1e-9);
    assert.ok(Math.abs(r.recoveredMass - total / 100) < 1e-9);
    // 条件平均距离（分子含全交叉项：[1,2] 样本以 d=4 小权重参与）
    const meanD01 = (10 * 0.1 * 0.9 ** 5 * 1 + 30 * 0.1 ** 4 * 0.9 ** 2 * 4) / w01;
    assert.ok(Math.abs(c01.meanHammingDistance! - meanD01) < 1e-9);
    // 排序：w01 > w12
    assert.equal(r.candidates[0]!.assignment.join(), '0,1');
  });

  it('f=0.5 退化边界合法：似然与 d 无关 → 均匀 quasi-后验', () => {
    const problem = makeProblem();
    const r = mitigateReadout(problem, standardSet(), 0.5);
    // 每候选权重 = 0.5^6 · 100；两候选 → 频率各 1/2
    assert.equal(r.candidates.length, 2);
    for (const c of r.candidates) {
      assert.ok(Math.abs(c.mitigatedFrequency - 0.5) < EPS);
    }
    assert.ok(Math.abs(r.recoveredMass - (2 * 0.5 ** 6 * 100) / 100) < EPS);
  });

  it('非法行 MAP 按自旋行去重：同两条相同非法行只解码一次（行为面）', () => {
    const problem = makeProblem();
    const row = [-1, -1, 1, 1, -1, 1];
    const r = mitigateReadout(problem, setOf([row, row], [5, 5]), 0.1);
    assert.equal(r.totalReads, 10);
    assert.deepEqual(r.candidates[0]!.assignment, [0, 1]);
    assert.ok(Math.abs(r.candidates[0]!.mitigatedCount - 10 * 0.1 * 0.9 ** 5) < EPS);
  });
});

describe('R14B · 负对照：模型域与输入域的点名拒绝', () => {
  const problem = makeProblem();
  const good = setOf([spinsOf([0, 1], 2, 3)], [1]);

  it('flipProb > 0.5（似然反序）/ 负值 / NaN', () => {
    for (const f of [0.51, 1, -0.1, Number.NaN]) {
      assert.throws(
        () => mitigateReadout(problem, good, f),
        (e: unknown) => {
          assert.ok(e instanceof QuantumEstimateError, `f=${f}`);
          assert.match(e.message, /likelihood inverts/);
          return true;
        },
      );
    }
    // 边界 0 与 0.5 合法（端点含）
    assert.doesNotThrow(() => mitigateReadout(problem, good, 0));
    assert.doesNotThrow(() => mitigateReadout(problem, good, 0.5));
  });

  it('空样本 / 计数失配 / 非 ±1 / 错长行', () => {
    assert.throws(
      () => mitigateReadout(problem, setOf([], []), 0.1),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /0 spins/);
        return true;
      },
    );
    const mismatch = setOf([spinsOf([0, 1], 2, 3)], [1]);
    mismatch.occurrences = [1, 2];
    assert.throws(
      () => mitigateReadout(problem, mismatch, 0.1),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /occurrences/);
        return true;
      },
    );
    const badSpin = spinsOf([0, 1], 2, 3);
    badSpin[2] = 0; // 非 ±1
    assert.throws(() => mitigateReadout(problem, setOf([badSpin], [1]), 0.1), /must be exactly ±1/);
    assert.throws(
      () => mitigateReadout(problem, setOf([new Array<number>(7).fill(1)], [1]), 0.1),
      /spins length 7 != m\*n = 6/,
    );
  });

  it('负对照：伪造计量单位（负计数 / NaN / 全零计数）被点名拒绝', () => {
    for (const [label, occ] of [
      ['负计数', [-1]],
      ['NaN', [Number.NaN]],
    ] as Array<[string, number[]]>) {
      assert.throws(
        () => mitigateReadout(problem, setOf([spinsOf([0, 1], 2, 3)], occ), 0.1),
        (e: unknown) => {
          assert.ok(e instanceof BackendError, label);
          assert.match(e.message, /occurrence count/);
          return true;
        },
      );
    }
    assert.throws(
      () => mitigateReadout(problem, setOf([spinsOf([0, 1], 2, 3)], [0]), 0.1),
      /zero total occurrences/,
    );
  });

  it('m > n（无合法分配存在）：MAP 解码透传 InfeasibleProblemError', () => {
    const infeasible: AssignmentProblem = {
      taskIds: ['t0', 't1', 't2'],
      agentIds: ['a0', 'a1'],
      weights: [
        [0.5, 0.5],
        [0.5, 0.5],
        [0.5, 0.5],
      ],
      ineligible: [
        [false, false],
        [false, false],
        [false, false],
      ],
      couplings: new Map(),
      penaltyOneHot: 1,
      penaltyCapacity: 1,
    };
    assert.throws(
      () => mapDecodeAssignment(infeasible, spinsOf([0, 0, 0], 3, 2)),
      /tasks <= agents/,
    );
  });

  it('候选清单：空清单 / 错长 / 非法分配（agent 复用）逐项点名', () => {
    assert.throws(
      () => mitigateReadout(problem, good, 0.1, { candidates: [] }),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /candidates is empty/);
        return true;
      },
    );
    assert.throws(
      () => mitigateReadout(problem, good, 0.1, { candidates: [[0]] }),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /length m=2/);
        return true;
      },
    );
    assert.throws(
      () =>
        mitigateReadout(problem, good, 0.1, {
          candidates: [
            [0, 1],
            [0, 0],
          ],
        }),
      (e: unknown) => {
        assert.ok(e instanceof BackendError);
        assert.match(e.message, /candidates\[1\].*not a valid assignment/);
        return true;
      },
    );
    // 合法清单照常工作（含重复去重）
    const r = mitigateReadout(problem, good, 0, {
      candidates: [
        [0, 1],
        [1, 2],
        [0, 1],
      ],
    });
    assert.equal(r.candidates.length, 2);
    assert.equal(r.candidates[0]!.mitigatedCount, 1);
  });
});

/**
 * qiskit-export SELF_CHECK 向量的 int32 边界回归网（2026-09 代码质量遍历）：
 *
 * bitsOf/decodeAssignment（TS 真值）按 int32 位掩码打包与解码：q ≥ 32 时
 * `1 << q` 回绕混叠低位、bit 31 打包出负数。生成物的 Python decode 是
 * 任意精度整数——同一 bits 两侧读位在 NQ ≥ 32 时系统性分歧。修复前
 * m=3、n=15（NQ=45）导出程序内嵌 [65537, [0,1,2]]（Python 实际解得
 * None），m=2、n=31（NQ=62）内嵌负数 bits 向量：导出程序 _run_self_check
 * 启动即 AssertionError。
 *
 * 修复：NQ ≥ 32 时仅嵌入结论完全由任务 0 行决定的安全位型（0/3）。
 * 本文件用 BigInt 实现逐句对应 Python decode 的仲裁解码器，对任何尺寸
 * 的生成物逐条对账。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../../src/core/quantum-optimizer.js';
import { toQiskitProgram } from '../../src/core/qpu/qiskit-export.js';

function makeProblem(m: number, n: number): AssignmentProblem {
  return {
    taskIds: Array.from({ length: m }, (_, t) => `t${t}`),
    agentIds: Array.from({ length: n }, (_, a) => `a${a}`),
    weights: Array.from({ length: m }, () => Array.from({ length: n }, () => 10)),
    ineligible: Array.from({ length: m }, () => new Array<boolean>(n).fill(false)),
    couplings: new Map(),
    penaltyOneHot: 100,
    penaltyCapacity: 100,
  };
}

/** 与生成物 def decode() 逐句对应：任意精度读位（BigInt 模拟 Python int） */
function pythonDecode(bits: number, m: number, n: number): number[] | null {
  const bitAt = (q: number): boolean => ((BigInt(bits) >> BigInt(q)) & 1n) === 1n;
  const assignment: number[] = [];
  const used = new Set<number>();
  for (let t = 0; t < m; t++) {
    let chosen = -1;
    let count = 0;
    for (let a = 0; a < n; a++) {
      if (bitAt(t * n + a)) {
        chosen = a;
        count++;
      }
    }
    if (count !== 1 || used.has(chosen)) return null;
    assignment.push(chosen);
    used.add(chosen);
  }
  return assignment;
}

function selfCheckOf(m: number, n: number): Array<[number, number[] | null]> {
  const program = toQiskitProgram(makeProblem(m, n), { angles: [0.7, 0.2] });
  const match = program.match(/^SELF_CHECK = (\[.*\])$/m);
  assert.ok(match, '生成物应包含 SELF_CHECK 向量表');
  return JSON.parse(match[1]!) as Array<[number, number[] | null]>;
}

describe('qiskit-export SELF_CHECK 的 int32 边界', () => {
  it('NQ=45（m=3,n=15）：每条向量与 Python 任意精度解码一致', () => {
    const vectors = selfCheckOf(3, 15);
    assert.ok(vectors.length >= 2, '至少保留任务 0 行决定的安全位型');
    for (const [bits, expected] of vectors) {
      assert.deepEqual(
        pythonDecode(bits, 3, 15),
        expected,
        `bits=${bits}: 向量锚点与 Python decode 分歧（导出程序启动自检会崩）`,
      );
    }
  });

  it('NQ=62（m=2,n=31）：不嵌入负数 bits（bit 31 打包回绕）', () => {
    const vectors = selfCheckOf(2, 31);
    assert.ok(vectors.length >= 2);
    for (const [bits] of vectors) {
      assert.ok(Number.isInteger(bits) && bits >= 0, `向量 bits 必须非负 int32，got ${bits}`);
    }
    for (const [bits, expected] of vectors) {
      assert.deepEqual(pythonDecode(bits, 2, 31), expected);
    }
  });

  it('小问题（NQ ≤ 31）向量集不变：仍覆盖四类形态', () => {
    const vectors = selfCheckOf(2, 3);
    assert.ok(vectors.length >= 4, '合法/复用/空任务/one-hot 四类形态齐备');
    const results = vectors.map(([, expected]) => expected);
    assert.ok(
      results.some((r) => Array.isArray(r)),
      '应含合法分配向量',
    );
    assert.ok(results.includes(null), '应含 None 向量');
    for (const [bits, expected] of vectors) {
      assert.deepEqual(pythonDecode(bits, 2, 3), expected);
    }
  });
});

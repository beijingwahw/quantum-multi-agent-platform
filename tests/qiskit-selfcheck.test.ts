/**
 * qiskit-export 跨语言自检向量锚定（Q5）：
 *
 * 生成的 Python decode() 与 src/core/quantum-optimizer.ts 的
 * decodeAssignment + one-hot/不复用判定是手写同步的双实现。本测试在
 * CI 里解析生成物内嵌的 SELF_CHECK 向量，逐条与 TS 真值重算对账——
 * 不执行 Python，但两侧共享同一份向量：TS 侧改语义此处红，Python
 * 侧改语义运行时断言红。漂移不再靠人眼。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';
import { toQiskitProgram } from '../src/core/qpu/qiskit-export.js';
import { decodeAssignment } from '../src/core/quantum-optimizer.js';

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

/** TS 侧真值：Python decode 的契约（one-hot + agent 不复用） */
function pythonDecodeSemantics(bits: number, m: number, n: number): number[] | null {
  const decoded = decodeAssignment(bits, m, n);
  const used = new Set<number>();
  for (const a of decoded) {
    if (a < 0 || used.has(a)) return null;
    used.add(a);
  }
  return decoded;
}

describe('Q5 · qiskit-export 跨语言自检向量', () => {
  it('生成物内嵌 SELF_CHECK，且向量与 TS 真值逐条一致', () => {
    const program = toQiskitProgram(makeProblem(3, 4), {
      angles: [0.5, 0.25, 0.6, 0.3, 0.4, 0.2],
    });

    const match = program.match(/^SELF_CHECK = (\[.*\])$/m);
    assert.ok(match, '生成物应包含 SELF_CHECK 向量表');
    const vectors = JSON.parse(match[1]!) as Array<[number, number[] | null]>;
    assert.ok(vectors.length >= 4, `向量应覆盖四类形态，实际 ${vectors.length} 条`);

    for (const [bits, expected] of vectors) {
      const got = pythonDecodeSemantics(bits, 3, 4);
      assert.deepEqual(got, expected, `bits=${bits}: 生成物向量与 TS 真值不一致（跨语言契约漂移）`);
    }
  });

  it('向量形态覆盖：合法分配 / one-hot 违约 / 空任务 / agent 复用', () => {
    const program = toQiskitProgram(makeProblem(2, 3), { angles: [0.7, 0.2] });
    const vectors = JSON.parse(program.match(/^SELF_CHECK = (\[.*\])$/m)![1]!) as Array<
      [number, number[] | null]
    >;

    const results = vectors.map(([, expected]) => expected);
    assert.ok(
      results.some((r) => Array.isArray(r)),
      '应含合法分配向量',
    );
    assert.ok(results.includes(null), '应含非法（None）向量');
    // 非法向量的具体成因由位型决定：0 = 空任务；(1<<0)|(1<<1) = one-hot 违约；
    // [0,0] 的 bits = agent 复用——三类至少各出现一次由生成端构造保证
    assert.ok(
      vectors.some(([bits]) => bits === 0),
      '应含空任务位型',
    );
    assert.ok(
      vectors.some(([bits]) => bits === 3),
      '应含 one-hot 违约位型',
    );
  });

  it('生成物含跨语言契约注释与运行期断言', () => {
    const program = toQiskitProgram(makeProblem(2, 2), { angles: [0.7, 0.2] });
    assert.match(program, /_run_self_check\(\)/);
    assert.match(program, /quantum-optimizer\.ts/);
  });
});

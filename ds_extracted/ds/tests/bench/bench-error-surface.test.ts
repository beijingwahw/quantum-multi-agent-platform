/**
 * bench 错误面收敛测试：src/bench 的三处 throw 全部落入 PlatformError
 * 层级（BenchReportError / QuantumEngineError），调用方可按类别捕获——
 * 这是「src 内所有 throw 一律抛层级子类」约定在 bench 域的兑现证明。
 *
 * 反挑选法律的拒绝面（render/write 拒绝非法 run）与子空间维度上限面
 * 各自断言：错误类名、instanceof PlatformError、消息关键片段（含
 * checkRun 定罪的 problems 明细）。既有断言（tests/sched-bench）只按
 * 消息正则定罪；本文件补上「错误类型面」这一层。
 */
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssignmentProblem } from '../../src/core/quantum-optimizer.js';
import {
  greedyOpponent,
  hungarianOpponent,
  subspaceExactSolver,
} from '../../src/bench/opponents.js';
import { recordFamily } from '../../src/bench/generator.js';
import { runBenchmark, type BenchRun } from '../../src/bench/runner.js';
import { renderMarkdown, writeReports } from '../../src/bench/report.js';
import { BenchReportError, PlatformError, QuantumEngineError } from '../../src/utils/errors.js';

/** 铸一个合法的小矩阵 run（expectedCells 由 runBenchmark 铸造，不可伪造） */
function mintLegalRun(): BenchRun {
  const specs = recordFamily()
    .filter((s) => s.m === 2 && s.n === 3)
    .slice(0, 2);
  return runBenchmark(specs, [hungarianOpponent, greedyOpponent], 42);
}

describe('bench 错误面（PlatformError 层级收敛）', () => {
  describe('renderMarkdown / writeReports 拒绝非法 run（BenchReportError）', () => {
    it('删行（反挑选法律）：renderMarkdown 抛 BenchReportError，携带 selection suspected 明细', () => {
      const run = mintLegalRun();
      const forged: BenchRun = { ...run, rows: run.rows.slice(0, -1) };
      let caught: unknown;
      try {
        renderMarkdown(forged);
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof BenchReportError, '必须是 BenchReportError（不再是裸 Error）');
      assert.ok(caught instanceof PlatformError, 'BenchReportError 应是 PlatformError 子类');
      assert.equal(caught.name, 'BenchReportError');
      assert.match(caught.message, /refusing to render an illegal run/);
      assert.match(caught.message, /selection suspected/);
    });

    it('删行：writeReports 在写盘前拦截，抛 BenchReportError', () => {
      const run = mintLegalRun();
      const forged: BenchRun = { ...run, rows: run.rows.slice(0, -1) };
      let caught: unknown;
      try {
        // 校验先于任何 fs 调用；目录指向 tmp——即使守卫回归也不污染 out/bench
        writeReports(forged, resolve(tmpdir(), 'ds-bench-error-surface'));
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof BenchReportError, '必须是 BenchReportError（不再是裸 Error）');
      assert.ok(caught instanceof PlatformError, 'BenchReportError 应是 PlatformError 子类');
      assert.equal(caught.name, 'BenchReportError');
      assert.match(caught.message, /refusing to write an illegal run/);
      assert.match(caught.message, /selection suspected/);
    });

    it('重复格（行数对但伪造行）：checkRun 定罪 duplicate cell，renderMarkdown 同样拒绝', () => {
      const run = mintLegalRun();
      // 行数保持 expectedCells 不变，把末行替换为首行副本 → 行数检查通过、重复格检查触发
      const dupSource = run.rows[0]!;
      const forged: BenchRun = { ...run, rows: [...run.rows.slice(0, -1), dupSource] };
      const dupKey = `${dupSource.instanceId}::${dupSource.solver}`;
      let caught: unknown;
      try {
        renderMarkdown(forged);
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof BenchReportError, '必须是 BenchReportError（不再是裸 Error）');
      assert.ok(caught instanceof PlatformError, 'BenchReportError 应是 PlatformError 子类');
      assert.equal(caught.name, 'BenchReportError');
      assert.match(caught.message, /refusing to render an illegal run/);
      assert.ok(caught.message.includes(dupKey), `消息应携带定罪格 ${dupKey}`);
    });

    it('缺 expectedCells（伪造者无从铸造）：renderMarkdown 拒绝', () => {
      const run = mintLegalRun();
      const forged = { ...run, expectedCells: undefined } as unknown as BenchRun;
      let caught: unknown;
      try {
        renderMarkdown(forged);
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof BenchReportError, '必须是 BenchReportError（不再是裸 Error）');
      assert.ok(caught instanceof PlatformError, 'BenchReportError 应是 PlatformError 子类');
      assert.match(caught.message, /refusing to render an illegal run/);
      assert.match(caught.message, /selection suspected/);
    });
  });

  it('subspaceExactSolver 维度上限：抛 QuantumEngineError（instance over the dimension cap）', () => {
    // P(11,8) = 6,652,800 > SUBSPACE_DIMENSION_CAP (2^21 = 2,097,152)：
    // 子空间枚举在 cap 处中止 → buildSubspaceModel 返回 null → 求解器拒绝
    const m = 8;
    const n = 11;
    const problem: AssignmentProblem = {
      taskIds: Array.from({ length: m }, (_, i) => `t${i}`),
      agentIds: Array.from({ length: n }, (_, i) => `a${i}`),
      weights: Array.from({ length: m }, (_, t) =>
        Array.from({ length: n }, (_, a) => +(((t + a) % 7) / 7 + 0.15).toFixed(3)),
      ),
      ineligible: Array.from({ length: m }, () => Array.from({ length: n }, () => false)),
      couplings: new Map(),
      penaltyOneHot: 0,
      penaltyCapacity: 0,
    };
    let caught: unknown;
    try {
      subspaceExactSolver.solve(problem);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof QuantumEngineError, '必须是 QuantumEngineError（不再是裸 Error）');
    assert.ok(caught instanceof PlatformError, 'QuantumEngineError 应是 PlatformError 子类');
    assert.equal(caught.name, 'QuantumEngineError');
    assert.match(caught.message, /subspace model build failed/);
    assert.match(caught.message, /dimension cap/);
  });
});

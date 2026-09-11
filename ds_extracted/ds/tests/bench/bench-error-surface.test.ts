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
import { checkRun, runBenchmark, type BenchRun } from '../../src/bench/runner.js';
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

    it('身份篡改（行数与唯一性都完好）：instanceId 与自身 (track,m,n,seed) 不符 → checkRun 定罪，renderMarkdown 拒绝', () => {
      // 反挑选法律的隐藏面：删行会被行数定罪、复制行会被重复格定罪，
      // 但把败局所在实例的 instanceId 改写成另一个（未在 run 中的）名字，
      // 行数与唯一性检查都照常通过——旧 checkRun 放行，报告会把败局伪装成
      // 另一个实例的行。行内一致性检查（id ↔ track/m/n/seed）必须抓住它。
      const run = mintLegalRun();
      const victim = run.rows[0]!;
      const doctoredId = `${victim.track}-m${victim.m}n${victim.n}-s${victim.seed + 999}`;
      const forged: BenchRun = {
        ...run,
        rows: run.rows.map((r) => (r === victim ? { ...r, instanceId: doctoredId } : r)),
      };
      // 行数不变、无重复格——旧检查面（count + duplicate）对此失明
      assert.equal(forged.rows.length, run.expectedCells);
      const problems = checkRun(forged);
      assert.ok(
        problems.some((p) => p.includes('disagrees with its own spec') && p.includes(doctoredId)),
        `应定罪身份篡改（实际 problems: ${problems.join(' | ')}）`,
      );
      let caught: unknown;
      try {
        renderMarkdown(forged);
      } catch (err) {
        caught = err;
      }
      assert.ok(caught instanceof BenchReportError);
      assert.match(caught.message, /doctored identity suspected/);
    });

    it('幽灵求解器（行数与唯一性都完好）：行内 solver 不在 run 声明的 solverIds → checkRun 定罪', () => {
      const run = mintLegalRun();
      const victim = run.rows[0]!;
      const ghost = `${victim.solver}-v2`;
      const forged: BenchRun = {
        ...run,
        rows: run.rows.map((r) => (r === victim ? { ...r, solver: ghost } : r)),
      };
      assert.equal(forged.rows.length, run.expectedCells);
      const problems = checkRun(forged);
      assert.ok(
        problems.some((p) => p.includes('not among the run') && p.includes(ghost)),
        `应定罪幽灵求解器（实际 problems: ${problems.join(' | ')}）`,
      );
      assert.ok(problems.some((p) => p.includes('matrix incomplete')));
    });
  });

  describe('渲染纪律（renderer discipline）', () => {
    it('无法计算的 gap（played 行 optimal≤0）渲染为 —，绝不伪装成 0.0000', () => {
      // 旧行为把 NaN gap 渲染成 0.0000——读起来像零差距，与 hit=no 自相矛盾；
      // 表格自身对 NaN 汇总列的约定就是 —。committed 工件无 NaN gap 行
      //（全部 optimal>0），此改动对冻结字节零影响。
      const run = mintLegalRun();
      const victim = run.rows[0]!;
      const withNanGap: BenchRun = {
        ...run,
        rows: run.rows.map((r) => (r === victim ? { ...r, gap: Number.NaN, hit: false } : r)),
      };
      // 形状仍合法（checkRun 不审计数值，只审计结构与身份）——必须可渲染
      assert.deepEqual(checkRun(withNanGap), []);
      const md = renderMarkdown(withNanGap);
      const line = md
        .split('\n')
        .find((l) => l.includes(`| ${victim.instanceId} | ${victim.solver} |`));
      assert.ok(line, 'per-instance 行必须存在');
      const cells = line.split('|').map((c) => c.trim());
      assert.equal(cells[5], '—', `gap 单元格应为 —（实际行: ${line}）`);
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

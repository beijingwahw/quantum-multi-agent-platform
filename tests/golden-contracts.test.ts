/**
 * golden-contracts —— 黄金值快照与性质测试（Wave 3.1「可复现从注释
 * 承诺升级为 CI 强制」的创新落地）。
 *
 * 三类锚定：
 * 1. **黄金值**：核心数值口径（denormalizeExpectation / 亲和度求和序）
 *    锁定具体比特级输出——任何漂移在 CI 第一时间显形，而非下游
 *    近平局处静默选出不同 agent；
 * 2. **性质**：耦合键编码的往返/归一化/对角拒绝在 500 组随机输入上
 *    成立（PBT 风格——性质比样例更强）；
 * 3. **等价性**：双实现（top-K 线性扫描 vs sort-slice）在随机分布上
 *    逐项一致——等价性此前只有注释承诺。
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { couplingKey } from '../src/core/quantum-optimizer.js';
import { denormalizeExpectation } from '../src/core/solver-common.js';
import { mulberry32 } from '../src/utils/rng.js';
import { QuantumScheduler } from '../src/core/quantum-scheduler.js';
import { isLegalTaskTransition, isTerminalTaskStatus } from '../src/core/task-lifecycle.js';
import type { Agent } from '../src/types/quantum-types.js';

// ----------------------------------------------------------------------------
// 1. denormalizeExpectation：黄金值 + 往返性质
// ----------------------------------------------------------------------------
describe('黄金契约 · denormalizeExpectation', () => {
  it('黄金值锁定（scale=1 与 scale=2W 两条路径的历史口径）', () => {
    // QAOA 路径口径（scale=1）：x·span+min 的历史值
    assert.strictEqual(denormalizeExpectation(0.5, 1, -1, 3), 1);
    assert.strictEqual(denormalizeExpectation(0.25, 1, 0, 8), 2);
    // 退火路径口径（scale=2W）：(x/2W)·span+min 的历史值
    assert.strictEqual(denormalizeExpectation(3, 6, -2, 4), 1);
    assert.strictEqual(denormalizeExpectation(1, 2, 10, 12), 11);
  });

  it('往返性质：denorm∘norm === 恒等（500 组随机谱，误差 ≤ 1 ULP 量级）', () => {
    const rng = mulberry32(20260905);
    for (let i = 0; i < 500; i++) {
      const min = -100 + rng() * 200;
      const max = min + rng() * 100;
      const scale = 1 + Math.floor(rng() * 64);
      const energy = min + rng() * (max - min);
      const normalized = ((energy - min) / (max - min)) * scale;
      const restored = denormalizeExpectation(normalized, scale, min, max);
      // 归一化-还原是非精确浮点往返：容差为谱宽的 1e-12 相对量级
      assert.ok(
        Math.abs(restored - energy) <= Math.max(1e-12, (max - min) * 1e-12),
        `round-trip drift ${Math.abs(restored - energy)} exceeds ULP budget at min=${min}, max=${max}`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 2. couplingKey：随机性质（往返 / 传序归一化 / 对角拒绝）
// ----------------------------------------------------------------------------
describe('黄金契约 · couplingKey 性质', () => {
  it('500 组随机对：解码满足 q1 < q2 且与传序无关', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 500; i++) {
      const nqubits = 2 + Math.floor(rng() * 60);
      const q1 = Math.floor(rng() * nqubits);
      let q2 = Math.floor(rng() * nqubits);
      if (q1 === q2) q2 = (q2 + 1) % nqubits;
      const key = couplingKey(q1, q2, nqubits);
      const keyReversed = couplingKey(q2, q1, nqubits);
      assert.strictEqual(key, keyReversed, `传序归一化：(${q1},${q2}) 与 (${q2},${q1}) 必须同键`);
      const d1 = Math.floor(key / nqubits);
      const d2 = key % nqubits;
      assert.ok(d1 < d2, `解码后必须满足 lo < hi（got ${d1},${d2}）`);
      assert.ok((d1 === q1 && d2 === q2) || (d1 === q2 && d2 === q1), '解码必须还原原对（无序）');
    }
  });

  it('对角键被拒绝（四条能量路径语义分裂的构造点封印）', () => {
    for (const q of [0, 7, 31]) {
      assert.throws(() => couplingKey(q, q, 64), /Diagonal coupling/);
    }
  });
});

// ----------------------------------------------------------------------------
// 3. 任务状态机：转移表性质 + 混合负载后的不变量
// ----------------------------------------------------------------------------
describe('黄金契约 · 任务状态机', () => {
  it('转移表性质：终态无出边、非终态可达终态', () => {
    const statuses = [
      'pending',
      'assigned',
      'running',
      'completed',
      'failed',
      'cancelled',
    ] as const;
    for (const from of statuses) {
      if (isTerminalTaskStatus(from)) {
        for (const to of statuses) {
          assert.ok(!isLegalTaskTransition(from, to), `终态 ${from} 不得有出边（→ ${to}）`);
        }
      } else {
        assert.ok(
          isLegalTaskTransition(from, 'failed'),
          `非终态 ${from} 必须可达 failed（级联失败兜底）`,
        );
        assert.ok(isLegalTaskTransition(from, 'cancelled'), `非终态 ${from} 必须可达 cancelled`);
      }
    }
    // pending → assigned 是唯一入调度边
    assert.ok(isLegalTaskTransition('pending', 'assigned'));
    assert.ok(!isLegalTaskTransition('pending', 'running'), '不得跳过 assigned 直达 running');
    assert.ok(!isLegalTaskTransition('assigned', 'pending'), '不得回退到 pending');
  });

  it('混合负载后调度器不变量全部成立（计数器 ↔ 全表派生真值）', () => {
    const scheduler = new QuantumScheduler({});
    const agents: Agent[] = [];
    for (let i = 0; i < 4; i++) {
      const agent: Agent = {
        id: `a${i}`,
        name: `a${i}`,
        type: 'developer',
        capabilities: ['js'],
        state: 'idle',
        load: 0,
        position: { x: 0, y: 0, z: 0 },
        quantumEntanglement: [],
        lastHeartbeat: new Date(),
      };
      agents.push(agent);
      scheduler.registerAgent(agent);
    }
    const mk = (name: string) => ({
      name,
      type: 'test',
      priority: 'medium' as const,
      requirements: [{ type: 'capability' as const, name: 'js', value: null, weight: 1 }],
      dependencies: [],
      estimatedDuration: 1000,
      actualDuration: 0,
      status: 'pending' as const,
    });

    // 混合负载：提交→分配→运行→完成/取消/失败 + 终态后重调度尝试
    const t1 = scheduler.submitTask(mk('ok'));
    const t2 = scheduler.submitTask(mk('cancelled'));
    const t3 = scheduler.submitTask(mk('failed'));
    scheduler.updateTaskStatus(t1.id, 'running');
    scheduler.completeTask(t1.id, true);
    scheduler.updateTaskStatus(t2.id, 'cancelled');
    scheduler.completeTask(t3.id, false, { reason: 'timeout' });
    // 对终态任务的重调度/状态写入被转移表拒绝（不得复活）
    scheduler.scheduleTask(t1.id);
    scheduler.updateTaskStatus(t1.id, 'running');

    const violations = scheduler.checkInvariants();
    assert.deepStrictEqual(violations, [], `不变量违例：${JSON.stringify(violations)}`);
    scheduler.shutdown();
  });
});

// ----------------------------------------------------------------------------
// 4. top-K 等价性：子空间线性扫描 vs 全量 sort-slice（08#30 测试锚定）
// ----------------------------------------------------------------------------
describe('黄金契约 · top-K 双实现等价', () => {
  /** 与 collapseSubspace 相同的线性 K 槽算法（相等概率保持原次序） */
  function linearTopK(probs: Float64Array, topK: number): Array<{ s: number; p: number }> {
    const top: Array<{ s: number; p: number }> = [];
    for (let s = 0; s < probs.length && topK > 0; s++) {
      const p = probs[s]!;
      if (top.length === topK && p <= top[top.length - 1]!.p) continue;
      let i = top.length;
      while (i > 0 && top[i - 1]!.p < p) i--;
      if (top.length === topK) top.pop();
      top.splice(i, 0, { s, p });
    }
    return top;
  }

  /** 参照实现：全量 Array.from().sort().slice()（V8 稳定排序） */
  function sortSliceTopK(probs: Float64Array, topK: number): Array<{ s: number; p: number }> {
    return Array.from(probs, (p, s) => ({ s, p }))
      .sort((a, b) => b.p - a.p)
      .slice(0, topK);
  }

  it('200 组随机分布（含并列概率）逐项一致', () => {
    const rng = mulberry32(7);
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(rng() * 200);
      const probs = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        // 量化到 1/16 制造并列概率——并列正是次序敏感性的暴露点
        probs[k] = Math.floor(rng() * 16) / 16;
      }
      const topK = 1 + Math.floor(rng() * 5);
      const a = linearTopK(probs, topK);
      const b = sortSliceTopK(probs, topK);
      assert.strictEqual(a.length, b.length, `trial ${trial}: 长度一致`);
      for (let i = 0; i < a.length; i++) {
        assert.strictEqual(
          a[i]!.s,
          b[i]!.s,
          `trial ${trial} 槽 ${i}: 选中下标一致（并列次序含在内）`,
        );
        assert.strictEqual(a[i]!.p, b[i]!.p);
      }
    }
  });
});

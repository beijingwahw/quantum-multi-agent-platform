/**
 * R18 创新 · commutation-ft 钉板（代理 B · QPU+总线域）
 *
 * 覆盖五张面：
 * - 定理 A 匹配下界：手锚（路径/环/团/调度 Ising 形状）+ 小图 brute-force
 *   枚举（「不存在 < Δ(G⁺) 组的合法分解」的反证 referee）；
 * - 定理 B Kőnig 精确：随机二部小图 ×300（seeded）全部零缺口 + 验证器
 *   通过；奇环等非二部图 mode 'koenig' 点名拒绝；
 * - 不变量验证器（走私审判）：共享比特组 / 丢边 / 重复边 / 空组 /
 *   场项-耦合冲突 / 少于下界的方案——逐项定罪；
 * - 定理 C FT 画像缩减：同假设下轮数/信道错误按操作数比例、T 计数与
 *   蒸馏项逐字节不变、调度编码的缩减因子手算钉死；
 * - 输入域负对照：未归一化边 / 越界比特 / 重边 / 域外场项口径。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parallelizeLayer,
  verifyMatchingPartition,
  matchingLowerBound,
  interactionIsBipartite,
  parallelEstimateFtCircuit,
} from '../src/core/qpu/commutation-ft.js';
import type { CouplingEdge } from '../src/core/qpu/commutation-ft.js';
import { surfaceCode, estimateFtCircuit } from '../src/core/qpu/ft-estimate.js';
import { QuantumEstimateError } from '../src/utils/errors.js';

/** mulberry32（与 experiments/qpu-cross-validation/kernel.ts 同惯用法） */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const edge = (a: number, b: number): CouplingEdge => [a, b];

describe('R18B · 定理 A：匹配下界（手锚 + brute-force 反证）', () => {
  it('手锚：调度 Ising 形状 m=4×n=5 → E=70、Δ(G⁺)=m+n−1=8', () => {
    // one-hot 团（每任务 C(n,2)）+ 容量对（每 agent C(m,2)）——toIsing 的 J 结构
    const m = 4;
    const n = 5;
    const couplings: CouplingEdge[] = [];
    for (let t = 0; t < m; t++) {
      for (let a1 = 0; a1 < n; a1++) {
        for (let a2 = a1 + 1; a2 < n; a2++) couplings.push(edge(t * n + a1, t * n + a2));
      }
    }
    for (let a = 0; a < n; a++) {
      for (let t1 = 0; t1 < m; t1++) {
        for (let t2 = t1 + 1; t2 < m; t2++) couplings.push(edge(t1 * n + a, t2 * n + a));
      }
    }
    assert.equal(couplings.length, m * 10 + n * 6); // 4·C(5,2)+5·C(4,2) = 40+30 = 70
    const bound = matchingLowerBound({ nqubits: m * n, couplings, fieldQubits: [0, 1, 2] });
    // 无场项下界：Δ(G) = (n−1)+(m−1) = 7；全场项 = 8
    assert.equal(matchingLowerBound({ nqubits: m * n, couplings, fieldQubits: [] }), 7);
    assert.equal(bound, 8);
  });

  it('brute-force 反证：小图上不存在少于 Δ(G⁺) 组的合法分解（全指派枚举 referee）', () => {
    // K4（6 边团，非二部）+ 全场项：Δ(G)=3 → 下界 4。枚举 10 个项目
    //（6 边 + 4 场项）→ 3 组的全指派（3^10 = 59049），断言无合法方案
    const couplings: CouplingEdge[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) couplings.push(edge(i, j));
    }
    const nq = 4;
    const fields = [0, 1, 2, 3];
    assert.equal(matchingLowerBound({ nqubits: nq, couplings, fieldQubits: fields }), 4);
    // 项目 i（0..5 = 耦合边，6..9 = 场项比特 i−6）；occupied[g] = 组 g 占用的比特集
    const projects: Array<
      | { readonly kind: 'edge'; readonly e: CouplingEdge }
      | { readonly kind: 'field'; readonly v: number }
    > = [
      ...couplings.map((e) => ({ kind: 'edge' as const, e })),
      ...fields.map((v) => ({ kind: 'field' as const, v })),
    ];
    const occupies = (p: (typeof projects)[number]): number[] =>
      p.kind === 'edge' ? [p.e[0], p.e[1]] : [p.v];
    let legalWithThree = false;
    const search = (idx: number, occupied: Array<Set<number>>): void => {
      if (legalWithThree) return;
      if (idx === projects.length) {
        legalWithThree = true;
        return;
      }
      for (let g = 0; g < 3; g++) {
        const bits = occupies(projects[idx]!);
        if (bits.every((b) => !occupied[g]!.has(b))) {
          bits.forEach((b) => occupied[g]!.add(b));
          search(idx + 1, occupied);
          bits.forEach((b) => occupied[g]!.delete(b));
        }
      }
    };
    search(0, [new Set(), new Set(), new Set()]);
    assert.equal(legalWithThree, false, '3 组方案不存在（下界定理的反证 referee）');
    // 4 组方案存在（First-Fit 实际构造）
    const p = parallelizeLayer(nq, couplings, { mode: 'first-fit' });
    assert.ok(p.groupCount >= 4);
    assert.equal(verifyMatchingPartition(nq, couplings, fields, p.groups).valid, true);
  });
});

describe('R18B · 定理 B：Kőnig 二部精确构造', () => {
  it('随机二部小图 ×300（seeded）：groupCount === Δ(G⁺)、gap=0、验证器全绿', () => {
    const rng = makeRng(20260920);
    let zeroGap = 0;
    for (let trial = 0; trial < 300; trial++) {
      // 随机二部图：左 3 + 右 3~4 顶点，每对以概率 0.4 连边（映射到 0..L+R−1）
      const l = 3;
      const r = 3 + Math.floor(rng() * 2);
      const couplings: CouplingEdge[] = [];
      for (let i = 0; i < l; i++) {
        for (let j = 0; j < r; j++) {
          if (rng() < 0.4) couplings.push(edge(i, l + j));
        }
      }
      if (couplings.length === 0) continue;
      const nq = l + r;
      assert.equal(interactionIsBipartite(nq, couplings), true, '前置：构造确为二部');
      const p = parallelizeLayer(nq, couplings, { mode: 'koenig' });
      assert.equal(p.algorithm, 'koenig');
      const verdict = verifyMatchingPartition(
        nq,
        couplings,
        Array.from({ length: nq }, (_, q) => q),
        p.groups,
      );
      assert.equal(verdict.valid, true, `trial=${trial}: ${verdict.reason}`);
      assert.equal(p.groupCount, p.lowerBound, `trial=${trial}: Kőnig 必须达到下界`);
      assert.equal(p.gap, 0);
      assert.ok(p.groupCount >= 1);
      zeroGap++;
    }
    assert.ok(zeroGap >= 250, `有效试验数 ${zeroGap}（空图重掷不应吞掉样本量）`);
  });

  it('路径 P4 / 偶环 C6 手锚：二部精确 Δ(G⁺)', () => {
    const path: CouplingEdge[] = [edge(0, 1), edge(1, 2), edge(2, 3)];
    const pp = parallelizeLayer(4, path, { mode: 'koenig' });
    assert.equal(pp.lowerBound, 3); // deg=(1,2,2,1)+1 → 3
    assert.equal(pp.groupCount, 3);
    const cycle: CouplingEdge[] = [
      edge(0, 1),
      edge(1, 2),
      edge(2, 3),
      edge(3, 4),
      edge(4, 5),
      edge(0, 5),
    ];
    const pc = parallelizeLayer(6, cycle, { mode: 'koenig' });
    assert.equal(pc.lowerBound, 3); // deg=2+1 → 3
    assert.equal(pc.groupCount, 3);
  });

  it('奇环 C5：非二部 → mode koenig 点名拒绝；auto 走 first-fit 且 ≥ 下界', () => {
    const c5: CouplingEdge[] = [edge(0, 1), edge(1, 2), edge(2, 3), edge(3, 4), edge(0, 4)];
    assert.equal(interactionIsBipartite(5, c5), false);
    assert.throws(
      () => parallelizeLayer(5, c5, { mode: 'koenig' }),
      (e: unknown) =>
        e instanceof QuantumEstimateError && e.message.includes('exact only on bipartite'),
    );
    const p = parallelizeLayer(5, c5); // auto
    assert.equal(p.algorithm, 'first-fit');
    assert.equal(p.bipartite, false);
    assert.equal(p.lowerBound, 3); // deg=2+1 → 3
    assert.ok(p.groupCount >= p.lowerBound);
    const verdict = verifyMatchingPartition(5, c5, [0, 1, 2, 3, 4], p.groups);
    assert.equal(verdict.valid, true);
  });

  it('确定性：同输入两次分解 deepEqual（无 RNG，组序/组内序确定）', () => {
    const couplings: CouplingEdge[] = [edge(0, 3), edge(1, 4), edge(2, 5), edge(0, 4), edge(1, 5)];
    const a = parallelizeLayer(6, couplings, { mode: 'koenig' });
    const b = parallelizeLayer(6, couplings, { mode: 'koenig' });
    assert.deepEqual(a, b);
  });
});

describe('R18B · 不变量验证器（走私审判）', () => {
  const nq = 6;
  const couplings: CouplingEdge[] = [edge(0, 1), edge(2, 3), edge(4, 5)];
  const fields = [0, 1, 2, 3, 4, 5];

  it('合法分解通过', () => {
    const ok = [
      { couplings: [edge(0, 1), edge(2, 3), edge(4, 5)], fieldQubits: [] },
      { couplings: [], fieldQubits: [0, 1, 2, 3, 4, 5] },
    ];
    assert.equal(verifyMatchingPartition(nq, couplings, fields, ok).valid, true);
  });

  it('负对照 1：组内共享比特（非 matching）被定罪', () => {
    const bad = [
      { couplings: [edge(0, 1), edge(1, 2)], fieldQubits: [] },
      { couplings: [edge(2, 3), edge(4, 5)], fieldQubits: [] },
      { couplings: [], fieldQubits: [0, 1, 2, 3, 4, 5] },
    ];
    // 基集换成 P4（0-1,1-2,2-3）：组 0 的两条边共享 qubit 1
    const p4: CouplingEdge[] = [edge(0, 1), edge(1, 2), edge(2, 3)];
    const verdict = verifyMatchingPartition(4, p4, [], bad.slice(0, 2));
    assert.equal(verdict.valid, false);
    assert.match(verdict.reason, /not a matching.*qubit 1/);
  });

  it('负对照 2：丢边 / 重复边 / 未知边 / 空组 / 场项-耦合冲突', () => {
    // 丢边
    let verdict = verifyMatchingPartition(nq, couplings, fields, [
      { couplings: [edge(0, 1), edge(2, 3)], fieldQubits: [4, 5] },
    ]);
    assert.equal(verdict.valid, false);
    assert.match(verdict.reason, /missing/);
    // 重复边（跨组出现两次）
    verdict = verifyMatchingPartition(nq, couplings, fields, [
      { couplings: [edge(0, 1)], fieldQubits: [] },
      { couplings: [edge(0, 1), edge(2, 3), edge(4, 5)], fieldQubits: [] },
    ]);
    assert.equal(verdict.valid, false);
    assert.match(verdict.reason, /more than one group/);
    // 未知边
    verdict = verifyMatchingPartition(nq, couplings, fields, [
      { couplings: [edge(0, 1), edge(2, 3), edge(4, 5), edge(0, 2)], fieldQubits: [] },
    ]);
    assert.equal(verdict.valid, false);
    assert.match(verdict.reason, /unknown edge/);
    // 空组
    verdict = verifyMatchingPartition(nq, couplings, fields, [
      { couplings: [edge(0, 1), edge(2, 3), edge(4, 5)], fieldQubits: [] },
      { couplings: [], fieldQubits: [] },
    ]);
    assert.equal(verdict.valid, false);
    assert.match(verdict.reason, /empty/);
    // 场项与耦合共享比特
    verdict = verifyMatchingPartition(nq, couplings, fields, [
      { couplings: [edge(0, 1), edge(2, 3), edge(4, 5)], fieldQubits: [0] },
    ]);
    assert.equal(verdict.valid, false);
    assert.match(verdict.reason, /shares qubit 0/);
  });

  it('负对照 3（下界的数学冗余性）：完整覆盖+组内匹配的 2 组方案对 P4+全场项不存在（全指派枚举）', () => {
    // 定理 A 的实例化 referee：P4（3 边）+ 4 场项 = 7 个项目 → 2 组的
    // 2^7 = 128 种全指派，断言无「每组合法 matching 且全覆盖」的方案。
    // （验证器的下界分支因此是深度防御——完整覆盖+组内匹配在数学上
    // 已蕴含组数 ≥ Δ(G⁺)，无法从合法输入触达该分支；此处以枚举证明
    // 蕴含关系本身，而不是伪造输入。）
    const path: CouplingEdge[] = [edge(0, 1), edge(1, 2), edge(2, 3)];
    const p4fields = [0, 1, 2, 3];
    const projects: Array<{ kind: 'edge'; e: CouplingEdge } | { kind: 'field'; v: number }> = [
      ...path.map((e) => ({ kind: 'edge' as const, e })),
      ...p4fields.map((v) => ({ kind: 'field' as const, v })),
    ];
    const occupies = (p: (typeof projects)[number]): number[] =>
      p.kind === 'edge' ? [p.e[0], p.e[1]] : [p.v];
    let legal = false;
    const search = (idx: number, occupied: Array<Set<number>>): void => {
      if (legal) return;
      if (idx === projects.length) {
        legal = true;
        return;
      }
      for (let g = 0; g < 2; g++) {
        const bits = occupies(projects[idx]!);
        if (bits.every((b) => !occupied[g]!.has(b))) {
          bits.forEach((b) => occupied[g]!.add(b));
          search(idx + 1, occupied);
          bits.forEach((b) => occupied[g]!.delete(b));
        }
      }
    };
    search(0, [new Set(), new Set()]);
    assert.equal(legal, false, '2 组合法方案不存在（下界 Δ(G⁺)=3 的枚举证明）');
    assert.equal(matchingLowerBound({ nqubits: 4, couplings: path, fieldQubits: p4fields }), 3);
  });
});

describe('R18B · 定理 C：FT 画像缩减（同假设、只改并行度）', () => {
  /** 调度形状 4×5 的耦合集（one-hot 团 + 容量对） */
  function schedulingCouplings(m: number, n: number): CouplingEdge[] {
    const out: CouplingEdge[] = [];
    for (let t = 0; t < m; t++) {
      for (let a1 = 0; a1 < n; a1++) {
        for (let a2 = a1 + 1; a2 < n; a2++) out.push(edge(t * n + a1, t * n + a2));
      }
    }
    for (let a = 0; a < n; a++) {
      for (let t1 = 0; t1 < m; t1++) {
        for (let t2 = t1 + 1; t2 < m; t2++) out.push(edge(t1 * n + a, t2 * n + a));
      }
    }
    return out;
  }

  it('并行画像恒等式：轮数/信道错误按操作数比例、T 计数与蒸馏项逐字节不变', () => {
    const m = 4;
    const n = 5;
    const nq = m * n;
    const couplings = schedulingCouplings(m, n);
    assert.equal(couplings.length, 70);
    const partition = parallelizeLayer(nq, couplings); // fieldTerms 'all'（缺省）
    const profile = { logicalQubits: nq, couplings: 70, depth: 64 };
    const code = surfaceCode(5);
    const result = parallelEstimateFtCircuit(profile, code, partition);

    // 串行锚：与 ft-estimate 直出逐位一致
    assert.deepEqual(result.serial, estimateFtCircuit(profile, code));
    assert.equal(result.serial.logicalOpsTotal, 64 * (70 + 2 * nq)); // 64·110
    // 并行操作数 = depth·(groups+1)；缩减因子 = 110/(groups+1)
    assert.equal(result.parallel.logicalOpsTotal, 64 * (partition.groupCount + 1));
    assert.ok(Math.abs(result.roundsReductionFactor - 110 / (partition.groupCount + 1)) < 1e-12);
    // 轮数比例恒等（syndromeRoundsPerOp 相同）
    assert.equal(
      result.parallel.syndromeRoundsTotal,
      Math.round(
        (result.parallel.logicalOpsTotal / result.serial.logicalOpsTotal) *
          result.serial.syndromeRoundsTotal,
      ),
    );
    // 信道错误比例 = 操作数比例（lepr 相同）
    const ratio = result.parallel.epsilonChannel / result.serial.epsilonChannel;
    assert.ok(
      Math.abs(ratio - result.parallel.logicalOpsTotal / result.serial.logicalOpsTotal) < 1e-12,
    );
    // T 计数 / 蒸馏错误 / 码块占地逐字节不变
    assert.equal(result.parallel.tGatesTotal, result.serial.tGatesTotal);
    assert.equal(result.parallel.epsilonDistillation, result.serial.epsilonDistillation);
    assert.equal(result.parallel.physicalQubits, result.serial.physicalQubits);
    assert.equal(result.parallel.blocks, result.serial.blocks);
    // 并行画像必是合法收缩：轮数更少、信道错误更小
    assert.ok(result.parallel.syndromeRoundsTotal < result.serial.syndromeRoundsTotal);
    assert.ok(result.parallel.epsilonChannel < result.serial.epsilonChannel);
    assert.ok(result.roundsReductionFactor > 1, '调度形状（E=70, nq=20）缩减因子必须 >1');
  });

  it('缩减因子量级：稠密调度形状的并行分组数远小于串行旋转数', () => {
    const m = 6;
    const n = 6;
    const couplings = schedulingCouplings(m, n);
    const partition = parallelizeLayer(m * n, couplings);
    // 串行每层旋转 = E + 2nq = 180 + 72 = 252；下界 Δ(G⁺) = m+n−1 = 11
    assert.equal(couplings.length, m * 15 + n * 15); // m·C(6,2)+n·C(6,2) = 90+90 = 180
    assert.equal(partition.lowerBound, m + n - 1);
    assert.ok(partition.groupCount < 40, `groups=${partition.groupCount} 应远小于 252`);
    assert.ok(partition.groupCount + 1 < 252 / 8, '缩减因子 > 8 倍');
  });

  it('负对照：fieldTerms 口径失配点名拒绝（对读前提）', () => {
    const partition = parallelizeLayer(4, [edge(0, 1)], { fieldTerms: 'none' });
    assert.throws(
      () =>
        parallelEstimateFtCircuit(
          { logicalQubits: 4, couplings: 1, depth: 4 },
          surfaceCode(3),
          partition,
        ),
      /partition covers 0 field terms/,
    );
  });
});

describe('R18B · 输入域负对照', () => {
  it('未归一化 / 越界 / 重边 / 域外场项 / 非法 nqubits 逐项点名', () => {
    assert.throws(() => parallelizeLayer(4, [edge(1, 0)]), /normalized/);
    assert.throws(() => parallelizeLayer(4, [edge(0, 0)]), /must be \[q1, q2\]/);
    assert.throws(() => parallelizeLayer(4, [edge(0, 4)]), /must be \[q1, q2\]/);
    assert.throws(() => parallelizeLayer(0, []), /positive integer/);
    assert.throws(() => parallelizeLayer(4, [edge(0, 1), edge(0, 1)]), /duplicate coupling edge/);
    assert.throws(() => parallelizeLayer(4, [], { fieldTerms: [0, 0] }), /duplicate field term/);
    assert.throws(() => parallelizeLayer(4, [], { fieldTerms: [4] }), /integers in \[0, 4\)/);
  });
});

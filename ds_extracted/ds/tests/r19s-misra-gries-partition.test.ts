/**
 * R19 创新 · Misra-Gries 分解钉板（代理 S · QPU 域）
 *
 * 五张面：
 * - 定理 V referee：seeded 随机一般图 ×300，验证器全绿且 gap ∈ {0,1}
 *   （组数 ≤ Δ(G⁺)+1 恒成立——First-Fit 无此界）；
 * - 全图普查（6 顶点 2^15 图）：First-Fit gap>1 的实例计数钉死＋
 *   （若存在）分离证人图上 MG gap ≤ 1；
 * - 手锚：奇环 C5+全场项（χ′=Δ+1 强制）、K4+全场项、调度形状 6×6；
 * - 确定性双跑 deepEqual；二部图上与 Kőnig 精确并列对读；
 * - FT 接缝演示（收口批扩 LayerPartition.algorithm 字面量前的 cast
 *   适配——parallelEstimateFtCircuit 只消费 groupCount/fieldTermCount）；
 * - 输入域负对照（与 commutation-ft 同款消息镜像）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { misraGriesLayerPartition } from '../src/core/qpu/misra-gries-partition.js';
import { parallelizeLayer, parallelEstimateFtCircuit } from '../src/core/qpu/commutation-ft.js';
import type { CouplingEdge, LayerPartition } from '../src/core/qpu/commutation-ft.js';
import { surfaceCode, estimateFtCircuit } from '../src/core/qpu/ft-estimate.js';

/** mulberry32（与 r18b/experiments 同惯用法） */
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

describe('R19S · 定理 V：随机一般图 referee（gap ∈ {0,1} 恒成立）', () => {
  it('seeded 随机图 ×300：验证器全绿、组数 ≤ Δ(G⁺)+1、gap ≤ 1', () => {
    const rng = makeRng(20260921);
    let nonBipartite = 0;
    let gapOne = 0;
    let trials = 0;
    for (let trial = 0; trial < 300; trial++) {
      const nq = 6 + Math.floor(rng() * 4); // 6..9 顶点
      const p = 0.25 + rng() * 0.35; // 0.25..0.6 密度
      const couplings: CouplingEdge[] = [];
      for (let i = 0; i < nq; i++) {
        for (let j = i + 1; j < nq; j++) {
          if (rng() < p) couplings.push(edge(i, j));
        }
      }
      if (couplings.length === 0) continue;
      const fields: 'all' | 'none' = rng() < 0.5 ? 'all' : 'none';
      const mg = misraGriesLayerPartition(nq, couplings, { fieldTerms: fields });
      // 内部自检已过（verifyMatchingPartition 在 misraGriesLayerPartition
      // 里强制绿才返回）；此处独立断言定理 V 的数值面
      assert.ok(mg.groupCount >= mg.lowerBound, `trial=${trial}: 组数低于下界不可能`);
      assert.ok(
        mg.groupCount <= mg.vizingUpperBound,
        `trial=${trial}: 组数 ${mg.groupCount} 超 Vizing 上界 ${mg.vizingUpperBound}（定理 V 破产）`,
      );
      assert.ok(mg.gap === 0 || mg.gap === 1, `trial=${trial}: gap=${mg.gap} ∉ {0,1}`);
      assert.equal(mg.vizingUpperBound, mg.lowerBound + 1);
      if (!mg.bipartite) nonBipartite++;
      if (mg.gap === 1) gapOne++;
      trials++;
    }
    assert.ok(trials >= 250, `有效试验 ${trials}（空图重掷不应吞掉样本量）`);
    assert.ok(nonBipartite >= 100, `非二部样本 ${nonBipartite}（一般图面必须实打实覆盖）`);
    assert.ok(gapOne >= 5, `gap=1 样本 ${gapOne}（构造冗余面上界应被观察到）`);
  });
});

describe('R19S · 全图普查（6 顶点）：First-Fit 无界 vs MG 有界', () => {
  it('2^15 全图：FF gap>1 计数钉死＝507；首个证人图上 MG gap ≤ 1（分离）', () => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) pairs.push([i, j]);
    }
    let ffExceeds = 0;
    let witness: { couplings: CouplingEdge[]; ffGap: number; mgGap: number } | null = null;
    for (let mask = 1; mask < 1 << pairs.length; mask++) {
      const couplings: CouplingEdge[] = [];
      for (let b = 0; b < pairs.length; b++) {
        if ((mask >> b) & 1) couplings.push(edge(pairs[b]![0], pairs[b]![1]));
      }
      const ff = parallelizeLayer(6, couplings, { fieldTerms: 'none', mode: 'first-fit' });
      if (ff.gap > 1) {
        ffExceeds++;
        if (witness === null) {
          const mg = misraGriesLayerPartition(6, couplings, { fieldTerms: 'none' });
          witness = { couplings, ffGap: ff.gap, mgGap: mg.gap };
        }
      }
    }
    // 普查钉板（机器读数冻结：6 顶点纯边域 First-Fit 超界实例恰 507 个，
    // 占 507/32767 ≈ 1.55%——FF 的 gap 无界不是理论空谈，小域即触发）
    assert.equal(ffExceeds, 507, '6 顶点纯边域 FF gap>1 实例计数（机器普查冻结值）');
    // 分离证人：同一图上 FF 超界而 MG 在定理界内
    assert.ok(witness !== null, '普查已发现 507 例，证人必存在');
    assert.ok(witness.ffGap >= 2, `证人图 FF gap=${witness.ffGap} 应 ≥ 2`);
    assert.ok(witness.mgGap <= 1, `证人图 MG gap=${witness.mgGap} 应 ≤ 1（定理 V）`);
  });
});

describe('R19S · 手锚：强制 Δ+1 与调度形状', () => {
  it('奇环 C5＋全场项：χ′=3=Δ(G⁺) 强制；MG 组数 ∈ [3,4]', () => {
    const c5: CouplingEdge[] = [edge(0, 1), edge(1, 2), edge(2, 3), edge(3, 4), edge(0, 4)];
    const mg = misraGriesLayerPartition(5, c5);
    assert.equal(mg.lowerBound, 3); // deg=2 + 场项 1
    assert.ok(mg.groupCount === 3 || mg.groupCount === 4, `实际 ${mg.groupCount}`);
    assert.ok(mg.gap <= 1);
    assert.equal(mg.bipartite, false);
  });

  it('K4＋全场项：Δ(G⁺)=4；MG ≤ 5（χ′=4，不承诺取到）', () => {
    const k4: CouplingEdge[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) k4.push(edge(i, j));
    }
    const mg = misraGriesLayerPartition(4, k4);
    assert.equal(mg.lowerBound, 4);
    assert.ok(mg.groupCount <= 5 && mg.groupCount >= 4);
  });

  it('调度形状 6×6（E=180，非二部）：MG ≤ 12 且不劣于 First-Fit（本冻结输入上）', () => {
    const couplings: CouplingEdge[] = [];
    const m = 6;
    const n = 6;
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
    assert.equal(couplings.length, 180);
    const mg = misraGriesLayerPartition(m * n, couplings);
    assert.equal(mg.lowerBound, m + n - 1); // Δ(G⁺)=11（全场项并入）
    assert.ok(mg.groupCount <= 12, `MG 组数 ${mg.groupCount} 超 Δ+1`);
    const ff = parallelizeLayer(m * n, couplings); // auto → 非二部走 first-fit
    assert.equal(ff.algorithm, 'first-fit');
    assert.ok(
      mg.groupCount <= ff.groupCount,
      `本冻结输入上 MG(${mg.groupCount}) 应不劣于 FF(${ff.groupCount})`,
    );
  });

  it('二部输入：与 Kőnig 精确并列对读（Kőnig gap=0；MG ≤ Δ+1）', () => {
    const bip: CouplingEdge[] = [
      edge(0, 3),
      edge(0, 4),
      edge(1, 3),
      edge(1, 5),
      edge(2, 4),
      edge(2, 5),
    ];
    const mg = misraGriesLayerPartition(6, bip);
    const ko = parallelizeLayer(6, bip, { mode: 'koenig' });
    assert.equal(mg.bipartite, true);
    assert.equal(ko.gap, 0);
    assert.ok(mg.groupCount <= mg.lowerBound + 1);
  });

  it('确定性：同输入两次分解 deepEqual', () => {
    // 两个共点于 qubit 2 的三角形（归一化边序确定）
    const couplings: CouplingEdge[] = [
      edge(0, 1),
      edge(1, 2),
      edge(0, 2),
      edge(2, 3),
      edge(3, 4),
      edge(2, 4),
    ];
    assert.deepEqual(
      misraGriesLayerPartition(5, couplings),
      misraGriesLayerPartition(5, couplings),
    );
  });
});

describe('R19S · FT 接缝演示（收口批扩字面量前的 cast 适配）', () => {
  it('MG 组数直喂 parallelEstimateFtCircuit：定理 C 恒等式在 MG 分组上成立', () => {
    const couplings: CouplingEdge[] = [];
    const m = 4;
    const n = 5;
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
    const mg = misraGriesLayerPartition(m * n, couplings); // fieldTerms 'all'
    // cast 适配：LayerPartition.algorithm 联合类型本波只读冻结；
    // parallelEstimateFtCircuit 消费的 partition 字段仅 groupCount 与
    // fieldTermCount（见其签名契约）——cast 不触碰被消费面
    const partition = mg as unknown as LayerPartition;
    const profile = { logicalQubits: m * n, couplings: 70, depth: 16 };
    const code = surfaceCode(5);
    const result = parallelEstimateFtCircuit(profile, code, partition);
    assert.deepEqual(result.serial, estimateFtCircuit(profile, code));
    assert.equal(result.parallel.logicalOpsTotal, 16 * (mg.groupCount + 1));
    assert.equal(result.parallel.tGatesTotal, result.serial.tGatesTotal);
    assert.ok(result.roundsReductionFactor > 1);
  });
});

describe('R19S · 输入域负对照（commutation-ft 同款消息镜像）', () => {
  it('未归一化 / 越界 / 自环 / 重边 / 非法 nqubits / 域外与重复场项 逐项点名', () => {
    assert.throws(() => misraGriesLayerPartition(4, [edge(1, 0)]), /normalized/);
    assert.throws(() => misraGriesLayerPartition(4, [edge(0, 4)]), /must be \[q1, q2\]/);
    assert.throws(() => misraGriesLayerPartition(4, [edge(2, 2)]), /must be \[q1, q2\]/);
    assert.throws(() => misraGriesLayerPartition(0, []), /positive integer/);
    assert.throws(
      () => misraGriesLayerPartition(4, [edge(0, 1), edge(0, 1)]),
      /duplicate coupling edge/,
    );
    assert.throws(
      () => misraGriesLayerPartition(4, [], { fieldTerms: [0, 0] }),
      /duplicate field term/,
    );
    assert.throws(
      () => misraGriesLayerPartition(4, [], { fieldTerms: [4] }),
      /integers in \[0, 4\)/,
    );
  });
});

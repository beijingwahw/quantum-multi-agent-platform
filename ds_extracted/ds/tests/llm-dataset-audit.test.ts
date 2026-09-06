/**
 * 标注审计快照（llm-learning-curve 数据集）
 *
 * 数据集的类别不平衡与 R3 判定争议是已知且**有意保留**的标注现状
 * （改标注 = 改变已发表实验的结论，属实验所有者的决策）。本套件把
 * 现状钉死成机械断言：任何标注或词表的后续变更都必须有意识地更新
 * 这里的快照——这正是"所有者显式裁决"的机制。
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKETS,
  labelAudit,
  mentionedAspects,
  ASPECT_KEYWORDS,
  type Ticket,
} from '../experiments/llm-learning-curve/dataset.js';

describe('llm-learning-curve · 标注审计快照', () => {
  const audit = labelAudit();

  it('边际分布快照：sentiment 32/10/2、urgent 9/44、aspect 顶类为质量 12', () => {
    assert.equal(TICKETS.length, 44);
    assert.deepEqual(audit.sentimentCounts, { 负面: 32, 正面: 10, 中性: 2 });
    assert.equal(audit.urgentCount, 9);
    assert.deepEqual(audit.aspectCounts, { 物流: 8, 质量: 12, 客服: 11, 价格: 7, 功能: 6 });
  });

  it('多数类朴素基线：不平衡对 exact-match 零样本基线的抬高幅度', () => {
    // 解读 q̂0 / base 参数时必须知道的背景：全预测多数类即得此分
    assert.ok(Math.abs(audit.majorityBaseRate.sentiment - 32 / 44) < 1e-12);
    assert.ok(Math.abs(audit.majorityBaseRate.urgent - 35 / 44) < 1e-12);
    assert.ok(Math.abs(audit.majorityBaseRate.aspect - 12 / 44) < 1e-12);
  });

  it('R3 一致性（严格读法）：43 张可裁决工单全部与优先级推导一致', () => {
    assert.deepEqual(
      audit.r3Mismatches,
      [],
      '严格读法下数据集必须自洽——若此断言失败，说明有人改了标注或词表而未裁决',
    );
  });

  it('词法静默工单恰为 #42（"退货"是 urgent 词，不构成方面提及）', () => {
    assert.deepEqual(audit.lexiconSilent, [42]);
    const t42 = TICKETS.find((t) => t.id === 42) as Ticket;
    assert.equal(mentionedAspects(t42.text).size, 0);
  });

  it('争议词影响收敛于两例：保修→#32、App→#11（所有者决策项）', () => {
    assert.deepEqual(
      audit.disputedImpact.map((d) => ({ id: d.id, keyword: d.keyword })),
      [
        { id: 11, keyword: 'App' },
        { id: 32, keyword: '保修' },
      ],
    );
    // 含入读法的翻转方向：功能 > 客服、质量 > 客服（R3 优先级）
    const d11 = audit.disputedImpact.find((d) => d.id === 11)!;
    const d32 = audit.disputedImpact.find((d) => d.id === 32)!;
    assert.equal(d11.labeled, '客服');
    assert.equal(d11.underInclusiveReading, '功能');
    assert.equal(d32.labeled, '客服');
    assert.equal(d32.underInclusiveReading, '质量');
  });

  it('同含争议词但不受影响的工单：#14（坏了已命中质量）、#16（闪退已命中功能）', () => {
    // 词表包含争议词，但这两张的推导主方面在两种读法下不变——
    // 证明 disputedImpact 收敛性不是词表的巧合
    const t14 = TICKETS.find((t) => t.id === 14) as Ticket;
    const t16 = TICKETS.find((t) => t.id === 16) as Ticket;
    const strict14 = [...mentionedAspects(t14.text)].sort();
    const inclusive14 = [...mentionedAspects(t14.text, { includeDisputed: true })].sort();
    const strict16 = [...mentionedAspects(t16.text)].sort();
    const inclusive16 = [...mentionedAspects(t16.text, { includeDisputed: true })].sort();
    assert.deepEqual(strict14, inclusive14); // 保修⊆质量，命中集合不变
    assert.deepEqual(strict16, inclusive16); // App⊆功能，命中集合不变
    assert.ok(!audit.disputedImpact.some((d) => d.id === 14 || d.id === 16));
  });

  it('词表声明式完整性：每个条目的方面都在 ASPECTS 内且关键词非空', () => {
    const aspects = new Set<string>(['物流', '质量', '客服', '价格', '功能']);
    for (const entry of ASPECT_KEYWORDS) {
      assert.ok(aspects.has(entry.aspect), `未知方面: ${entry.aspect}`);
      assert.ok(entry.keywords.length > 0, `${entry.aspect} 词表为空`);
    }
  });
});

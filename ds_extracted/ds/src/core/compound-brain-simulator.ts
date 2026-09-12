/**
 * CompoundBrainSimulator —— CompoundBrain 的实验驱动器（08#11 关注点分离）
 *
 * 复利增长机制（allocateBatch/settle/WDP/校准）与实验工具（真实动力学
 * 抽样、DSIC 虚报）此前同居 CompoundBrain——实验关注点渗入核心机制类。
 * 本类把实验面整体迁出：机制类只保留 allocateBatch/settle 与只读的
 * 模拟驱动面（setBid/simFacts），真实学习动力学
 *    q = base + α(1−base)(1−e^{−βk})
 * 与成败抽样的 RNG 流完全由本模拟器持有。
 *
 * 位级不变承诺（迁移契约）：逻辑自 CompoundBrain.simulateBatch 原样
 * 迁移——RNG 为同一 Mulberry32(seed)，每个分配恰抽一次、按分配序；
 * trueQuality 公式逐操作同序。同 seed 下 settlements/realizedWelfare
 * 与迁移前逐位一致（tests/regression/r8-core-lifecycle.test.ts 经
 * CompoundBrain 上保留的 deprecated 委托路径锁定同一流）。
 */

import { MechanismError } from '../utils/errors.js';
import { Mulberry32, DEFAULT_SEED } from '../utils/rng.js';
import type {
  CompoundAllocation,
  CompoundBrain,
  CompoundSimFacts,
  CompoundTaskSpec,
  Settlement,
} from './compound-brain.js';

/** 模拟器选项：真实学习参数（机制不可见）与抽样种子 */
export interface CompoundBrainSimulatorOptions {
  /** 真实学习幅度 α（机制不可见；0 = 不可学习对照臂） */
  simAlpha: number;
  /** 真实学习速率 β（机制不可见） */
  simBeta: number;
  /** 抽样种子（缺省平台默认 42；与迁移前 config.seed 同源同流） */
  seed?: number;
}

export class CompoundBrainSimulator {
  private readonly brain: CompoundBrain;
  private readonly simAlpha: number;
  private readonly simBeta: number;
  private readonly rngSource: Mulberry32;

  // 04 P2-11（erasableSyntaxOnly）：参数属性改为显式字段 + 构造器赋值
  constructor(brain: CompoundBrain, options: CompoundBrainSimulatorOptions) {
    this.brain = brain;
    this.simAlpha = options.simAlpha;
    this.simBeta = options.simBeta;
    this.rngSource = new Mulberry32(options.seed ?? DEFAULT_SEED);
  }

  /** 实验用：虚报成本（DSIC 检验）。未知 id 立即抛错（与旧
   * CompoundBrain.misreport 同款）：静默跳过会让 DSIC 实验带着错误
   * 定价跑完全程 */
  misreport(agentId: string, bid: number): void {
    this.brain.setBid(agentId, bid);
  }

  /** 真实动力学下的成功率（仅 simulate 使用；机制不可见） */
  private trueQuality(facts: CompoundSimFacts, c: string): number {
    const base = facts.trueQuality[c] ?? 0.5;
    const k = facts.capital[c] ?? 0;
    return base + this.simAlpha * (1 - base) * (1 - Math.exp(-this.simBeta * k));
  }

  /**
   * 一步模拟：分配 → 按真实动力学抽成败 → 结算。
   * 返回本批真实福利 Σ(v·success − trueCost)。
   */
  simulateBatch(tasks: CompoundTaskSpec[]): {
    allocation: CompoundAllocation;
    settlements: Settlement[];
    realizedWelfare: number;
  } {
    const allocation = this.brain.allocateBatch(tasks);
    const settlements: Settlement[] = [];
    let realized = 0;
    for (const asg of allocation.assignments) {
      const facts = this.brain.simFacts(asg.agentId);
      if (!facts) {
        throw new MechanismError(
          `CompoundBrainSimulator: agent '${asg.agentId}' missing from brain (internal invariant)`,
        );
      }
      const q = this.trueQuality(facts, asg.capability);
      const success = this.rngSource.next() < q;
      // 资本快照必须取自 settle 之前（与 pending 台账/校准观测同一口径）：
      // 同批多次获胜时 settle 后再读会把 kBefore+1 报成分配时资本
      const kBefore = facts.capital[asg.capability] ?? 0;
      this.brain.settle(asg.taskId, success);
      realized += (success ? asg.taskValue : 0) - facts.trueCost;
      settlements.push({
        taskId: asg.taskId,
        agentId: asg.agentId,
        capability: asg.capability,
        success,
        capitalAtAssignment: kBefore,
      });
    }
    return { allocation, settlements, realizedWelfare: realized };
  }
}

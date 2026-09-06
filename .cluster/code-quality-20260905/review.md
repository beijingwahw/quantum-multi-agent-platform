# 交叉复核结论（S4）

复核人：主线 | 时间：2026-09-05 03:05 | 方法：抽查回读源码 + 口径核对

## 一、P0/P1 抽查回读结果

| 发现 | 声称位置 | 回读验证 | 结论 |
|---|---|---|---|
| subagent_02 #21 (P0) plugin 动作串行执行 | plugin.ts:200-233 | 实际在 140-186 行：`for [ruleId] → for action → await executeAction` 双层串行循环属实 | ✅ 成立（行号偏差可接受，subagent 自注 ±10） |
| subagent_01 #1 (P1) scheduleTask 无状态守卫 | quantum-scheduler.ts:~468 | 实际 460 行起：只查存在性 + 依赖，无 `status === 'pending'` 检查 | ✅ 成立 |
| subagent_01 #2 (P1) overloaded 吸收态 | quantum-scheduler.ts:~365 | 实际 402-406 行：释放分支 `if (agent.state === 'working')` 排除 overloaded——负载归零不恢复 idle，且空闲池只收 idle | ✅ 成立（本仓最典型的状态机死锁） |

## 二、口径统一

- 规模数字以主线统计为准：src 40 文件 11828 LOC（.ts）、tests 28 文件 5822 LOC、examples 8 文件 1796 LOC、experiments 4 文件 1412 LOC、scripts 2 文件 534 LOC
- subagent_08 的「quantum-scheduler ~1540 行」等单文件行数为估算，报告中统一用 KB 体积 + 文件数表达
- subagent_05 测试文件数为 28（含 console.test.ts），与目录清单一致
- 发现总数去重后约 190 条（含主线 24 条）；报告正文收录 P0/P1 全量 + P2/P3 精选，全部明细以各 subagent_NN.md 为附录基础

## 三、置信度分级

- 高置信（回读验证 / 主线亲审）：P0 plugin 串行、P1 状态守卫缺失、P1 overloaded 吸收态、全部 QPU/基建发现（主线亲审）、ESLint 9 EOL / Node 20 EOL（官方来源）
- 中置信（单源 + 行号自洽）：core 优化器各 P1（子空间回退 chosen=0、worker 序列化脆弱性、主线程阻塞）、总线 cardinality 攻击面
- 待深化（写进报告「已知边界」）：subagent_02/06 的「待补」段落（dsh-integration.ts、benchmark.ts、tools/ 四文件中 3 个未深审）——审计覆盖声明中明示

## 四、保留分歧

- subagent_08 #13 对 bruteForceOptimum 耦合键一致性的表述自相矛盾（先说编码一致又说语义不一致）——降级为「疑似」，列入建议验证清单而非结论
- subagent_02 把 plugin 串行定为 P0、而 executor 重试不分类定为 P1——严重度排序主观，报告按「影响面×修复成本」重排：串行动作影响吞吐上限保留 P0（事件风暴下堆积无界）

## 五、覆盖缺口（诚实声明）

- dsh-integration.ts（15.4KB）、tools/fs-tools.ts、system-tools.ts、web-tools.ts、performance/benchmark.ts：subagent_09 声明「待审」后未完成深审——本报告相应章节标注覆盖深度为「总线层已深审，工具层仅边界扫描」
- subagent_02/06 的模块概览、Top3 段落未写完——由主线在 brief.md 中依据发现清单补齐
- 前端 web-console 仅静态审阅，无运行时验证

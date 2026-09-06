# 派单台账（追加） — 超时重派记录

## 第一波（02:12 派出）
| 路 | 任务 | 产物 | 结局 |
|---|---|---|---|
| 01 | core 调度引擎(全 core 14 文件) | subagent_01.md | 超时 20m/45 调用无产物 |
| 02 | 主动智能+集成层 | subagent_02.md | 超时 20m/33 调用无产物(留 _check*.js 垃圾) |
| 03 | 量子算法(路径错给成 src\qpu) | subagent_03.md | 超时 20m/54 调用无产物 |
| 04 | 前沿对标调研 | subagent_04.md | ✅ 完成 30KB |
| 05 | 测试+工程基建(合并过重) | subagent_05.md | 超时 20m/50 调用无产物 |
| 06 | 实验/示例/文档漂移 | subagent_06.md | 在跑 |

## 重派波（修正 + 拆小 + 增量写作纪律）
| 路 | 任务 | 产物 | 派出时间 | 状态 |
|---|---|---|---|---|
| R1 | 主动智能+集成层补审(禁临时文件纪律) | subagent_02.md | 02:29 | 在跑 |
| R2 | QPU 量子后端(修正路径 src\core\qpu,5 文件) | subagent_03.md | 02:36 | 在跑 |
| R3 | 测试质量(tests/ 28 文件,单路) | subagent_05.md | 02:36 | 在跑 |
| R4 | 工程基建与 CI(配置单路拆出) | subagent_07.md | 02:36 | 在跑 |
| R5 | core 调度算法半区(scheduler/vcg/flow/baselines) | subagent_01.md | 02:39 | 在跑 |
| R6 | core 优化器与平台入口半区(brain/optimizer/agent-manager/index.ts) | subagent_08.md | 02:39 | 在跑 |

## 超时根因与对策
1. 模块过大（core 14 文件 11.8K LOC 单路扛不动）→ 按 55KB/45KB 两个核心文件切半区
2. 路径错误（src\qpu 不存在，实际 src\core\qpu）→ 派单前已实勘目录
3. 全读后一次性写产物，20 分钟上限前写不完 → 新纪律：增量写作(骨架→edit 追加)
4. 低效遍历（_check*.js 临时脚本 ×30）→ 明令禁止临时文件，只准 read
5. 测试+基建合并过重 → 拆成两路

## 复核安排（回齐后）
- 主线 read 全部 subagent_*.md，抽查 file:line 证据回读源码
- 数字口径统一：src 40 文件 11828 LOC / tests 27-28 文件 5822 LOC / examples 8 文件 1796 LOC / experiments 4 文件 1412 LOC / scripts 2 文件 534 LOC
- P0/P1 发现必须双源印证（文件证据 + 主线核读）

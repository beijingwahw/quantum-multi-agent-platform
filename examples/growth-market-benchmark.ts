/**
 * 增长市场调度器基准对比：market vs greedy（最低价） vs round-robin（轮询）
 * 运行：node --import tsx examples/growth-market-benchmark.ts
 */
import {
  GrowthMarketScheduler,
  type GrowthAgentSpec
} from '../src/core/growth-market-scheduler.js';

const CAPS = ['research', 'coding', 'writing'];
const ROUNDS = 900;

const AGENTS: GrowthAgentSpec[] = [
  { id: 'researcher', capabilities: CAPS, trueCost: 4,   trueQuality: { research: 0.9,  coding: 0.5,  writing: 0.6 } },
  { id: 'coder',      capabilities: CAPS, trueCost: 3.5, trueQuality: { research: 0.5,  coding: 0.85, writing: 0.5 } },
  { id: 'writer',     capabilities: CAPS, trueCost: 3,   trueQuality: { research: 0.35, coding: 0.4,  writing: 0.88 } },
  { id: 'generalist', capabilities: CAPS, trueCost: 1.2, trueQuality: { research: 0.45, coding: 0.45, writing: 0.45 } },
  { id: 'novice',     capabilities: CAPS, trueCost: 2,   trueQuality: { research: 0.6,  coding: 0.6,  writing: 0.35 } }
];

console.log(`任务数: ${ROUNDS}，能力轮转: ${CAPS.join(' → ')}，同一随机种子\n`);
console.log('| 策略 | 早期成功率 | 后期成功率 | 净福利 |');
console.log('|---|---|---|---|');

for (const policy of ['market', 'greedy', 'round-robin'] as const) {
  const s = new GrowthMarketScheduler({ seed: 42 });
  AGENTS.forEach((a) => s.register(a));
  for (let i = 0; i < ROUNDS; i++) {
    s.simulateTask(CAPS[i % CAPS.length], policy);
  }
  const early = s.getWindowSuccessRate(0, 150).toFixed(3);
  const late = s.getWindowSuccessRate(ROUNDS - 150, ROUNDS).toFixed(3);
  console.log(`| ${policy} | ${early} | ${late} | ${s.getNetWelfare()} |`);
}

console.log('\n市场机制下的最终分工（专业化涌现）:');
const s = new GrowthMarketScheduler({ seed: 7 });
AGENTS.forEach((a) => s.register(a));
for (let i = 0; i < ROUNDS; i++) {
  s.simulateTask(CAPS[i % CAPS.length], 'market');
}
for (const snap of s.getSnapshot()) {
  const caps = Object.entries(snap.capital)
    .map(([c, n]) => `${c}:${n}`)
    .join(', ');
  console.log(
    `  ${snap.id.padEnd(11)} 主专业=${String(snap.dominant).padEnd(8)} 专业化度=${snap.dominantShare} 利润=${snap.profit} 资本={${caps}}`
  );
}

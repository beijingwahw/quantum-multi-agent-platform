import { CompoundBrain } from '../src/core/compound-brain.js';

const brain = new CompoundBrain({ simAlpha: 0.9, simBeta: 0.15, seed: 11, exploreCoefficient: 0, growthHorizon: 60 });
brain.registerAgent({ id: 'trainee', capabilities: ['X'], trueCost: 0.3, trueQuality: { X: 0.3 }, credentialQuality: { X: 0.3 }, capacity: 1 });
brain.registerAgent({ id: 'hire', capabilities: ['X'], trueCost: 1.0, trueQuality: { X: 0.6 }, credentialQuality: { X: 0.6 }, capacity: 1 });

// 重建观测流：分配时记录资本，结算时记 (base, k, success)
const capital = new Map<string, number>([['trainee', 0], ['hire', 0]]);
const kAtAssign = new Map<string, number>();
const obs: Array<{ base: number; k: number; success: boolean }> = [];
const credOf: Record<string, number> = { trainee: 0.3, hire: 0.6 };
brain.on('allocated', ({ assignments }: any) => {
  for (const a of assignments) kAtAssign.set(a.taskId, capital.get(a.agentId) ?? 0);
});
brain.on('settled', (s: any) => {
  const k = kAtAssign.get(s.taskId) ?? 0;
  obs.push({ base: credOf[s.agentId], k, success: s.success });
  capital.set(s.agentId, k + 1);
});
for (let b = 0; b < 120; b++) brain.simulateBatch([{ capability: 'X', value: 10 }]);

// 复刻 calibrate 分桶
const buckets = new Map<number, { ws: number; n: number }>();
for (const o of obs) {
  const denom = Math.max(0.05, 1 - o.base);
  const s = ((o.success ? 1 : 0) - o.base) / denom;
  const b = buckets.get(o.k) ?? { ws: 0, n: 0 };
  b.ws += s; b.n += 1;
  buckets.set(o.k, b);
}
const pts = [...buckets.entries()].map(([k, v]) => ({ k, s: v.ws / v.n, n: v.n })).sort((a, b) => a.k - b.k);
console.log('buckets:', pts.map((p) => `${p.k}:${p.s.toFixed(2)}(${p.n})`).join(' '));

// 网格拟合
let best = { alpha: 0, beta: 0, sse: Infinity };
for (let ai = 0; ai <= 50; ai++) {
  const alpha = ai / 50;
  for (let bi = 0; bi <= 40; bi++) {
    const beta = Math.pow(10, -3 + (bi * 3.5) / 40);
    let sse = 0;
    for (const p of pts) {
      const pred = alpha * (1 - Math.exp(-beta * p.k));
      sse += p.n * (p.s - pred) * (p.s - pred);
    }
    if (sse < best.sse - 1e-12) best = { alpha, beta, sse };
  }
}
const w = pts.reduce((a, p) => a + p.n, 0);
const mean = pts.reduce((a, p) => a + p.n * p.s, 0) / w;
const sst = pts.reduce((a, p) => a + p.n * (p.s - mean) * (p.s - mean), 0);
console.log('best:', best, 'r2:', 1 - best.sse / sst);

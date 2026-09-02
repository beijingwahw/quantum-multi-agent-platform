import { CompoundBrain } from '../src/core/compound-brain.js';

// 复刻校准内部：测量 regime A 的 held-out 增益
function collect(simAlpha: number, simBeta: number, seed: number, batches: number) {
  const brain = new CompoundBrain({ simAlpha, simBeta, seed, exploreCoefficient: 0, growthHorizon: 60 });
  brain.registerAgent({ id: 'hire', capabilities: ['X'], trueCost: 1.0, trueQuality: { X: 0.6 }, credentialQuality: { X: 0.6 }, capacity: 1 });
  brain.registerAgent({ id: 'trainee', capabilities: ['X'], trueCost: 0.3, trueQuality: { X: 0.3 }, credentialQuality: { X: 0.3 }, capacity: 1 });
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
  for (let b = 0; b < batches; b++) brain.simulateBatch([{ capability: 'X', value: 10 }]);
  return obs;
}

function analyze(obs: Array<{ base: number; k: number; success: boolean }>) {
  const all = obs.map((o) => {
    const denom = Math.max(0.05, 1 - o.base);
    return { k: o.k, s: ((o.success ? 1 : 0) - o.base) / denom };
  });
  // 分箱平滑：按 k 等宽 8 箱
  const B = 8;
  const kmax = Math.max(...all.map((p) => p.k));
  const bins = Array.from({ length: B }, () => ({ ws: 0, n: 0, kk: 0 }));
  for (const p of all) {
    const bi = Math.min(B - 1, Math.floor((p.k / (kmax + 1)) * B));
    bins[bi].ws += p.s;
    bins[bi].n += 1;
    bins[bi].kk += p.k;
  }
  const pts = bins.filter((b) => b.n > 0).map((b) => ({ k: b.kk / b.n, s: b.ws / b.n, n: b.n }));
  // 加权拟合
  let best = { alpha: 0, beta: 0, sse: Infinity };
  for (let ai = 0; ai <= 50; ai++) {
    const alpha = ai / 50;
    for (let bi = 0; bi <= 40; bi++) {
      const beta = Math.pow(10, -3 + (bi * 3.5) / 40);
      let sse = 0;
      for (const p of pts) sse += p.n * (p.s - alpha * (1 - Math.exp(-beta * p.k))) ** 2;
      if (sse < best.sse - 1e-12) best = { alpha, beta, sse };
    }
  }
  // 零模型（全局均值）与方差解释量
  const w = pts.reduce((a, p) => a + p.n, 0);
  const mean = pts.reduce((a, p) => a + p.n * p.s, 0) / w;
  const sseNull = pts.reduce((a, p) => a + p.n * (p.s - mean) ** 2, 0);
  // 噪声方差估计（逐观测残差）
  const varHat = all.reduce((a, p) => a + (p.s - mean) ** 2, 0) / (all.length - 1);
  return { n: all.length, cand: best, gain: sseNull - best.sse, ratio: (sseNull - best.sse) / varHat, nbins: pts.length };
}

for (const simAlpha of [0.9, 0.5, 0.2, 0.03, 0]) {
  const rs = Array.from({ length: 20 }, (_, i) => analyze(collect(simAlpha, 0.15, 500 + i, 120)));
  const ratio = rs.reduce((a, r) => a + r.ratio, 0) / rs.length;
  const alpha = rs.reduce((a, r) => a + r.cand.alpha, 0) / rs.length;
  for (const gate of [2, 4, 8]) {
    const pass = rs.filter((r) => r.ratio > gate).length;
    process.stdout.write(`门限${gate}:通过${pass}/20 `);
  }
  console.log(`| α_true=${simAlpha}: 平均增益/var=${ratio.toFixed(1)} 拟合α̂=${alpha.toFixed(2)}`);
}

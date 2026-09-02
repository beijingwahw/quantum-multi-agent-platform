import { CompoundBrain } from '../src/core/compound-brain.js';

// 不可学习 regime（α_true=0.03）：测量校准 α̂ 的跨种子分布
function one(seed: number, batches: number): { alphaHat: number; betaHat: number } {
  const brain = new CompoundBrain({ simAlpha: 0.03, simBeta: 0.15, seed, exploreCoefficient: 0, growthHorizon: 60 });
  brain.registerAgent({ id: 'hire', capabilities: ['X'], trueCost: 1.0, trueQuality: { X: 0.6 }, credentialQuality: { X: 0.6 }, capacity: 1 });
  for (let b = 0; b < batches; b++) brain.simulateBatch([{ capability: 'X', value: 10 }]);
  const cal = brain.calibrations()[0];
  return { alphaHat: cal.alphaHat, betaHat: cal.betaHat };
}

const n = 40;
const alphas = Array.from({ length: n }, (_, i) => one(1000 + i, 120));
const mean = alphas.reduce((a, x) => a + x.alphaHat, 0) / n;
const sd = Math.sqrt(alphas.reduce((a, x) => a + (x.alphaHat - mean) ** 2, 0) / n);
console.log(`不可学习 regime α̂: mean=${mean.toFixed(3)} sd=${sd.toFixed(3)} max=${Math.max(...alphas.map((x) => x.alphaHat)).toFixed(2)}（真值 0.03）`);

const alphas2 = Array.from({ length: n }, (_, i) => one(1000 + i, 400));
const mean2 = alphas2.reduce((a, x) => a + x.alphaHat, 0) / n;
console.log(`400 批时 α̂: mean=${mean2.toFixed(3)}（若 →0.03 则系统无偏，纯噪声收敛问题）`);

import { CompoundBrain } from '../src/core/compound-brain.js';

const brain = new CompoundBrain({ simAlpha: 0.9, simBeta: 0.15, seed: 11, exploreCoefficient: 0, growthHorizon: 60 });
brain.registerAgent({ id: 'trainee', capabilities: ['X'], trueCost: 0.3, trueQuality: { X: 0.3 }, credentialQuality: { X: 0.3 }, capacity: 1 });
brain.registerAgent({ id: 'hire', capabilities: ['X'], trueCost: 1.0, trueQuality: { X: 0.6 }, credentialQuality: { X: 0.6 }, capacity: 1 });

for (let b = 0; b < 120; b++) brain.simulateBatch([{ capability: 'X', value: 10 }]);
const cal = brain.calibrations()[0];
console.log('calibration:', cal);

// 复刻内部分桶逻辑做检查
const state = (brain as any);
const agents = state.agents as Map<string, any>;
for (const [id, a] of agents) {
  console.log(id, 'attempts=', a.attempts.get('X'), 'successes=', a.successes.get('X'), 'capital=', a.capital.get('X'));
}

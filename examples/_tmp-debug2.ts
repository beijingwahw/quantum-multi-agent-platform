import { CompoundBrain } from '../src/core/compound-brain.js';

const brain = new CompoundBrain({ simAlpha: 0.9, simBeta: 0.15, seed: 11, exploreCoefficient: 0, growthHorizon: 60 });
brain.registerAgent({ id: 'trainee', capabilities: ['X'], trueCost: 0.3, trueQuality: { X: 0.3 }, credentialQuality: { X: 0.3 }, capacity: 1 });
brain.registerAgent({ id: 'hire', capabilities: ['X'], trueCost: 1.0, trueQuality: { X: 0.6 }, credentialQuality: { X: 0.6 }, capacity: 1 });

for (let b = 1; b <= 6; b++) {
  const { allocation, settlements, realizedWelfare } = brain.simulateBatch([{ capability: 'X', value: 10 }]);
  console.log(`batch ${b}: assignments=${allocation.assignments.length} dropped=${allocation.droppedTasks} W=${allocation.welfareAugmented.toFixed(2)} realized=${realizedWelfare.toFixed(2)}`,
    settlements.map((s) => `${s.agentId}:${s.success}`).join(','));
}

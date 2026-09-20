/**
 * R19-Q 补充账本：随机起点（非 CD 种子）上非均匀买断精修的实际改进量。
 * （端到端账本测试里 CD 种子已饱和 Δq=0；此处记录非饱和证据，入册用。）
 */
import { couplingKey } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/quantum-optimizer.ts';
import {
  buildSubspaceModel,
  SubspaceState,
  type SubspaceModel,
} from 'file:///D:/multi-agent/ds_extracted/ds/src/core/subspace-optimizer.ts';
import {
  expectationValueInto,
  minMaxOf,
  normalizedEnergies as normalizedEnergiesOf,
} from 'file:///D:/multi-agent/ds_extracted/ds/src/core/solver-common.ts';
import { mulberry32 } from 'file:///D:/multi-agent/ds_extracted/ds/src/utils/rng.ts';
import { GAMMA_BOUND, BETA_BOUND } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/constants.ts';
import { refineGammaByNonuniformBuyout } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/nonuniform-gamma-buyout.ts';
import { refineAnglesByGammaBetaAlternation } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/gamma-beta-alternating.ts';
import { refineGammaByTrigBuyout } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/gamma-spectrum-buyout.ts';
import { refineAnglesByExactCosine } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/exact-cosine-coordinate.ts';
import { subspaceMixerGap } from 'file:///D:/multi-agent/ds_extracted/ds/src/core/parameter-shift.ts';

function subspaceEnergies(model: SubspaceModel): Float64Array {
  const { min, max } = minMaxOf(model.energies);
  return normalizedEnergiesOf(model.energies, min, max, 1);
}

function evaluateOf(model: SubspaceModel, energies: Float64Array, layers: number) {
  const st = new SubspaceState(model.dimension);
  return (angles: number[]): number => {
    st.setUniform();
    for (let p = 0; p < layers; p++) {
      st.applyCostPhase(angles[p]!, energies);
      for (const group of model.mixers) {
        st.applyFiberMixer(group, angles[layers + p]!);
      }
    }
    return expectationValueInto(st, energies);
  };
}

function randomAngles(rng: () => number, layers: number): number[] {
  const a: number[] = [];
  for (let p = 0; p < layers; p++) a.push(rng() * Math.PI);
  for (let p = 0; p < layers; p++) a.push(rng() * (Math.PI / 2));
  return a;
}

// 不可公度谱实例
const incommensurable = buildSubspaceModel({
  taskIds: ['t0', 't1'],
  agentIds: ['a0', 'a1', 'a2'],
  weights: [
    [1, Math.SQRT2, 2],
    [1, 2, Math.SQRT2],
  ],
  ineligible: [
    [false, false, false],
    [false, false, false],
  ],
  couplings: new Map(),
  penaltyOneHot: 0,
  penaltyCapacity: 0,
})!;
{
  const energies = subspaceEnergies(incommensurable);
  const layers = 2;
  const evaluate = evaluateOf(incommensurable, energies, layers);
  const gap = subspaceMixerGap(incommensurable, 0)!;
  const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
  const specs = [
    { index: 2, gap },
    { index: 3, gap },
  ];
  console.log('[r19q 随机起点账本 · 不可公度谱电路 dim=6, layers=2]');
  for (const s of [3, 31, 97]) {
    const angles = randomAngles(mulberry32(s), layers);
    const nu = refineGammaByNonuniformBuyout(evaluate, angles, bounds, energies, {
      gammaIndices: [0, 1],
      sweeps: 4,
    });
    const joint = refineAnglesByGammaBetaAlternation(evaluate, angles, bounds, specs, energies, {
      gammaIndices: [0, 1],
      sweeps: 4,
    });
    const eccm = refineAnglesByExactCosine(evaluate, angles, bounds, specs, { sweeps: 4 });
    console.log(
      `  start ${s}: start=${evaluate(angles).toFixed(12)} | 非均匀γ=${nu.value.toFixed(12)}@${nu.evaluations}ev | ` +
        `ECCMβ=${eccm.value.toFixed(12)}@${eccm.evaluations}ev | γβ联合=${joint.value.toFixed(12)}@${joint.evaluations}ev ` +
        `(γ块${joint.gammaFrozen ? '冻结（A4 降级，谱分析失败）' : '可用'})`,
    );
  }
}
// 公度小谱对照（两版皆工作）
const commensurable = buildSubspaceModel({
  taskIds: ['t0', 't1'],
  agentIds: ['a0', 'a1', 'a2'],
  weights: [
    [1, 3, 2],
    [1, 2, 3],
  ],
  ineligible: [
    [false, false, false],
    [false, false, false],
  ],
  couplings: new Map(),
  penaltyOneHot: 0,
  penaltyCapacity: 0,
})!;
{
  const energies = subspaceEnergies(commensurable);
  const layers = 2;
  const evaluate = evaluateOf(commensurable, energies, layers);
  const bounds = [GAMMA_BOUND, GAMMA_BOUND, BETA_BOUND, BETA_BOUND];
  console.log('[r19q 公度谱对照 · 均匀与非均匀两版皆工作]');
  for (const s of [3, 31]) {
    const angles = randomAngles(mulberry32(s), layers);
    const uniform = refineGammaByTrigBuyout(evaluate, angles, bounds, energies, {
      gammaIndices: [0, 1],
      sweeps: 4,
    });
    const nu = refineGammaByNonuniformBuyout(evaluate, angles, bounds, energies, {
      gammaIndices: [0, 1],
      sweeps: 4,
    });
    console.log(
      `  start ${s}: start=${evaluate(angles).toFixed(12)} | 均匀γ=${uniform.value.toFixed(12)}@${uniform.evaluations}ev ` +
        `| 非均匀γ=${nu.value.toFixed(12)}@${nu.evaluations}ev (K=${nu.rows[0]?.sampleCount ?? '?'})`,
    );
  }
}
void couplingKey;

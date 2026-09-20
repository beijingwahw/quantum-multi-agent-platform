/**
 * shadow-price-secant —— 影子价格 λ 的分段仿射割线搜索（R18-A 创新 1，opt-in）。
 *
 * ============ 动机（遍历 batch-vcg-scheduler.ts 后确认的真实成本中心） ============
 *
 * 预算紧路径 allocateBatch 的 λ-bisection：固定 60 轮二分，每轮
 * solveWithPayments = 1 次全解 + 赢家数次 pivot 重解，每次重解都冷重建
 * 一个 MinCostFlow 网络（min-cost-flow.ts 的守卫明确禁止增量重解）。即一次
 * 预算紧分配要付 62×(1+赢家数) 次 MCF 冷解——而其中 60 轮二分只是把 λ 的
 * 区间宽度从 λmax 缩到 λmax·2⁻⁶⁰，比支付本身的舍入粒度（round9，1e-9）
 * 精了约 50 个数量级：绝大部分求解在为无人消费的精度付费。
 *
 * 结构性事实（本模块的立足点）：总支付 Σp(λ) 是 λ 的**分段仿射函数**。
 * 固定 argmax 分配 X 与各 pivot 重解 X₋ᵢ 不变的区间内，
 *   W(λ) = Σ_{p∈X}(v_p − λ − b_p) 对 λ 仿射，
 *   p_i(λ) = b_i·k_i + W(λ) − W₋ᵢ(λ) 对 λ 仿射，
 * 故 Σp(λ) 在段内仿射；段的边界是 argmax 解跳变的 λ 值（组合 score 变号
 * 或替代集更替），跨段发生跳变。对分段仿射函数的求根，割线插值
 * （regula falsi）在**单一仿射段内一步精确命中**——这是二分对函数结构
 * 零感知、每步只买一个 bit 的对照面。
 *
 * ============ 本模块（纯算法，零平台状态，不被任何既有文件 import） ============
 *
 * 输入一个支付评估器 λ ↦ Σp(λ)（调用方自己绑定市场状态）、预算 B 与
 * λmax（λ=λmax 处空分配、Σp=0 ≤ B 恒可行的上界），输出满足
 * Σp ≤ B + tol 的 λ 与评估轨迹/机器计数。算法 = 割线插值（bracketing
 * regula falsi + Illinois 减半防单端停滞）+ 单调性守卫 + 终局可行复核。
 *
 * 精确主张（可证伪）：
 *
 * 定理（仿射段内一步命中）：若 P 在 [0, λmax] 上仿射且 P(0) > B ≥ P(λmax)，
 * 则第 3 次评估（λ=0、λ=λmax、割线点 λ̂ = (P(0)−B)·λmax/(P(0)−P(λmax))）
 * 满足 |P(λ̂) − B| ≤ hitTol，且 λ̂ 即最小可行 λ（段内 P 单调不增 ⟹ 任何
 * λ < λ̂ 有 P(λ) > B）。hitTol 的量纲来源：插值算术（一减一乘一除）的
 * IEEE 双精度相对舍入，上限数 ulp；本模块取 1e-9（与 batch-VCG 支付的
 * round9 舍入粒度同量级），测试在构造的仿射评估器上逐例断言。
 *
 * 性质（可行性保守性）：返回值要么 λ=0（预算本不紧，1 次评估），要么
 * bracket 可行端（P ≤ B + tol 已实测），要么 exactHit 点（P(λ̂) 实测
 * = B ± hitTol）——任何路径的 λ 都是**实测过支付**的点，不 extrapolate。
 * 评估器违约（P(λmax) > B、或 λ 增支付反增）时具名抛错带证据对，
 * 不静默交出无主张的结果。
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - 不主张最坏情形评估次数优于二分：Σp 的仿射段数可达组合数级，最坏
 *   退化到与二分同阶（maxEvaluations 防御上限内，超限抛错而非死循环）；
 *   「一步命中」只在评估器确实落在单一仿射段上时成立，跳变实例（argmax
 *   解在 B 两侧跳变、Σp 跳过预算）会逐步收缩 bracket，exactHit=false。
 * - 不主张 Σp(λ) 的全局单调性：本模块只消费「λ 增大时支付不得显著增大」
 *   的逐对守卫（违约即抛）；跨段跳降（支付骤降）是合法的，bracket
 *   语义在跳变下依然保守（可行端必实测可行）。
 * - 不主张找到的 λ 是全局最小可行 λ（跳变实例上最小可行 λ 可以在断点
 *   左侧的二分盲区里）；主张的是「实测可行的 λ + 仿射段内的精确性」。
 * - 接入面：batch-vcg 的 solveWithPayments 是 private——本模块以通用
 * 评估器协议交付（测试含同构市场的端到端演示），接线由编排者裁决
 * （allocateBatch 的 λ-bisection 循环整体替换为对 solveSecant 的单次
 * 调用，solveWithPayments 作 evaluate 回调）。
 *
 * 文献接地（只给形状，〔待双源〕）：
 * - 求根试位/割线法族：regula falsi（双假设线性插值求根）的古典起源
 *   〔待双源〕；Illinois 型单端停滞减半修正（20 世纪中叶数值分析文献
 *   族，作者-年份未经核实——不写记忆中的人名，待双源后再具名）〔待双源〕。
 * - 预算约束机制的影子价格松弛：拉格朗日乘子定价的传统（一般均衡
 *   边际定价思想谱系）〔待双源〕；VCG 族预算平衡不可能性：Green 与
 *   Laffmont 1979 机制设计专著 〔待双源〕。
 * - 参数化机制的分段线性结构（顶点/断点几何）：强多项式参数流综述
 *   文献族 〔待双源〕。
 */

import { MechanismError } from '../utils/errors.js';

/** 支付评估器：λ ↦ Σp(λ)。调用方绑定市场状态（每次调用 ≈ 一轮 MCF 重解）。 */
export type PaymentEvaluator = (lambda: number) => number;

export interface SecantSearchInput {
  /** 支付评估器（本模块不重入、不缓存——每次调用即一次计费） */
  readonly evaluate: PaymentEvaluator;
  /** 预算 B ≥ 0（Σp ≤ B + tolerance 视为可行） */
  readonly budget: number;
  /**
   * λ 上界：契约 P(λmax) ≤ B（空分配 Σp = 0 恒可行）。batch-VCG 的取法是
   * max(1, max(v)+1)（所有组合 score < 0）。
   */
  readonly lambdaMax: number;
  /** 预算比较容差（缺省 1e-9，与 batch-VCG 的 budget+1e-9 同值同义） */
  readonly tolerance?: number;
  /**
   * 「一步命中」判定容差：|P(λ̂) − B| ≤ exactHitTol 时认定插值点落在
   * 单一仿射段内且命中预算（缺省 1e-9；量纲来源见模块头定理）。
   */
  readonly exactHitTolerance?: number;
  /**
   * bracket 宽度的实用收敛判据（缺省 lambdaMax·1e-12）。量纲来源：支付
   * 粒度 round9(1e-9) ÷ 支付曲线斜率上界（任务数级，O(10)）⟹ 再深两个
   * 量级的 λ 分辨率已无支付侧消费者——与二分 60 轮的 λmax·2⁻⁶⁰ 相比
   * 仍保守（更宽即更早停）。
   */
  readonly lambdaResolution?: number;
  /** 防御性评估上限（缺省 64；超限抛错而非死循环——终止性守卫） */
  readonly maxEvaluations?: number;
}

export interface SecantSearchResult {
  /** 实测过支付的可行 λ（P(λ) ≤ budget + tolerance） */
  readonly lambda: number;
  /** 该 λ 的实测支付 */
  readonly payment: number;
  /** λ=0 即可行时为 true（预算不紧，1 次评估短路——与 allocateBatch 的 exact 路径对齐） */
  readonly slackAtZero: boolean;
  /** 割线插值点实测命中预算（|P(λ̂) − B| ≤ exactHitTolerance）至少发生一次 */
  readonly exactHit: boolean;
  /** 评估轨迹（λ 序列，机器计数 = length；审计面） */
  readonly evaluatedLambdas: readonly number[];
}

/**
 * 割线搜索最小可行影子价格。抛错面（全部具名、带证据）：
 * - budget/lambdaMax/tolerance 域外输入；
 * - P(λmax) > budget + tolerance（λmax 契约违约——评估器没回到空分配）；
 * - 单调性违约（λ 增大支付显著增大）——继续搜索的任何结果都无正确性主张；
 * - 评估数超上限（终止性守卫，理论不可达）。
 */
export function solveSecant(input: SecantSearchInput): SecantSearchResult {
  const budget = input.budget;
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
    throw new MechanismError(
      `solveSecant: budget must be a finite number ≥ 0, got ${String(input.budget)}`,
    );
  }
  const lambdaMax = input.lambdaMax;
  if (typeof lambdaMax !== 'number' || !Number.isFinite(lambdaMax) || lambdaMax <= 0) {
    throw new MechanismError(
      `solveSecant: lambdaMax must be a finite positive number, got ${String(input.lambdaMax)}`,
    );
  }
  const tol = input.tolerance ?? 1e-9;
  if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 0) {
    throw new MechanismError(
      `solveSecant: tolerance must be a finite number ≥ 0, got ${String(input.tolerance)}`,
    );
  }
  const hitTol = input.exactHitTolerance ?? 1e-9;
  if (typeof hitTol !== 'number' || !Number.isFinite(hitTol) || hitTol < 0) {
    throw new MechanismError(
      `solveSecant: exactHitTolerance must be a finite number ≥ 0, got ${String(
        input.exactHitTolerance,
      )}`,
    );
  }
  const maxEval = input.maxEvaluations ?? 64;
  if (!Number.isInteger(maxEval) || maxEval < 4) {
    throw new MechanismError(
      `solveSecant: maxEvaluations must be an integer ≥ 4, got ${String(input.maxEvaluations)}`,
    );
  }
  const lambdaResolutionInput = input.lambdaResolution ?? lambdaMax * 1e-12;
  if (
    typeof lambdaResolutionInput !== 'number' ||
    !Number.isFinite(lambdaResolutionInput) ||
    lambdaResolutionInput <= 0
  ) {
    throw new MechanismError(
      `solveSecant: lambdaResolution must be a finite positive number, got ${String(
        input.lambdaResolution,
      )}`,
    );
  }
  // 实用分辨率与浮点可表达下限取大——分辨率需求低于 ulp 级时插值点与
  // 端点在浮点里不可区分，继续迭代只会在贴端检查上空转。
  const lambdaResolution = Math.max(lambdaResolutionInput, lambdaMax * Number.EPSILON * 4);

  const evaluated: number[] = [];
  const evaluate = (lambda: number): number => {
    if (evaluated.length >= maxEval) {
      throw new MechanismError(
        `solveSecant: evaluation cap ${maxEval} exceeded without convergence ` +
          `(bracket [${lo}, ${hi}]) — termination invariant broken or evaluator degenerate`,
      );
    }
    evaluated.push(lambda);
    return input.evaluate(lambda);
  };

  // ---- 端点评估：λ=0（不紧短路）与 λ=λmax（契约校验） ----
  const p0 = evaluate(0);
  if (p0 <= budget + tol) {
    return {
      lambda: 0,
      payment: p0,
      slackAtZero: true,
      exactHit: false,
      evaluatedLambdas: evaluated,
    };
  }
  const pm = evaluate(lambdaMax);
  if (pm > budget + tol) {
    throw new MechanismError(
      `solveSecant: P(lambdaMax) = ${pm} > budget ${budget} — ` +
        `lambdaMax contract violated (evaluator must reach the empty allocation at lambdaMax)`,
    );
  }

  // ---- bracketing regula falsi + Illinois 减半 + 周期中点保底 ----
  // lo = 最近的不可行端（P > B + tol），hi = 最近的可行端（P ≤ B + tol）。
  // 插值点恒落开区间内（P_lo > B ≥ P_hi ⟹ 分母 > 0 且系数 ∈ (0,1)）。
  let lo = 0;
  let pLo = p0;
  let hi = lambdaMax;
  let pHi = pm;
  // 同端连续吸收新点的轮数：可行端 ≥1 时 Illinois 减半（把插值点拉向
  // 停滞端）；任一端 ≥3 时插一步纯中点（保证对端也被推进——跳降平台上
  // 纯割线对停滞对端零进展，混合步进给出 O(log(range/resolution)) 的
  // 最坏步数界）。
  let feasibleStall = 0;
  let infeasibleStall = 0;
  // 支付平坦终止：可行端连续两次新点实测支付相同（≤ tol/2）——落进了
  // 跳降平台，bracket 内全是同支付点，继续收缩 λ 不改变任何支付侧量；
  // 双侧版本（不可行端也连续两次不变）覆盖「bracket 跨纯跳变断点」的
  // 形态（两侧平台、中间跳变），此时收缩只定位断点位置而无支付消费者。
  let flatFeasible = 0;
  let flatInfeasible = 0;
  let exactHit = false;

  for (;;) {
    if (hi - lo <= lambdaResolution) {
      return {
        lambda: hi,
        payment: pHi,
        slackAtZero: false,
        exactHit,
        evaluatedLambdas: evaluated,
      };
    }
    let lambdaHat: number;
    if (feasibleStall >= 3 || infeasibleStall >= 3) {
      lambdaHat = lo + (hi - lo) / 2; // 中点保底步
    } else {
      // Illinois 减半：上一轮新点落可行侧时，插值用的 P_hi 以 budget 为
      // 基准等比折半——只影响选点，不动实测值与返回值。
      const interpolationP = feasibleStall >= 1 ? budget + (pHi - budget) / 2 : pHi;
      lambdaHat = lo + ((pLo - budget) * (hi - lo)) / (pLo - interpolationP);
    }
    if (!(lambdaHat > lo) || !(lambdaHat < hi)) {
      // 插值点贴端（浮点下不可分辨）：bracket 已收敛到可表达极限
      return {
        lambda: hi,
        payment: pHi,
        slackAtZero: false,
        exactHit,
        evaluatedLambdas: evaluated,
      };
    }
    const pHat = evaluate(lambdaHat);

    // 单调性守卫：更大的 λ 处支付显著更大——评估器违约。比较基准取同侧
    // 端点（lo 不可行侧），容差用 tol 同档（支付粒度 round9 的噪声级）。
    if (pHat > pLo + tol) {
      throw new MechanismError(
        `solveSecant: payment monotonicity violated — ` +
          `P(${lo}) = ${pLo} but P(${lambdaHat}) = ${pHat} at a larger lambda ` +
          `(the shadow-price payment curve must be non-increasing)`,
      );
    }

    if (pHat <= budget + tol) {
      if (Math.abs(pHat - budget) <= hitTol) {
        // 仿射段内命中：段内单调不增 ⟹ λ̂ 即最小可行点（更小的 λ 支付 > B）
        exactHit = true;
        return {
          lambda: lambdaHat,
          payment: pHat,
          slackAtZero: false,
          exactHit,
          evaluatedLambdas: evaluated,
        };
      }
      // 支付平坦检测（与上一可行端实测值比较；首次更新时对照 pHi 初值）
      flatFeasible = Math.abs(pHat - pHi) <= tol / 2 ? flatFeasible + 1 : 0;
      if (flatFeasible >= 2 || (flatFeasible >= 1 && flatInfeasible >= 2)) {
        return {
          lambda: lambdaHat,
          payment: pHat,
          slackAtZero: false,
          exactHit,
          evaluatedLambdas: evaluated,
        };
      }
      hi = lambdaHat;
      pHi = pHat;
      feasibleStall++;
      infeasibleStall = 0;
    } else {
      flatInfeasible = Math.abs(pHat - pLo) <= tol / 2 ? flatInfeasible + 1 : 0;
      lo = lambdaHat;
      pLo = pHat;
      infeasibleStall++;
      feasibleStall = 0;
    }
  }
}

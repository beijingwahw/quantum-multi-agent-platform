/**
 * R19-R 创新 1：JointPosteriorExploration（(α̂,β̂) 联合后验 sd 探索系数）的
 * 机器验收面——与 src/proactive-intelligence/joint-posterior-exploration.ts
 * 模块头的定理一一对应：
 *   定理 J1（成对恒等式）→ σ² = ½ΣΣ w_g w_h (m_g−m_h)² 双路径对拍；
 *   定理 J2（Lipschitz 证书包络）→ σ ≤ √(L·K/(e·n))，E_w[d̄] ≤ K/(e·n)；
 *   定理 J3（预算望远镜）→ Σ e ≤ 2e₀·√(L·K/e)·√N（联合仿真台账对账）；
 *   定理 J4（k 面精确端点）→ σ(0)=0 逐位、σ(∞)=sd_w(α)、非单调钉板、
 *     高斯 LAN 对拍 sd_w(α) ≈ 1/√(2nc)；
 *   附：与 R18 版 σ 的对照账本（k 盲 vs 外推叉）、饱和/门控恒等式、
 *     走私负对照（均匀权重/线性权重统计量被证书定罪）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  JointPosteriorExploration,
  JointExplorationBudgetLedger,
  sigmaJointAt,
  certifiedEnvelope,
  jointBudgetBound,
  DEFAULT_JOINT_EXPLORATION_CONFIG,
  type JointGridComponent,
  type JointFeedbackInputs,
} from '../src/proactive-intelligence/joint-posterior-exploration.js';
import { EvidenceGatedExploration } from '../src/proactive-intelligence/evidence-gated-exploration.js';
import { SprtCalibrationGate } from '../src/proactive-intelligence/sprt-calibration-gate.js';
import { mulberry32 } from '../src/utils/rng.js';
import { ConfigurationError, NumericDomainError } from '../src/utils/errors.js';

const KERNEL = new JointPosteriorExploration();

/** 测试侧独立实现的混合权重（ll 形）：与模块零共享代码路径 */
function testWeightsLL(components: readonly JointGridComponent[]): number[] {
  const llMax = Math.max(...components.map((c) => c.logLikelihood!));
  const raw = components.map((c) => Math.exp(c.logLikelihood! - llMax));
  const z = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / z);
}

/** 测试侧独立实现的曲线质量 m_g(k) = α(1−e^{−βk}) */
function testMass(c: JointGridComponent, k: number): number {
  return c.alpha * (1 - Math.exp(-c.beta * k));
}

/** 中性未检出输入（除标注外）：12 分量小网格 */
function gridInputs(
  partial: Partial<JointFeedbackInputs>,
  components?: readonly JointGridComponent[],
): JointFeedbackInputs {
  const comps: JointGridComponent[] = [];
  for (const alpha of [0.2, 0.4, 0.6, 0.8]) {
    for (const beta of [0.05, 0.15, 0.45]) {
      comps.push({ alpha, beta, logLikelihood: -1 * ((alpha * 7 + beta * 3) % 2.1) });
    }
  }
  return {
    components: components ?? comps,
    evaluationCapital: 10,
    alphaHat: 0,
    betaHat: 0,
    meanCapital: 0,
    decided: false,
    ...partial,
  };
}

// ----------------------------------------------------------------------------
// 定理 J1 · 成对恒等式（双路径对拍）
// ----------------------------------------------------------------------------

describe('R19-R · 联合后验 · 成对恒等式（定理 J1）', () => {
  it('σ² = E_w[m²]−(E_w[m])² = ½ΣΣ w_g w_h (m_g−m_h)²（100 组随机网格 × 3 个 k，独立复算）', () => {
    const rng = mulberry32(97);
    for (let t = 0; t < 100; t++) {
      const K = 2 + Math.floor(rng() * 8);
      let llMax = -Infinity;
      const comps: JointGridComponent[] = [];
      for (let g = 0; g < K; g++) {
        const alpha = 0.05 + rng() * 0.9;
        const beta = 0.01 + rng() * 0.9;
        const ll = -(rng() * rng() * 30);
        if (ll > llMax) llMax = ll;
        comps.push({ alpha, beta, logLikelihood: ll });
      }
      const w = testWeightsLL(comps);
      for (const k of [0.5, 8, 400]) {
        // 路径 1：直接方差公式
        let e1 = 0;
        let e2 = 0;
        for (let g = 0; g < K; g++) {
          const m = testMass(comps[g]!, k);
          e1 += w[g]! * m;
          e2 += w[g]! * m * m;
        }
        const varDirect = e2 - e1 * e1;
        // 路径 2：成对恒等式
        let varPair = 0;
        for (let g = 0; g < K; g++) {
          for (let h = 0; h < K; h++) {
            varPair += 0.5 * w[g]! * w[h]! * (testMass(comps[g]!, k) - testMass(comps[h]!, k)) ** 2;
          }
        }
        const sigmaModule = sigmaJointAt(comps, k);
        assert.ok(
          Math.abs(sigmaModule - Math.sqrt(varDirect)) < 1e-12,
          `模块 σ=${sigmaModule} vs 直接公式 √var=${Math.sqrt(varDirect)}（t=${t}, k=${k}）`,
        );
        assert.ok(
          Math.abs(varDirect - varPair) < 1e-12,
          `成对恒等式失配：${varDirect} vs ${varPair}（t=${t}, k=${k}）`,
        );
      }
    }
  });

  it('weight 形（calibrations() mixture 对接口径）：权重直接消费，σ 与 ll 形一致', () => {
    const llComps: JointGridComponent[] = [
      { alpha: 0.4, beta: 0.1, logLikelihood: -0.3 },
      { alpha: 0.6, beta: 0.2, logLikelihood: -1.1 },
      { alpha: 0.3, beta: 0.5, logLikelihood: -2.0 },
    ];
    const w = testWeightsLL(llComps);
    const weightComps: JointGridComponent[] = llComps.map((c, i) => ({
      alpha: c.alpha,
      beta: c.beta,
      weight: w[i]!,
    }));
    for (const k of [1, 10, 100]) {
      assert.ok(
        Math.abs(sigmaJointAt(llComps, k) - sigmaJointAt(weightComps, k)) < 1e-15,
        `ll 形与 weight 形 σ 应逐位一致（k=${k}）`,
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 定理 J4 · k 面精确端点与非单调
// ----------------------------------------------------------------------------

describe('R19-R · 联合后验 · k 面端点（定理 J4）', () => {
  const fork: JointGridComponent[] = [
    { alpha: 0.8, beta: 0.02, logLikelihood: 0 },
    { alpha: 0.4, beta: 0.3, logLikelihood: -0.4 },
  ];

  it('σ(0) = 0 逐位（全部分量在零资本处曲线质量为 0——与 SPRT 零资本零信息精确同源）', () => {
    for (const comps of [fork, gridInputs({}).components]) {
      assert.equal(sigmaJointAt(comps, 0), 0);
    }
  });

  it('σ(∞) = sd_w(α)：k=5000（β≥0.02 ⟹ e^{−βk}≈1e−44 饱和）', () => {
    const w = testWeightsLL(fork);
    const meanA = w[0]! * 0.8 + w[1]! * 0.4;
    const sdA = Math.sqrt(w[0]! * (0.8 - meanA) ** 2 + w[1]! * (0.4 - meanA) ** 2);
    assert.ok(Math.abs(sigmaJointAt(fork, 5000) - sdA) < 1e-15);
  });

  it('σ(k) 非单调钉板：快/慢叉升–降–回收（0 → 峰 → 谷 → sd_w(α)）', () => {
    // A=(0.7, 0.03) 慢高曲线；B=(0.3, 0.9) 快低曲线：中段分离最大（k≈4），
    // A 追平 B 后合拢（k≈20），饱和区重新分开到 0.4（sd_w(α) 面）
    const riseFall: JointGridComponent[] = [
      { alpha: 0.7, beta: 0.03, logLikelihood: 0 },
      { alpha: 0.3, beta: 0.9, logLikelihood: -0.4 },
    ];
    const s1 = sigmaJointAt(riseFall, 1);
    const s4 = sigmaJointAt(riseFall, 4);
    const s20 = sigmaJointAt(riseFall, 20);
    const sInf = sigmaJointAt(riseFall, 5000);
    assert.ok(s1 > 0 && s4 > s1, '过渡区分离扩大');
    assert.ok(s20 < s4, '快曲线饱和、慢曲线追平：分离收窄（下降段）');
    assert.ok(sInf > 4 * s20, '饱和区只剩幅度差：分离回收（再升段）');
    console.log(
      `[R19-R k 面] σ(1)=${s1.toFixed(4)} < σ(4)=${s4.toFixed(4)} > σ(20)=${s20.toFixed(4)}` +
        ` < σ(∞)=${sInf.toFixed(4)}（升–降–回收的非单调面）`,
    );
  });

  it('高斯 LAN 对拍：稠密 α 网格 + 二次亏量 ll，sd_w(α) ≈ 1/√(2nc)（5% 内）', () => {
    // w ∝ exp(−n·c·(α−α*)²) 是离散化高斯：sd_w(α) → 1/√(2nc)（网格间距 → 0）
    const c = 12;
    const n = 200;
    const comps: JointGridComponent[] = [];
    for (let j = -15; j <= 15; j++) {
      const alpha = 0.6 + j * 0.01;
      if (alpha <= 0 || alpha > 0.98) continue;
      comps.push({ alpha, beta: 0.15, logLikelihood: -n * c * (j * 0.01) ** 2 });
    }
    const got = sigmaJointAt(comps, 5000); // k→∞ ⟹ σ = sd_w(α)
    const gaussian = 1 / Math.sqrt(2 * n * c);
    console.log(
      `[R19-R LAN] sd_w(α)=${got.toFixed(6)} vs 高斯 1/√(2nc)=${gaussian.toFixed(6)}（n=${n}）`,
    );
    assert.ok(Math.abs(got - gaussian) / gaussian < 0.05, `LAN 对拍失配：${got} vs ${gaussian}`);
  });
});

// ----------------------------------------------------------------------------
// 定理 J2 · Lipschitz 证书包络
// ----------------------------------------------------------------------------

describe('R19-R · 联合后验 · 证书包络（定理 J2）', () => {
  it('随机网格 × 随机 n：σ ≤ √(L·K/(e·n)) 与 E_w[d̄] ≤ K/(e·n) 双证书全过', () => {
    const rng = mulberry32(19);
    let worst = 0;
    for (let t = 0; t < 300; t++) {
      const K = 2 + Math.floor(rng() * 10);
      const n = 1 + Math.floor(rng() * 300);
      const comps: JointGridComponent[] = [];
      for (let g = 0; g < K; g++) {
        comps.push({
          alpha: 0.05 + rng() * 0.9,
          beta: 0.01 + rng() * 0.9,
          logLikelihood: -(rng() * rng() * n * 1.5),
        });
      }
      // 任意两分量 ll 严格相等（平网格）会让 L 无穷——随机浮点下概率 0，出现则跳过
      const llVals = comps.map((c) => c.logLikelihood!);
      if (new Set(llVals).size !== K) continue;
      const k = rng() * 60;
      const face = certifiedEnvelope(comps, n, k);
      assert.ok(face.sigma <= face.bound + 1e-15, `σ=${face.sigma} 超证书 ${face.bound}（t=${t}）`);
      assert.ok(face.ewDeficit <= face.deficitBound + 1e-15, 'E_w[d̄] 超 K/(e·n)');
      assert.ok(face.lipschitzConstant > 0 && face.componentCount === K);
      worst = Math.max(worst, face.sigma / face.bound);
    }
    console.log(`[R19-R 证书] 300 组 σ/证书 最大比值 = ${worst.toFixed(4)}（证书保守度参考）`);
  });

  it('平网格（ll 全等）/ ll 并列且曲线不同的网格：证书不可得，指名拒绝', () => {
    const flat: JointGridComponent[] = [
      { alpha: 0.3, beta: 0.1, logLikelihood: -2 },
      { alpha: 0.7, beta: 0.4, logLikelihood: -2 },
    ];
    assert.throws(
      () => certifiedEnvelope(flat, 10, 5),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('flat'),
    );
    const tied: JointGridComponent[] = [
      { alpha: 0.2, beta: 0.1, logLikelihood: -1 },
      { alpha: 0.9, beta: 0.1, logLikelihood: -1 },
      { alpha: 0.5, beta: 0.2, logLikelihood: -4 },
    ];
    assert.throws(
      () => certifiedEnvelope(tied, 10, 5),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('flat'),
    );
  });

  it('weight 形网格请求证书：ll 是证书的充分统计量，缺省指名拒绝', () => {
    const comps: JointGridComponent[] = [
      { alpha: 0.4, beta: 0.1, weight: 0.6 },
      { alpha: 0.6, beta: 0.2, weight: 0.4 },
    ];
    assert.throws(
      () => certifiedEnvelope(comps, 10, 5),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('logLikelihood'),
    );
    assert.throws(
      () => certifiedEnvelope(gridInputs({}).components, 0, 5),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('observations'),
    );
  });
});

// ----------------------------------------------------------------------------
// 定理 J3 · 预算望远镜与联合仿真（对照账本）
// ----------------------------------------------------------------------------

describe('R19-R · 联合后验 · 预算证书（定理 J3）与对照账本', () => {
  it('联合仿真（学习流 + SPRT 门 + 逐步重拟合小网格）：逐步 σ ≤ 证书；Σ e ≤ 2e₀√(LK/e)·√N', () => {
    const HORIZON = 400;
    const BASE = 0.5;
    const ALPHA_TRUE = 0.6;
    const BETA_TRUE = 0.12;
    const E0 = 0.5;
    const rng = mulberry32(2718);
    const gate = new SprtCalibrationGate();
    const ledger = new JointExplorationBudgetLedger({ baseCoefficient: E0 });
    const obs: Array<{ k: number; success: boolean }> = [];
    let lipMax = 0;
    let kMax = 0;
    const r18Kernel = new EvidenceGatedExploration({ baseCoefficient: E0 });
    let r18Total = 0;
    let jointTotal = 0;
    for (let i = 0; i < HORIZON; i++) {
      if (gate.isTerminal()) break;
      const k = Math.min(i, 12);
      const success = rng() < BASE + ALPHA_TRUE * (1 - BASE) * (1 - Math.exp(-BETA_TRUE * k));
      obs.push({ k, success });
      gate.observe(BASE, k, success);
      // 12 分量小网格逐步重拟合（Bernoulli 精确 ll，与 fitGrid 同族）
      const comps: JointGridComponent[] = [];
      for (const alpha of [0.2, 0.4, 0.6, 0.8]) {
        for (const beta of [0.05, 0.15, 0.45]) {
          let ll = 0;
          for (const o of obs) {
            const p = BASE + alpha * (1 - BASE) * (1 - Math.exp(-beta * o.k));
            const q = Math.min(1 - 1e-6, Math.max(1e-6, p));
            ll += o.success ? Math.log(q) : Math.log(1 - q);
          }
          comps.push({ alpha, beta, logLikelihood: ll });
        }
      }
      const sigmaHere = sigmaJointAt(comps, k);
      // 平似然步（首个观测在 k=0：全部曲线 p=base 并列——零资本零信息的
      // 似然族恒等式）：证书诚实不可得，σ 恰为 0（定理 J4 端点），预算覆盖不受损
      let faceOk = true;
      let faceBound = Number.NaN;
      try {
        const face = certifiedEnvelope(comps, obs.length, k);
        assert.ok(face.sigma <= face.bound + 1e-15, `第 ${i} 步 σ 超证书`);
        faceBound = face.bound;
        lipMax = Math.max(lipMax, face.lipschitzConstant);
        kMax = Math.max(kMax, face.componentCount);
      } catch (e) {
        if (!(e instanceof NumericDomainError) || !e.message.includes('flat')) throw e;
        faceOk = false;
        assert.equal(sigmaHere, 0, '证书不可得的步必须恰是 σ=0 的零资本步');
      }
      assert.ok(faceOk || sigmaHere === 0);
      const coef = KERNEL.coefficient(
        gridInputs({ components: comps, evaluationCapital: k, decided: gate.isTerminal() }),
      );
      ledger.record(coef.coefficient);
      jointTotal = ledger.totalSubsidy();
      // R18 对照账本：同一 (n,s) 流上的成功率 Beta 后验 σ（对 k 盲）
      const n = obs.length;
      const s = obs.filter((o) => o.success).length;
      const r18 = r18Kernel.coefficient({
        attempts: n,
        successes: s,
        alphaHat: 0,
        betaHat: 0,
        meanCapital: 0,
        decided: gate.isTerminal(),
      });
      r18Total += r18.coefficient;
      if (n === 50 || n === 150 || n === 300) {
        console.log(
          `[R19-R 对照] n=${n}：σ_joint(k̄)=${coef.jointSigma.toFixed(4)}（证书 ${faceBound.toFixed(4)}）` +
            ` vs σ_R18(n,s)=${r18.uncertaintySigma.toFixed(4)}（两个不同的估计对象）`,
        );
      }
    }
    const bound = ledger.bound({ lipschitzMax: lipMax, componentCountMax: kMax });
    const pureBound = jointBudgetBound(ledger.entryCount(), {
      baseCoefficient: E0,
      lipschitzMax: lipMax,
      componentCountMax: kMax,
    });
    console.log(
      `[R19-R 预算] Σ e_joint=${jointTotal.toFixed(3)} ≤ 界=2e₀√(LK/e)·√N=${bound.toFixed(3)}` +
        `（N=${ledger.entryCount()}，L_max=${lipMax.toFixed(3)}，K_max=${kMax}）`,
    );
    console.log(
      `[R19-R 对照] 同流 Σ e_R18=${r18Total.toFixed(3)}（成功率后验口径，k 盲）；门判=${gate.getState().decision}`,
    );
    assert.ok(jointTotal <= bound + 1e-12, '联合预算超望远镜界（定理 J3 被违反）');
    assert.ok(Math.abs(bound - pureBound) < 1e-12, '台账界 = 纯函数界（同一证书）');
    assert.ok(jointTotal > 0, '判前探索在付钱');
  });

  it('门控断流恒等式：decided ⟹ e ≡ 0（任意网格/k̄/检出状态）', () => {
    const rng = mulberry32(11);
    for (let t = 0; t < 100; t++) {
      const comps: JointGridComponent[] = [];
      for (let g = 0; g < 3; g++) {
        comps.push({
          alpha: 0.1 + rng() * 0.8,
          beta: 0.02 + rng() * 0.5,
          logLikelihood: -(rng() * rng() * 20),
        });
      }
      const got = KERNEL.coefficient(
        gridInputs({
          components: comps,
          evaluationCapital: rng() * 50,
          alphaHat: rng(),
          betaHat: rng(),
          meanCapital: rng() * 30,
          decided: true,
        }),
      );
      assert.equal(got.coefficient, 0, '终判后系数恒 0');
      assert.equal(got.undecidedFactor, 0);
      assert.ok(got.jointSigma > 0, 'σ 面照常计算（审计面不因门控失明）');
    }
  });

  it('饱和因子与 R18 同语义：k̄=ln(100)/β̂ ⟹ ≤0.01；未检出恒 1', () => {
    const betaHat = 0.12;
    const f1 = KERNEL.coefficient(
      gridInputs({ alphaHat: 0.6, betaHat, meanCapital: Math.log(100) / betaHat }),
    ).saturationFactor;
    assert.ok(f1 <= 0.01 + 1e-15);
    assert.equal(
      KERNEL.coefficient(gridInputs({ alphaHat: 0, betaHat: 0.12, meanCapital: 50 }))
        .saturationFactor,
      1,
    );
  });
});

// ----------------------------------------------------------------------------
// 语义升级钉板 · 外推叉与 k 盲对照
// ----------------------------------------------------------------------------

describe('R19-R · 联合后验 · 与 R18 σ 的语义分界', () => {
  it('外推叉：观测窗内近并列的两曲线在未观测资本处分叉——σ_joint 放大，σ_R18 对 k 盲', () => {
    const r18 = new EvidenceGatedExploration();
    // 两分量 ll 近并列（宿主声明的准后验）：初始斜率几乎相等（αβ ≈ 0.05），
    // 观测窗 k ≤ 5 内曲线近重合，渐近幅度 0.55 vs 0.9 在未观测区分叉
    const comps: JointGridComponent[] = [
      { alpha: 0.55, beta: 0.09, logLikelihood: -0.02 },
      { alpha: 0.9, beta: 0.055, logLikelihood: 0 },
    ];
    const sigmaObservedWindow = sigmaJointAt(comps, 5);
    const sigmaFuture = sigmaJointAt(comps, 120);
    assert.ok(sigmaFuture > 4 * sigmaObservedWindow, '未观测区的曲线值不确定度应被放大');
    console.log(
      `[R19-R 外推叉] σ_joint(5)=${sigmaObservedWindow.toFixed(4)} vs σ_joint(120)=${sigmaFuture.toFixed(4)}`,
    );
    // R18 σ 只依赖 (n,s)：评估资本无关（k 盲钉板）
    const at3 = r18.coefficient({
      attempts: 40,
      successes: 24,
      alphaHat: 0,
      betaHat: 0,
      meanCapital: 3,
      decided: false,
    });
    const at100 = r18.coefficient({
      attempts: 40,
      successes: 24,
      alphaHat: 0,
      betaHat: 0,
      meanCapital: 100,
      decided: false,
    });
    assert.equal(at3.uncertaintySigma, at100.uncertaintySigma, 'R18 σ 对评估资本 k 完全盲');
    // 零资本语义：k̄=0 处联合 σ 逐位为 0（零资本零曲线信息），R18 σ(n,s) 不为 0
    assert.equal(KERNEL.coefficient(gridInputs({ evaluationCapital: 0 })).jointSigma, 0);
    assert.ok(at3.uncertaintySigma > 0);
  });

  it('分解快照：meanCurveMass/alphaSd/betaSd/componentCount 逐项独立复算', () => {
    const comps: JointGridComponent[] = [
      { alpha: 0.5, beta: 0.1, logLikelihood: -0.2 },
      { alpha: 0.7, beta: 0.3, logLikelihood: -1.5 },
    ];
    const w = testWeightsLL(comps);
    const got = KERNEL.coefficient(gridInputs({ components: comps, evaluationCapital: 20 }));
    let em = 0;
    let ea = 0;
    let eb = 0;
    let ea2 = 0;
    let eb2 = 0;
    for (let g = 0; g < 2; g++) {
      em += w[g]! * testMass(comps[g]!, 20);
      ea += w[g]! * comps[g]!.alpha;
      ea2 += w[g]! * comps[g]!.alpha ** 2;
      eb += w[g]! * comps[g]!.beta;
      eb2 += w[g]! * comps[g]!.beta ** 2;
    }
    assert.ok(Math.abs(got.meanCurveMass - em) < 1e-15);
    assert.ok(Math.abs(got.alphaPosteriorSd - Math.sqrt(ea2 - ea * ea)) < 1e-15);
    assert.ok(Math.abs(got.betaPosteriorSd - Math.sqrt(eb2 - eb * eb)) < 1e-15);
    assert.equal(got.componentCount, 2);
    assert.equal(
      got.coefficient,
      DEFAULT_JOINT_EXPLORATION_CONFIG.baseCoefficient * got.jointSigma,
      'e = e₀·σ_joint（未检出、未终判、饱和=1）',
    );
  });
});

// ----------------------------------------------------------------------------
// 走私负对照与输入域
// ----------------------------------------------------------------------------

describe('R19-R · 联合后验 · 走私审判与输入域', () => {
  it('均匀权重走私：似然已裁决后仍平权对待分量——被证书定罪（σ_uniform ≫ 证书包络）', () => {
    // 数据已集中（固定 KL、n=2000 ⟹ ll 亏量 ∝ n）：似然权重集中在最优分量，
    // σ 应微小且 ≤ 证书；均匀权重把质量推给已被数据拒绝的分量，产出膨胀的
    // 假不确定度——证书对似然口径成立，对走私口径定罪
    const comps: JointGridComponent[] = [
      { alpha: 0.2, beta: 0.1, logLikelihood: 0 },
      { alpha: 0.9, beta: 0.5, logLikelihood: -1000 },
      { alpha: 0.4, beta: 0.2, logLikelihood: -933 },
    ];
    const k = 10;
    const face = certifiedEnvelope(comps, 2000, k);
    const uniComps: JointGridComponent[] = comps.map((c) => ({
      alpha: c.alpha,
      beta: c.beta,
      weight: 1 / 3,
    }));
    const sigmaUni = sigmaJointAt(uniComps, k);
    console.log(
      `[R19-R 走私] σ_似然=${face.sigma.toExponential(3)} ≤ 证书=${face.bound.toExponential(3)}` +
        ` ≪ σ_均匀走私=${sigmaUni.toExponential(3)}（定罪比 ${(sigmaUni / face.bound).toFixed(1)}×）`,
    );
    assert.ok(face.sigma <= face.bound, '似然权重在证书内');
    assert.ok(sigmaUni > face.bound * 10, '均匀权重统计量远超证书（走私定罪）');
  });

  it('输入域走私：空网格/非法分量/混合权重口径/越界 k/非布尔 decided 指名拒绝', () => {
    assert.throws(
      () => sigmaJointAt([], 5),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('components'),
    );
    assert.throws(
      () => sigmaJointAt([{ alpha: 0.99, beta: 0.1, logLikelihood: 0 }], 5),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('alpha'),
    );
    assert.throws(
      () => sigmaJointAt([{ alpha: 0.5, beta: 0, logLikelihood: 0 }], 5),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('beta'),
    );
    assert.throws(
      () => sigmaJointAt([{ alpha: 0.5, beta: 0.1, logLikelihood: Number.NaN }], 5),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('logLikelihood'),
    );
    assert.throws(
      () =>
        sigmaJointAt(
          [
            { alpha: 0.5, beta: 0.1, logLikelihood: 0 },
            { alpha: 0.5, beta: 0.2 },
          ],
          5,
        ),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('mixed'),
    );
    assert.throws(
      () =>
        sigmaJointAt(
          [
            { alpha: 0.5, beta: 0.1, weight: 0.5 },
            { alpha: 0.6, beta: 0.2, weight: 0.2 },
          ],
          5,
        ),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('sum'),
    );
    assert.throws(
      () =>
        sigmaJointAt(
          [
            { alpha: 0.5, beta: 0.1, weight: -0.5 },
            { alpha: 0.6, beta: 0.2, weight: 1.5 },
          ],
          5,
        ),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('weight'),
    );
    assert.throws(
      () => KERNEL.coefficient(gridInputs({ evaluationCapital: -1 })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('evaluationCapital'),
    );
    assert.throws(
      () => KERNEL.coefficient(gridInputs({ alphaHat: -0.1 })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('alphaHat'),
    );
    assert.throws(
      () => KERNEL.coefficient(gridInputs({ decided: 1 as unknown as boolean })),
      (e: unknown) => e instanceof NumericDomainError && e.message.includes('decided'),
    );
    assert.throws(
      () => KERNEL.coefficient(null as unknown as JointFeedbackInputs),
      (e: unknown) => e instanceof NumericDomainError,
    );
    assert.throws(
      () => jointBudgetBound(-1, { lipschitzMax: 1, componentCountMax: 1 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('evaluations'),
    );
    assert.throws(
      () => jointBudgetBound(10, { lipschitzMax: 0, componentCountMax: 1 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('lipschitzMax'),
    );
  });

  it('台账域校验与缺省常量钉板', () => {
    const ledger = new JointExplorationBudgetLedger();
    assert.throws(
      () => ledger.record(-0.001),
      (e: unknown) => e instanceof NumericDomainError,
    );
    assert.equal(DEFAULT_JOINT_EXPLORATION_CONFIG.baseCoefficient, 0.5);
    assert.throws(
      () => new JointPosteriorExploration({ baseCoefficient: 0 }),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('baseCoefficient'),
    );
  });

  it('纯函数确定性：同输入逐位同输出（toPrecision(15) 全分解）', () => {
    const inp = gridInputs({ alphaHat: 0.4, betaHat: 0.1, meanCapital: 6, evaluationCapital: 9 });
    const a = KERNEL.coefficient(inp);
    const b = KERNEL.coefficient(inp);
    assert.equal(a.coefficient.toPrecision(15), b.coefficient.toPrecision(15));
    assert.equal(a.jointSigma.toPrecision(15), b.jointSigma.toPrecision(15));
    assert.equal(a.alphaPosteriorSd.toPrecision(15), b.alphaPosteriorSd.toPrecision(15));
  });
});

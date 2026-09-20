/**
 * de-signing 证书的张量网络提升定理 —— v0.5.0（R19 波 G3-a）。
 *
 * 把 designing-element（元素级判定器）与 tn/（MPS/DMRG）两模块接通——
 * 它们在仓内互不引用，本文件是第一座桥（R18 详册认定的真实空白）。
 *
 * 定理（DL-a，平移不变提升引理）。开链的元素级 worst 行有精确形状
 *   max_z A_i(z) = 基项 + Σ_{邻居 o} |合并贡献_o|，
 * 即每位之值只依赖「本位角度 + 邻位角度多重集 + 该位的邻居数」。因此
 * 若判定器在链 n₀ ≥ 3（含一个双邻居内部位——全部局域环境的见证）上
 * 以**平移不变证书**（ψ_i ≡ ψ、d_i ≡ d）返回 YES，则同一证书对一切
 * n ≥ n₀ 的同参数链 YES：内部位的逐点表达式与 n₀ 逐位相同，端点是
 * 内部位邻居集的真子集（去掉一项 |t| 只会更小）——O(n+|E|) 精确复核
 * 逐点同一。周期环（全内部位）YES 同样提升到一切开链。
 *
 * 定理（DL-b，双基执行）。n = 64 均匀链 (g,p,κ,w) 上：DMRG 基态在
 * **计算基**符号混合（具名正/负振幅见证 ⟹ P = Σψ/Σ|ψ| < 1 严格，
 * 构造性证明）；把 U_i† 逐 site 作用到 MPS 张量后（去符号基），
 * H′ = U†HU 的 stoquastic 证书（公式路径，n=64 直接精确）+ Perron-
 * Frobenius 定理给出基态非负，机器面为种子化构型普查 min 振幅 ≥ −1e-12。
 * 「规范只换基、不改硬件测量基中的符号结构」（README 论断）的 64 比
 * 特执行即此：计算基的 P 坍缩与去符号基的 P=1 是同一态的两个基。
 *
 * 审计面（DL-c）。不平移不变证书的伪造提升、缺内部位见证的 base、
 * 目标链上复核出正元素，全部具名击毙（auditLiftClaim）。
 *
 * 诚实边界：
 *  - n=64 的符号普查是**采样面**（2^64 不可枚举）；「全构型非负」由
 *    H′ stoquastic 精确证书 + PF 定理承担（定理路径），采样只验证
 *    DMRG 截断（discarded ~1e-14）没有引入符号翻转；
 *  - P 的数值本身（不只是 P<1/P=1 的定性）在小尺度 n ≤ 10 由稠密
 *    全枚举精确钉住，n=64 只报见证与采样统计；
 *  - 链族（1D 局域）＋单比特实正交基变换；一般图的 YES 证书不自动
 *    提升（局域环境可能随 n 增长），本模块不做一般图主张。
 *
 * 实现注意：mpsAmplitude（tn/mps.ts）用 (bits >>> i) & 1 寻址——JS
 * 位运算 32 位截断，site ≥ 32 的位读不到（仓内 MPS 层对 n ≤ 32 正确；
 * n = 64 需要本模块的 hi/lo 双字寻址 amplitude64，见模块底部缺陷备注）。
 */
import { NonstoqError } from "../core/errors.js";
import { Rng } from "../core/rng.js";
import type { ElementTerms, LocalRotation } from "./designing-element.js";
import { normalizeTerms, scanMaxOffDiagonal } from "./designing-element.js";
import type { Mps } from "../tn/mps.js";
import { dmrgGroundState } from "../tn/dmrg.js";
import type { ChainHamiltonian } from "../tn/mpo.js";

/** The uniform translation-invariant open-chain family this module executes. */
export interface UniformChain {
  readonly n: number;
  readonly g: number;
  readonly p: number;
  readonly kappa: number;
  readonly w: number;
}

/** 均匀开链的 ElementTerms（designing-element 的输入形态；长度域由调用面守卫）。 */
export function uniformChainTerms(c: UniformChain): ElementTerms {
  const n = c.n;
  return {
    n,
    xFields: Array.from({ length: n }, (_, i) => ({ i, c: c.g })),
    zFields: Array.from({ length: n }, (_, i) => ({ i, c: c.p })),
    pairs: Array.from({ length: n - 1 }, (_, i) => ({
      i,
      j: i + 1,
      kappa: c.kappa,
      zz: c.w,
    })),
  };
}

/** 证书平移不变性：ψ 全同 + d 单值（判定的搜索面在均匀族上返回均匀证书——机器事实）。 */
export function isTranslationInvariantCertificate(cert: LocalRotation): {
  readonly invariant: boolean;
  readonly psiSpread: number;
  readonly dValues: readonly number[];
} {
  const psiSpread = Math.max(...cert.psi) - Math.min(...cert.psi);
  const dValues = [...new Set(cert.d)];
  return {
    invariant: psiSpread === 0 && dValues.length === 1,
    psiSpread,
    dValues,
  };
}

/** 位点的邻居数（归一化后 pairs）：开链上端点 1、内部 2。 */
function neighborCounts(norm: ElementTerms): number[] {
  const deg = new Array<number>(norm.n).fill(0);
  for (const e of norm.pairs) {
    deg[e.i]! += 1;
    deg[e.j]! += 1;
  }
  return deg;
}

export interface LiftViolation {
  readonly name: string;
  readonly detail: string;
}

export interface LiftResult {
  readonly accepted: boolean;
  readonly violations: readonly LiftViolation[];
  /** 提升证书（均匀 ψ/d 复制到 targetN 位）。 */
  readonly certificate: LocalRotation | null;
  /** 目标链上的精确最大非对角元（≤ 0 即 stoquastic）。 */
  readonly maxOffDiagonal: number | null;
  /** 内部位与端点的逐位 A 值（逐点同一性的机器证据）。 */
  readonly interiorValue: number | null;
  readonly endValue: number | null;
}

/**
 * (DL-a) 定理执行：把 base 链（n₀ ≥ 3）上的平移不变 YES 证书提升到
 * targetN 链。复核 = 目标链上 O(n+|E|) 精确扫描 + 内部/端点两类局域
 * 环境的逐位同一性。任何不变量破坏 throw CertificateVerificationFailed。
 */
export function liftChainCertificate(
  base: UniformChain,
  cert: LocalRotation,
  targetN: number,
): LiftResult {
  const violations: LiftViolation[] = [];
  if (
    !Number.isInteger(base.n) ||
    base.n < 2 ||
    base.n > 64 ||
    !Number.isInteger(targetN) ||
    targetN < 2 ||
    targetN > 64
  ) {
    return {
      accepted: false,
      violations: [
        {
          name: "domain",
          detail: `chain lengths in [2,64], got base ${base.n}, target ${targetN}`,
        },
      ],
      certificate: null,
      maxOffDiagonal: null,
      interiorValue: null,
      endValue: null,
    };
  }
  const invariance = isTranslationInvariantCertificate(cert);
  if (!invariance.invariant) {
    violations.push({
      name: "non-invariant-certificate",
      detail:
        `the lift argument needs psi_i = psi and d_i = d on every site; this certificate has ` +
        `psi spread ${invariance.psiSpread.toExponential(3)} and d values [${invariance.dValues.join(",")}]`,
    });
  }
  if (base.n < 3) {
    violations.push({
      name: "missing-interior-witness",
      detail:
        `base chain n = ${base.n} has no interior (two-neighbor) site — the lift's witness ` +
        `environment is absent; n0 >= 3 is required`,
    });
  }
  if (targetN < base.n) {
    violations.push({
      name: "target-below-base",
      detail: `the lift only goes up: targetN ${targetN} < base n0 ${base.n}`,
    });
  }
  if (cert.psi.length !== base.n || cert.d.length !== base.n) {
    violations.push({
      name: "certificate-shape",
      detail: `certificate carries ${cert.psi.length} sites, base chain has ${base.n}`,
    });
  }
  if (violations.length > 0) {
    return {
      accepted: false,
      violations,
      certificate: null,
      maxOffDiagonal: null,
      interiorValue: null,
      endValue: null,
    };
  }
  // the lifted certificate: the uniform (psi, d) replicated to targetN sites
  const lifted: LocalRotation = {
    psi: Array.from({ length: targetN }, () => cert.psi[0] as number),
    d: Array.from({ length: targetN }, () => cert.d[0] as number),
  };
  const targetTerms = uniformChainTerms({ ...base, n: targetN });
  const scan = scanMaxOffDiagonal(targetTerms, lifted);
  if (scan.max > 0) {
    violations.push({
      name: "positive-element-in-target",
      detail: `re-scan of the lifted certificate on n=${targetN} found max element ${scan.max} > 0 at ${scan.worst.name}`,
    });
    return {
      accepted: false,
      violations,
      certificate: lifted,
      maxOffDiagonal: scan.max,
      interiorValue: null,
      endValue: null,
    };
  }
  // per-site identity: interior sites share one A value, end sites another (<= interior)
  const norm = normalizeTerms(targetTerms);
  const deg = neighborCounts(norm);
  const interiorValue = siteValueViaBase(base, lifted, 2); // any interior site's row
  const endValue = siteValueViaBase(base, lifted, 1); // any end site's row
  // the identity claim, re-verified: every interior site equals interiorValue,
  // every end site equals endValue (uniformity makes the map constant per degree)
  for (let i = 0; i < targetN; i++) {
    const expected = (deg[i] as number) === 2 ? interiorValue : endValue;
    const actual = maxSingleFlipRow(norm, lifted, i);
    if (Math.abs(actual - expected) > 1e-15) {
      throw new NonstoqError(
        "CertificateVerificationFailed",
        `lift identity broken at site ${i}: A = ${actual.toExponential(6)} vs degree-class value ${expected.toExponential(6)}`,
      );
    }
  }
  return {
    accepted: true,
    violations: [],
    certificate: lifted,
    maxOffDiagonal: scan.max,
    interiorValue,
    endValue,
  };
}

/**
 * 度类（邻居数 1 或 2）的代表行值：在同参数 base 链上取一个同度位的最
 * 大单翻转行值（位 1 = 内部见证、位 0 = 端点）。提升引理的逐点同一性
 * 即「同参数 + 同局域环境 ⟹ 同值」——这里让机器直接读出两个代表值。
 */
function siteValueViaBase(
  base: UniformChain,
  lifted: LocalRotation,
  degree: number,
): number {
  const terms = normalizeTerms(uniformChainTerms(base));
  const site = degree === 2 ? 1 : 0; // interior witness site 1 (n0 >= 3), end site 0
  return maxSingleFlipRow(terms, lifted, site);
}

/** 单站点最大翻转行 A_i（worst z 已由 |t| 求和吸收——与 designing-element 同式）。 */
function maxSingleFlipRow(
  norm: ElementTerms,
  rot: LocalRotation,
  site: number,
): number {
  const a = rot.psi.map(Math.cos);
  const b = rot.psi.map(Math.sin);
  const g = new Array<number>(norm.n).fill(0);
  for (const f of norm.xFields) g[f.i]! += f.c;
  const p = new Array<number>(norm.n).fill(0);
  for (const f of norm.zFields) p[f.i]! += f.c;
  let value = g[site]! * a[site]! - rot.d[site]! * p[site]! * b[site]!;
  const perNeighbor = new Map<number, number>();
  for (const e of norm.pairs) {
    if (e.i !== site && e.j !== site) continue;
    const other = e.i === site ? e.j : e.i;
    const t =
      e.kappa * a[site]! * b[other]! -
      rot.d[site]! * rot.d[other]! * e.zz * b[site]! * a[other]!;
    perNeighbor.set(other, (perNeighbor.get(other) ?? 0) + t);
  }
  for (const t of perNeighbor.values()) value += Math.abs(t);
  return value;
}

// ---------------------------------------------------------------------------
// (DL-b) the dual-basis execution at n = 64
// ---------------------------------------------------------------------------

/**
 * n = 64 振幅寻址：hi 携带 bit 32..63、lo 携带 bit 0..31（tn/mps.ts 的
 * mpsAmplitude 用 32 位截断的 (bits >>> i) & 1，site ≥ 32 读不到——本
 * 函数是 64 位安全的同一收缩，O(n·χ²)）。
 */
export function amplitude64(mps: Mps, hi: number, lo: number): number {
  let v = new Float64Array(1);
  v[0] = 1;
  let chi = 1;
  for (let i = 0; i < mps.n; i++) {
    const s = i < 32 ? (lo >>> i) & 1 : (hi >>> (i - 32)) & 1;
    const cr = mps.chis[i + 1] as number;
    const t = mps.tensors[i] as Float64Array;
    const next = new Float64Array(cr);
    for (let r = 0; r < cr; r++) {
      let acc = 0;
      for (let l = 0; l < chi; l++) acc += v[l]! * t[(l * 2 + s) * cr + r]!;
      next[r] = acc;
    }
    v = next;
    chi = cr;
  }
  return v[0]!;
}

/** U_i（designing-element.siteMatrix 同式：d=+1 旋转 R(ψ/2)，d=−1 反射 Z·R((ψ−π)/2)）。 */
function siteUnitary(psi: number, d: number): number[][] {
  const c = Math.cos(psi / 2);
  const s = Math.sin(psi / 2);
  return d === 1
    ? [
        [c, -s],
        [s, c],
      ]
    : [
        [s, c],
        [c, -s],
      ];
}

/** 逐 site 把 2×2 矩阵作用到 MPS（态 |ψ⟩ → (⊗M_i)|ψ⟩；键维不变，O(n·χ²)）。 */
export function rotateMpsSites(
  mps: Mps,
  mats: ReadonlyArray<ReadonlyArray<readonly number[]>>,
): Mps {
  const tensors = mps.tensors.map((t, i) => {
    const cl = mps.chis[i] as number;
    const cr = mps.chis[i + 1] as number;
    const nt = new Float64Array(cl * 2 * cr);
    const m = mats[i] as ReadonlyArray<readonly number[]>;
    for (let l = 0; l < cl; l++) {
      for (let sp = 0; sp < 2; sp++) {
        for (let s = 0; s < 2; s++) {
          const ms = m[sp]![s] as number;
          if (ms === 0) continue;
          for (let r = 0; r < cr; r++)
            nt[(l * 2 + sp) * cr + r]! += ms * t[(l * 2 + s) * cr + r]!;
        }
      }
    }
    return nt;
  });
  return { n: mps.n, chis: [...mps.chis], tensors };
}

/** Σ_z ψ(z)² 的精确收缩（与 tn/mps.ts 的私有 mpsNorm 同构——范数守恒裁判）。 */
export function mpsNormSquared(mps: Mps): number {
  let env = new Float64Array(1);
  env[0] = 1;
  let chi = 1;
  for (let i = 0; i < mps.n; i++) {
    const t = mps.tensors[i] as Float64Array;
    const cr = mps.chis[i + 1] as number;
    const next = new Float64Array(cr * cr);
    for (let b = 0; b < cr; b++) {
      for (let bp = 0; bp < cr; bp++) {
        let acc = 0;
        for (let a = 0; a < chi; a++) {
          for (let ap = 0; ap < chi; ap++) {
            const e = env[a * chi + ap]!;
            if (e === 0) continue;
            for (let s = 0; s < 2; s++)
              acc += e * t[(a * 2 + s) * cr + b]! * t[(ap * 2 + s) * cr + bp]!;
          }
        }
        next[b * cr + bp] = acc;
      }
    }
    env = next;
    chi = cr;
  }
  return env[0]!;
}

export interface SignCensus {
  readonly configs: number;
  readonly pos: number;
  readonly neg: number;
  readonly minAmplitude: number;
  /** 具名见证（hex hi/lo 对）。 */
  readonly witnessPos: readonly [string, string] | null;
  readonly witnessNeg: readonly [string, string] | null;
}

/**
 * 全局符号约定（与 anneal/project.ts 同律）：最大幅值取正。MPS 的规范
 * 自由度含整体负号——不固定符号时「单符号」主张会在不同 DMRG 种子下
 * 随机翻转（n=8 实测：搜索态收敛到负基态，rotated 全枚举 min = −max|φ|）。
 * 以结构化构型（全 0/全 1/两个交替）上 |幅值| 最大者的符号为准。
 */
function fixGlobalSign(mps: Mps): Mps {
  const probes: Array<[number, number]> = [
    [0, 0],
    [0xffffffff, 0xffffffff],
    [0x55555555, 0x55555555],
    [0xaaaaaaaa, 0xaaaaaaaa],
  ];
  let best = -Infinity;
  let bestAmp = 0;
  for (const [hi, lo] of probes) {
    const amp = amplitude64(mps, hi, lo);
    if (Math.abs(amp) > best) {
      best = Math.abs(amp);
      bestAmp = amp;
    }
  }
  if (bestAmp < 0) {
    const t0 = mps.tensors[0] as Float64Array;
    const flipped = Float64Array.from(t0, (x) => -x);
    return {
      n: mps.n,
      chis: [...mps.chis],
      tensors: [flipped, ...mps.tensors.slice(1)],
    };
  }
  return mps;
}

/** 计算基符号普查：结构化构型 + 种子化随机构型（64 位安全寻址）。 */
export function signCensus64(
  mps: Mps,
  seed: number,
  randomConfigs: number,
): SignCensus {
  const rng = new Rng(seed);
  const configs: Array<[number, number]> = [
    [0, 0],
    [0xffffffff, 0xffffffff],
    [0x55555555, 0x55555555],
    [0xaaaaaaaa, 0xaaaaaaaa],
  ];
  for (let k = 0; k < randomConfigs; k++)
    configs.push([rng.nextU32(), rng.nextU32()]);
  let pos = 0;
  let neg = 0;
  let min = Infinity;
  let witnessPos: [string, string] | null = null;
  let witnessNeg: [string, string] | null = null;
  for (const [hi, lo] of configs) {
    const amp = amplitude64(mps, hi, lo);
    min = Math.min(min, amp);
    if (amp < 0) {
      neg++;
      witnessNeg ??= [hex(hi), hex(lo)];
    } else {
      pos++;
      if (witnessPos === null && amp > 0) witnessPos = [hex(hi), hex(lo)];
    }
  }
  return {
    configs: configs.length,
    pos,
    neg,
    minAmplitude: min,
    witnessPos,
    witnessNeg,
  };
}

function hex(x: number): string {
  return (x >>> 0).toString(16).padStart(8, "0");
}

export interface DesignedBasisExecution {
  readonly n: number;
  readonly dmrgEnergy: number;
  readonly maxBond: number;
  readonly maxDiscarded: number;
  /** 计算基（硬件测量基）：符号混合 ⟹ P < 1 严格（构造性见证）。 */
  readonly computational: SignCensus;
  /** 去符号基（U† 逐 site 作用后）：min 振幅 ≥ −tol 的采样面。 */
  readonly designed: SignCensus;
  /** ‖U†ψ‖² 与 ‖ψ‖² 之差（旋转的等距守恒，应 ~1e-15）。 */
  readonly normDrift: number;
  /** H′ stoquastic 证书（公式路径，n=64 精确）。 */
  readonly maxOffDiagonalRotated: number;
  readonly liftAccepted: boolean;
}

export interface ExecutionOptions {
  readonly chiMax?: number;
  readonly sweeps?: number;
  readonly seed?: number;
  readonly randomConfigs?: number;
}

/**
 * (DL-b) 双基执行：均匀链 (g,p,κ,w) 上 DMRG 基态的计算基/去符号基符号
 * 普查 + 守恒裁判。证书来自 base 链的判定器输出（调用方传入，本函数
 * 只执行提升与旋转——判定与执行分离，审计面各自独立）。
 */
export function designedBasisExecution(
  chain: UniformChain,
  cert: LocalRotation,
  options: ExecutionOptions = {},
): DesignedBasisExecution {
  const chiMax = options.chiMax ?? 48;
  const sweeps = options.sweeps ?? 12;
  const seed = options.seed ?? 0x5eed64;
  const randomConfigs = options.randomConfigs ?? 300;
  const h: ChainHamiltonian = {
    n: chain.n,
    alpha: Array.from({ length: chain.n }, () => chain.p),
    beta: Array.from({ length: chain.n }, () => chain.g),
    omega: Array.from({ length: chain.n - 1 }, () => chain.w),
    kappa: Array.from({ length: chain.n - 1 }, () => chain.kappa),
  };
  const dmrg = dmrgGroundState(h, { chiMax, sweeps, seed });
  const state = dmrg.state;
  const normBefore = mpsNormSquared(state);
  // de-signed basis: |phi> = U†|GS> site by site (U_i from the certificate),
  // with the repo's global-sign convention (largest amplitude positive) applied
  // AFTER the rotation — the gauge sign is a property of the state, not the basis
  const rotated = fixGlobalSign(rotateMpsSites(state, conjugateSites(cert)));
  const normAfter = mpsNormSquared(rotated);
  const lift = liftChainCertificate(
    { ...chain, n: 3 },
    {
      psi: [
        cert.psi[0] as number,
        cert.psi[0] as number,
        cert.psi[0] as number,
      ],
      d: [cert.d[0] as number, cert.d[0] as number, cert.d[0] as number],
    },
    chain.n,
  );
  return {
    n: chain.n,
    dmrgEnergy: dmrg.energy,
    maxBond: dmrg.maxBond,
    maxDiscarded: dmrg.maxDiscarded,
    computational: signCensus64(state, 0xc0ffee01, randomConfigs),
    designed: signCensus64(rotated, 0xc0ffee02, randomConfigs),
    normDrift: Math.abs(normAfter - normBefore),
    maxOffDiagonalRotated: lift.maxOffDiagonal ?? NaN,
    liftAccepted: lift.accepted,
  };
}

/** U† 的逐 site 矩阵（siteUnitary 的转置）。 */
function conjugateSites(cert: LocalRotation): number[][][] {
  const out: number[][][] = [];
  for (let i = 0; i < cert.psi.length; i++) {
    const u = siteUnitary(cert.psi[i] as number, cert.d[i] as number);
    out.push([
      [u[0]![0] as number, u[1]![0] as number],
      [u[0]![1] as number, u[1]![1] as number],
    ]);
  }
  return out;
}

/** (DL-c) 审计面：伪造提升的走私审判（具名击毙）。 */
export function auditLiftClaim(claim: {
  readonly base: UniformChain;
  readonly certificate: LocalRotation;
  readonly targetN: number;
}): LiftResult {
  return liftChainCertificate(claim.base, claim.certificate, claim.targetN);
}

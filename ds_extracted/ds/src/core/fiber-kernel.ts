/**
 * fiber-kernel —— 子空间演化与纤维构建的纯内核函数集。
 *
 * 这些函数是刻意设计的**零依赖纯函数**（不引用任何模块状态、不使用闭包
 * 捕获）：主线程的串行路径直接调用它们；并行演化内核（subspace-parallel）
 * 经 Function.prototype.toString 把同一份源码序列化进 Worker 线程执行。
 * 两条路径因此保证**逐位一致**——并行只是把纤维区间/元素区间划分给不同
 * 线程，任何单纤维或单元素的数学完全相同，与线程调度无关（确定性并行）。
 *
 * 注意：修改这些函数 = 同时修改串行与并行两条路径的数值行为，
 * 必须全量回归 tests/（物理不变量与最优性基准）。
 */

// ----------------------------------------------------------------------------
// 纤维混合内核（完全图旋转，闭式精确）
// ----------------------------------------------------------------------------

/**
 * 对 order/runs 描述的纤维组，在 runs 下标区间 [runLo, runHi) 上施加
 * e^{−iβ·A} 的纤维混合：a_j ↦ e^{iβ}·a_j + (e^{−iβ(k−1)} − e^{iβ})·μ。
 * 性能要点（8×10 实例曾因此慢 5×）：
 * 1. 旋转系数按纤维尺寸 k 查表——一次调用内 β 恒定而 k 取值极少，
 *    此前逐纤维 4 次三角函数（150 步 × 8 混合器 ≈ 29 亿次 Math.cos/sin）
 *    曾占退火耗时 ~80%；
 * 2. k=3 展开特化——移动混合器纤维尺寸恰为 n−m+1，泛型双循环的每纤维
 *    固定开销（循环设置/分支）曾是次要热点。
 * 查表值与直接计算逐位一致；缓存表为函数局部数组（NaN 哨兵），保持函数
 * 可自由序列化。
 */
export function applyFiberRunsKernel(
  re: Float64Array,
  im: Float64Array,
  order: Int32Array,
  runs: Int32Array,
  runLo: number,
  runHi: number,
  b: number,
): void {
  const cosB = Math.cos(b);
  const sinB = Math.sin(b);
  const cacheRe = new Float64Array(64).fill(NaN);
  const cacheIm = new Float64Array(64).fill(NaN);

  for (let r = runLo; r < runHi; r += 2) {
    const start = runs[r]!;
    const end = runs[r + 1]!;
    const k = end - start;
    if (k <= 1) continue; // 纤维退化（唯一可选agent）：恒等

    // 旋转系数 (e^{−iβ(k−1)} − e^{iβ}) 按 k 查缓存
    let diffRe: number, diffIm: number;
    if (k < 64) {
      diffRe = cacheRe[k]!;
      if (Number.isNaN(diffRe)) {
        const theta = -b * (k - 1);
        diffRe = Math.cos(theta) - cosB;
        diffIm = Math.sin(theta) - sinB;
        cacheRe[k] = diffRe;
        cacheIm[k] = diffIm;
      } else {
        diffIm = cacheIm[k]!;
      }
    } else {
      const theta = -b * (k - 1);
      diffRe = Math.cos(theta) - cosB;
      diffIm = Math.sin(theta) - sinB;
    }

    if (k === 3) {
      // 展开特化：热路径（n−m+1 = 3 的移动混合器）
      const s0 = order[start]!;
      const s1 = order[start + 1]!;
      const s2 = order[start + 2]!;
      const a0r = re[s0]!,
        a0i = im[s0]!;
      const a1r = re[s1]!,
        a1i = im[s1]!;
      const a2r = re[s2]!,
        a2i = im[s2]!;
      const muRe = (a0r + a1r + a2r) / 3;
      const muIm = (a0i + a1i + a2i) / 3;
      const cRe = diffRe * muRe - diffIm * muIm;
      const cIm = diffRe * muIm + diffIm * muRe;
      re[s0] = a0r * cosB - a0i * sinB + cRe;
      im[s0] = a0r * sinB + a0i * cosB + cIm;
      re[s1] = a1r * cosB - a1i * sinB + cRe;
      im[s1] = a1r * sinB + a1i * cosB + cIm;
      re[s2] = a2r * cosB - a2i * sinB + cRe;
      im[s2] = a2r * sinB + a2i * cosB + cIm;
      continue;
    }

    let sumRe = 0,
      sumIm = 0;
    for (let i = start; i < end; i++) {
      const s = order[i]!;
      sumRe += re[s]!;
      sumIm += im[s]!;
    }
    const muRe = sumRe / k;
    const muIm = sumIm / k;

    // a_j ↦ e^{iβ}·a_j + diff·μ
    for (let i = start; i < end; i++) {
      const s = order[i]!;
      const ar = re[s]!;
      const ai = im[s]!;
      const er = ar * cosB - ai * sinB;
      const ei = ar * sinB + ai * cosB;
      re[s] = er + diffRe * muRe - diffIm * muIm;
      im[s] = ei + diffRe * muIm + diffIm * muRe;
    }
  }
}

// ----------------------------------------------------------------------------
// 代价相位递推内核（退火专用）
// ----------------------------------------------------------------------------

/**
 * 在元素区间 [lo, hi) 上推进相位递推并施加：ph ← ph·z 后振幅复乘【新】ph。
 * 退火相位 γ_t = (t/steps)·dt 线性增长 ⇒ 每元素相位因子满足
 * ph(t) = ph(t−1)·z_k（z_k = e^{−i·e_k·dt/steps} 常量），逐元素独立，
 * 区间划分不影响数值。与直接 cos(γ_t·e) 的差异 O(t·ε)≈1e−14（双精度
 * 舍入累积），|ph| 全程 1±ε，幺正性不受影响。
 * 注意：振幅必须乘推进后的 ph(t)（与全空间引擎的 s_t 调度一致）——
 * 乘旧相位会把总代价角缩短 (steps−1)/steps·τ/2，退火调度滞后一个子步。
 */
export function advanceCostKernel(
  re: Float64Array,
  im: Float64Array,
  phRe: Float64Array,
  phIm: Float64Array,
  zRe: Float64Array,
  zIm: Float64Array,
  lo: number,
  hi: number,
): void {
  // 标量形态是刻意选择（2026-09-06 实测）：4× ILP 展开曾被尝试并按
  // bench-kit（伪影对消测量器）实测为负收益——慢 18.1%（95% CI
  // [1.134, 1.192]×，A/A 控制通过）——机理：标量体 ~10 个活值恰在
  // V8 分配的寄存器内，展开后 ~40 个活值强制溢出；且乱序 CPU 已从
  // 数据依赖图自动抽取元素级并行，JS 层展开只增寄存器压力不增并行度。
  // 数据级并行的正确路线是 WASM f64x2（元素级逐位一致），见
  // tests/bench/advance-cost-bench.test.ts 的锚定与评估。
  for (let k = lo; k < hi; k++) {
    const pr = phRe[k]!;
    const pi = phIm[k]!;
    const zr = zRe[k]!;
    const zi = zIm[k]!;
    const nr = pr * zr - pi * zi;
    const ni = pr * zi + pi * zr;
    phRe[k] = nr;
    phIm[k] = ni;
    const r = re[k]!;
    const iv = im[k]!;
    re[k] = r * nr - iv * ni;
    im[k] = r * ni + iv * nr;
  }
}

// ----------------------------------------------------------------------------
// 纤维组构建内核（DFS2：按"其余任务固定"分组重排基态索引）
// ----------------------------------------------------------------------------

/**
 * 为变化任务组 vary（1 个 = 移动混合；2 个 = 换位混合）构建纤维组：
 * 同 fiber 的基态在 order 中连续，runs[2i..2i+1] = order 上的 [start,end)。
 * order 恰为 0..dim−1 的一个排列（每个基态属于恰一个纤维），故按 dim
 * 预分配；runs 上界 2·dim。输出数组由调用方分配（串行路径用普通数组，
 * 并行路径用 SharedArrayBuffer 底座与 Worker 零拷贝共享），本函数返回
 * 实际长度。
 *
 * 自包含的升序键二分查找（键 = Σ a_t·n^(m−1−t)，a_0 为最高位——DFS
 * 字典序枚举 ⇒ 键严格升序）：此前用 Map<double,double> 做 1450 万次
 * 哈希插入/查询，是大维度构建的主要成本。
 */
export function buildFiberGroupKernel(
  m: number,
  n: number,
  ineligible: Uint8Array,
  sortedKeys: Float64Array,
  vary: Int32Array,
  dim: number,
  order: Int32Array,
  runs: Int32Array,
): { orderLen: number; runsLen: number } {
  const powers = new Float64Array(m);
  let size = 1;
  for (let t = m - 1; t >= 0; t--) {
    powers[t] = size;
    size *= n;
  }

  // 键 → 规范索引（sortedKeys 严格升序且唯一）
  const indexOfKey = (key: number): number => {
    let lo = 0;
    let hi = sortedKeys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = sortedKeys[mid]!;
      if (v === key) return mid;
      if (v < key) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  };

  let orderLen = 0;
  let runsLen = 0;

  const used = new Uint8Array(n);
  const current = new Int32Array(m).fill(-1);
  const varySet = new Uint8Array(m);
  for (const t of vary) varySet[t] = 1;

  const assignVary = (vi: number): void => {
    if (vi === vary.length) {
      let key = 0;
      for (let t = 0; t < m; t++) key += current[t]! * powers[t]!;
      const idx = indexOfKey(key);
      if (idx >= 0) order[orderLen++] = idx;
      return;
    }
    const t = vary[vi]!;
    for (let a = 0; a < n; a++) {
      if (ineligible[t * n + a] || used[a]!) continue;
      used[a] = 1;
      current[t] = a;
      assignVary(vi + 1);
      used[a] = 0;
      current[t] = -1;
    }
  };

  const dfs2 = (pos: number): void => {
    if (pos === m) {
      // 所有非变化维度已固定：展开变化维度生成一个纤维
      const start = orderLen;
      assignVary(0);
      if (orderLen > start) {
        runs[runsLen++] = start;
        runs[runsLen++] = orderLen;
      }
      return;
    }
    if (varySet[pos]) {
      dfs2(pos + 1); // 跳过变化维度（稍后统一展开）
      return;
    }
    for (let a = 0; a < n; a++) {
      if (ineligible[pos * n + a] || used[a]!) continue;
      used[a] = 1;
      current[pos] = a;
      dfs2(pos + 1);
      used[a] = 0;
      current[pos] = -1;
    }
  };

  dfs2(0);

  return { orderLen, runsLen };
}

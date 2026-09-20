/**
 * R19-Q 任务2 落码前机器可行性验证（宪法4：规格即假设，先验证再落码）。
 *
 * 验证四个假设：
 *  H1 不可公度频率集 {√2−1, 1, √2}（energies [0,1,√2] 的差集，R=3，K=7）
 *     上：黄金比贪心选点 + GEPP 解 7×7 线性系统，恢复系数的精度量级；
 *  H2 稀疏高谐波集 {0.5, 100.5, 101, 101.5}（R=4，K=9；均匀买断需 N=407>257
 *     被拒）上：同流程的恢复精度与条件水平；
 *  H3 主元比率（GEPP max/min pivot）作为条件代理的水平与稳定性；
 *  H4 网格 + Lipschitz 证书最小化在非均匀恢复系数上是否给出真夹逼。
 *
 * 输出各假设的原始数字，据此推导最终代码容差。
 */

const GOLDEN = 0.6180339887498949;

/** 行向量 r(γ) = [1, cos(d1γ), sin(d1γ), ...] */
function rowAt(differences, gamma) {
  const row = [1];
  for (const d of differences) {
    row.push(Math.cos(d * gamma), Math.sin(d * gamma));
  }
  return row;
}

/** 黄金比候选池（确定性） */
function goldenPool(span, count) {
  const pts = [];
  for (let k = 1; k <= count; k++) pts.push(span * ((k * GOLDEN) % 1));
  return pts;
}

/** 贪心最大体积（Gram–Schmidt 残差范数）选点：纯线性代数，零电路评估 */
function greedySelect(differences, span, K) {
  const poolSize = Math.min(2048, Math.max(64, 8 * K));
  const pool = goldenPool(span, poolSize);
  const rows = pool.map((g) => rowAt(differences, g));
  const basis = [];
  const selected = [];
  const orthogonalResidual = (row) => {
    const r = row.slice();
    for (const q of basis) {
      let dot = 0;
      for (let j = 0; j < r.length; j++) dot += r[j] * q[j];
      for (let j = 0; j < r.length; j++) r[j] -= dot * q[j];
    }
    let n = 0;
    for (const v of r) n += v * v;
    return { residual: r, norm: Math.sqrt(n) };
  };
  while (selected.length < K) {
    let bestIdx = -1;
    let bestNorm = -1;
    let bestResidual = null;
    for (let i = 0; i < rows.length; i++) {
      if (selected.includes(i)) continue;
      const { residual, norm } = orthogonalResidual(rows[i]);
      if (norm > bestNorm) {
        bestNorm = norm;
        bestIdx = i;
        bestResidual = residual;
      }
    }
    if (bestIdx < 0 || bestNorm < 1e-12) return { selected, failed: true, bestNorm };
    selected.push(bestIdx);
    const q = bestResidual.map((v) => v / bestNorm);
    basis.push(q);
  }
  return { selected: selected.map((i) => pool[i]), failed: false };
}

/** GEPP 求解方阵 A c = y；返回 { c, pivotRatio } */
function solveGepp(A, y) {
  const n = A.length;
  const M = A.map((row, i) => [...row, y[i]]);
  const pivots = [];
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-300) return { c: null, pivotRatio: Infinity };
    if (piv !== col) {
      const t = M[piv];
      M[piv] = M[col];
      M[col] = t;
    }
    pivots.push(Math.abs(M[col][col]));
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  const c = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * c[k];
    c[r] = s / M[r][r];
  }
  const pivotRatio = Math.max(...pivots) / Math.min(...pivots);
  return { c, pivotRatio };
}

function evaluateTrig(c, differences, gamma) {
  let v = c[0];
  for (let r = 0; r < differences.length; r++) {
    v += c[2 * r + 1] * Math.cos(differences[r] * gamma) + c[2 * r + 2] * Math.sin(differences[r] * gamma);
  }
  return v;
}

function checkCase(name, differences, trueCoeffs) {
  const K = 2 * differences.length + 1;
  const dMin = differences[0];
  const span = (2 * Math.PI) / dMin;
  const { selected, failed } = greedySelect(differences, span, K);
  if (failed) {
    console.log(`[${name}] 贪心失败（秩亏）`);
    return;
  }
  const A = selected.map((g) => rowAt(differences, g));
  const y = selected.map((g) => evaluateTrig(trueCoeffs, differences, g));
  const { c, pivotRatio } = solveGepp(A, y);
  if (c === null) {
    console.log(`[${name}] GEPP 奇异`);
    return;
  }
  let maxCoeffErr = 0;
  for (let j = 0; j < K; j++) {
    maxCoeffErr = Math.max(maxCoeffErr, Math.abs(c[j] - trueCoeffs[j]));
  }
  let maxValErr = 0;
  const phases = [];
  for (let k = 1; k <= 200; k++) {
    const g = span * ((k * GOLDEN) % 1);
    phases.push(g);
    maxValErr = Math.max(maxValErr, Math.abs(evaluateTrig(c, differences, g) - evaluateTrig(trueCoeffs, differences, g)));
  }
  console.log(
    `[${name}] R=${differences.length} K=${K} span=${span.toFixed(4)} pivotRatio=${pivotRatio.toExponential(3)} maxCoeffErr=${maxCoeffErr.toExponential(3)} maxValErr(200pt)=${maxValErr.toExponential(3)}`,
  );
  // 证书最小化（网格 + Lipschitz）
  let lipschitz = 0;
  for (let r = 0; r < differences.length; r++) {
    lipschitz += differences[r] * Math.hypot(c[2 * r + 1], c[2 * r + 2]);
  }
  const bound = Math.PI;
  const gridPoints = 65536;
  let gridMin = Infinity;
  let bestGamma = 0;
  for (let j = 0; j < gridPoints; j++) {
    const g = (j * bound) / (gridPoints - 1);
    const v = evaluateTrig(c, differences, g);
    if (v < gridMin) {
      gridMin = v;
      bestGamma = g;
    }
  }
  const h = bound / (gridPoints - 1);
  const lower = gridMin - (lipschitz * h) / 2;
  // 密扫真极小（用真系数）+ 最优格内三分精修（纯密扫极小是上界，须精修后比对）
  let denseArgmin = 0;
  let trueMin = Infinity;
  for (let j = 0; j <= 200000; j++) {
    const g = (j * bound) / 200000;
    const v = evaluateTrig(trueCoeffs, differences, g);
    if (v < trueMin) {
      trueMin = v;
      denseArgmin = g;
    }
  }
  let lo = Math.max(0, denseArgmin - bound / 200000);
  let hi = Math.min(bound, denseArgmin + bound / 200000);
  for (let it = 0; it < 100 && hi - lo > 1e-15; it++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (evaluateTrig(trueCoeffs, differences, m1) <= evaluateTrig(trueCoeffs, differences, m2)) hi = m2;
    else lo = m1;
  }
  trueMin = Math.min(trueMin, evaluateTrig(trueCoeffs, differences, (lo + hi) / 2));
  const upper = gridMin;
  console.log(
    `  证书: lower=${lower.toExponential(6)} trueMin=${trueMin.toExponential(6)} upper=${upper.toExponential(6)} 夹逼成立=${lower <= trueMin + 1e-12 && trueMin <= upper + 1e-12}`,
  );
}

// H1: energies [0,1,√2] 的差集 {1, √2−1, √2} 升序 = {√2−1, 1, √2}
checkCase('H1-不可公度', [Math.SQRT2 - 1, 1, Math.SQRT2], [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05]);
// H2: 稀疏高谐波（均匀买断 M=203 ⇒ N=407>257 拒绝）
checkCase('H2-稀疏高谐波', [0.5, 100.5, 101, 101.5], [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05, 0.04, -0.03]);
// H2b: 更极端——大频率间隔
checkCase('H2b-极端间隔', [0.25, 200.125], [0.7, 0.6, -0.4, 0.3, 0.2]);
// 对照: 可公度小谱（与均匀买断同域，验证不回归）
checkCase('对照-公度{2,4}', [2, 4], [0.7, 0.5, -0.3, 0.2, 0.15]);

// H3: 不同种子式偏移的池（改 pool 起点）对 pivotRatio 的影响（确定性敏感性）
console.log('\n[H3] 池偏移敏感性（不可公度集）：');
for (const offset of [0, 1, 2, 3]) {
  const differences = [Math.SQRT2 - 1, 1, Math.SQRT2];
  const K = 7;
  const span = (2 * Math.PI) / differences[0];
  const pool = [];
  for (let k = 1; k <= 512; k++) pool.push(span * (((k + offset) * GOLDEN) % 1));
  const rows = pool.map((g) => rowAt(differences, g));
  const basis = [];
  const sel = [];
  while (sel.length < K) {
    let bi = -1;
    let bn = -1;
    let br = null;
    for (let i = 0; i < rows.length; i++) {
      if (sel.includes(i)) continue;
      const r = rows[i].slice();
      for (const q of basis) {
        let dot = 0;
        for (let j = 0; j < r.length; j++) dot += r[j] * q[j];
        for (let j = 0; j < r.length; j++) r[j] -= dot * q[j];
      }
      let n = 0;
      for (const v of r) n += v * v;
      if (Math.sqrt(n) > bn) {
        bn = Math.sqrt(n);
        bi = i;
        br = r;
      }
    }
    sel.push(bi);
    basis.push(br.map((v) => v / bn));
  }
  const A = sel.map((i) => rows[i]);
  const trueCoeffs = [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05];
  const y = sel.map((i) => evaluateTrig(trueCoeffs, differences, pool[i]));
  const { c, pivotRatio } = solveGepp(A, y);
  let err = 0;
  for (let j = 0; j < K; j++) err = Math.max(err, Math.abs(c[j] - trueCoeffs[j]));
  console.log(`  offset=${offset}: pivotRatio=${pivotRatio.toExponential(3)} coeffErr=${err.toExponential(3)}`);
}

// H4 补充：探针残差口径——用恢复系数 vs 真多项式在 [0,π] 黄金探针上的残差
console.log('\n[H4] [0,π] 域内探针残差（不可公度）：');
{
  const differences = [Math.SQRT2 - 1, 1, Math.SQRT2];
  const trueCoeffs = [0.7, 0.5, -0.3, 0.2, 0.15, -0.1, 0.05];
  const K = 7;
  const span = (2 * Math.PI) / differences[0];
  const { selected } = greedySelect(differences, span, K);
  const A = selected.map((g) => rowAt(differences, g));
  const y = selected.map((g) => evaluateTrig(trueCoeffs, differences, g));
  const { c } = solveGepp(A, y);
  let maxRes = 0;
  for (let p = 1; p <= 8; p++) {
    const g = Math.PI * ((p * GOLDEN) % 1);
    maxRes = Math.max(maxRes, Math.abs(evaluateTrig(c, differences, g) - evaluateTrig(trueCoeffs, differences, g)));
  }
  console.log(`  maxProbeResidual(8) = ${maxRes.toExponential(3)}`);
}

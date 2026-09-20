// R20 γ 规格即假设 · route-price F7（Choi 协方差交换子克隆间隙）仓外机器验证。
// 问题：R18 agentF §三 F4-a 的三条规格断言在落码前是否被机器证实？
//  S1  信道与重相位共轭可交换 ⟺ [Choi(E), U_φ⊗Ū_φ] = 0（元素级、逐 φ）
//  S2  该等价又 ⟺ J 的带条件（非零元仅存于 m−i = n−j 处，整数等式）
//  S3  克隆 {|0>,|1>,|+>,|+i>} 四种子态的信道其基像被线性钉死；钉死像违反带条件
//      ⟹ 无重相位协变克隆信道（W-B 数值间隙的代数升级）
//  S4  CNOT 对信道（协变但非克隆）必须通过 —— 负对照
// 全部用 route-price linalg 同构的复矩阵核（float，φ 代数格点）。

// --- minimal complex kernel (isomorphic to route-price/src/kernel/linalg.ts) ---
const c = (re, im = 0) => ({ re, im });
const cadd = (a, b) => c(a.re + b.re, a.im + b.im);
const cmul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cconj = (a) => c(a.re, -a.im);
const cabs = (a) => Math.hypot(a.re, a.im);
const zeros = (n, m) => Array.from({ length: n }, () => Array.from({ length: m }, () => c(0)));
const matmul = (a, b) =>
  a.map((row) => b[0].map((_, j) => row.reduce((acc, x, k) => cadd(acc, cmul(x, b[k][j])), c(0))));
const dag = (m) => m.map((_, i) => m.map((row) => cconj(row[i])));
const kron2 = (a, b) => {
  const dim = a.length * b.length;
  const out = zeros(dim, dim);
  for (let ac = 0; ac < a.length; ac++)
    for (let ar = 0; ar < a.length; ar++)
      for (let bc = 0; bc < b.length; bc++)
        for (let br = 0; br < b.length; br++)
          out[ac * b.length + bc][ar * b.length + br] = cmul(a[ac][ar], b[bc][br]);
  return out;
};

// --- seeded mulberry32-style gaussian for random probes (xorshift-driven, [0,1)) ---
let st = 20260921 >>> 0;
const rnd = () => {
  st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0;
  return st / 4294967296;
};
const gauss = () => {
  const u = Math.max(rnd(), 1e-12), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// --- 2×2 pieces ---
const E = (i, j, n = 2) => { const m = zeros(n, n); m[i][j] = c(1); return m; };
const rephase = (phi) => [[c(1), c(0)], [c(0), c(Math.cos(phi), Math.sin(phi))]]; // U_φ = diag(1, e^{iφ})

/** linear map M2->M4 (or M2->M2) as its four basis images B[i][j] (n×n each). */
const applyLin = (B, X) => {
  const n = X.length;
  const out = zeros(B[0][0].length, B[0][0].length);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = X[i][j];
      if (x.re === 0 && x.im === 0) continue;
      for (let r = 0; r < out.length; r++)
        for (let q = 0; q < out.length; q++)
          out[r][q] = cadd(out[r][q], cmul(x, B[i][j][r][q]));
    }
  return out;
};
const maxDiff = (a, b) => {
  let w = 0;
  for (let r = 0; r < a.length; r++) for (let q = 0; q < a.length; q++) w = Math.max(w, cabs(cadd(a[r][q], cmul(c(-1), b[r][q]))));
  return w;
};

// --- S1/S2: the triple equivalence on the SAME representation (2->2) ---
// covariance face: T(U ρ U†) = U T(ρ) U† for all 2×2 ρ  (probe: 4 matrix units + 5 random ρ)
const covSameRep = (B, phi) => {
  const U = rephase(phi);
  let worst = 0;
  const probes = [E(0, 0), E(0, 1), E(1, 0), E(1, 1)];
  for (let t = 0; t < 5; t++) {
    const X = zeros(2, 2).map((row) => row.map(() => c(gauss(), gauss())));
    probes.push(X);
  }
  for (const X of probes) {
    const UXU = matmul(U, matmul(X, dag(U)));
    const lhs = applyLin(B, UXU);
    const rhs = matmul(U, matmul(applyLin(B, X), dag(U)));
    worst = Math.max(worst, maxDiff(lhs, rhs));
  }
  return worst;
};
// Choi commutator face: J = Σ B[i][j] ⊗ E[i][j] (output ⊗ input, 4×4); [J, U⊗Ū]
const choi2to2 = (B) => kron2(B[0][0], E(0, 0)).map((row, r) =>
  row.map((x, q) => cadd(x, cadd(cmul(c(1), kron2(B[0][1], E(0, 1))[r][q]), cadd(cmul(c(1), kron2(B[1][0], E(1, 0))[r][q]), cmul(c(1), kron2(B[1][1], E(1, 1))[r][q]))))));
const commutatorNorm = (J, phi) => {
  const D = kron2(rephase(phi), dag(rephase(phi))); // U ⊗ Ū (diagonal)
  const A = matmul(J, D), Bm = matmul(D, J);
  let w = 0;
  for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) w = Math.max(w, cabs(cadd(A[r][q], cmul(c(-1), Bm[r][q]))));
  return w;
};
// band face: B[i][j][m][n] = 0 unless m − n = i − j
const bandViolation2to2 = (B) => {
  const bad = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
    for (let m = 0; m < 2; m++) for (let n = 0; n < 2; n++)
      if (m - n !== i - j && cabs(B[i][j][m][n]) > 1e-14) bad.push(`B[${i}${j}][${m}${n}]=${cabs(B[i][j][m][n]).toExponential(2)}`);
  return bad;
};

const id2 = () => [[c(1), c(0)], [c(0), c(1)]];
const deph = () => {
  const B = [zeros(2, 2), zeros(2, 2)].map(() => [zeros(2, 2), zeros(2, 2)]);
  B[0][0] = E(0, 0); B[1][1] = E(1, 1); // ½(ρ+ZρZ) = the diagonal part
  return B;
};
const Z2 = [[c(1), c(0)], [c(0), c(-1)]];
const zconj = () => { // ρ ↦ ZρZ  — expected NOT covariant (U_φ and U_φ† disagree)
  const B = [zeros(2, 2), zeros(2, 2)].map(() => [zeros(2, 2), zeros(2, 2)]);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) B[i][j] = matmul(Z2, matmul(E(i, j), Z2));
  return B;
};
const ampdamp = (g) => { // ρ ↦ K0ρK0†+K1ρK1†, K0=diag(1,√(1−γ)), K1=√γ|0><1|
  const K0 = [[c(1), c(0)], [c(0), c(Math.sqrt(1 - g))]];
  const K1 = [[c(0), c(Math.sqrt(g))], [c(0), c(0)]];
  const B = [zeros(2, 2), zeros(2, 2)].map(() => [zeros(2, 2), zeros(2, 2)]);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const X = E(i, j);
    B[i][j] = cadd(c(0), c(0)) && matmul(K0, matmul(X, dag(K0))).map((row, r) => row.map((x, q) => cadd(cmul(c(1), x), cmul(c(1), matmul(K1, matmul(X, dag(K1)))[r][q]))));
  }
  return B;
};

const PHIS = [0, Math.PI / 12, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2];
const report2to2 = (name, B, expectCov) => {
  const worstCov = Math.max(...PHIS.map((p) => covSameRep(B, p)));
  const J = choi2to2(B);
  const worstComm = Math.max(...PHIS.map((p) => commutatorNorm(J, p)));
  const band = bandViolation2to2(B);
  const cov = worstCov < 1e-12;
  console.log(`[S1/S2] ${name}: cov=${cov} (worst ${worstCov.toExponential(2)}) commutator worst ${worstComm.toExponential(2)} band-violations ${band.length} — triple-equivalence ${cov === (worstComm < 1e-12) && cov === (band.length === 0) ? "HOLDS" : "BREAKS"} (expected cov=${expectCov})`);
  return cov === expectCov;
};

const X2m = [[c(0), c(1)], [c(1), c(0)]];
const xconj = () => { // ρ ↦ XρX — expected NOT covariant (X U_φ X = U_φ†)
  const B = [zeros(2, 2), zeros(2, 2)].map(() => [zeros(2, 2), zeros(2, 2)]);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) B[i][j] = matmul(X2m, matmul(E(i, j), X2m));
  return B;
};

let ok = true;
ok = report2to2("identity", (() => { const B = [zeros(2, 2), zeros(2, 2)].map(() => [zeros(2, 2), zeros(2, 2)]); B[0][0] = E(0, 0); B[0][1] = E(0, 1); B[1][0] = E(1, 0); B[1][1] = E(1, 1); return B; })(), true) && ok;
ok = report2to2("dephasing ½(ρ+ZρZ)", deph(), true) && ok;
ok = report2to2("bit-flip ZρZ", zconj(), true) && ok; // machine-overruled my first expectation: Z is diagonal, commutes with U_φ
ok = report2to2("amplitude damping γ=0.3", ampdamp(0.3), true) && ok; // machine-overruled too: K1U_φ = e^{iφ}K1, the phase cancels across the conjugate pair
ok = report2to2("bit-flip XρX", xconj(), false) && ok;
for (let t = 0; t < 3; t++) {
  const B = [zeros(2, 2), zeros(2, 2)].map(() => [zeros(2, 2), zeros(2, 2)]);
  const U = (() => { const g = zeros(2, 2).map((row) => row.map(() => c(gauss(), gauss()))); return g; })();
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) B[i][j] = matmul(U, matmul(E(i, j), dag(U))); // random unitary conj — covariant only if U commutes with rephasing
  report2to2(`random unitary conj #${t}`, B, false);
}

// --- S3: the clone pinning ---
// cloning constraints from |0>,|1>,|+>,|+i>:
const ket = (a, b) => [c(a), c(b)];
const outer4 = (v) => v.map((x) => v.map((y) => cmul(x, cconj(y))));
const plus = ket(Math.SQRT1_2, Math.SQRT1_2);
const plusI = ket(Math.SQRT1_2, Math.SQRT1_2); // placeholder, fixed below
plusI[1] = c(0, Math.SQRT1_2);
const kronVec = (u, v) => [cmul(u[0], v[0]), cmul(u[0], v[1]), cmul(u[1], v[0]), cmul(u[1], v[1])];
const B00 = outer4(kronVec(ket(1, 0), ket(1, 0)));   // clone |0>
const B11 = outer4(kronVec(ket(0, 1), ket(0, 1)));   // clone |1>
const Qplus = outer4(kronVec(plus, plus));
const QplusI = outer4(kronVec(plusI, plusI));
// |+><+| = ½(E00+E01+E10+E11) ⇒ B01+B10 = 2Q+ − B00 − B11
const S = Qplus.map((row, r) => row.map((x, q) => cadd(cmul(c(2), x), cmul(c(-1), cadd(B00[r][q], B11[r][q])))));
// |+i><+i| = ½(E00 − iE01 + iE10 + E11) ⇒ −i(B01−B10) = 2Qi − B00 − B11 ⇒ B01−B10 = i·W
const W = QplusI.map((row, r) => row.map((x, q) => cadd(cmul(c(2), x), cmul(c(-1), cadd(B00[r][q], B11[r][q])))));
const iW = W.map((row) => row.map((x) => cmul(c(0, 1), x)));
const B01p = S.map((row, r) => row.map((x, q) => cmul(c(0.5), cadd(x, iW[r][q]))));
const B10p = S.map((row, r) => row.map((x, q) => cmul(c(0.5), cadd(x, cmul(c(-1), iW[r][q])))));
// round-trip: the pinned map must clone the four seed states exactly
const pinned = [[B00, B01p], [B10p, B11]];
const rho2 = (v) => [v, v].map(() => 0) && outer2(v);
function outer2(v) { return [v, v].map((x) => x.map(() => c(0))).map((row, r) => row.map((_, q) => cmul(v[r], cconj(v[q])))); }
const seeds = [["|0>", ket(1, 0)], ["|1>", ket(0, 1)], ["|+>", plus], ["|+i>", plusI]];
for (const [nm, v] of seeds) {
  const got = applyLin(pinned, rho2(v));
  const want = outer4(kronVec(v, v));
  console.log(`[S3] pin round-trip ${nm}: |E(ρ)−|ψψ><ψψ|| = ${maxDiff(got, want).toExponential(2)}`);
}
// band violations of the pinned B01 (one-wire: a1−b1 = −1; two-wire: a1+a2−b1−b2 = −1)
let bad1 = 0, bad2 = 0, offband = [];
for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
  const mag = cabs(B01p[a][b]);
  if (mag <= 1e-14) continue;
  const a1 = a >> 1, a2 = a & 1, b1 = b >> 1, b2 = b & 1;
  const oneWire = a1 - b1 === -1, twoWire = a1 + a2 - b1 - b2 === -1;
  if (!oneWire) { bad1++; offband.push(`[1w] B01[${a}][${b}]=${mag.toFixed(3)}`); }
  if (!twoWire) { bad2++; offband.push(`[2w] B01[${a}][${b}]=${mag.toFixed(3)}`); }
}
console.log(`[S3] pinned B01 nonzero entries off one-wire band: ${bad1}; off two-wire band: ${bad2} — sample: ${offband.slice(0, 4).join(", ")}`);
console.log(`[S3] pinned B01 exact faces: [0][0]=(${B01p[0][0].re.toFixed(3)},${B01p[0][0].im.toFixed(3)}) (band demands 0 — CONVICTED iff nonzero)`);

// --- S4: the CNOT pair channel (covariant but not a cloner) ---
const cnotB = [[B00, outer4(kronVec(ket(1, 0), ket(1, 0)))], [outer4(kronVec(ket(0, 1), ket(0, 1))), B11]];
// B01^CNOT = |00><11|, B10 = |11><00|
const e4 = (i, j) => { const m = zeros(4, 4); m[i][j] = c(1); return m; };
cnotB[0][1] = e4(0, 3);
cnotB[1][0] = e4(3, 0);
const oneWireBand = (B) => {
  const bad = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      if (cabs(B[i][j][a][b]) <= 1e-14) continue;
      const a1 = a >> 1, b1 = b >> 1;
      if (a1 - b1 !== i - j) bad.push(`B[${i}${j}][${a}][${b}]`);
    }
  return bad;
};
console.log(`[S4] CNOT-pair one-wire band violations: ${oneWireBand(cnotB).length} (must be 0)`);
console.log(`[S4] CNOT-pair fails two-wire band: ${(() => { let n = 0; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { if (cabs(cnotB[i][j][a][b]) <= 1e-14) continue; const a1 = a >> 1, a2 = a & 1, b1 = b >> 1, b2 = b & 1; if (a1 + a2 - b1 - b2 !== i - j) n++; } return n; })()} (nonzero — it is one-wire covariant only)`);
// covariance of the CNOT pair channel under the one-wire rep, direct action check:
{
  const worst = Math.max(...PHIS.map((phi) => {
    const U = rephase(phi), Uout = kron2(U, id2());
    let w = 0;
    for (const X of [E(0, 0), E(0, 1), E(1, 0), E(1, 1)]) {
      const UXU = matmul(U, matmul(X, dag(U)));
      w = Math.max(w, maxDiff(applyLin(cnotB, UXU), matmul(Uout, matmul(applyLin(cnotB, X), dag(Uout)))));
    }
    return w;
  }));
  console.log(`[S4] CNOT-pair one-wire covariance direct: worst ${worst.toExponential(2)} (must be <1e-15)`);
}
// exact gap matrix CNOT-B01 vs pinned-B01 (the W-B gap as an exact matrix)
{
  const g = B01p.map((row, r) => row.map((x, q) => cabs(cadd(x, cmul(c(-1), cnotB[0][1][r][q])))));
  console.log(`[S4] gap |pinned B01 − CNOT B01| max entry ${Math.max(...g.flat()).toFixed(3)}; entry [0][0] pinned (${B01p[0][0].re.toFixed(3)},${B01p[0][0].im.toFixed(3)}) vs CNOT 0`);
}

// --- W-B coherence-rate tie, corrected shape: equatorial ψ, ideal clone face vs any channel face ---
// s(φ) = [Q(U_φρU_φ†)]_{03} must equal e^{−2iφ}s(0) (quadratic faces rotate at −2φ);
// t(φ) = [E_pinned(U_φρU_φ†)]_{03} is a mix of e^{±iφ} terms (rate-1 family) — the structural gap.
{
  const psi = ket(Math.SQRT1_2, Math.SQRT1_2); // equatorial: ρ_{01} ≠ 0
  const cloneFace = (phi) => {
    const v = [psi[0], cmul(c(Math.cos(phi), Math.sin(phi)), psi[1])];
    return outer4(kronVec(v, v))[0][3];
  };
  const chanFace = (phi) => {
    const v = [psi[0], cmul(c(Math.cos(phi), Math.sin(phi)), psi[1])];
    return applyLin(pinned, outer2(v))[0][3];
  };
  const s0 = cloneFace(0);
  let worstClone = 0, worstGap = 0, rateReport = [];
  for (const phi of [Math.PI / 6, Math.PI / 4, Math.PI / 3]) {
    const s = cloneFace(phi), t = chanFace(phi);
    const expect = cmul(c(Math.cos(2 * phi), -Math.sin(2 * phi)), s0);
    worstClone = Math.max(worstClone, cabs(cadd(s, cmul(c(-1), expect))));
    worstGap = Math.max(worstGap, cabs(cadd(t, cmul(c(-1), s))));
    rateReport.push(`φ=${phi.toFixed(3)}: s=${s.re.toFixed(3)}+${s.im.toFixed(3)}i t=${t.re.toFixed(3)}+${t.im.toFixed(3)}i`);
  }
  // the channel face rotates at rate 1: t(φ)/t(0) should be e^{+iφ}·(ρ_{01}/ρ_{10} phase bookkeeping) — verify |t(φ)| constant (rate-1 pure phase vs rate-2)
  console.log(`[W-B tie] clone face rotates at −2φ exactly (worst dev ${worstClone.toExponential(2)}); channel-vs-clone |00><11| gap worst ${worstGap.toFixed(3)} at the same φ — ${rateReport.join("; ")}`);
}
console.log(ok ? "S1/S2 expectation table: all as machine-corrected" : "S1/S2 expectation table: MISMATCH");

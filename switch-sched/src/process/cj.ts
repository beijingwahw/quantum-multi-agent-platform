/**
 * Choi-Jamiołkowski machinery in the OCB 2012 convention.
 *
 * A party with input space P (dim dP) and output space F (dim dF) performs a
 * CP map M with Kraus operators K_μ. Its CJ matrix, following Oreshkov-Costa-
 * Brukner Nat. Commun. 3, 1092 (2012), Eq. (3) and preceding text, is
 *
 *   M^{PF} = (I ⊗ M(|ϕ+⟩⟨ϕ+|))^T,   |ϕ+⟩ = Σ_j |j⟩|j⟩ (unnormalized),
 *
 * i.e. entry-wise M[(i,a),(i',a')] = Σ_μ K*[a,i] · K[a',i'] with i ∈ P the
 * input index (major) and a ∈ F the output index (minor). A bipartite process
 * matrix W on (A1 ⊗ A2 ⊗ B1 ⊗ B2) generates probabilities
 *
 *   P(M_A, M_B) = Tr[ W (M_A ⊗ M_B) ]            (OCB Eq. (3)).
 *
 * Everything here is exact linear algebra on real-valued instances of the
 * causal game (σ_x, σ_z families); the convention is additionally pinned by
 * complex-valued anchors in test/process.test.ts (Born-rule reconstructions).
 */

import { type CMat, type CVec, identity, kron, mat, mMul, mTrace } from '../core/cmat.js';

/**
 * CJ matrix of a CP map given by its Kraus operators (input dP → output dF),
 * in the OCB convention M = [I ⊗ Λ(|ϕ+⟩⟨ϕ+|)]^{T_{input}}, i.e.
 *
 *   M[(i,a),(i',a')] = Σ_μ K_μ[a,i'] · K_μ*[a',i]
 *
 * (i input-major, a output-minor). Two anchors pin this against OCB Methods
 * Eq. (20) and the identity channel (verified in test/process.test.ts):
 *   - measure-prepare K = |φ⟩⟨ψ| gives exactly |ψ⟩⟨ψ| ⊗ |φ⟩⟨φ|;
 *   - the identity channel gives the SWAP operator, not |I⟩⟨I|.
 * The previous build implemented Σ_μ K*[a,i] K[a',i'] (conjugate block) —
 * identical on the real Pauli strategies, wrong on complex anchors.
 */
export function cjMatrix(kraus: readonly CMat[]): CMat {
  const k0 = kraus[0];
  if (k0 === undefined) throw new Error('cjMatrix: empty Kraus set');
  const dP = k0.cols;
  const dF = k0.rows;
  const M = mat(dP * dF, dP * dF);
  for (const K of kraus) {
    if (K.rows !== dF || K.cols !== dP) throw new Error('cjMatrix: Kraus shapes must agree');
    for (let i = 0; i < dP; i++) {
      for (let a = 0; a < dF; a++) {
        for (let i2 = 0; i2 < dP; i2++) {
          for (let a2 = 0; a2 < dF; a2++) {
            // Σ_μ K[a,i'] K*[a',i] with (i,a) the row pair, (i',a') the column pair
            const kr = K.re[a * dP + i2]!;
            const ki = K.im[a * dP + i2]!;
            const lr = K.re[a2 * dP + i]!;
            const li = K.im[a2 * dP + i]!;
            const idx = (i * dF + a) * (dP * dF) + (i2 * dF + a2);
            M.re[idx] = M.re[idx]! + (kr * lr + ki * li);
            M.im[idx] = M.im[idx]! + (ki * lr - kr * li);
          }
        }
      }
    }
  }
  return M;
}

/** Kraus operators of "detect |ψ⟩ (one bit of outcome), prepare |φ⟩". */
export function measurePrepareKraus(psi: CVec, phi: CVec): CMat[] {
  const K = mat(phi.n, psi.n);
  for (let a = 0; a < phi.n; a++) {
    for (let i = 0; i < psi.n; i++) {
      // K[a,i] = φ[a] · conj(ψ[i])
      K.re[a * psi.n + i] = phi.re[a]! * psi.re[i]! + phi.im[a]! * psi.im[i]!;
      K.im[a * psi.n + i] = phi.im[a]! * psi.re[i]! - phi.re[a]! * psi.im[i]!;
    }
  }
  return [K];
}

/** OCB Eq. (3): P(M_A, M_B) = Tr[W (M_A ⊗ M_B)]. */
export function processProbability(w: CMat, mA: CMat, mB: CMat): number {
  const t = mTrace(mMul(w, kron(mA, mB)));
  if (Math.abs(t.im) > 1e-10) throw new Error(`processProbability: imaginary probability ${t.im}`);
  return t.re;
}

/** Shared-bipartite-state process: W = ρ^{A1B1} ⊗ 𝟙^{A2} ⊗ 𝟙^{B2}. */
export function sharedStateProcess(rhoA1B1: CMat): CMat {
  return kron(kron(rhoA1B1, identity(2)), identity(2));
}

/**
 * Definite-order circuit process with the first-acting party receiving a
 * fresh state:
 *   A-first: W = ρ^{A1} ⊗ CJ_C^{A2B1} ⊗ 𝟙^{B2} — Alice's output A2 is wired
 *   through channel C into Bob's input B1; Bob's output B2 is dumped.
 *   B-first is the mirror image (OCB Methods: "Bob is given a state ρ^{B1}
 *   and his output is sent to Alice through a quantum channel C").
 * The channel factor is the cjMatrix in THIS module's OCB convention,
 * untransposed — pinned against direct circuit simulation with complex
 * states, channels, and instruments (test/process.test.ts): among the four
 * candidates {CJ, CJᵀ, CJ*, CJ̄ᵀ} only this one reproduces the circuit Born
 * probabilities in both orders.
 */
export function firstPartyProcess(
  first: 'A' | 'B',
  rhoIn: CMat,
  channelKraus: readonly CMat[],
): CMat {
  // a malformed input state would silently index past its rows and produce a
  // NaN process that could sneak into a battery — refuse it at the boundary
  if (rhoIn.rows !== 2 || rhoIn.cols !== 2) {
    throw new Error(`firstPartyProcess: input state must be 2x2 on the first party's wire, got ${rhoIn.rows}x${rhoIn.cols}`);
  }
  const cj = cjMatrix(channelKraus);
  const w = mat(16, 16);
  for (let i1 = 0; i1 < 2; i1++) {
    for (let i2 = 0; i2 < 2; i2++) {
      for (let j1 = 0; j1 < 2; j1++) {
        for (let j2 = 0; j2 < 2; j2++) {
          const row = ((i1 * 2 + i2) * 2 + j1) * 2 + j2;
          for (let i1p = 0; i1p < 2; i1p++) {
            for (let i2p = 0; i2p < 2; i2p++) {
              for (let j1p = 0; j1p < 2; j1p++) {
                for (let j2p = 0; j2p < 2; j2p++) {
                  const col = ((i1p * 2 + i2p) * 2 + j1p) * 2 + j2p;
                  let re: number;
                  let im: number;
                  if (first === 'A') {
                    // ρ on A1; identity on B2; channel CJ couples A2 → B1
                    const r = rhoIn.re[i1 * 2 + i1p]!;
                    const ri = rhoIn.im[i1 * 2 + i1p]!;
                    const idB2 = j2 === j2p ? 1 : 0;
                    const c = cj.re[(i2 * 2 + j1) * 4 + (i2p * 2 + j1p)]!;
                    const ci = cj.im[(i2 * 2 + j1) * 4 + (i2p * 2 + j1p)]!;
                    re = r * idB2 * c - ri * idB2 * ci;
                    im = r * idB2 * ci + ri * idB2 * c;
                  } else {
                    // ρ on B1; identity on A2; channel CJ couples B2 → A1
                    const r = rhoIn.re[j1 * 2 + j1p]!;
                    const ri = rhoIn.im[j1 * 2 + j1p]!;
                    const idA2 = i2 === i2p ? 1 : 0;
                    const c = cj.re[(j2 * 2 + i1) * 4 + (j2p * 2 + i1p)]!;
                    const ci = cj.im[(j2 * 2 + i1) * 4 + (j2p * 2 + i1p)]!;
                    re = r * idA2 * c - ri * idA2 * ci;
                    im = r * idA2 * ci + ri * idA2 * c;
                  }
                  w.re[row * 16 + col] = re;
                  w.im[row * 16 + col] = im;
                }
              }
            }
          }
        }
      }
    }
  }
  return w;
}

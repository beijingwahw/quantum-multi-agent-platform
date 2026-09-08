# vacuum-compiler — Roadmap #11: the ground-state compiler, with its energy ledger

> Epoch-4 claim, audited: "程序写进基态，宇宙自己执行；零能耗永恒节拍。"
> What survives the audit: the program CAN be written into the ground state
> (machine-certified to 1e-16 for random circuits), and the universe DOES
> execute it — but every way of READING the answer pays, and the vacuum never
> beats running the program. The disclaimer clause is a price list.

## Positioning (honest delimitation)

The Feynman–Kitaev construction is textbook theory: clocks (FEY85), the
history-state Hamiltonian and k-local QMA-completeness (KSV02 Ch. 14, KKR06),
Hamiltonian simulation as compilation (LLO96). What did not exist — the reason
this repository exists — is the **machine-certificate layer**: nobody compiles
circuits into Hamiltonians and stamps the deed numerically, and nobody audits
the "zero energy" claim into an itemized readout ledger.

## Deliverables

**T1 — the compiler deed.** `H_prop |Psi_hist> = 0` to ~1e-15 for random
circuits × random inputs; ground-state degeneracy accounting (bare: every
input's history, 2^n; with k checked input qubits: 2^(n-k)); witness semantics
(accepting program: ground energy exactly 0; rejecting: lifted).

**T2 — the spectral gap law, as a theorem.** The bare clock chain has spectrum
{1 − cos(pi k/C)} (k = 0..T), machine-matched for T = 2..12 including the full
multiset at T = 5. **The dressing identity**: W = sum_t (U_t...U_1) ⊗ |t><t|
is unitary and W† H_prop W = ½·Laplacian(path on C vertices) ⊗ I for EVERY
circuit (verified to ~4e-16) — the propagation spectrum is circuit-independent,
and the clock-walks-alone law of T4 is this identity in motion.

**T3 — the readout certificates.** Clock measurement outcomes are exactly
uniform; the marginal's coherences are exactly <psi_t|psi_t'>/C (the law is
coherence, not diagonality — folklore says otherwise). Conditioning on clock
outcome t hands back U_t...U_1|psi_in> with fidelity EXACTLY 1 — at every t,
in the ground state AND mid-walk.

**T4 — the energy ledger.** Three readout modes, each priced:
- **static**: storage costs zero work (an eigenstate in a closed system does
  nothing), but expected erasure = (T+1)·log2(T+1) bits to land on step T;
- **fueled**: a clock tilt −eps·t buys delivery probability (0.143 → 0.399
  across eps/gap 0→1.6). Machine-discovered law: the tilt closes on the
  trajectory-covariant subspace exactly, so the cargo stays EXACT at every
  tilt — the price of oil is the closing spectral gap, not the cargo;
- **walk**: free clock evolution delivers with peak 0.456 at t* = 8.5 for
  T = 6, cargo exact whenever delivered (the walk never garbles the program —
  verified at every sampled time), delivery curve circuit-independent;
- the wall: direct execution = T unitary gates, ZERO erasure. The vacuum
  compiler stores and attests computation; it never beats running it.

**T5 — the graduated boundary and amplification (v0.2.0).** The DTC
eternal-clock face of the epoch-4 claim is no longer open at the model
layer: dtc-clock (v0.21.0) shipped the certificate layer (TC14 the tariff
0 < 5 < 9 < 43.02 kT·ln2 units, TC17 the winner) and route-price (v0.2.0)
receipted it with independent cross-checks (W-E). This repo's own face of
the graduation is the independent THIRD path: the tariff ordering re-derived
on OUR conventions in exact integer arithmetic ((T+1)^(T+1) vs 2^c — no
floats in any decision), the quoted 43.02 certified as the correct 2-decimal
rounding of 12·log2(12) at the matched depth T = 11 (tight: 4301/4303 both
fail), and the sibling citations re-audited read-only against their shipped
reports at every repro. Plus the AMPLIFICATION face: repeating the witness
check k times decays a partial cheater's success exactly as eps^k (AND
accept) with survival (1-eps)^k (OR detect) — exact rationals, the
binomial identity at BigInt residue 0, seeded MC inside 5 sigma on every
resolvable row (rows below the resolution floor are exact-only),
completeness 1^k = 1 exactly, priced at k·(T+1)·log2(T+1) bits. And the
walk's coherent price one step deeper: the second walk family (depth sweep
T = 4..10) shows the energy spread sigma_E is EXACTLY 1/2, conserved under
the walk, independent of depth and circuit — depth buys time, not
bandwidth, against the Mandelstam–Tamm floor pi/(2·sigma_E) = pi.

## Machine-discovered laws (stated, then verified)

1. **Dressing identity** — W†H_prop W = ½L⊗I; gates are a clock-local unitary
   dressing of the bare chain.
2. **The clock walks alone** — walk delivery curves are identical across
   circuits (the data register rides along as U_t...U_1|psi_in>).
3. **Covariant-subspace law** — clock-diagonal, data-identity perturbations
   (the fuel tilt) never leave the covariant subspace: cargo infidelity is
   exactly 0 at every tilt strength.
4. **Clock-marginal coherence law** — rho_clock[t,t'] = <psi_t|psi_t'>/(T+1).
5. **Walk bandwidth constancy** — the clock-0 basis state's energy spread
   sigma_E = sqrt(<H^2>-<H>^2) under prop+in is EXACTLY 1/2 (one clock edge
   touched: <H> = <H^2> = 1/2), independent of depth and circuit, conserved
   under the walk.
6. **Amplification decay** — a unique-input program's per-round soundness
   eps is its own acceptance probability (the trajectory law), and k rounds
   decay it exactly as eps^k / (1-eps)^k.

## Honest boundaries

- **Toy scale.** n ≤ 3 data qubits, T ≤ 12 clock steps (exact dense
  diagonalization). No claim about preparing FK ground states at scale —
  that is the QMA-hard direction and it is not attempted here.
- **"Zero energy" is scoped, not free.** Storage in the ground state of a
  closed system does no work — but nothing is executed until you look, and
  every look pays: Landauer for the outcome record (kT·ln2 × bits), coherent
  time for the walk, closing gap for the fuel. The ledger is the claim.
- **The vacuum never beats running the program.** Zero erasure for direct
  reversible execution vs 6–20 expected erasure bits per delivered answer
  here. The compiler's commodity is storage + attestation (the KKR06 witness
  semantics), not compute.
- **The DTC "eternal clock" face: GRADUATED at the model layer (v0.2.0).**
  The v0.1.0 boundary ("stays open — no certificate layer exists") is now
  false in this workspace and is retired honestly: dtc-clock v0.21.0
  executed the beat-clocks-general-computation face (cargo fidelity exactly
  1 at every tick, TC6) and the thermodynamic certificate (TC12 zero net
  work on the ideal beat, TC14 the legislated tariff, TC17 the winner —
  the FK spectral-clock entry of that table is THIS repo's T4 static mode,
  quoted); route-price v0.2.0 receipted it with independent cross-checks
  (W-D/W-E, the tariff re-priced on its own netlist). This repo's own
  contribution is the third-path exact cross-check of T5 — read-only
  citations to the siblings' shipped certificates, no code import. The
  hardware face remains MI22's; no hardware claim is made here either.
- The walk's delivery peak is measured, not optimized; no claim of efficient
  delivery for large T (the path graph has no perfect state transfer).

## The v0.3.0 quality wall

No new mathematics — the same claims, harder to smuggle against. Every public
kernel now names its preconditions at the throw site with a coded `VacuumError`
(malformed grids, dimension mismatches, off-register gate placements,
non-divisor clock dimensions, non-probability parameters): the latent defects
this wave convicted — a two-qubit gate placed outside the register silently
came back as pure identities with the correct dimension, `geometricAttempts`
at p = 0 hung the caller forever, a non-divisor clock silently read past the
state buffer — are dead, each with a named-rejection anchor in the suite. The
never-referenced collateral surplus (`cmatAdd`, `cvecBasisState`,
`cvecAddScaled`, `circuitUnitary`, `overlap`, `Rng.pick`,
`directExecutionErasureBits`) is retired behind a module-surface regression,
and the exact big-integer power and the (T+1)·log2(T+1) tariff float are
single-sourced. All four repro reports regenerated byte-identical
(SHA-compared before and after).

## Reproduce everything

```
npm ci && npm test && npm run repro
```

41/41 tests (v0.1.0 shipped 20, v0.2.0 shipped 32); full rebuild of all four
reports in ~1.3s. Seeded, zero runtime dependencies, TypeScript strict +
NodeNext. Reports land in `out/reports/` (exp4-boundary.md is new in v0.2.0).
Citations (web-verified, with corrections logged): [docs/citations.md](docs/citations.md).

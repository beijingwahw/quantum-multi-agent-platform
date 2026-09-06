# k-switch — Order superposition over k! topological sorts, executed

Roadmap #10 (epoch-2 frontier): the N-switch theorem layer, machine-verified
for k = 3. Theory knows the quadratic query separation (ARA14: O(n) with the
N-switch vs O(n²) for fixed-order circuits); nobody had executed any of it.

## The parity-orthogonality law (the core new executable)

On the promise "three boxes pairwise commute" vs "pairwise anticommute", with
one use of each box and the control prepared uniform:

- **commuting**: the control ends EXACTLY in the uniform state |u⟩ (fidelity
  1.000000000000) — the order carries no phase;
- **anticommuting**: every order's product is (−1)^{inv(π)}·P, so the control
  ends EXACTLY in the permutation-parity state |u_par⟩ (fidelity
  1.000000000000);
- ⟨u|u_par⟩ = (3 even − 3 odd)/6 = **0 exactly** — deterministic readout.

**Dimension-free**: ARA14's d ≥ N! target-dimension requirement belongs to
their strictly harder full problem (identifying every order's phase); the
binary promise needs no such bound — derived and executed here.

**Plain fixed orders are structurally blind**: commuting triples have
order-independent products; anticommuting Pauli triples have products ±c·I —
every output is the input up to a global phase, trace distance 0 (to the
sqrt-amplified float floor ~2e−8) for all 6 orders across the promise class.
Interleaved circuits are probed by sampling and bounded by ARA14's cited
theorem; coherent control of gate application is the switch's own mechanism,
excluded from "fixed-order" by definition.

## The six-order scheduling contact surface

alloc₁(X)–alloc₂(Z)–exec(γ) chain, receiver = machine register: **all six
fixed orders carry D = 1/√2 exactly; the six-order switch lands at exactly
1/2 = D(fixed)/√2.** Verdict unchanged from the two-box case: order
superposition does not beat ANY definite order on scheduling primitives.

## Reproduce

```
npm install
npm test        # 5/5
npm run repro   # 0.2 s
```

## Honest boundaries

1. The interleaved/ancilla-assisted lower bound is ARA14's theorem, cited —
   we execute the plain-order blindness (exact, structural) and a sampling
   probe, not the general proof.
2. The promise here is the binary commuting/anticommuting decision; ARA14's
   full problem (all-order phase identification, d ≥ N!) is stronger and NOT
   claimed.
3. The scheduling chain is one toy family (unitary writes + probabilistic
   erasure); the law found (uniform 1/√2, switch 1/2) is that family's law,
   honestly scoped — consistent with ../switch-sched's admission criterion.

## Related

- `../switch-sched` (#8, the 2-switch layer), `../causal-ineq` (#9, the
  causal inequality), `../bqp-map` (the atlas row `order-as-resource`).

## Bibliography (web-verified)

- **ARA14** — M. Araújo, F. Costa, Č. Brukner, "Computational advantage from
  quantum-controlled ordering of gates", PRL 113, 250402 (2014).
  arXiv:1401.8127.
- **CDP13** — Chiribella-D'Ariano-Perinotti-Valiron, PRA 88, 022318 (2013).
  arXiv:0912.0195. [Verified earlier today in this workspace.]

MIT. TypeScript strict, zero runtime dependencies, NodeNext, node:test.

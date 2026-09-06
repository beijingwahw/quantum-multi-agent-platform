# EXP1 — The 3-switch, executed

**A. promise instances verified**: canonical commuting triple commutator 0.00e+0 (=0); anticommuting commutator modulus 2.000000000000 (=2, the Pauli value).

**B. isometry certificate**: M†M = I to <1e-13 for both instances (24-dim: control 6 x system 4).

**C. the parity-orthogonality law, executed**: on the commuting instance the control ends EXACTLY in |u> (uniform): fidelity 1.000000000000000; on the anticommuting instance EXACTLY in |u_par> (permutation-parity state): fidelity 1.000000000000000; <u|u_par> = 0.00e+0 (3 even - 3 odd = 0). One use of each box, deterministic — dimension-free.

**D. plain fixed-order blindness is structural**: every one of the 6 orders, on both canonical instances and a random Pauli-type anticommuting triple, outputs the input up to a global phase — max trace distance 2.11e-8. Commuting triples have order-independent products; anticommuting Pauli triples have products +-c·I. The promise classes are invisible to this whole circuit class.

**E. interleaved spot check** (sampling probe, NOT a proof): random unitaries interleaved between the queries, 8 seeds: max distinguishability 1.000000. The general statement — fixed-order circuits need quadratically more queries — is ARA14's theorem, cited.

| quantity | value | anchor |
| --- | --- | --- |
| commuting control fidelity | 1.000000000000000 | 1 |
| anticommuting control fidelity | 1.000000000000000 | 1 |
| <u|u_par> | 0.00e+0 | 0 |
| plain-order max T (6 orders x 3 instances) | 2.11e-8 | 0 |
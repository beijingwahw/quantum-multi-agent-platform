# exp1-switch-algebra

## A. Commutation task — switch readout is deterministic

| pair | d | relation | control out | fidelity to |±⟩ |
|---|---|---|---|---|
| (X, Z) | 2 | XZ = −ZX | |−⟩ | 1.000000000000 |
| (Z, Y) | 2 | ZY = −YZ | |−⟩ | 1.000000000000 |
| (X⊗I, I⊗X) | 4 | commute | |+⟩ | 1.000000000000 |
| (Z⊗I, I⊗Z) | 4 | commute | |+⟩ | 1.000000000000 |

Switch: T(|+⟩⟨+|, |−⟩⟨−|) = 1 — **deterministic, one use of each box.**

## B. Irreducibility — each fixed-order class has a fooling instance pair; the switch has none

- plain fixed order, fooling pair (X⊗I, Z⊗I) vs (X⊗I, I⊗Z), Z-eigenbasis inputs:
  max cross-class trace distance = **0.00e+0** — identical outputs, zero information.
- coherent control of gates, fooling pair (X, Z) vs (ZX, I) (matrix-equal products):
  max cross-class trace distance = **0.00e+0** — the control cannot see the difference.
- switch readout on the SAME pairs: T(|−⟩⟨−|, |+⟩⟨+|) = **1.000000000000** — deterministic.

A strategy must succeed on ALL instances. Each fixed-order class has an instance pair on
which it outputs literally the same state in both promise classes; the switch separates
both pairs with one use of each box. The full 4-vs-2 query bound over ancilla-assisted
fixed-order circuits is the theorem of Chiribella et al. 2013 (cited, not re-proven here).

## C. Control-displacement witness Δ_c = T(Tr_S ρ_out, ρ_c^in)

- replacer-pair switch, input |v⊥⟩: Δ_c = **0.500000000000** (= 1/2 exactly)
- definite-order use (spectator control): Δ_c = **3.33e-16** (0 exactly)
- interpretation: information reached the control through the ORDER degree of freedom —
  no fixed-order use can offer that channel. Full causal-nonseparability certification
  lives in the process-matrix framework (OCB 2012; Goswami et al. 2018), cited.

## D. Dilation independence of the switched channel

| dilation | max |ρ_out − ρ_ref| |
|---|---|
| replacer Kraus (env 2) | 0.00e+0 |
| env unitary freedom e^{iθσz} | 3.47e-18 |
| padded with fresh env qubit (env 4) | 0.00e+0 |

The supermap is well-defined on the CHANNEL, not the dilation — the executable form of
the well-definedness statement in Chiribella et al. 2013.


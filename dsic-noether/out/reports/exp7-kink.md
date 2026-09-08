# EXP7 — the kink locus as piecewise-smooth Noether: K4 executed

v0.2.0 stopped where the allocation jumps. v0.3.0 runs the chain on each smooth piece and
prices the gluing. Two regimes, one discipline: per-patch zero polynomials PLUS exact
kink conditions — the piecewise face of the Noether conservation.

## JUMP regime — the second-price kink

The mechanism is two polynomial patches over Q[s, t, w]; the patch rules are constant, so
the per-patch links hold trivially (labelled honestly) — the content is at the kink:

| patch | [E] / [G] | [I] readoff |
| --- | --- | --- |
| win: x = 1, p = w | 0 (coefficient-wise) | clean |
| lose: x = 0, p = 0 | 0 (coefficient-wise) | clean |

Both patches are Groves under the SAME gauge h = w (the Clarke pivot): second price is
piecewise-Groves with a common gauge; the kink only switches the selection.

| probe | law | machine |
| --- | --- | --- |
| jumps at the kink | [x] = 1, [p] = w, [u] = t - w | exact rationals |
| gluing identity | [u] = t*[x] - [p] | residual 0 exact |
| charge one-sided limits | winner: 0 and -(t-w); loser: -(t-w) and 0 | DSIC across, exact |
| across-kink [I] (MS02) | U(t1)-U(t0) = signed measure above w | exact on 4 pairs (crossing, below, above, reversed) |

The utility jumps at the kink by exactly t - w (the true-type gap), the payment by w, the
allocation by 1 — and the gluing identity [u] = t*[x] - [p] closes exactly. The charge's
one-sided limits are 0 and -(t-w) for a true winner (and the signed -(t-w), 0 for a true
loser — forcing a win you should not take costs exactly the true-type gap). The
across-kink integration step is the Milgrom-Segal envelope (MS02), executed exactly.

| mechanism | the counterfeit's cover | the conviction |
| --- | --- | --- |
| first price p = s | kink gluing HOLDS ([p] = w at s = w) | patch [E] residual exactly -1: convicted |
| all-pay p = s (both patches) | loses without paying? no — pays s | losing-patch [E] residual exactly -1: convicted |

First price PASSES the gluing identity (it pays s, which equals w at the kink) — kink
conditions alone do not certify DSIC. The composite checker demands per-patch [E] AND
gluing; first price's winning patch carries residual exactly -1. The counterfeit
certificate 'gluing => DSIC' is named and rejected.

## CONTINUITY regime — the capacity wall of the quadratic family

Types widened to [1/2, 5/2]^2 so the capacity wall binds at s* = w - 1 (the region
v0.2.0's interior guard was built to avoid). The efficient allocation is the clamp
max(0, (s-w+1)/2):

| probe | chain | machine |
| --- | --- | --- |
| interior patch x = (s-w+1)/2 | [E] 0, [G] 0, readoff clean | nonconstant rule — chain nontrivial |
| wall patch x = 0 | [E] 0, [G] 0 | constant rule |
| gluing at s* = w - 1 (w symbolic) | [x] = [p] = [charge] = 0 | zero polynomials |
| charge FLUX at s* | dG/ds jumps by (t-w+1)/2 = x(t) | exact (the surface term) |
| piecewise charge on the grid (81x81) | never > 0; interior -1/64; cross -1/64 | 20 wall-to-wall flat pairs (weak DSIC) |

Here NOTHING jumps: x, p, and the charge are continuous at the wall kink (zero
polynomials with w symbolic). What jumps is the charge's FLUX — dG/ds breaks by exactly
(t-w+1)/2 = x(t), the true allocation: the piecewise conservation law carries a surface
term at the interface, the exact analog of a Rankine-Hugoniot condition. The interior
charge is the SAME -(s-t)^2/4 as the unconstrained family; the wall-to-wall block is the
weak-DSIC flat (charge 0 — every walled report is as good as truth), counted in the
grid witness rather than hidden.

## Honest boundary

PROVED, machine-exact: per-patch chains and gluing in both regimes; the common-gauge
structure of second price; the across-kink envelope (MS02) on rational pairs; the flux
surface term at the wall. The per-patch second-price links are trivially zero (constant
patch rules) — labelled, not inflated. NOT proved: the general measurable-space
Green-Laffont theorem on the kink locus (GL79, cited); tie-breaking AT the kink point
itself (the repo stays tie-free by construction — the wall flat is indifference, not a
tie); the multi-agent wall combinatorics (here one wall, n = 2).

# EXP5 — the continuum derivation, executed: Noether 1918 -> Green-Laffont

The excluded boundary of v0.1.0, executed at the smooth layer. Stage: the quadratic
divisible-good family (v = theta*a - a^2/2, sum a = 1) on Theta = [2/5, 3/5]^n — the
efficient allocation x_j = theta_j - thetabar + 1/n is affine, and EVERY identity below
is verified as the ZERO POLYNOMIAL in exact rational arithmetic: it holds for EVERY type
profile in the region at once. The interior guard holds x in [2/15, 8/15] (corners, exact).

## T5 — the continuum 1-forms: closedness is the Helmholtz face

| rule | closedness of alpha = x.ds | witness |
| --- | --- | --- |
| efficient rule (n=3, 2 goods) | d alpha = 0 | 0 (coefficient-wise) |
| skew rule c=1/7 | residual -2c = -2/7 | cycle -2cwh = -2/175; +2/175 on the reversed orientation |
| skew rule c=-2/9 | residual -2c = 4/9 | cycle -2cwh = 4/225; +4/225 on the reversed orientation |
| efficient rule rectangle loop | exact edge integration | 0 (exact 0) |

The report action S[gamma] = integral of x.ds along report paths has as its
Euler-Lagrange equations the closedness d alpha = 0 (the inverse-problem face,
OLV86) — and a payment with alpha = dp exists exactly when the Jacobian of x is
symmetric. The efficient family's Jacobian is symmetric coefficient-wise; the skew
family crosses the implementable locus exactly at c = 0 with cycle integral -2cwh.

## The chain, assembled (T8): [E]nvelope -> [I]ntegration -> [S]tationarity -> [G]roves

| n | [E] residual | [S] residual | [I] readoff | [G] form |
| --- | --- | --- | --- | --- |
| 2 | 0 (coefficient-wise) | 0 (coefficient-wise) | 0 (coefficient-wise) | clean (no s-monomials) |
| 3 | 0 (coefficient-wise) | 0 (coefficient-wise) | 0 (coefficient-wise) | clean (no s-monomials) |

- [E] DSIC => the payment's own-report derivative equals dV/da . dx/ds on the
  truthful diagonal — residual the zero polynomial.
- [I] fiber integration (the Poincare/FTC step) exhibits the gauge h(theta_-i):
  the readoff p - (antiderivative) carries no own-report monomials and equals the
  anchored Groves payment exactly.
- [S] efficiency enters: sum_j (theta_j - x_j) . dx_j/ds = 0 (all marginal gaps
  equal lambda and the allocations sum to 1) — residual the zero polynomial.
- [G] p + W_-i(x) = the Clarke pivot exactly: p = h(theta_-i) - W_-i(x), the
  Groves form, with exactly the gauge freedom (KSS11's second-theorem class).

## T6 — Noether I, mechanism-native: the charge and its orbit conservation

| n | charge closed form | G == welfare gap | grid witness |
| --- | --- | --- | --- |
| 2 | -(n-1)(s-t)^2/(2n) exact | 0 (coefficient-wise) | -1/6400 < 0 at 81 grid points |
| 3 | -(n-1)(s-t)^2/(2n) exact | 0 (coefficient-wise) | -1/4800 < 0 at 81 grid points |

The charge (deviation gain) has the closed form -(n-1)(s-t)^2/(2n) — DSIC for this
family by ordered-field arithmetic, equality iff s = t, independently witnessed on
exact rational grids. Under the one-parameter gauge orbit p -> p + eps*g(theta_-i)
the charge is CONSERVED: dG/deps is the zero polynomial for seeded random gauges —
the Noether-I implication shape (invariance => conserved quantity), executed.

| gauge trial | gauge purity | dG/deps |
| --- | --- | --- |
| 0 | no s/t monomials | 0 (coefficient-wise) |
| 1 | no s/t monomials | 0 (coefficient-wise) |
| 2 | no s/t monomials | 0 (coefficient-wise) |

## T7 — Noether II: the gauge identity and the classification (uniqueness, executed)

The gauge group is C^infinity(Theta_-i) — transformations by arbitrary functions,
Noether's second-theorem class. The identity it buys: the fiber derivative of every
differential incentive identity annihilates the gauge direction (g has no s-monomials,
so d/ds vanishes on it — the constraint system cannot see the gauge). The
classification corollary IS Green-Laffont uniqueness: the solver reads the gauge
off ANY DSIC payment exactly, and convicts off-orbit payments on sight. The census
(v0.3.0) includes a TWO-PARAMETER non-linear gauge alpha o0 o1 + beta o0^3: both
parameters recovered coefficient-exact; the same gauge with a hidden (1/11)s^2
term is convicted on sight.

| payment | verdict | evidence |
| --- | --- | --- |
| 0 | gauge | recovered exactly (0 residual) |
| 1 | gauge | recovered exactly (0 residual) |
| 2 | gauge | recovered exactly (0 residual) |
| control p + (3/7)s | NOT-DSIC | convicted (1 own-report monomials) |
| h = (2/7)o0o1 - (3/5)o0^3 (two-parameter) | gauge | both parameters recovered (0 residual) |
| same gauge + hidden (1/11)s^2 | NOT-DSIC | convicted on sight |

## K1 — the off-gauge crime and its exact price

| probe | law | machine |
| --- | --- | --- |
| envelope residual of p + eps*s | exactly -eps | -1 |
| profitable deviation at eps=1/20 | s* = t - eps*n/(n-1), worth eps^2 n/(2(n-1)) | 3/1600 (exact) |

p + eps*s (a payment that moves along the OWN-report coordinate) breaks the envelope
by exactly -eps and buys a profitable deviation at s* = t - eps*n/(n-1) worth
eps^2 n/(2(n-1)) — the crime and its price in closed form, exact.

## K2 — efficiency is load-bearing: the kappa family and the decreasing rule

| rule | own envelope | Groves drift d/ds[p + W_-i] |
| --- | --- | --- |
| kappa = 1/2 | 0 (coefficient-wise) | 1/6 * s |
| kappa = 1 | 0 (coefficient-wise) | 0 (the kappa = 1 slice IS Groves) |
| kappa = 2 | 0 (coefficient-wise) | -4/3 * s |
| decreasing rule x = 9/10 - s/5 | 2-cycle gain | 1/125 > 0 (not implementable, ROC87) |
| same rule, any affine payment | exact deviation witness | beta=0: s=3/10, gain 1/50 |

The kappa-rule (efficient for the discounted profile kappa*s) is implementable —
its own envelope holds for every kappa — but its Groves drift is exactly
kappa(1-kappa)(n-1)/n * s: the Groves form holds ONLY on the kappa = 1 slice.
The decreasing rule is not implementable at all: 2-cycle gain c(a-b)^2 > 0 exact.

## K3 — topology is load-bearing: closed does NOT imply exact on an annulus

| probe | law | machine |
| --- | --- | --- |
| curl (closedness) | 0 (coefficient-wise) | closed on the punctured plane |
| quarter-turn symmetry | 0 (coefficient-wise) | all four sides integrate equally |
| side antiderivative | 2(2t^2-2t+1) - (1+(2t-1)^2) = 0 exact | side = pi/2 numeric 1.57079632679 |
| diamond loop total | 4 * pi/2 = 2*pi exact | numeric 6.28318530718 |

The form (x dy - y dx)/(x^2+y^2) is closed (curl = 0 coefficient-wise) yet integrates
to exactly 2*pi around the unit diamond — four equal sides by the quarter-turn
symmetry (exact), each side pi/2 by the atan(2t-1) antiderivative identity (exact),
numeric cross-check 6.2831853071796. On a NON-CONVEX type region the Poincare step
[I] fails: closedness does not produce a potential — and no FINITE report set can
host this phenomenon (every cycle through finitely many reports decomposes into
triangles, so closed => exact always at the T2 layer). The annulus witness marks a
theorem-shape that exists ONLY in the continuum.

## K4 — smoothness is load-bearing: the kink locus of the second-price auction

| probe | law | machine |
| --- | --- | --- |
| winning region theta_1 > theta_2 | U(theta') - U(theta) == theta' - theta | bitwise on rational pairs |
| crossing the diagonal by any eps > 0 | allocation jumps by exactly 1 | 1 |

On both open regions of the second-price auction the envelope holds bitwise on
rational pairs — the smooth chain runs; the diagonal (where the allocation jumps by
exactly 1) is where the chain's hypotheses fail and the general measurable-space
theorem (GL79, cited) takes over.

## Honest boundary

PROVED here, machine-exact: every link of the chain on the smooth convex layer,
both directions (Groves form => DSIC by the closed-form charge; DSIC => Groves form
by [E]+[I]+[S]); Noether I as orbit conservation of the charge; Noether II as the
gauge identity whose moduli reading is uniqueness; the four controls marking where
gauge-orthogonality (K1), efficiency (K2), convexity (K3), and smoothness (K4) are
load-bearing. NOT proved, quoted: the general Green-Laffont theorem for measurable
type spaces and nonsmooth mechanisms (GL79) — the kink locus K4 is its territory;
Green/Poincare as general analytic theorems (SPI65) — here they are executed as
exact polynomial integration on a convex box; Noether's theorems as general
statements (NOE18, KSS11) — their mechanism INSTANCES are what the machine holds.

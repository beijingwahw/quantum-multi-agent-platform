# W1 — the correlation inventory: what the joint column holds

| p (visibility) | E(a,b) matrix path | -p a.b closed | worst dev (24 axis pairs) | CHSH | 2*sqrt(2)*p |
| --- | --- | --- | --- | --- | --- |
| 1 | (24 pairs) | (24 pairs) | 0.000000000000000 | -2.828427124746 | 2.828427124746 |
| 0.9 | (24 pairs) | (24 pairs) | 0.000000000000000 | -2.545584412272 | 2.545584412272 |
| 0.75 | (24 pairs) | (24 pairs) | 0.000000000000000 | -2.121320343560 | 2.121320343560 |
| 0.5 | (24 pairs) | (24 pairs) | 0.000000000000000 | -1.414213562373 | 1.414213562373 |
| 0.25 | (24 pairs) | (24 pairs) | 0.000000000000000 | -0.707106781187 | 0.707106781187 |

The joint table P(x,y|a,b) = (1 - xy p a.b)/4 on both arithmetic paths; CHSH rides Tsirelson's line 2*sqrt(2)*p to machine precision (TSIR80).

## The complex-anchor family |Phi_theta> = (|00> + e^{i theta}|11>)/sqrt(2)

| theta | E(a,b) matrix path | full closed form | dev |
| --- | --- | --- | --- |
| 0.0000 | -0.508800000000 | -0.508800000000 | 0.000000000000000 |
| 0.7854 | -0.013618325857 | -0.013618325857 | 0.000000000000000 |
| 1.0472 | 0.196002466359 | 0.196002466359 | 0.000000000000000 |
| 1.5708 | 0.599200000000 | 0.599200000000 | 0.000000000000000 |

Full tensor: E = cos(theta)(ax bx - ay by) + az bz + sin(theta)(ax by + ay bx). The z-diagonal (+1, phase-blind) and the sin(theta) off-diagonals (phase-carrying, conjugation-sensitive) both anchor — the y-side cells break first under any conjugation slip. An earlier draft dropped both terms; the referee flagged the 0.1872 = az*bz residual at theta = 0 before shipping.

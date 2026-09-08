# exp3-sched-contact

## Table 1 — alloc vs exec(γ): the realistic scheduling pair

| γ | D(AB) = 1−γ | D(BA) = 1 | D(switch) | Δ = switch − max fixed |
|---|---|---|---|---|
| 0 | 1.000000 | 1.000000 | 0.500000 | -0.500000 |
| 0.25 | 0.750000 | 1.000000 | 0.375000 | -0.625000 |
| 0.5 | 0.500000 | 1.000000 | 0.250000 | -0.750000 |
| 0.75 | 0.250000 | 1.000000 | 0.125000 | -0.875000 |
| 1 | 0.000000 | 1.000000 | 0.000000 | -1.000000 |

Closed forms verified: execute-after-allocation keeps the task signature with weight
1−γ; allocation-after-execution always writes it. The best definite order dominates at
every γ — on the realistic scheduling pair, order superposition strictly loses (Δ < 0
for 0 < γ < 1): the coherent average over "already allocated" and "not yet allocated"

branches blurs exactly the signature the receiver needs.

## Table 2 — alloc-erased(ε) vs exec(0.5): the ESC-shaped column

| ε | D(AB) | D(BA) | D(switch) | Δ = switch − max fixed |
|---|---|---|---|---|
| 0 | 0.500000 | 1.000000 | 0.250000 | -0.750000 |
| 0.25 | 0.375000 | 0.750000 | 0.187500 | -0.562500 |
| 0.5 | 0.250000 | 0.500000 | 0.125000 | -0.375000 |
| 0.75 | 0.125000 | 0.250000 | 0.062500 | -0.187500 |
| 1 | 0.000000 | 0.000000 | 0.000000 | +0.000000 |

Exact law **D(switch) = (1−ε)/4**, and at ε = 1 EVERYTHING closes — including the switch.
Contrast with T2: there the payload TRANSITED both erasing channels (each environment
captured distinguishable information and the order coherences recombined it); here the
payload is CREATED by the allocation channel and erased after the fact — no transiting
information, no order resource. **Admission criterion, sharpened: order superposition
pays only when the payload must transit erasing structure on both branches.**

## Table 3 — random CPTP pairs (control group)

- 40 random isometry pairs (d = 2, env 2), random orthogonal input pairs
- receiver = system register: Δ median **-0.149905**, max **-0.009113**,
  positives Δ > 1e−9: **0/40**
- receiver = joint (system + control): Δ median **0.147796**, max **0.526844**,
  positives: **34/40**

Generic channel pairs give the system-register receiver no edge — median deficit, zero
positives in this sample; the JOINT receiver (system + control) wins on 34/40, but that
partly reflects an extra output register no plain definite-order use has, not order
advantage per se (against the fully general causally-separable class the question is
what process witnesses decide — cited, OCB 2012 / Goswami 2018). For scheduling, the
receiver is the machine register: order is a resource only under structural admission —
payload transiting erasing channels on both branches — never by default.


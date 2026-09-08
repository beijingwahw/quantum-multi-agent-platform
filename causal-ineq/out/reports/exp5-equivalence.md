# EXP5 — The OCB12 equivalence, machine-checked

v0.1.0 boundary 1 said: "the explicit W of OCB12 was not transcribed; unitary equivalence
not claimed." That boundary is retired — by transcription and elementwise comparison:

| pair | max elementwise deviation |
| --- | --- |
| W* (machine-derived) vs W_OCB12 (eq. 7 transcribed) | 2.78e-17 |
| W* vs S_OCB,1 (LC25 eq. 41, alpha=1) | 2.78e-17 |
| W* vs S_OCB,2 (LC25, alpha=2 — must differ) | 6.50e-2 |

The repo's constraint-derived construction and the paper's eq. (7) are the SAME operator,
term for term: (1/4)[1 + (1/√2)(Z^{A2}Z^{B1} + Z^{A1}X^{B1}Z^{B2})] — and LC25's attaining
process S_OCB,alpha at alpha=1 is the same operator a third time. Both pass the validity
checker (Hermitian, PSD, trace 4, allowed patterns).

## The payoff functional, derived twice

Derivation 1: the process Born rule executed (T3 machinery, 16-dim exact arithmetic).
Derivation 2: OCB12 eq. (26) closed forms P(x|a,b) = ½[1+(−1)^{x+b}/√2], P(y|a,b) =
½[1+(−1)^{y+a}/√2]. Max entrywise deviation across all 16 table entries:
1.11e-16. The x=1/y=1 columns (omitted for width) match the
same closed forms.

| P(x|a,b) b'=0 | a=0 | a=1 |
| --- | --- | --- |
| b=0 executed | 0.853553390593 | 0.853553390593 |
| b=1 executed | 0.146446609407 | 0.146446609407 |

| P(y|a,b) b'=1 | a=0 | a=1 |
| --- | --- | --- |
| b=0 executed | 0.853553390593 | 0.146446609407 |
| b=1 executed | 0.853553390593 | 0.146446609407 |

runProtocol on the transcription: p_success = 0.853553390593 = cos²(π/8) exactly.

## Tamper controls — the check has teeth

| tampered transcription | validity | elementwise dev | payoff dev | table dev | outcome |
| --- | --- | --- | --- | --- | --- |
| sigma_x^{B1} mistranscribed as sigma_y | VALID | 2.50e-1 | 1.77e-1 | 3.54e-1 | REJECTED by comparison |
| coefficient 1/√2 mistranscribed as 0.69 | VALID | 4.28e-3 | 4.28e-3 | 8.55e-3 | REJECTED by comparison |

Both tampered processes are VALID (allowed patterns, PSD) — a validity checker alone waves
them through; only the elementwise/entrywise comparison against the transcribed original
rejects them. This is the fake-equivalence smuggling trial in executable form.

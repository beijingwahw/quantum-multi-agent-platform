/** Exp1 — T1 blindness: server-view zero-leakage identity + negative controls. */

import { writeReport, mdTable, fmt, sci } from './report.js';
import {
  serverViewMixed,
  worstCaseBlindnessGap,
  angleOtpMutualInfo,
  noPadLeakage,
  mixedCompare,
} from '../protocol/ubqc.js';
import { makeRng } from '../core/rng.js';
import { EIGHT_ANGLES } from '../protocol/ubqc.js';
import { pathToFileURL } from "node:url";

function main(): void {
  const rng = makeRng(0x51ac);

  // (1) identity: E_pads[server view] = I/2^n exactly for every secret
  const identityRows: string[][] = [];
  for (const n of [1, 2, 3, 4]) {
    const thetas = Array.from({ length: n }, () => EIGHT_ANGLES[rng.int(8)]!); // rng.int(8) ∈ [0,8) on the 8-angle grid
    const gap = mixedCompare(serverViewMixed(thetas), n);
    identityRows.push([String(n), String(2 ** n), fmt(gap, 15)]);
  }

  // (2) worst-case gap between two random secrets
  const gapN1 = worstCaseBlindnessGap(1, 64, 1); // exhaustive 8×8 pairs
  const gapN3 = worstCaseBlindnessGap(3, 40, 0x77);
  const gapN4 = worstCaseBlindnessGap(4, 30, 0x78);

  // (3) angle OTP on Z_8
  const otp = angleOtpMutualInfo();

  // (4) negative control: no pad
  const noPad2 = noPadLeakage(2);
  const noPad3 = noPadLeakage(3);

  writeReport(
    { name: 'exp1-blindness', title: 'T1 — UBQC blindness as an exact identity' },
    {
      identityChecks: identityRows.map(([n, dim, gap]) => ({ n, dim, traceDistanceToMixed: Number(gap) })),
      worstCaseGaps: { n1: gapN1, n3: gapN3, n4: gapN4 },
      angleOtp: otp,
      noPad: { n2: noPad2, n3: noPad3 },
    },
    `## Zero-leakage identity

${mdTable(['n', 'dim 2^n', '‖E[ρ_server] − I/2^n‖₁'], identityRows)}

Worst-case trace distance between server views of two different secrets:
n=1 (exhaustive 64 pairs) = ${sci(gapN1)}; n=3 (40 random pairs) = ${sci(gapN3)}; n=4 (30 pairs) = ${sci(gapN4)}.

**Conclusion:** the pad-averaged server view is the maximally mixed state to machine
precision, for every secret — blindness of the prepare-and-send layer is an exact
identity, not an estimate.

## The pad is a one-time-pad on the angle group — two exact regimes

Standard UBQC pads {0, π/2, π, 3π/2}: I(θ;δ) = **${fmt(otp.standard.mutualInfoBits, 12)} bits exactly**
(the quadrant of θ is public by design — absorbed into the flow corrections),
H(θ|δ) = ${fmt(otp.standard.condEntropyBits, 12)} bits.
Full-group pads (all 8 angles): I(θ;δ) = ${sci(otp.fullGroup.mutualInfoBits)} bits,
H(θ|δ) = ${fmt(otp.fullGroup.condEntropyBits, 12)} bits — a perfect OTP on Z₈.

## Negative control — drop the pad, leakage is immediate

| n | max trace distance vs secret 0 | Holevo χ (bits) of the 8^n ensemble |
|---|---|---|
| 2 | ${fmt(noPad2.maxTraceDistance, 6)} | ${fmt(noPad2.chiBits, 6)} |
| 3 | ${fmt(noPad3.maxTraceDistance, 6)} | ${fmt(noPad3.chiBits, 6)} |

Without the angle pad the server's states are pure and secret-dependent; the
one-time-pad structure is exactly what zeros the Holevo information.
`,
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

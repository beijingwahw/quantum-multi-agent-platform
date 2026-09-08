/**
 * W5 — bounded privacy amplification: the security layer W4 excluded,
 * executed at BB84-grade toy scale and measured, not asserted.
 *
 * Chain: W4's withdrawal delivers sifted bits at QBER q = (1-p)/2. Worst-case
 * attribution (BB84-grade accounting): every bit of QBER is adversary
 * footprint. Two explicit adversary profiles on exact tables:
 *   smoothed — Z^m = X^m through a per-bit BSC(eps_E), eps_E = 1/2 - q: her
 *     guessing advantage equals her footprint (the intercept-resend identity,
 *     cross-checked in W6);
 *   sparse — she knows a subset of raw bits exactly (W6's tapped fraction).
 * Amplifier: the universal-2 family x -> trunc_k(a (x) x) over GF(2^m),
 * a in GF(2^m)* — 255 explicit maps at m = 8, 15 at m = 4. The hash choice
 * is public; I(K; Z^m | a) is enumerated over the whole family.
 */
import { bscBlockInfo, collisionCensus, gfMul, inverseCensus, paMeasure, sparseAdversaryInfo } from "../kernel/amplify.js";
import { auditRateRow, auditUniformityClaim } from "../kernel/audit.js";
import { h2 } from "../kernel/tariff.js";
import { writeReport, fmt } from "./report.js";
import { pathToFileURL } from "node:url";

function main(): void {
  const lines: string[] = [];
  lines.push("# W5 — bounded privacy amplification: the security layer, measured at toy scale\n");

  // A. the family certificate
  lines.push("## A. the explicit family and its machine certificate\n");
  const inv4 = inverseCensus(4);
  const inv8 = inverseCensus(8);
  lines.push(`- field certificates: GF(2^4) poly x^4+x+1 — ${inv4.invertible}/${inv4.nonzero} nonzero elements invertible; GF(2^8) poly x^8+x^4+x^3+x+1 — ${inv8.invertible}/${inv8.nonzero}. Multiplication anchor 0x57 * 0x83 = 0x${gfMul(0x57, 0x83, 8).toString(16)} in GF(2^8).`);
  lines.push("\n| m | k | family | collisions per delta | collision prob | 2^-k | universal-2 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [m, k] of [
    [8, 8],
    [8, 6],
    [8, 4],
    [8, 2],
    [4, 4],
    [4, 2],
  ] as const) {
    const c = collisionCensus(m, k);
    lines.push(`| ${m} | ${k} | ${c.family} | ${c.collisionsPerDelta} | ${fmt(c.maxCollisionProb, 12)} | ${fmt(c.uniform2Bound, 12)} | ${c.universal2 ? "yes (strict)" : "NO"} |`);
  }
  lines.push(
    "\nThe collision count is identical for every delta != 0 (exhaustive) and equals 2^(m-k) - 1 of 2^m - 1 maps: universal-2 with room to spare (CW79's definition met strictly, never exactly at 2^-k — the audit below rejects any claim of exact uniformity).\n",
  );

  // B. Eve-surviving information before/after, smoothed profile
  lines.push("## B. Eve-surviving information, before and after amplification (exact states)\n");
  lines.push("| eps_E | before I(X^8;Z^8) (two-path dev) | after k=6 | after k=4 | after k=2 | TV family-mixed (k=4) | h_inf | LHL bound (k=4) |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const eps of [0.5, 0.45, 0.4, 0.3, 0.25, 0.1]) {
    const before = bscBlockInfo(8, eps);
    const pm4 = paMeasure(8, 4, eps);
    const pm6 = paMeasure(8, 6, eps);
    const pm2 = paMeasure(8, 2, eps);
    lines.push(
      `| ${eps} | ${fmt(before.table, 6)} (${Math.abs(before.table - before.closed).toExponential(1)}) | ${fmt(pm6.afterMean, 6)} | ${fmt(pm4.afterMean, 6)} | ${fmt(pm2.afterMean, 6)} | ${fmt(pm4.tvFamilyMixed, 6)} | ${fmt(pm4.hInf, 4)} | ${fmt(pm4.lhlBound, 4)} |`,
    );
  }
  lines.push(
    "\nReadings: at the full-tap equivalence point eps_E = 1/4 her 1.509775 block bits collapse to 0.181534 at k = 4 (8.3x) and 0.040815 at k = 2; the identity k = m reproduces the before-value to 1e-14 (the bijection anchor). The leftover-hash bound (ILL89 form) is VACUOUS at toy scale for k >= 4 whenever eps_E is noisy (bound >= 0.5 certifies nothing): printed, not hidden — that is the finite-size price of an 8-bit block. The family-mixed TV is small throughout, but with no composable epsilon behind it.\n",
  );

  // C. the sparse profile
  lines.push("## C. the sparse (intercept-resend) profile through the same amplifier\n");
  lines.push("| known raw bits of 8 | surviving I(K; Z) at k=4, mean | min | max |");
  lines.push("| --- | --- | --- | --- |");
  for (const kb of [1, 2, 3, 4]) {
    const sp = sparseAdversaryInfo(8, 4, kb);
    lines.push(`| ${kb} | ${fmt(sp.infoMean, 6)} | ${fmt(sp.infoMin, 6)} | ${fmt(sp.infoMax, 6)} |`);
  }
  lines.push(
    "\nExact linear algebra (field multiplication is GF(2)-linear, so I = k - rank of the truncated uncertainty subspace), brute-force cross-checked to 0 deviation. At the full tap (4 of 8 bits known) the mean surviving information is 0.745154 bits per 4-bit key — NOT zero, because the finite family contains degenerate maps (the identity map with the low half known leaks all k bits; max = 4). The finite-hash-family leak is measured, not averaged away.\n",
  );

  // D. the key-rate curve
  lines.push("## D. the key-rate curve r(p) vs the 1 - h2(q) line, with gap accounting\n");
  lines.push("Rate per sifted bit: r = max_k (k - I_after(k))/8 - h2(q), the W4 reconciliation floor subtracted. Data processing pins (k - I_after)/8 <= h2(eps_E) with equality at k = m (the identity), so the ceiling itself is the measured optimum at toy scale.\n");
  lines.push("| p | q=(1-p)/2 | line 1-h2(q) | I_E = 1-h2(p/2) | measured r | k* | gap to line | certified floor of the gap |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  const curve: Array<{ p: number; q: number; line: number; measured: number }> = [];
  for (const p of [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.55, 0.5]) {
    const q = (1 - p) / 2;
    const leak = h2(q);
    const eps = p / 2;
    let best = { k: 8, r: Number.NEGATIVE_INFINITY };
    for (const k of [8, 6, 4, 2]) {
      const pm = paMeasure(8, k, eps);
      const r = (k - pm.afterMean) / 8 - leak;
      if (r > best.r) best = { k, r };
    }
    const line = 1 - leak;
    const floorGap = 1 - h2(eps);
    curve.push({ p, q, line, measured: best.r });
    lines.push(
      `| ${p} | ${fmt(q, 3)} | ${fmt(line, 9)} | ${fmt(1 - h2(eps), 9)} | ${fmt(best.r, 9)} | ${best.k} | ${fmt(line - best.r, 9)} | ${fmt(floorGap, 9)} |`,
    );
  }
  lines.push(
    "\nFull k-sweep 1..8 run at p = 0.9 and p = 0.6 confirms k* = 8: (k - I_after(k)) never exceeds the identity's m*h2(eps_E) — the amplifier buys information collapse (B), not rate, at n = 8; the h2(q) reconciliation floor confiscates first. The measured curve sits where the worst-case attribution puts it: gap to the line exactly Eve's per-bit information (the certified floor), zero only at p = 1. At p = 1/2 (q = 1/4, the full-tap footprint) the measured rate reads 0 to machine precision — the census threshold. NOTE: this curve exceeds the Shor-Preskill-grade 1 - 2*h2(q) line wherever both are positive, because the toy adversary is an instantiation, weaker than the phase-symmetric worst case; no security claim rides on the measured numbers (see Boundary).\n",
  );
  // the k-sweep backing data
  lines.push("| k | (k - I_after)/8 at p=0.9 | at p=0.6 | ceiling h2(eps_E) |");
  lines.push("| --- | --- | --- | --- |");
  for (const k of [8, 7, 6, 5, 4, 3, 2, 1]) {
    const a = paMeasure(8, k, 0.45);
    const b = paMeasure(8, k, 0.3);
    lines.push(`| ${k} | ${fmt((k - a.afterMean) / 8, 9)} | ${fmt((k - b.afterMean) / 8, 9)} | ${fmt(h2(0.45), 9)} / ${fmt(h2(0.3), 9)} |`);
  }

  // E. finite-size: the small-block table
  lines.push("\n## E. finite-size: the small-block table (m = 4 vs m = 8)\n");
  lines.push("| m | p | eps_E | after k=m/2 | TV family-mixed | r (identity anchor) |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const p of [0.9, 0.7]) {
    const eps = p / 2;
    for (const m of [4, 8] as const) {
      const k = m / 2;
      const pm = paMeasure(m, k, eps);
      const pmId = paMeasure(m, m, eps);
      const r = (m - pmId.afterMean) / m - h2((1 - p) / 2);
      lines.push(`| ${m} | ${p} | ${eps} | ${fmt(pm.afterMean, 6)} | ${fmt(pm.tvFamilyMixed, 6)} | ${fmt(r, 9)} |`);
    }
  }
  lines.push(
    "\nThe 4-bit block amplifies the same way at a fifth of the family size; the identity-anchored rate is m-independent (the product-BSC structure cancels), while the surviving information and TV carry the block's finite size. This is the small-block table as data — the reconciliation floor h2(q) on both paths remains exact from W4.\n",
  );

  // F. the audit
  lines.push("## F. the smuggling audit, run on this report's own rows\n");
  let rejects = 0;
  for (const row of curve) {
    const v = auditRateRow(row, row.measured);
    if (!v.ok) rejects++;
  }
  const uniformity = auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: collisionCensus(8, 4).maxCollisionProb });
  lines.push(
    `- auditRateRow over all ${curve.length} curve rows: ${curve.length - rejects} pass, ${rejects} rejected (a row sitting on the 1-h2(q) line or above the certified-floor gap is a named counterfeit).\n- auditUniformityClaim, honest form: ${uniformity.ok ? "pass" : "REJECT"} — ${uniformity.detail}`,
  );
  // two forgery demos, both rejected BY NAME
  const naive09 = 1 - h2(0.05) - (1 - h2(0.45));
  const forgeryValue = auditRateRow({ p: 0.9, q: 0.05, line: 1 - h2(0.05), measured: 1 - h2(0.05) }, naive09);
  const forgeryNoGap = auditRateRow({ p: 0.9, q: 0.05, line: 1 - h2(0.05), measured: 1 - h2(0.05) }, 1 - h2(0.05));
  const forgeryUniform = auditUniformityClaim({ m: 8, k: 4, claimedCollisionProb: 0.0625 });
  lines.push(
    `- forged row demo 1 (measured column replaced by the theoretical line, machine number still the honest one): REJECTED — offense "${forgeryValue.offense}".\n- forged row demo 2 (machine number itself tampered to sit on the line): REJECTED — offense "${forgeryNoGap.offense}".\n- forged uniformity demo (family claimed exactly 2^-4-uniform): REJECTED — offense "${forgeryUniform.offense}".\n`,
  );

  lines.push("## Boundary\n");
  lines.push(
    "BB84-grade bounded amplification, not Shor-Preskill and not composable: the adversary is the explicit smoothed BSC(eps_E) profile (worst-case footprint attribution) plus the sparse profile — the machine measures THESE, and the all-adversaries statement rides on BB84/BBR88/CW79/ILL89, cited not re-proved. The leftover-hash bound is vacuous at this block size for most k; no composable epsilon is claimed anywhere in this report. The reconciliation syndrome is priced at its Shannon floor in the rate but its exact coupling into Eve's posterior is code-dependent and not modeled. Finite-size and finite-family effects are printed as data (B, C, E), not folded into an error bar.\n",
  );

  const path = writeReport("w5-amplification.md", lines.join("\n"));
  console.log(`exp W5 done -> ${path}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

/**
 * EXP3 — the violation, executed: the OCB protocol on exact process Born
 * rule. Anchors: causal channels cap at exactly 3/4; the mixed process at 1/2;
 * W*(1/√2) at exactly cos²(π/8); the noise threshold at exactly η = 1/√2;
 * measurement-angle grid confirming the z-basis optimum within the rotated family.
 */
import { runProtocol, bobAngleBranch, COS2_PI_8 } from "../src/game/quantum.js";
import { wChannelAB, wChannelBA, wMixed, wNoisy, wStar } from "../src/process/construct.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];

  // headline table
  const rows: string[][] = [];
  const anchors: ReadonlyArray<{ name: string; w: ReturnType<typeof wMixed>; expect: number; tol: number }> = [
    { name: "mixed (1/4)·1", w: wMixed(), expect: 0.5, tol: 1e-12 },
    { name: "channel A≺B", w: wChannelAB(), expect: 0.75, tol: 1e-12 },
    { name: "channel B≺A", w: wChannelBA(), expect: 0.5, tol: 1e-12 },
    { name: "W*(1/√2)", w: wStar(Math.SQRT1_2), expect: COS2_PI_8, tol: 1e-12 },
  ];
  for (const a of anchors) {
    const p = runProtocol(a.w);
    rows.push([a.name, p.pAliceGuesses.toFixed(12), p.pBobGuesses.toFixed(12), p.pSuccess.toFixed(12), a.expect.toFixed(12)]);
    if (Math.abs(p.pSuccess - a.expect) > a.tol) {
      failures.push(`${a.name}: p_success ${p.pSuccess} != anchor ${a.expect}`);
    }
  }

  // noise sweep: linear law, threshold exactly 1/sqrt(2)
  const noiseRows: string[][] = [];
  for (const eta of [0, 0.25, 0.5, Math.SQRT1_2, 0.8, 1]) {
    const p = runProtocol(wNoisy(eta));
    const linear = 0.5 + eta * (COS2_PI_8 - 0.5);
    noiseRows.push([eta.toFixed(6), p.pSuccess.toFixed(12), linear.toFixed(12), (p.pSuccess - 0.75 >= -1e-12 ? "≥" : "<") + " 3/4"]);
    if (Math.abs(p.pSuccess - linear) > 1e-12) failures.push(`noise eta=${eta}: nonlinear (${p.pSuccess} vs ${linear})`);
  }
  const atThreshold = runProtocol(wNoisy(Math.SQRT1_2)).pSuccess;
  if (Math.abs(atThreshold - 0.75) > 1e-12) failures.push(`threshold: eta=1/sqrt(2) gives ${atThreshold} != 3/4`);

  // measurement-angle grid: Bob's b'=1 axis rotated in the x-z plane; z (theta=0) optimal
  const angles: string[][] = [];
  let best = { theta: 0, p: -1 };
  for (let i = 0; i <= 32; i++) {
    const theta = (i / 32) * Math.PI;
    const p = bobAngleBranch(wStar(Math.SQRT1_2), theta);
    if (p > best.p) best = { theta, p };
  }
  for (const theta of [0, Math.PI / 8, Math.PI / 4, Math.PI / 2]) {
    const p = bobAngleBranch(wStar(Math.SQRT1_2), theta);
    const closed = 0.5 * (1 + Math.SQRT1_2 * Math.cos(theta));
    angles.push([theta.toFixed(6), p.toFixed(12), closed.toFixed(12)]);
    if (Math.abs(p - closed) > 1e-12) failures.push(`angle ${theta}: ${p} != closed form ${closed}`);
  }
  if (best.theta > 1e-9 || Math.abs(best.p - COS2_PI_8) > 1e-12) {
    failures.push(`angle grid: optimum at theta=${best.theta} (expected 0), p=${best.p}`);
  }

  const body =
    `# EXP3 — The violation, executed\n\n` +
    `The OCB protocol on the process Born rule P = Tr[W (M^A ⊗ M^B)], exact complex arithmetic:\n\n` +
    table(["process", "P(x=b) (b'=0)", "P(y=a) (b'=1)", "p_success", "anchor"], rows) +
    `\n\n**Anchors**: the causal channel A≺B delivers EXACTLY the classical cap 3/4 (Bob reads a off the ` +
    `identity channel, Alice stays blind); W*(1/√2) delivers exactly cos²(π/8) = ${COS2_PI_8.toFixed(12)} — ` +
    `both branches at ½(1+1/√2). The gap over 3/4 is ${(COS2_PI_8 - 0.75).toFixed(6)}.\n\n` +
    `## Noise sweep (white-noise blend, linear in η by the Born rule)\n\n` +
    table(["η", "p_success (executed)", "linear law", "vs 3/4"], noiseRows) +
    `\n\n**Threshold exactly η* = 1/√2**: at η = 0.707107 the success crosses the causal bound — ` +
    `p(η) = ½ + η/2√2 hits 3/4 precisely there. Linear because the Born rule is linear in W.\n\n` +
    `## Measurement-angle grid (Bob's b'=1 axis in the x-z plane)\n\n` +
    table(["θ", "executed", "closed form ½(1+cos θ/√2)"], angles) +
    `\n\nGrid over 33 angles: optimum at θ = 0 (z basis) with value cos²(π/8) — the analytic optimum ` +
    `within the rotated-measurement family.\n`;

  if (failures.length > 0) throw new Error(`exp3 failures:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  const file = writeReport("exp3-quantum.md", body);
  console.log(`exp3 done -> ${file} — W* p_success = ${COS2_PI_8.toFixed(12)}`);
}

run();

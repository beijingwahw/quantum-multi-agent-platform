/**
 * QuantumSched-Bench tests (GENESIS 目标 A's own requirement: every opponent
 * independently checked against brute force on small instances — 对拍).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { benchRng, makeBenchInstance, recordFamily } from '../../src/bench/generator.js';
import {
  assignmentWelfare,
  defaultSolvers,
  greedyOpponent,
  hungarianOpponent,
  makeAnnealingOpponent,
  referee,
} from '../../src/bench/opponents.js';
import { checkRun, runBenchmark } from '../../src/bench/runner.js';
import { renderJson, renderMarkdown, summarize, writeReports } from '../../src/bench/report.js';

const SMALL_SPECS = recordFamily().filter((s) => s.m === 2 && s.n === 3);

describe('generator', () => {
  it('the record family is 50 instances: small dual-track 40 + the 6×8 record track 10, public seeds', () => {
    const specs = recordFamily();
    assert.equal(specs.length, 50);
    assert.equal(specs.filter((s) => s.track === 'np-hard').length, 25);
    assert.equal(specs.filter((s) => s.track === 'linear').length, 25);
    assert.equal(specs.filter((s) => s.m === 6 && s.n === 8).length, 10);
    assert.ok(specs.every((s) => s.seed % 100 === 0));
  });

  it('deterministic: same spec twice → byte-identical problem; the golden fingerprint is frozen', () => {
    const spec = recordFamily()[0]!;
    const a = makeBenchInstance(spec);
    const b = makeBenchInstance(spec);
    assert.deepEqual(a.problem.weights, b.problem.weights);
    assert.deepEqual(
      [...a.problem.couplings.entries()].sort(),
      [...b.problem.couplings.entries()].sort(),
    );
    assert.equal(a.problem.penaltyOneHot, b.problem.penaltyOneHot);
    // golden: if the generator ever drifts, the bench's public numbers drift — refuse
    const p = a.problem;
    const fp = [
      a.id,
      String(a.nqubits),
      p.weights.map((r) => r.join(',')).join(';'),
      p.penaltyOneHot.toFixed(6),
      [...p.couplings.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([k, v]) => `${k}:${v}`)
        .join(','),
    ].join('|');
    assert.equal(
      fp,
      'np-hard-m2n3-s100|6|0.293,0.37,0.522;0.772,0.537,0.631|7.400000|4:0.35,9:0.35',
    );
  });

  it('different seeds → different instances; the rng is the platform idiom', () => {
    const a = makeBenchInstance({ track: 'linear', m: 3, n: 4, seed: 100 });
    const b = makeBenchInstance({ track: 'linear', m: 3, n: 4, seed: 200 });
    assert.notDeepEqual(a.problem.weights, b.problem.weights);
    assert.equal(benchRng(7)(), benchRng(7)());
  });
});

describe('opponents — 对拍 against the brute-force referee', () => {
  it('Hungarian is exact on the linear track (small instances)', () => {
    for (const spec of SMALL_SPECS.filter((s) => s.track === 'linear')) {
      const inst = makeBenchInstance(spec);
      const sol = hungarianOpponent.solve(inst.problem);
      const w = assignmentWelfare(inst.problem, sol.assignment);
      const opt = referee(inst.problem).welfare;
      assert.ok(Math.abs(w - opt) < 1e-9, `${inst.id}: hungarian ${w} vs brute ${opt}`);
    }
  });

  it('the one welfare accounting mirrors the referee (对拍 on the brute assignment itself)', () => {
    for (const spec of SMALL_SPECS) {
      const inst = makeBenchInstance(spec);
      const opt = referee(inst.problem);
      const w = assignmentWelfare(inst.problem, opt.assignment);
      assert.ok(
        Math.abs(w - opt.welfare) < 1e-12,
        `${inst.id}: accounting ${w} vs referee ${opt.welfare}`,
      );
    }
  });

  it('SA never loses to greedy (best-ever tracking) and hits optimum on the small family majority', () => {
    const sa = makeAnnealingOpponent(42, 4000);
    const greedy = greedyOpponent;
    let hits = 0;
    for (const spec of SMALL_SPECS) {
      const inst = makeBenchInstance(spec);
      const saW = assignmentWelfare(inst.problem, sa.solve(inst.problem).assignment);
      const gW = assignmentWelfare(inst.problem, greedy.solve(inst.problem).assignment);
      const opt = referee(inst.problem).welfare;
      assert.ok(saW >= gW - 1e-12, `${inst.id}: SA ${saW} < greedy ${gW}`);
      if (Math.abs(saW - opt) < 1e-9) hits++;
    }
    assert.ok(hits >= SMALL_SPECS.length - 2, `SA small-family hits ${hits}/${SMALL_SPECS.length}`);
  });

  it('SA is deterministic from its seed', () => {
    const spec = SMALL_SPECS[0]!;
    const inst = makeBenchInstance(spec);
    const a = makeAnnealingOpponent(7).solve(inst.problem);
    const b = makeAnnealingOpponent(7).solve(inst.problem);
    assert.deepEqual(a.assignment, b.assignment);
  });
});

describe('the runner and the anti-selection law', () => {
  it('a full small matrix: rows = instances × solvers, one per cell', () => {
    const specs = SMALL_SPECS.slice(0, 3);
    const solvers = defaultSolvers(42);
    const run = runBenchmark(specs, solvers, 42);
    assert.equal(run.rows.length, specs.length * solvers.length);
    assert.equal(run.expectedCells, specs.length * solvers.length);
    assert.deepEqual(checkRun(run), []);
  });

  it('a dropped loss is a forged report — checkRun convicts by name', () => {
    const specs = SMALL_SPECS.slice(0, 3);
    const solvers = defaultSolvers(42);
    const run = runBenchmark(specs, solvers, 42);
    const forged = { ...run, rows: run.rows.slice(0, -1) };
    const problems = checkRun(forged);
    assert.ok(problems.some((p) => p.includes('selection suspected')));
    assert.throws(() => writeReports(forged), /refusing to write an illegal run/);
  });

  it('JSON and Markdown tell the same numbers (parse-back)', () => {
    const specs = SMALL_SPECS.slice(0, 2);
    const run = runBenchmark(specs, [hungarianOpponent, greedyOpponent], 42);
    const json = JSON.parse(renderJson(run)) as typeof run;
    assert.equal(json.rows.length, run.rows.length);
    const md = renderMarkdown(run);
    for (const r of run.rows) {
      assert.ok(md.includes(r.instanceId), `md missing instance ${r.instanceId}`);
      assert.ok(md.includes(r.solver), `md missing solver ${r.solver}`);
    }
    const summary = summarize(run);
    assert.equal(summary.length, new Set(run.rows.map((x) => `${x.track}::${x.solver}`)).size);
  });
});

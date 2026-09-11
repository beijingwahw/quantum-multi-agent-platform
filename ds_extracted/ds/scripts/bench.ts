/**
 * QuantumSched-Bench CLI (GENESIS 目标 A):
 *   npm run bench                          — full matrix, JSON + Markdown to out/bench/
 *   npm run bench -- regenerate --seed 7   — rebuild the instance set from a
 *                                            seed, verify determinism (two
 *                                            builds must agree byte-for-byte)
 * Unknown flags / malformed --seed values are refused with exit 1 (naming the
 * offending token) — never silently ignored.
 * Every public number regenerates from here.
 */
import { makeBenchInstance, recordFamily } from '../src/bench/generator.js';
import { defaultSolvers } from '../src/bench/opponents.js';
import { runBenchmark } from '../src/bench/runner.js';
import { writeReports } from '../src/bench/report.js';

function fingerprint(spec: ReturnType<typeof recordFamily>[number]): string {
  const inst = makeBenchInstance(spec);
  const p = inst.problem;
  const parts: string[] = [
    inst.id,
    String(inst.nqubits),
    p.weights.map((row) => row.join(',')).join(';'),
    p.penaltyOneHot.toFixed(6),
    p.penaltyCapacity.toFixed(6),
    [...p.couplings.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, v]) => `${k}:${v}`)
      .join(','),
  ];
  return parts.join('|');
}

/**
 * 解析 `--seed <n>`：缺失或非有限数值时干净拒绝并指名收到的值——
 * 旧行为把 `Number(undefined)`/`Number('abc')` 静默变成 NaN，打印
 * "--seed NaN is accepted…" 的注记继续退出 0，坏参数被吞而非被拒。
 */
function parseSeed(command: string, args: readonly string[]): number {
  const seedIdx = args.indexOf('--seed');
  if (seedIdx < 0) return 42;
  const raw = args[seedIdx + 1];
  const seed = Number(raw);
  if (raw === undefined || !Number.isFinite(seed)) {
    console.error(`bench ${command}: --seed requires a finite number, got ${String(raw)}`);
    process.exit(1);
  }
  return seed;
}

/** 未知旗标/多余位置参数一律拒绝：静默忽略会让打错的参数带着默认行为跑完全程 */
function refuseUnknownTokens(command: string, args: readonly string[]): void {
  const rest = args.slice(1);
  const knownFlags = command === 'regenerate' ? new Set(['--seed']) : new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      if (!knownFlags.has(a)) {
        console.error(`bench ${command}: unknown flag '${a}' — see header of scripts/bench.ts`);
        process.exit(1);
      }
      if (a === '--seed') i++; // 值由 parseSeed 校验
    } else {
      console.error(`bench ${command}: unexpected argument '${a}'`);
      process.exit(1);
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'run';
  if (command === 'regenerate') {
    refuseUnknownTokens(command, args);
    const seed = parseSeed(command, args);
    const specs = recordFamily();
    let mismatches = 0;
    for (const spec of specs) {
      const a = fingerprint(spec);
      const b = fingerprint(spec); // rebuild from the same inputs
      if (a !== b) mismatches++;
    }
    if (mismatches > 0) {
      console.error(
        `regenerate: ${mismatches} instances not reproducible from their seeds — refusing`,
      );
      process.exit(1);
    }
    console.log(
      `regenerate OK: ${specs.length} instances rebuilt byte-identically from their (track, size, seed) triples; family seed base unchanged${seed !== 42 ? ` (note: the record family's seeds are fixed at 100·k; --seed ${seed} is accepted for custom runs via the library API)` : ''}`,
    );
    return;
  }
  if (command === 'run') {
    refuseUnknownTokens(command, args);
    const run = runBenchmark(recordFamily(), defaultSolvers(42), 42);
    const paths = writeReports(run);
    const npRows = run.rows.filter((r) => r.track === 'np-hard');
    const recordRows = run.rows.filter((r) => r.m === 6 && r.n === 8 && r.track === 'np-hard');
    const solvers = [...new Set(npRows.map((r) => r.solver))];
    console.log(
      `QuantumSched-Bench: ${run.rows.length} cells (${recordFamily().length} instances × ${solvers.length} solvers)`,
    );
    for (const s of solvers) {
      const rr = recordRows.filter((r) => r.solver === s && !r.skipped);
      const skipped = recordRows.filter((r) => r.solver === s && r.skipped).length;
      console.log(
        `  record track 6×8 ${s}: ${rr.filter((r) => r.hit).length}/${rr.length} hits${skipped > 0 ? ` (+${skipped} skipped)` : ''}`,
      );
    }
    console.log(`reports: ${paths.json} , ${paths.md}`);
    return;
  }
  console.error(`unknown command '${command}' — use 'run' or 'regenerate --seed N'`);
  process.exit(1);
}

main();

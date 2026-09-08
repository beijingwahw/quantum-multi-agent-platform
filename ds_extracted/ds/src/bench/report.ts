/**
 * QuantumSched-Bench — the report layer: machine-readable JSON + a Markdown
 * table set, and the integrity law that refuses a forged report. Every
 * number printed in the Markdown is read back from the JSON rows — two
 * formats, one truth.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BenchReportError } from '../utils/errors.js';
import { checkRun, type BenchRun, type BenchRow } from './runner.js';

export function renderJson(run: BenchRun): string {
  return JSON.stringify(run, null, 2);
}

/** Per-(track, solver) hit counts and mean gaps — the summary the record cites. */
export interface SummaryCell {
  readonly track: string;
  readonly solver: string;
  readonly kind: string;
  readonly cells: number;
  readonly hits: number;
  readonly meanGap: number;
}

export function summarize(run: BenchRun): SummaryCell[] {
  const map = new Map<string, BenchRow[]>();
  for (const r of run.rows) {
    const key = `${r.track}::${r.solver}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  const out: SummaryCell[] = [];
  for (const [key, list] of map) {
    const played = list.filter((r) => !r.skipped);
    const gaps = played.map((r) => (Number.isNaN(r.gap) ? 0 : r.gap));
    out.push({
      track: key.split('::')[0]!,
      solver: key.split('::')[1]!,
      kind: list[0]!.kind,
      cells: played.length,
      hits: played.filter((r) => r.hit).length,
      meanGap: gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : Number.NaN,
    });
  }
  out.sort((a, b) =>
    a.track === b.track ? a.solver.localeCompare(b.solver) : a.track.localeCompare(b.track),
  );
  return out;
}

export function renderMarkdown(run: BenchRun): string {
  const problems = checkRun(run);
  if (problems.length > 0) {
    throw new BenchReportError(`refusing to render an illegal run:\n${problems.join('\n')}`);
  }
  const lines: string[] = [];
  lines.push('# QuantumSched-Bench — the reproducible battle record');
  lines.push('');
  lines.push(
    `> Generated ${run.generatedAt}, seed ${run.seed}. Referee: brute-force enumeration, always. Welfare recomputed by the single accounting function — no solver self-report. Losses ship as losses (the anti-selection law).`,
  );
  lines.push('');
  for (const track of ['linear', 'np-hard']) {
    const rows = run.rows.filter((r) => r.track === track);
    if (rows.length === 0) continue;
    lines.push(`## Track: ${track}`);
    lines.push('');
    lines.push('| solver | hits/cells | mean gap | worst gap |');
    lines.push('| --- | --- | --- | --- |');
    const solvers = [...new Set(rows.map((r) => r.solver))];
    for (const s of solvers) {
      const srows = rows.filter((r) => r.solver === s);
      const played = srows.filter((r) => !r.skipped);
      const skipped = srows.length - played.length;
      const gaps = played.map((r) => (Number.isNaN(r.gap) ? 0 : r.gap));
      const meanGap = gaps.length > 0 ? gaps.reduce((x, g) => x + g, 0) / gaps.length : Number.NaN;
      const worstGap = gaps.length > 0 ? Math.max(...gaps) : Number.NaN;
      lines.push(
        `| ${s} | ${played.filter((r) => r.hit).length}/${played.length}${
          skipped > 0 ? ` (+${skipped} skipped)` : ''
        } | ${Number.isNaN(meanGap) ? '—' : meanGap.toFixed(4)} | ${
          Number.isNaN(worstGap) ? '—' : worstGap.toFixed(4)
        } |`,
      );
    }
    lines.push('');
  }
  lines.push('## Per-instance rows');
  lines.push('');
  lines.push('| instance | solver | welfare | optimal | gap | hit |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of run.rows) {
    if (r.skipped) {
      lines.push(
        `| ${r.instanceId} | ${r.solver} | skipped (over the solver's qubit cap) | ${r.optimal.toFixed(4)} | — | — |`,
      );
      continue;
    }
    lines.push(
      `| ${r.instanceId} | ${r.solver} | ${r.welfare.toFixed(4)} | ${r.optimal.toFixed(4)} | ${(Number.isNaN(
        r.gap,
      )
        ? 0
        : r.gap
      ).toFixed(4)} | ${r.hit ? 'YES' : 'no'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/** Write both formats; returns their paths. */
export function writeReports(
  run: BenchRun,
  dir = resolve(process.cwd(), 'out', 'bench'),
): { json: string; md: string } {
  const problems = checkRun(run);
  if (problems.length > 0) {
    throw new BenchReportError(`refusing to write an illegal run:\n${problems.join('\n')}`);
  }
  mkdirSync(dir, { recursive: true });
  const json = resolve(dir, 'bench-report.json');
  const md = resolve(dir, 'bench-report.md');
  writeFileSync(json, renderJson(run), 'utf8');
  writeFileSync(md, renderMarkdown(run), 'utf8');
  return { json, md };
}

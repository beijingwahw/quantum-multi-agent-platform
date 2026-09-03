/**
 * LLM 学习曲线实验 · Runner
 *
 * 假设：上下文资本 ≈ few-shot 案例积累，Agent 有效质量随资本沿
 *       qEff(k) = base + α(1−base)(1−e^(−βk)) 饱和上升。
 *
 * 实验设计（真实模型 glm-4-flash，非模拟）：
 * - treatment：Agent 处理任务序列，每处理完一个任务就把【标准答案】存入案例库
 *   （反馈修正型资本，对应调度器 completeTask 里 capital=尝试次数的语义），
 *   后续任务以"system 规则 + 全部历史案例"为上下文求解。k = 求解时库容量。
 * - control：案例内容相同但标签被确定性破坏（aspect/sentiment 轮转、urgent 取反），
 *   保持提示词形状与长度一致。若提升仅来自"格式锚定"，control 也会上升。
 * - 每个 condition 跑 R 个独立"生命周期"（任务顺序独立洗牌），池化估计 q(k)。
 *
 * 用法：
 *   ZHIPU_API_KEY=... node --import tsx experiments/llm-learning-curve/run.ts --pilot
 *   ZHIPU_API_KEY=... node --import tsx experiments/llm-learning-curve/run.ts
 *   node --import tsx experiments/llm-learning-curve/run.ts --analyze
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, shuffled } from '../../src/utils/rng.js';
import {
  SYSTEM_PROMPT,
  IMPLICIT_PROMPT,
  TICKETS,
  ASPECTS,
  SENTIMENTS,
  type Ticket,
} from './dataset.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** --implicit：口径不告知，案例是唯一知识来源（隐性技能 regime） */
const IMPLICIT = process.argv.includes('--implicit');
const PROMPT = IMPLICIT ? IMPLICIT_PROMPT : SYSTEM_PROMPT;
const SUFFIX = IMPLICIT ? '-implicit' : '';
const JSONL = path.join(HERE, `results${SUFFIX}.jsonl`);
const OUT = path.join(HERE, `results${SUFFIX}.json`);

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = process.env.GLM_MODEL ?? 'glm-4-flash';
const RUNS = Number(process.env.RUNS ?? 12);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);
const MAX_LIBRARY = 40;

type Condition = 'treatment' | 'control';

interface EvalRecord {
  condition: Condition;
  run: number;
  taskId: number;
  k: number;
  ok: boolean;
  pred: string;
}

// ---------- 工具 ----------

/** 确定性破坏标签：保证错误但 schema 合法（control 专用） */
function corrupt(t: Ticket): string {
  const aspect = ASPECTS[(ASPECTS.indexOf(t.aspect as any) + 1) % ASPECTS.length];
  const sentiment = SENTIMENTS[(SENTIMENTS.indexOf(t.sentiment as any) + 1) % SENTIMENTS.length];
  return JSON.stringify({ aspect, sentiment, urgent: !t.urgent });
}

const answerOf = (t: Ticket) =>
  JSON.stringify({ aspect: t.aspect, sentiment: t.sentiment, urgent: t.urgent });

// ---------- API 客户端 ----------

class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly limit: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }
  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const sem = new Semaphore(CONCURRENCY);

async function chat(messages: Array<{ role: string; content: string }>): Promise<string> {
  const key = process.env.ZHIPU_API_KEY;
  if (!key) throw new Error('缺少 ZHIPU_API_KEY 环境变量');
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    await sem.acquire();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, 60_000);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`), {
          fatal: true,
        });
      }
      const data: any = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err: any) {
      lastErr = err;
      if (err.fatal) throw err;
    } finally {
      sem.release();
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 500));
  }
  throw lastErr;
}

function parseAnswer(raw: string): { aspect: string; sentiment: string; urgent: boolean } | null {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    if (
      typeof obj.aspect === 'string' &&
      typeof obj.sentiment === 'string' &&
      typeof obj.urgent === 'boolean'
    ) {
      return obj;
    }
    return null;
  } catch {
    return null;
  }
}

function grade(pred: ReturnType<typeof parseAnswer>, truth: Ticket): boolean {
  return (
    !!pred &&
    pred.aspect === truth.aspect &&
    pred.sentiment === truth.sentiment &&
    pred.urgent === truth.urgent
  );
}

// ---------- 一次生命周期 ----------

async function runLifetime(
  condition: Condition,
  run: number,
  tasks: Ticket[],
  log: (r: EvalRecord) => void,
) {
  const rng = mulberry32(condition === 'treatment' ? 1000 + run : 9000 + run);
  const order = shuffled(tasks, rng);
  const library: Array<{ user: string; assistant: string }> = [];

  for (const task of order) {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: PROMPT },
    ];
    for (const ex of library.slice(-MAX_LIBRARY)) {
      messages.push({ role: 'user', content: ex.user });
      messages.push({ role: 'assistant', content: ex.assistant });
    }
    messages.push({ role: 'user', content: task.text });

    let ok = false;
    let predStr = '';
    try {
      const raw = await chat(messages);
      const pred = parseAnswer(raw);
      ok = grade(pred, task);
      predStr = pred ? JSON.stringify(pred) : raw.slice(0, 60);
    } catch (err: any) {
      predStr = `API_ERROR: ${String(err.message).slice(0, 60)}`;
    }

    log({
      condition,
      run,
      taskId: task.id,
      k: Math.min(library.length, MAX_LIBRARY),
      ok,
      pred: predStr,
    });

    // 反馈修正型资本：无论自身成败，标准答案入库（control 存破坏后的标签）
    library.push({
      user: task.text,
      assistant: condition === 'treatment' ? answerOf(task) : corrupt(task),
    });
  }
}

// ---------- 分析与拟合 ----------

const BUCKETS: Array<[string, number, number]> = [
  ['0', 0, 1],
  ['1-3', 1, 4],
  ['4-7', 4, 8],
  ['8-12', 8, 13],
  ['13-19', 13, 20],
  ['20+', 20, Infinity],
];

interface FitResult {
  base: number;
  alpha: number;
  beta: number;
  r2: number;
  linearR2: number;
}

/** 拟合 q(k) = base + C(1−e^(−βk))，β 网格搜索 + OLS 闭式解，R² 对比线性基线 */
function fitCurve(points: Array<{ k: number; ok: boolean }>): FitResult {
  const n = points.length;
  const y: number[] = points.map((p) => (p.ok ? 1 : 0));
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((a, b) => a + (b - yMean) ** 2, 0);

  const ols = (x: number[]): { a: number; b: number; sse: number } => {
    const xm = x.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i]! - xm) * (y[i]! - yMean);
      sxx += (x[i]! - xm) ** 2;
    }
    const b = sxx === 0 ? 0 : sxy / sxx;
    const a = yMean - b * xm;
    let sse = 0;
    for (let i = 0; i < n; i++) sse += (y[i]! - (a + b * x[i]!)) ** 2;
    return { a, b, sse };
  };

  const linear = ols(points.map((p) => Math.min(p.k, MAX_LIBRARY)));

  let best: FitResult | null = null;
  for (let i = 0; i <= 300; i++) {
    const beta = 0.01 * Math.pow(1.02, i); // 0.01 ~ ~2.3
    const x = points.map((p) => 1 - Math.exp(-beta * p.k));
    const { a, b, sse } = ols(x);
    // OLS 系数即 q = base + C·(1−e^(−βk))，其中 base=a、C=b
    const base = Math.max(0, Math.min(1, a));
    const C = Math.max(0, b);
    const alpha = base < 1 ? Math.min(1, C / (1 - base)) : 0;
    const r2 = sst === 0 ? 0 : 1 - sse / sst;
    if (!best || r2 > best.r2) {
      best = { base, alpha, beta, r2, linearR2: sst === 0 ? 0 : 1 - linear.sse / sst };
    }
  }
  return best!;
}

function analyze() {
  if (!fs.existsSync(JSONL)) {
    console.error('没有 results.jsonl，请先运行实验');
    process.exit(1);
  }
  const records: EvalRecord[] = fs
    .readFileSync(JSONL, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));

  const report: any = {
    model: MODEL,
    mode: IMPLICIT ? 'implicit（口径仅存于案例）' : 'explicit（规则已完整告知）',
    totalEvals: records.length,
    runsPerCondition: {},
    conditions: {},
    fittedAt: new Date().toISOString(),
  };

  for (const cond of ['treatment', 'control'] as Condition[]) {
    const pts = records.filter((r) => r.condition === cond);
    report.runsPerCondition[cond] = new Set(pts.map((r) => r.run)).size;

    const buckets = BUCKETS.map(([label, lo, hi]) => {
      const inBucket = pts.filter((r) => r.k >= lo && r.k < hi);
      const q = inBucket.length ? inBucket.filter((r) => r.ok).length / inBucket.length : null;
      return {
        label,
        kMid: lo,
        n: inBucket.length,
        q: q === null ? null : Math.round(q * 1000) / 1000,
      };
    });

    const fit = fitCurve(pts.map((r) => ({ k: r.k, ok: r.ok })));
    const low = pts.filter((r) => r.k <= 1);
    const high = pts.filter((r) => r.k >= 13);
    const qLow = low.filter((r) => r.ok).length / Math.max(1, low.length);
    const qHigh = high.filter((r) => r.ok).length / Math.max(1, high.length);
    // 正态近似 95% CI
    const ci = (p: number, n: number) =>
      n === 0
        ? [0, 0]
        : [p - 1.96 * Math.sqrt((p * (1 - p)) / n), p + 1.96 * Math.sqrt((p * (1 - p)) / n)];

    report.conditions[cond] = {
      buckets,
      fit: {
        base: Math.round(fit.base * 1000) / 1000,
        alpha: Math.round(fit.alpha * 1000) / 1000,
        beta: Math.round(fit.beta * 1000) / 1000,
        r2: Math.round(fit.r2 * 1000) / 1000,
        linearR2: Math.round(fit.linearR2 * 1000) / 1000,
      },
      qLow: {
        v: Math.round(qLow * 1000) / 1000,
        n: low.length,
        ci95: ci(qLow, low.length).map((x) => Math.round(x * 1000) / 1000),
      },
      qHigh: {
        v: Math.round(qHigh * 1000) / 1000,
        n: high.length,
        ci95: ci(qHigh, high.length).map((x) => Math.round(x * 1000) / 1000),
      },
      gain: Math.round((qHigh - qLow) * 1000) / 1000,
    };
  }

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  // 控制台摘要
  console.log(`\n模型: ${MODEL}  总评测算例: ${records.length}`);
  for (const cond of ['treatment', 'control'] as Condition[]) {
    const c = report.conditions[cond];
    console.log(
      `\n[${cond}] 拟合: base=${c.fit.base} α=${c.fit.alpha} β=${c.fit.beta} R²=${c.fit.r2} (线性R²=${c.fit.linearR2})`,
    );
    console.log(`  q(k≤1)=${c.qLow.v} → q(k≥13)=${c.qHigh.v}  提升=${c.gain}`);
    console.log(
      '  k 桶:',
      c.buckets.map((b: any) => `${b.label}:${b.q ?? '-'}(n=${b.n})`).join('  '),
    );
  }
  console.log(`\n结果已写入 ${OUT}`);
}

// ---------- 主流程 ----------

async function main() {
  const pilot = process.argv.includes('--pilot');
  if (process.argv.includes('--analyze')) {
    analyze();
    return;
  }

  const tasks = pilot ? TICKETS.slice(0, 12) : TICKETS;
  const runs = pilot ? 2 : RUNS;
  const conditions: Condition[] = ['treatment', 'control'];

  console.log(
    `实验: ${MODEL} | 任务数=${tasks.length} | 生命周期 runs=${runs}×2 conditions | 并发=${CONCURRENCY}`,
  );
  const started = Date.now();
  let done = 0;
  const total = tasks.length * runs * conditions.length;

  const log = (r: EvalRecord) => {
    fs.appendFileSync(JSONL, JSON.stringify(r) + '\n');
    done++;
    if (done % 50 === 0 || done === total) {
      console.log(`进度 ${done}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
  };

  if (pilot) fs.writeFileSync(JSONL, ''); // pilot 覆盖旧数据

  const jobs: Array<Promise<void>> = [];
  for (const cond of conditions) {
    for (let run = 0; run < runs; run++) {
      jobs.push(runLifetime(cond, run, tasks, log));
    }
  }
  await Promise.all(jobs);
  console.log(`实验完成，用时 ${((Date.now() - started) / 1000).toFixed(0)}s`);
  analyze();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

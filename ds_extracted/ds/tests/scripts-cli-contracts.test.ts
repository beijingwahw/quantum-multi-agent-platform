/**
 * scripts/ CLI 边界契约（R8-C 生命周期镜头）：
 * 可执行脚本的参数解析边缘——未知旗标、缺值、非数值——必须干净拒绝
 * （非零退出 + 指名违规 token），而不是带着默认行为静默跑完。
 *
 * 定罪的旧行为：
 * - scripts/bench.ts：`regenerate --seed`（缺值）/`--seed abc` 被
 *   Number() 静默转成 NaN，打印 "--seed NaN is accepted…" 注记后退出 0；
 *   未知旗标（含 `run --seed 7`）被完全忽略——run 会带着默认种子 42
 *   重写冻结工件，用户以为跑的是 7。
 * - scripts/dsh-proactive-install-to-dsh.mjs：未知参数被静默忽略
 *   （打错 `--dry-runn` 会执行真实安装）；且独立 CLI 直跑被
 *   `npm_lifecycle_event !== undefined` 门槛整体判死——文档化的
 *   "node scripts/install-to-dsh.mjs" 触发方式静默空转退出 0。
 *
 * 隔离纪律：install 脚本的全部子进程都显式 --dsh-home 到临时目录并
 * 清除 npm_lifecycle_event——即使在拒绝面回归的机器上也不会触碰真实
 * DSH 安装；bench 只测 regenerate/拒绝路径，永不触发会重写 out/bench
 * 冻结工件的 run 主路径。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const PLATFORM_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BENCH_SCRIPT = join(PLATFORM_ROOT, 'scripts', 'bench.ts');
const INSTALL_SCRIPT = join(PLATFORM_ROOT, 'scripts', 'dsh-proactive-install-to-dsh.mjs');

function runNode(
  args: string[],
  envOverrides: Record<string, string | undefined>,
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  // 值为 undefined 的覆盖键 = 从子进程环境中移除（如 npm_lifecycle_event）
  const removed = new Set(
    Object.entries(envOverrides)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k),
  );
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !removed.has(k)) env[k] = v;
  }
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v !== undefined) env[k] = v;
  }
  const res = spawnSync(process.execPath, args, {
    cwd: PLATFORM_ROOT,
    env,
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function runBench(args: string[]): ReturnType<typeof runNode> {
  return runNode(['--import', 'tsx', BENCH_SCRIPT, ...args], {});
}

describe('scripts/bench.ts CLI 边界', () => {
  it('合法邻位：regenerate 无旗标 → 退出 0，实例族从公开种子逐字节重建', () => {
    const res = runBench(['regenerate']);
    assert.equal(res.status, 0, `stdout=${res.stdout} stderr=${res.stderr}`);
    assert.match(res.stdout, /regenerate OK: 50 instances rebuilt byte-identically/);
  });

  it('合法邻位：regenerate --seed 7 → 退出 0，注记如实说明家族种子固定', () => {
    const res = runBench(['regenerate', '--seed', '7']);
    assert.equal(res.status, 0, `stdout=${res.stdout} stderr=${res.stderr}`);
    assert.match(res.stdout, /regenerate OK/);
    assert.match(res.stdout, /--seed 7 is accepted/);
  });

  it('缺值拒绝：`--seed`（无值）不再静默变 NaN，退出 1 且指名 undefined', () => {
    const res = runBench(['regenerate', '--seed']);
    assert.equal(res.status, 1, `旧行为吞掉坏参数退出 0：stdout=${res.stdout}`);
    assert.match(res.stderr, /--seed requires a finite number/);
    assert.match(res.stderr, /got undefined/);
  });

  it('非数值拒绝：--seed abc 退出 1 且指名收到的值', () => {
    const res = runBench(['regenerate', '--seed', 'abc']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /--seed requires a finite number/);
    assert.match(res.stderr, /got abc/);
  });

  it('未知旗标拒绝：--bogus 退出 1 且指名（不再静默忽略后照常工作）', () => {
    const res = runBench(['regenerate', '--bogus']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /unknown flag '--bogus'/);
  });

  it('run 不接受任何旗标：`run --seed 7` 在写盘前拒绝（旧行为带着默认种子 42 重写冻结工件）', () => {
    const res = runBench(['run', '--seed', '7']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /unknown flag '--seed'/);
    // 拒绝必须先于任何求解/写盘：不接受只有错误没有快速退出的形态
    assert.equal(res.stdout, '');
  });

  it('未知子命令拒绝：frobnicate → 退出 1 指名', () => {
    const res = runBench(['frobnicate']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /unknown command 'frobnicate'/);
  });
});

describe('scripts/dsh-proactive-install-to-dsh.mjs CLI 边界', () => {
  // 隔离的假 DSH 安装：一个 profile（web），任何真实写入都不可能落在这里之外
  const fakeHome = join(tmpdir(), `ds-install-cli-contract-${process.pid}`);
  mkdirSync(join(fakeHome, 'profiles', 'web'), { recursive: true });
  writeFileSync(
    join(fakeHome, 'profiles', 'web', 'package.json'),
    JSON.stringify({ name: 'web', version: '0.0.0' }),
    'utf8',
  );
  const NO_NPM_ENV = { npm_lifecycle_event: undefined, DSH_HOME: fakeHome };

  it('独立 CLI 直跑可用：无 npm 生命周期环境的 list 打印状态（旧门槛使其静默空转）', () => {
    const res = runNode([INSTALL_SCRIPT, 'list', '--dsh-home', fakeHome], NO_NPM_ENV);
    assert.equal(res.status, 0, `stdout=${res.stdout} stderr=${res.stderr}`);
    assert.match(res.stdout, /DSH_HOME/);
    assert.match(res.stdout, /web/);
    assert.match(res.stdout, /not installed/);
  });

  it('未知参数拒绝：--bogus-flag 退出 1 且指名（旧解析器静默忽略并继续默认 install）', () => {
    const res = runNode(
      [INSTALL_SCRIPT, '--bogus-flag', 'list', '--dsh-home', fakeHome],
      NO_NPM_ENV,
    );
    assert.equal(res.status, 1);
    assert.match(res.stderr, /unknown argument '--bogus-flag'/);
  });

  it('合法邻位：--help 退出 0 并打印用法', () => {
    const res = runNode([INSTALL_SCRIPT, '--help'], NO_NPM_ENV);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage: dsh-proactive-install/);
  });

  after(() => {
    rmSync(fakeHome, { recursive: true, force: true });
  });
});

/**
 * 安全加固与量子引擎关键修复的回归测试
 *
 * 覆盖三组曾真实存在的缺陷：
 * 1. 工具面安全：execute_command 命令注入、fs-tools 路径穿越（修复前均无阻拦）；
 * 2. 全空间引擎罚项计数器长度互换（perTask/perAgent）：非方阵问题
 *    （任务数≠agent数）的容量罚项曾整体静默丢失；
 * 3. 退火末态能量期望被能量归一化尺度（2·nqubits）放大、
 *    toIsing 忽略资格掩码、nqubits>30 防护。
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { read_file, write_file, setFsSandboxRoot } from '../src/tools/fs-tools.js';
import {
  execute_command,
  execute_command_argv,
  configureCommandPolicy,
  resetCommandPolicy,
} from '../src/tools/system-tools.js';
import QuantumMultiAgentPlatform from '../src/index.js';
import {
  computeEnergies,
  annealSolve,
  toIsing,
  defaultPenalties,
} from '../src/core/quantum-optimizer.js';
import type { AssignmentProblem } from '../src/core/quantum-optimizer.js';

// ----------------------------------------------------------------------------
// 工具面安全
// ----------------------------------------------------------------------------

describe('工具面安全加固', () => {
  afterEach(async () => {
    await setFsSandboxRoot(process.cwd());
    resetCommandPolicy();
  });

  it('read_file 允许沙箱内的相对路径', async () => {
    const content = await read_file('package.json');
    assert.ok(content.includes('quantum-multi-agent-platform'));
  });

  it('read_file 拒绝 ../ 路径穿越', async () => {
    await assert.rejects(
      () => read_file('../escape-attempt.txt'),
      /escapes the filesystem sandbox/,
    );
  });

  it('read_file 拒绝沙箱外的绝对路径', async () => {
    const outside = process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd';
    await assert.rejects(() => read_file(outside), /escapes the filesystem sandbox/);
  });

  it('write_file 同样受沙箱约束', async () => {
    await assert.rejects(() => write_file('../evil.txt', 'data'), /escapes the filesystem sandbox/);
  });

  it('setFsSandboxRoot 拒绝不存在的目录', async () => {
    await assert.rejects(
      () => setFsSandboxRoot('./definitely-not-a-real-dir-xyz'),
      /existing directory/,
    );
  });

  it('read_file 拒绝指向沙箱外的符号链接', async () => {
    const { symlink, unlink } = await import('node:fs/promises');
    const os = await import('node:os');
    const { join } = await import('node:path');
    const outside = join(os.tmpdir(), 'sandbox-escape-target.txt');
    // 无开发者模式的 Windows 无法创建符号链接；创建失败则本用例自动跳过
    const created = await symlink(outside, 'escape-link.txt', 'file')
      .then(() => true)
      .catch(() => false);
    if (!created) return;
    try {
      await assert.rejects(() => read_file('escape-link.txt'), /escapes the filesystem sandbox/);
    } finally {
      await unlink('escape-link.txt').catch(() => {});
    }
  });

  it('execute_command 拒绝 shell 元字符（命令注入）', async () => {
    await assert.rejects(() => execute_command('echo hello; del /q *'), /metacharacter/i);
    await assert.rejects(
      () => execute_command('npm test && curl http://evil.example'),
      /metacharacter/i,
    );
    await assert.rejects(() => execute_command('echo $(whoami)'), /metacharacter/i);
  });

  it('execute_command 拒绝 token 内的引号与 %（跨平台引号语义错配）', async () => {
    // % 在 cmd 双引号内仍会展开变量
    await assert.rejects(() => execute_command('echo "%PATH%"'), /forbidden character/i);
    // token 值含引号会破坏受控重建的命令行
    await assert.rejects(() => execute_command('echo "say \\"hi\\""'), /forbidden character/i);
  });

  it('execute_command 中单引号内的 cmd 元字符不被解释执行', async () => {
    // cmd.exe 不认单引号：旧实现把原文交回 cmd，'x & calc' 中的 & 会逃逸。
    // 新执行路径把 token 作为整体参数传递，& 只会被 echo 打印出来。
    const out = await execute_command("echo 'x & whoami'");
    assert.ok(out.includes('x & whoami'), `应原样打印 'x & whoami'，实际输出: ${out}`);
  });

  it('execute_command 超时被强制终止', async () => {
    // 解释器须显式 opted-in；载荷走脚本文件（-e 内联旗标被无条件拒绝）。
    // 脚本用 cwd 相对名，避免临时目录含空格被 shell 分词拆分。
    const { writeFile, unlink } = await import('node:fs/promises');
    const script = 'qmap-spin-forever.test.tmp.js';
    await writeFile(script, 'for(;;){}\n');
    // 05#15：超时降至 250ms 量级（原 1.5s 真实等待拖慢 CI；进程终止由
    // system-tools 的 taskkill /T /F 树杀路径负责，超时缩短不影响覆盖）
    configureCommandPolicy({ timeoutMs: 250, allowedPrograms: ['node'] });
    try {
      await assert.rejects(() => execute_command(`node ${script}`), /timed out/i);
    } finally {
      await unlink(script).catch(() => {});
    }
  });

  it('默认白名单不含解释器/包管理器（node -e 载荷无需元字符即可 RCE）', async () => {
    await assert.rejects(() => execute_command('node -v'), /not in the allowed list/);
    await assert.rejects(() => execute_command('npx some-package'), /not in the allowed list/);
    await assert.rejects(() => execute_command('npm install evil-pkg'), /not in the allowed list/);
  });

  it('解释器内联代码旗标被无条件拒绝（即便宿主显式开启解释器）', async () => {
    configureCommandPolicy({ allowedPrograms: ['node', 'ls', 'echo'] });
    await assert.rejects(() => execute_command('node -e console.log(42)'), /Inline-code flag '-e'/);
  });

  it('execute_command_argv 保留参数边界（含空白与 cmd 元字符的参数不被拆分）', async () => {
    const { writeFile, unlink } = await import('node:fs/promises');
    const script = 'qmap-echo-argv.test.tmp.js';
    await writeFile(script, 'console.log(JSON.stringify(process.argv.slice(2)))\n');
    configureCommandPolicy({ allowedPrograms: ['node'] });
    try {
      const out = await execute_command_argv('node', [script, 'fix: handle X', 'plain']);
      const argv = JSON.parse(out.trim().split('\n').pop()!) as string[];
      assert.deepEqual(argv, ['fix: handle X', 'plain']);
    } finally {
      await unlink(script).catch(() => {});
    }
  });

  it('execute_command 拒绝白名单外程序', async () => {
    await assert.rejects(
      () => execute_command('curl http://evil.example'),
      /not in the allowed list/,
    );
    await assert.rejects(
      () => execute_command('C:/Windows/System32/cmd.exe'),
      /bare name, not a path/,
    );
  });

  it('execute_command 拒绝不平衡引号与空命令', async () => {
    await assert.rejects(() => execute_command('echo "unclosed'), /quote/i);
    await assert.rejects(() => execute_command('   '), /non-empty/);
  });

  it('execute_command 放行白名单程序（引号内容作为参数透传）', async () => {
    const out = await execute_command("echo 'x & whoami'");
    assert.ok(out.includes('x & whoami'));
  });

  it('configureCommandPolicy 可扩展程序白名单', async () => {
    configureCommandPolicy({ allowedPrograms: ['git', 'echo'] });
    await assert.rejects(() => execute_command('node -v'), /not in the allowed list/);
  });
});

describe('平台配置安全', () => {
  it('deepMerge 拒绝 __proto__/constructor/prototype 键（原型污染）', () => {
    const poisoned = JSON.parse('{"__proto__": {"polluted": true}, "logLevel": "debug"}');
    assert.throws(() => new QuantumMultiAgentPlatform(poisoned as never), /not allowed/);
    // 全局原型未被污染
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
  });
});

// ----------------------------------------------------------------------------
// 全空间引擎：罚项计数器长度互换（回归：非方阵问题容量罚项丢失）
// ----------------------------------------------------------------------------

function buildNonSquareProblem(): AssignmentProblem {
  // 2 任务 × 3 agent（m≠n，互换 bug 的触发条件）
  const problem: AssignmentProblem = {
    taskIds: ['t0', 't1'],
    agentIds: ['a0', 'a1', 'a2'],
    weights: [
      [1, 1, 1],
      [1, 1, 1],
    ],
    ineligible: [
      [false, false, false],
      [false, false, false],
    ],
    couplings: new Map(),
    penaltyOneHot: 10,
    penaltyCapacity: 10,
  };
  return problem;
}

describe('computeEnergies 罚项（长度互换回归）', () => {
  it('容量违约在最高索引 agent 上同样被惩罚（修复前索引≥m 的计数静默丢失）', () => {
    const problem = buildNonSquareProblem();
    const { energies } = computeEnergies(problem);

    // 两任务都给 agent2（索引2 ≥ m=2，修复前 perAgent[2] 越界、罚项为0）
    const state = (1 << (0 * 3 + 2)) | (1 << (1 * 3 + 2));
    // E = -(w02 + w12) + penaltyCapacity · C(2,2) = -2 + 10·1
    assert.equal(energies[state], 8);
  });

  it('one-hot 违约在任务数 > agent 数的问题上同样生效', () => {
    // 3 任务 × 2 agent（m>n）：perTask 修复前长度为 n=2，任务2越界
    const problem: AssignmentProblem = {
      taskIds: ['t0', 't1', 't2'],
      agentIds: ['a0', 'a1'],
      weights: [
        [1, 1],
        [1, 1],
        [1, 1],
      ],
      ineligible: [
        [false, false],
        [false, false],
        [false, false],
      ],
      couplings: new Map(),
      penaltyOneHot: 10,
      penaltyCapacity: 10,
    };
    const { energies } = computeEnergies(problem);
    // 任务2 选了两个 agent（one-hot 违约，位 2*2+0=4 与 2*2+1=5）；
    // 任务0/1 未选（count=0 同样按 (0−1)² 计罚）
    const state = (1 << 4) | (1 << 5);
    // E = -(w20+w21) + λ·[(0−1)² + (0−1)² + (2−1)²] = -2 + 30
    assert.equal(energies[state], 28);
  });

  it('nqubits > 30 时显式报错而不是静默算错', () => {
    const problem: AssignmentProblem = {
      taskIds: Array.from({ length: 6 }, (_, i) => `t${i}`),
      agentIds: Array.from({ length: 6 }, (_, i) => `a${i}`),
      weights: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 1)),
      ineligible: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => false)),
      couplings: new Map(),
      penaltyOneHot: 10,
      penaltyCapacity: 10,
    };
    assert.throws(() => computeEnergies(problem), /at most 30 qubits/);
  });
});

// ----------------------------------------------------------------------------
// 退火期望值量纲 + toIsing 资格掩码
// ----------------------------------------------------------------------------

describe('annealSolve 期望值与 toIsing 资格掩码', () => {
  const problem = buildNonSquareProblem();
  const info = computeEnergies(problem);

  it('末态能量期望落在 [min, max] 能量区间内（修复前被放大 2·nqubits 倍）', () => {
    const sol = annealSolve(problem, { anneal: { tau: 20, steps: 200 }, seed: 7 });
    assert.ok(
      sol.expectation >= info.min - 1e-6 && sol.expectation <= info.max + 1e-6,
      `expectation ${sol.expectation} 超出能量区间 [${info.min}, ${info.max}]`,
    );
  });

  it('toIsing 对无资格格子施加显著负场（修复前资格掩码不出现在导出能量中）', () => {
    const masked: AssignmentProblem = {
      ...problem,
      ineligible: [
        [true, false, false],
        [false, false, false],
      ],
    };
    masked.penaltyOneHot = defaultPenalties(masked).oneHot;
    const ising = toIsing(masked);
    const n = 3;
    // 无资格格 (t0, a0) → q=0：选中(x=1,z=-1)时贡献 -h_0，须显著大于有资格格
    assert.ok(
      ising.h[0 * n + 0]! < ising.h[0 * n + 1]!,
      `无资格格 h=${ising.h[0]} 应小于有资格格 h=${ising.h[1]}`,
    );
  });
});

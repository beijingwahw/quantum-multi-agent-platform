/**
 * R19-R 创新 3：MinimalGrantDerivation（DSH 工作流最小授权自动推导）的
 * 机器验收面——与 src/dsh/minimal-grant-derivation.ts 模块头的定理一一对应：
 *   定理 M1（可靠性）→ 由推导授权构造的 ToolCapabilityPolicy 放行全部
 *     步骤的投影调用（checkCall 机器复核）；
 *   定理 M2（必要性）→ 删任一 grant，必有至少一个步骤被拒（逐 grant 钉板）；
 *   定理 M3（最小元/格论）→ 嵌套目录塌缩（子目录 grant 被吸收）、
 *     并列目录双保留；推导集 ⊑ 一切放行策略（前缀链论证的机器面）；
 *   越权推导定罪（负对照）→ 「授权 CWD 根」的走私推导放行了推导集拒绝
 *     的越界路径（default-deny 不放松）；派生后突变工作流不影响推导面。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, sep } from 'path';
import { deriveMinimalGrants } from '../src/dsh/minimal-grant-derivation.js';
import { ToolCapabilityPolicy } from '../src/tools/tool-capability-policy.js';
import { ConfigurationError } from '../src/utils/errors.js';

const DECLS = [
  {
    toolName: 'read_file',
    capabilities: [{ kind: 'fs.read' as const, param: 'path' }],
  },
  {
    toolName: 'write_file',
    capabilities: [{ kind: 'fs.write' as const, param: 'path' }],
  },
  {
    toolName: 'execute_command',
    capabilities: [{ kind: 'cmd' as const, param: 'command' }],
  },
  { toolName: 'subagent', capabilities: [{ kind: 'subagent' as const }] },
  {
    toolName: 'web_search',
    capabilities: [{ kind: 'net' as const, param: 'query' }],
  },
];

function wf(steps: Array<{ id: string; tool: string; parameters: Record<string, unknown> }>) {
  return { id: 'wf-test', name: 'wf-test', steps };
}

// ----------------------------------------------------------------------------
// 定理 M1/M2 · 可靠性与必要性
// ----------------------------------------------------------------------------

describe('R19-R · 授权推导 · 可靠性与必要性（定理 M1/M2）', () => {
  const workflow = wf([
    { id: '1', tool: 'read_file', parameters: { path: resolve('src/main.ts') } },
    { id: '2', tool: 'read_file', parameters: { path: resolve('src/util/helper.ts') } },
    { id: '3', tool: 'write_file', parameters: { path: resolve('dist/out.js'), content: 'x' } },
    { id: '4', tool: 'execute_command', parameters: { command: 'npm run lint' } },
    { id: '5', tool: 'subagent', parameters: { description: 'd', prompt: 'p' } },
  ]);

  it('M1 可靠性：推导授权构造的 policy 放行全部步骤投影', () => {
    const face = deriveMinimalGrants(workflow, DECLS);
    const policy = new ToolCapabilityPolicy(face.grants);
    for (const decl of DECLS) policy.registerTool(decl);
    for (const proj of face.stepProjections) {
      const decision = policy.checkCall(proj.tool, proj.params);
      assert.ok(decision.allowed, `步骤 ${proj.stepId} 未被放行：${decision.reason ?? ''}`);
    }
    // 授权面形状钉板：src 目录读、dist 目录写、npm 命令、subagent；无多余
    const srcRoot = resolve('src');
    const distRoot = resolve('dist');
    assert.ok(face.grants.includes(`fs.read:${srcRoot}`));
    assert.ok(face.grants.includes(`fs.write:${distRoot}`));
    assert.ok(face.grants.includes('cmd:npm'));
    assert.ok(face.grants.includes('subagent'));
    assert.equal(face.grants.length, 4);
  });

  it('M2 必要性：删任一 grant ⟹ 至少一个步骤被拒（逐 grant 机器复核）', () => {
    const face = deriveMinimalGrants(workflow, DECLS);
    for (const grant of face.grants) {
      const reduced = face.grants.filter((g) => g !== grant);
      const policy = new ToolCapabilityPolicy(reduced);
      for (const decl of DECLS) policy.registerTool(decl);
      const broken = face.stepProjections.some(
        (proj) => !policy.checkCall(proj.tool, proj.params).allowed,
      );
      assert.ok(broken, `删除 ${grant} 后仍有全步骤放行——该 grant 非必要（推导非最小）`);
      const covered = face.grantCoverage.find((c) => c.grant === grant);
      assert.ok(covered !== undefined && covered.stepIds.length > 0, `${grant} 应有非空覆盖`);
      for (const stepId of covered.stepIds) {
        assert.ok(
          face.stepProjections.some((p) => p.stepId === stepId),
          `覆盖面引用了不存在的步骤 ${stepId}`,
        );
      }
    }
  });
});

// ----------------------------------------------------------------------------
// 定理 M3 · 格论面：吸收塌缩与并列保留
// ----------------------------------------------------------------------------

describe('R19-R · 授权推导 · 格论最小元（定理 M3）', () => {
  it('嵌套塌缩：子目录 grant 被父目录吸收（同族两条路径只留最大目录）', () => {
    const parent = resolve('pkg');
    const child = resolve('pkg/lib');
    const face = deriveMinimalGrants(
      wf([
        { id: '1', tool: 'read_file', parameters: { path: `${parent}${sep}top.ts` } },
        { id: '2', tool: 'read_file', parameters: { path: `${child}${sep}deep.ts` } },
      ]),
      DECLS,
    );
    assert.ok(face.grants.includes(`fs.read:${parent}`));
    assert.ok(!face.grants.includes(`fs.read:${child}`), '子目录 grant 应被吸收');
    assert.equal(face.grants.filter((g) => g.startsWith('fs.read:')).length, 1);
  });

  it('并列保留：互不包含的目录各自保留（唯一覆盖 ⟹ 必要）', () => {
    const a = resolve('pkg-a');
    const b = resolve('pkg-b');
    const face = deriveMinimalGrants(
      wf([
        { id: '1', tool: 'read_file', parameters: { path: `${a}${sep}x.ts` } },
        { id: '2', tool: 'read_file', parameters: { path: `${b}${sep}y.ts` } },
      ]),
      DECLS,
    );
    assert.ok(face.grants.includes(`fs.read:${a}`));
    assert.ok(face.grants.includes(`fs.read:${b}`));
    assert.equal(face.grants.filter((g) => g.startsWith('fs.read:')).length, 2);
  });

  it('cmd 归一：首 token 提取＋小写化；带路径分隔符的 token 指名拒绝', () => {
    const face = deriveMinimalGrants(
      wf([
        { id: '1', tool: 'execute_command', parameters: { command: 'npm run lint' } },
        { id: '2', tool: 'execute_command', parameters: { command: 'NPM test' } },
      ]),
      DECLS,
    );
    assert.deepEqual(
      face.grants.filter((g) => g.startsWith('cmd:')),
      ['cmd:npm'],
    );
    // 投影口径：能力层的 cmd 参数是裸程序名（policy 的 checkCall 语义）
    const proj = face.stepProjections.find((p) => p.stepId === '1')!;
    assert.equal(proj.params.command, 'npm');
    assert.throws(
      () =>
        deriveMinimalGrants(
          wf([
            { id: '1', tool: 'execute_command', parameters: { command: 'C:\\tools\\npm.cmd run' } },
          ]),
          DECLS,
        ),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('bare'),
    );
  });

  it('同族不同目录：读授权不放行写路径、写授权不放行读路径（类的格独立）', () => {
    const readDir = resolve('docs-src');
    const writeDir = resolve('build-out');
    const face = deriveMinimalGrants(
      wf([
        { id: 'r', tool: 'read_file', parameters: { path: `${readDir}${sep}a.ts` } },
        {
          id: 'w',
          tool: 'write_file',
          parameters: { path: `${writeDir}${sep}b.ts`, content: 'x' },
        },
      ]),
      DECLS,
    );
    assert.ok(face.grants.includes(`fs.read:${readDir}`));
    assert.ok(face.grants.includes(`fs.write:${writeDir}`));
    assert.equal(face.grants.length, 2);
    const policy = new ToolCapabilityPolicy(face.grants);
    for (const decl of DECLS) policy.registerTool(decl);
    assert.ok(
      !policy.checkCall('write_file', { path: `${readDir}${sep}evil.ts`, content: 'x' }).allowed,
    );
    assert.ok(!policy.checkCall('read_file', { path: `${writeDir}${sep}sneak.ts` }).allowed);
    // 同目录读写（文法粗度的如实钉板）：授权文法按目录授予，同目录的
    // 另一文件互放行是文法上界而非推导缺陷（越权面＝整个目录，模块头声明）
    const shared = resolve('shared');
    const sameDir = deriveMinimalGrants(
      wf([
        { id: 'r', tool: 'read_file', parameters: { path: `${shared}${sep}a.ts` } },
        { id: 'w', tool: 'write_file', parameters: { path: `${shared}${sep}b.ts`, content: 'x' } },
      ]),
      DECLS,
    );
    const p2 = new ToolCapabilityPolicy(sameDir.grants);
    for (const decl of DECLS) p2.registerTool(decl);
    assert.ok(p2.checkCall('write_file', { path: `${shared}${sep}a.ts`, content: 'x' }).allowed);
    assert.ok(p2.checkCall('read_file', { path: `${shared}${sep}b.ts` }).allowed);
  });
});

// ----------------------------------------------------------------------------
// 越权推导定罪（负对照）与 default-deny
// ----------------------------------------------------------------------------

describe('R19-R · 授权推导 · 越权定罪与 default-deny', () => {
  const inner = resolve('inner-project');
  const workflow = wf([
    { id: '1', tool: 'read_file', parameters: { path: `${inner}${sep}a.ts` } },
    { id: '2', tool: 'read_file', parameters: { path: `${inner}${sep}b.ts` } },
  ]);

  it('走私推导定罪：「授权 CWD 根」的宽松推导放行了推导集拒绝的越界路径', () => {
    const face = deriveMinimalGrants(workflow, DECLS);
    const smuggled = [`fs.read:${resolve('.')}`]; // 只图省事授权整个 CWD
    const strict = new ToolCapabilityPolicy(face.grants);
    const loose = new ToolCapabilityPolicy(smuggled);
    for (const decl of DECLS) {
      strict.registerTool(decl);
      loose.registerTool(decl);
    }
    // 两边都放行工作流自身（都能跑）……
    for (const proj of face.stepProjections) {
      assert.ok(strict.checkCall(proj.tool, proj.params).allowed);
      assert.ok(loose.checkCall(proj.tool, proj.params).allowed);
    }
    // ……但宽松版多放行了工作流从未请求的路径（越权面被钉板定罪）
    const outside = `${resolve('secrets')}${sep}key.pem`;
    assert.ok(!strict.checkCall('read_file', { path: outside }).allowed, '最小集应拒绝越界读');
    assert.ok(
      loose.checkCall('read_file', { path: outside }).allowed,
      '走私集放行了越界读（定罪）',
    );
    console.log(
      `[R19-R 越权] 最小集=${face.grants.join(', ')}（拒越界）；走私集=${smuggled.join(', ')}（放行 secrets/key.pem）`,
    );
  });

  it('派生后突变工作流不影响推导面（纯函数快照，深拷贝出参）', () => {
    const input = wf([{ id: '1', tool: 'read_file', parameters: { path: `${inner}${sep}a.ts` } }]);
    const face = deriveMinimalGrants(input, DECLS);
    input.steps[0]!.parameters.path = `${resolve('escapes')}${sep}evil.ts`;
    input.steps.push({ id: '2', tool: 'subagent', parameters: { description: 'd', prompt: 'p' } });
    const again = deriveMinimalGrants(
      wf([{ id: '1', tool: 'read_file', parameters: { path: `${inner}${sep}a.ts` } }]),
      DECLS,
    );
    assert.deepEqual(face.grants, again.grants);
    assert.equal(face.grants.length, 1);
    // 突变后的越界调用被原推导构造的 policy 拒绝（default-deny 不放松）
    const policy = new ToolCapabilityPolicy(face.grants);
    for (const decl of DECLS) policy.registerTool(decl);
    assert.ok(
      !policy.checkCall('read_file', { path: input.steps[0]!.parameters.path as string }).allowed,
    );
    assert.ok(!policy.checkCall('subagent', { description: 'd', prompt: 'p' }).allowed);
  });

  it('net 无法从 query 推导：无宿主提示指名拒绝；有提示则全量授予（如实标注过授权）', () => {
    const netWf = wf([{ id: '1', tool: 'web_search', parameters: { query: 'latest tsp papers' } }]);
    assert.throws(
      () => deriveMinimalGrants(netWf, DECLS),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('net'),
    );
    const face = deriveMinimalGrants(netWf, DECLS, { netHosts: ['example.com'] });
    assert.ok(face.grants.includes('net:example.com'));
    const policy = new ToolCapabilityPolicy(face.grants);
    for (const decl of DECLS) policy.registerTool(decl);
    // net 投影参数：提示主机（query 串不含主机，投影面如实代位）
    assert.ok(policy.checkCall('web_search', { query: 'example.com' }).allowed);
  });
});

// ----------------------------------------------------------------------------
// 域校验
// ----------------------------------------------------------------------------

describe('R19-R · 授权推导 · 域校验', () => {
  it('空步骤/未声明工具/缺参数值/重复声明：指名拒绝', () => {
    assert.throws(
      () => deriveMinimalGrants(wf([]), DECLS),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('steps'),
    );
    assert.throws(
      () => deriveMinimalGrants(wf([{ id: '1', tool: 'ghost_tool', parameters: {} }]), DECLS),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('ghost_tool'),
    );
    assert.throws(
      () =>
        deriveMinimalGrants(wf([{ id: '1', tool: 'read_file', parameters: { path: '' } }]), DECLS),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('path'),
    );
    assert.throws(
      () => deriveMinimalGrants(wf([{ id: '1', tool: 'read_file', parameters: {} }]), DECLS),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('path'),
    );
    assert.throws(
      () =>
        deriveMinimalGrants(wf([{ id: '1', tool: 'read_file', parameters: { path: 'a.ts' } }]), [
          ...DECLS,
          { toolName: 'read_file', capabilities: [{ kind: 'fs.read' as const, param: 'path' }] },
        ]),
      (e: unknown) => e instanceof ConfigurationError && e.message.includes('read_file'),
    );
  });

  it('相对路径锚定 CWD：推导与 checkCall 同口径（resolve 一致）', () => {
    const face = deriveMinimalGrants(
      wf([{ id: '1', tool: 'read_file', parameters: { path: 'package.json' } }]),
      DECLS,
    );
    assert.ok(face.grants.includes(`fs.read:${resolve('.')}`));
    const policy = new ToolCapabilityPolicy(face.grants);
    for (const decl of DECLS) policy.registerTool(decl);
    assert.ok(policy.checkCall('read_file', { path: 'package.json' }).allowed);
    assert.ok(!policy.checkCall('read_file', { path: '../outside.json' }).allowed);
  });
});

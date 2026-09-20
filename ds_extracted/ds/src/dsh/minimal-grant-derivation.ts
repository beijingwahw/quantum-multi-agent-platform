/**
 * MinimalGrantDerivation —— DSH 工作流最小授权自动推导（R19-R 创新 3，opt-in）
 *
 * ============ 定位（与既有裁决层的分工，诚实边界） ============
 *
 * ToolCapabilityPolicy（R14-C）是**裁决层**：宿主手工声明 grants，checkCall
 * 按调用点参数逐能力裁决。DSH 工作流（dsh-integration）的默认模板需要
 * 什么授权全凭宿主经验——授权多了是越权面，授权少了运行期才发现。
 * 本模块补**推导层**：从工作流 steps 的静态参数集推导出恰好放行全部
 * 步骤的最小 grant 集，宿主拿推导结果构造 ToolCapabilityPolicy——
 * default-deny 语义不放松（推导集之外的调用一律被构造出的 policy 拒绝）。
 *
 * ============ 格论刻画（需求并集 ∩ 策略闭合） ============
 *
 * 以「放行调用集」A(G) 给 grant 集 G 定序：G ⊑ G' ⟺ A(G) ⊆ A(G')。
 * 对工作流 W，放行策略族 𝒫(W) = {G : W 的每个步骤投影 ∈ A(G)} 在该序
 * 下是上闭集（filter）。需求并集 R(W) = 逐步骤需求的并；本模块计算
 * 的是 𝒫(W) 的**最小元** G*（策略闭合的下确界），逐类构造：
 *
 *   - fs.read / fs.write：每条路径 p 取最深包围目录 dirname(p)，再把
 *     被其他保留目录真包含的目录吸收掉（保留包含序极大元）；
 *   - cmd：每条命令取首 token（裸程序名，小写归一）；
 *   - subagent：任一 subagent 步骤 ⟹ 单一 grant 'subagent'；
 *   - net：query 串不携带主机语义——**不可推导**。宿主须逐步骤给主机
 *     值或给 netHosts 白名单（后者是宿主申报的过授权，如实标注），
 *     否则指名拒绝（default-deny：拒绝猜测）。
 *
 * **定理 M1（可靠性）** 由 G* 构造的 ToolCapabilityPolicy 放行 W 的全部
 * 步骤投影（测试逐步骤 checkCall 机器复核）。
 *
 * **定理 M2（必要性）** G* 中删去任一 grant，必有至少一个步骤被拒：
 * fs 的保留目录互不真包含 ⟹ 各自独占覆盖其直接路径（其他保留目录
 * 无法包含它）；cmd/subagent/逐步骤 net 的 grant 与步骤一一对应。
 * （netHosts 白名单模式的宿主过授权不在此列——它们本来就不是推导量。）
 *
 * **定理 M3（最小元）** G* ⊑ G 对一切 G ∈ 𝒫(W)：放行路径 p 的 fs 根
 * 必是 p 的前缀链上的目录（同一文件的所有包围目录线性有序）——比
 * dirname(p) 更浅的根只会更宽松；吸收塌缩后 G* 的每个 fs 根在该链上
 * 取到最深可行位置。故 G* 的放行集含于任何放行策略的放行集。∎
 *
 * ============ 诚实边界（不主张什么） ============
 *
 * - **词法层推导**：与 ToolCapabilityPolicy 同口径的词法包含（resolve
 *   前缀比对，win32 大小写不敏感）；不能防御沙箱内符号链接逃逸——
 *   物理路径校验仍是 fs-tools 的职责（两层分工与 R14-C 声明一致）。
 * - **CWD 锚定**：相对路径（如 'package.json'）按 process.cwd() 解析，
 *   推导与 checkCall 用同一 resolve 口径；运行期换 CWD 会使锚漂移。
 * - **cmd 投影**：能力层的 cmd 参数语义是裸程序名；DSH 的完整命令串
 *   （'npm run lint'）投影为首 token（'npm'）。命令内部的旗标/参数
 *   由 system-tools 四闸门继续裁决——本层只授权「可以跑这个程序」。
 * - **参数是静态快照**：推导读 steps 的 parameters 现值；派生后宿主
 *   突变工作流不改变推导面（纯函数，出参深拷贝），突变产生的越界
 *   调用被构造出的 policy 拒绝（default-deny 不放松）。
 * - **net 的过授权**：netHosts 模式授予整个白名单而非逐步骤主机——
 *   query 串不决定主机，这是宿主申报的诚实过授权，不参与必要性主张。
 * - 不推导「步骤成功所需的参数类型/取值域」——那是 DSHIntegration
 *   validateAndNormalizeParameters 的既有职责。
 *
 * ============ 确定性契约 ============
 *
 * 纯函数：无 IO、无时钟、无随机源；同输入（含同 CWD）同输出。grants
 * 与 grantCoverage 按首遇序稳定排列，stepProjections 按步骤序。
 */

import { resolve, sep } from 'path';
import type { ToolCapabilityDeclaration } from '../tools/tool-capability-policy.js';
import { ConfigurationError } from '../utils/errors.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

/** 工作流的结构子集（DSHWorkflow 的 steps 形状；不依赖 dsh-integration） */
export interface GrantWorkflow {
  steps: ReadonlyArray<{
    id: string;
    tool: string;
    parameters: Record<string, unknown>;
  }>;
}

/** 推导选项 */
export interface DerivationOptions {
  /** net 白名单（query 串不携带主机语义时由宿主申报；全量授予＝诚实过授权） */
  netHosts?: readonly string[];
}

/** 步骤投影：checkCall 的直接输入面（params 只含声明过的参数） */
export interface StepProjection {
  stepId: string;
  tool: string;
  /** 声明能力的参数值（fs＝原路径；cmd＝裸程序名；net＝主机代位） */
  params: Record<string, string>;
}

/** 逐 grant 的覆盖审计面（必要性机器复核的输入） */
export interface GrantCoverage {
  grant: string;
  /** 该 grant 参与放行的步骤 id（删它 ⟹ 这些步骤中至少一个被拒） */
  stepIds: string[];
}

/** 推导结果面 */
export interface DerivedGrantFace {
  /** 最小授权集（grant 串，ToolCapabilityPolicy 构造函数直接消费） */
  grants: string[];
  /** 逐步骤投影（定理 M1 的机器复核输入） */
  stepProjections: StepProjection[];
  /** 逐 grant 覆盖（定理 M2 的机器复核输入） */
  grantCoverage: GrantCoverage[];
}

const CMD_FORBIDDEN = /[\\/:;]/;
const NET_HOST = /^[a-z0-9.-]+$/;

/** 词法包含（与 tool-capability-policy 的 isPathWithin 同口径） */
function withinLexical(requested: string, root: string): boolean {
  const absolute = resolve(requested);
  if (absolute === root) return true;
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return process.platform === 'win32'
    ? absolute.toLowerCase().startsWith(rootWithSep.toLowerCase())
    : absolute.startsWith(rootWithSep);
}

/** 严格包含：requested 真位于 root 之内（排除互含＝同目录大小写变体） */
function strictlyWithin(requested: string, root: string): boolean {
  return withinLexical(requested, root) && !withinLexical(root, requested);
}

interface FsFace {
  roots: string[];
  /** 每个保留根覆盖的步骤 id */
  coverageByRoot: Map<string, string[]>;
}

/**
 * fs 类的格运算：最深包围目录（dirname）→ 吸收塌缩（保留包含序极大元）。
 * 定理 M3 的机器面：塌缩后的根集合在「放行不减」序下最小。
 */
function deriveFsFace(
  kind: 'fs.read' | 'fs.write',
  steps: ReadonlyArray<{ id: string; tool: string; parameters: Record<string, unknown> }>,
  stepValues: Map<string, string>,
): FsFace {
  const dirByStep = new Map<string, string>();
  const dirs: string[] = [];
  for (const step of steps) {
    const value = stepValues.get(step.id)!;
    const dir = resolve(value.slice(0, Math.max(0, value.lastIndexOf(sep))) || '.');
    dirByStep.set(step.id, dir);
    if (!dirs.some((d) => d === dir)) dirs.push(dir);
  }
  // 吸收塌缩：被其他目录真包含的目录不是极大元，删除
  const kept = dirs.filter((d) => !dirs.some((d2) => d2 !== d && strictlyWithin(d, d2)));
  const coverageByRoot = new Map<string, string[]>();
  for (const root of kept) coverageByRoot.set(`${kind}:${root}`, []);
  for (const step of steps) {
    const value = stepValues.get(step.id)!;
    for (const root of kept) {
      if (withinLexical(value, root)) {
        coverageByRoot.get(`${kind}:${root}`)!.push(step.id);
        break; // 前缀链上最深的保留根先命中（kept 保持首遇序＝深链优先）
      }
    }
  }
  return { roots: kept, coverageByRoot };
}

// ----------------------------------------------------------------------------
// 推导主函数
// ----------------------------------------------------------------------------

/**
 * 从工作流 steps 推导最小授权集（定理 M1/M2/M3；格论刻画见模块头）。
 * 纯函数：出参深拷贝，不含对输入的别名引用。
 */
export function deriveMinimalGrants(
  workflow: GrantWorkflow,
  declarations: readonly ToolCapabilityDeclaration[],
  options: DerivationOptions = {},
): DerivedGrantFace {
  // unknown 视图校验（平台惯例）：类型标注对 JS 调用方不构成约束
  const rawWf = workflow as { steps?: unknown } | null;
  if (
    rawWf === null ||
    typeof rawWf !== 'object' ||
    !Array.isArray(rawWf.steps) ||
    rawWf.steps.length === 0
  ) {
    throw new ConfigurationError(
      'deriveMinimalGrants() workflow.steps must be a non-empty array (nothing to derive)',
    );
  }
  if (!Array.isArray(declarations)) {
    throw new ConfigurationError(
      `deriveMinimalGrants() declarations must be an array, got ${typeof declarations}`,
    );
  }
  const declByTool = new Map<string, { index: number; caps: ToolCapabilityDeclaration }>();
  declarations.forEach((decl, i) => {
    const raw = decl as { toolName?: unknown; capabilities?: unknown } | null;
    if (
      raw === null ||
      typeof raw !== 'object' ||
      typeof raw.toolName !== 'string' ||
      raw.toolName.length === 0
    ) {
      throw new ConfigurationError(
        `declarations[${i}].toolName must be a non-empty string, got ${String(raw === null ? raw : raw.toolName)}`,
      );
    }
    const toolName = raw.toolName;
    if (!Array.isArray(raw.capabilities) || raw.capabilities.length === 0) {
      throw new ConfigurationError(
        `declarations[${i}] ('${toolName}') must declare at least one capability`,
      );
    }
    if (declByTool.has(toolName)) {
      throw new ConfigurationError(
        `duplicate declaration for tool '${toolName}' (step ${i}) — replace instead of re-declaring`,
      );
    }
    declByTool.set(toolName, {
      index: i,
      caps: {
        toolName,
        capabilities: raw.capabilities as ToolCapabilityDeclaration['capabilities'],
      },
    });
  });

  // 步骤结构校验 + 声明存在性（default-deny：未声明工具不可推导），
  // 校验后净化为本地类型化数组（后续推导面零 any）
  const steps: Array<{ id: string; tool: string; parameters: Record<string, unknown> }> = [];
  for (const entry of rawWf.steps) {
    const raw = entry as { id?: unknown; tool?: unknown; parameters?: unknown } | null;
    if (
      raw === null ||
      typeof raw !== 'object' ||
      typeof raw.id !== 'string' ||
      raw.id.length === 0
    ) {
      throw new ConfigurationError('workflow step id must be a non-empty string');
    }
    if (typeof raw.tool !== 'string' || raw.tool.length === 0) {
      throw new ConfigurationError(`step '${raw.id}' must reference a non-empty tool name`);
    }
    if (raw.parameters === null || typeof raw.parameters !== 'object') {
      throw new ConfigurationError(`step '${raw.id}' parameters must be an object`);
    }
    if (!declByTool.has(raw.tool)) {
      throw new ConfigurationError(
        `step '${raw.id}' uses tool '${raw.tool}' with no capability declaration ` +
          '(default-deny: undeclared tools cannot be granted)',
      );
    }
    steps.push({
      id: raw.id,
      tool: raw.tool,
      parameters: raw.parameters as Record<string, unknown>,
    });
  }

  const grants: string[] = [];
  const grantSet = new Set<string>();
  const stepProjections: StepProjection[] = [];
  const grantCoverage: GrantCoverage[] = [];
  const pushGrant = (grant: string, stepIds: string[]): void => {
    if (grantSet.has(grant)) {
      const existing = grantCoverage.find((c) => c.grant === grant)!;
      existing.stepIds.push(...stepIds);
      return;
    }
    grantSet.add(grant);
    grants.push(grant);
    grantCoverage.push({ grant, stepIds: [...stepIds] });
  };

  // 逐声明推导（fs 的吸收塌缩需要同类聚合后统一做）
  for (const [toolName, { caps }] of declByTool) {
    const toolSteps = steps.filter((s) => s.tool === toolName);
    if (toolSteps.length === 0) continue;
    for (const cap of caps.capabilities) {
      const kind = cap.kind;
      if (kind === 'subagent') {
        pushGrant(
          'subagent',
          toolSteps.map((s) => s.id),
        );
        for (const step of toolSteps)
          stepProjections.push({ stepId: step.id, tool: toolName, params: {} });
        continue;
      }
      if (cap.param === undefined || typeof cap.param !== 'string' || cap.param.length === 0) {
        throw new ConfigurationError(
          `tool '${toolName}' capability '${kind}' requires a non-empty param name`,
        );
      }
      const param = cap.param;
      const stepValues = new Map<string, string>();
      for (const step of toolSteps) {
        const value = step.parameters[param];
        if (typeof value !== 'string' || value.length === 0) {
          throw new ConfigurationError(
            `step '${step.id}' ('${toolName}') is missing a non-empty string parameter '${param}' ` +
              `for capability '${kind}'`,
          );
        }
        stepValues.set(step.id, value);
      }
      if (kind === 'fs.read' || kind === 'fs.write') {
        const face = deriveFsFace(kind, toolSteps, stepValues);
        for (const [grant, stepIds] of face.coverageByRoot) pushGrant(grant, stepIds);
        for (const step of toolSteps) {
          stepProjections.push({
            stepId: step.id,
            tool: toolName,
            params: { [param]: stepValues.get(step.id)! },
          });
        }
      } else if (kind === 'cmd') {
        const programByStep = new Map<string, string>();
        for (const step of toolSteps) {
          const token = stepValues.get(step.id)!.split(/\s+/)[0] ?? '';
          if (token.length === 0 || CMD_FORBIDDEN.test(token)) {
            throw new ConfigurationError(
              `step '${step.id}' ('${toolName}') command must start with a bare program name ` +
                `(no path separators, ';' or whitespace), got '${token}'`,
            );
          }
          programByStep.set(step.id, token.toLowerCase());
        }
        const programs = [...new Set(programByStep.values())];
        for (const program of programs) {
          pushGrant(
            `cmd:${program}`,
            toolSteps.filter((s) => programByStep.get(s.id) === program).map((s) => s.id),
          );
        }
        for (const step of toolSteps) {
          stepProjections.push({
            stepId: step.id,
            tool: toolName,
            params: { [param]: programByStep.get(step.id)! },
          });
        }
      } else {
        // net：query 串不携带主机语义。逐步骤主机值可直接推导；
        // 否则必须由宿主申报白名单（诚实过授权），缺省指名拒绝。
        const hostByStep = new Map<string, string>();
        let anyNonHost = false;
        for (const step of toolSteps) {
          const value = stepValues.get(step.id)!;
          const lower = value.toLowerCase();
          if (NET_HOST.test(lower)) {
            hostByStep.set(step.id, lower);
          } else {
            anyNonHost = true;
          }
        }
        if (anyNonHost) {
          const whitelist = options.netHosts;
          if (whitelist === undefined || whitelist.length === 0) {
            throw new ConfigurationError(
              `tool '${toolName}' needs capability 'net' but its parameter '${param}' does not ` +
                'carry a host (query strings cannot be derived) — supply options.netHosts ' +
                '(host-declared whitelist, an honest over-grant)',
            );
          }
          const hosts: string[] = [];
          for (const host of whitelist) {
            if (typeof host !== 'string' || !NET_HOST.test(host.toLowerCase())) {
              throw new ConfigurationError(
                `options.netHosts entries must be plain lowercase domain suffixes, got ${String(host)}`,
              );
            }
            const lower = host.toLowerCase();
            if (!hosts.includes(lower)) hosts.push(lower);
          }
          // 投影代位：非主机值统一投影到首个白名单主机（该值必被放行）
          const placeholder = hosts[0]!;
          for (const step of toolSteps) {
            hostByStep.set(step.id, hostByStep.get(step.id) ?? placeholder);
          }
          for (const host of hosts) {
            pushGrant(
              `net:${host}`,
              toolSteps.filter((s) => hostByStep.get(s.id) === host).map((s) => s.id),
            );
          }
        } else {
          const hosts = [...new Set(hostByStep.values())];
          for (const host of hosts) {
            pushGrant(
              `net:${host}`,
              toolSteps.filter((s) => hostByStep.get(s.id) === host).map((s) => s.id),
            );
          }
        }
        for (const step of toolSteps) {
          stepProjections.push({
            stepId: step.id,
            tool: toolName,
            params: { [param]: hostByStep.get(step.id)! },
          });
        }
      }
    }
  }

  // 步骤投影按步骤序重排（声明序推导后恢复工作流自然序）
  const orderById = new Map(steps.map((s, i) => [s.id, i]));
  stepProjections.sort((a, b) => (orderById.get(a.stepId) ?? 0) - (orderById.get(b.stepId) ?? 0));
  return { grants, stepProjections, grantCoverage };
}

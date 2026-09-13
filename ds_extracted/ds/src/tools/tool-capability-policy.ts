/**
 * 工具能力声明与最小权限决策（DSH 插件协议的沙箱化能力扩展，opt-in）
 *
 * ============ 定位（与既有加固层的分工，诚实边界） ============
 *
 * src/tools 既有的两道闸门是「全局单根」语义：
 *   - fs-tools：setFsSandboxRoot 单一根目录（真实路径解析 + 反符号链接逃逸）；
 *   - system-tools：configureCommandPolicy 全局程序白名单 + 元字符/内联旗标拒绝。
 * 它们回答的是「平台允许做什么」。本模块补的是它们没有的「按宿主授权、
 * 按工具声明、按调用点参数」的细粒度决策层：
 *
 *   - 宿主构造 ToolCapabilityPolicy 时声明授予的能力（grants）：
 *       fs.read:<绝对目录>   允许读该目录树下（词法包含）
 *       fs.write:<绝对目录>  允许写该目录树下
 *       cmd:<程序名>         允许执行该裸程序名（大小写不敏感）
 *       net:<域名后缀>       允许访问该域名或其子域（点锚后缀匹配）
 *       subagent             允许委派子代理
 *   - 工具注册时声明自己需要的能力来源（参数名）：如 read_file 声明
 *     { kind: 'fs.read', param: 'path' } —— checkCall 按调用点实际参数值
 *     逐能力裁决，缺失能力指名返回（reason 含缺失的 grant 串）。
 *
 * 本模块是纯决策函数：不执行任何 IO、不 spawn 任何进程。词法包含判断
 * 不能防御「沙箱内符号链接指向沙箱外」的 TOCTOU——真实读写落盘前的
 * 物理路径校验仍由 fs-tools 的 resolveWithinSandbox 承担；本层把「宿主
 * 想授予什么」从代码常量提升为可声明、可审计的数据面。
 *
 * 全部匹配语义为词法 + 确定性（无随机、无时钟、无 IO）：同输入同输出。
 */

import { isAbsolute, resolve, sep } from 'path';
import { ConfigurationError, ToolError } from '../utils/errors.js';

// ----------------------------------------------------------------------------
// 类型
// ----------------------------------------------------------------------------

/** 能力类别（与 grant 串前缀一一对应） */
export type CapabilityKind = 'fs.read' | 'fs.write' | 'cmd' | 'net' | 'subagent';

/** 工具的能力需求声明：值取自调用参数（subagent 为静态授权，无参数） */
export interface ToolCapability {
  kind: CapabilityKind;
  /** 取值参数名：fs.read/fs.write 的路径参数、cmd 的程序名参数、net 的主机参数 */
  param?: string;
}

/** 工具能力声明（注册到策略的形状） */
export interface ToolCapabilityDeclaration {
  toolName: string;
  capabilities: readonly ToolCapability[];
}

/** checkCall 的裁决结果（拒绝时 reason 指名缺失能力；matched 供审计） */
export interface CapabilityDecision {
  allowed: boolean;
  /** 拒绝原因（allowed=false 时必有，含全部缺失能力，按声明序） */
  reason?: string;
  /** 本次调用实际匹配到的授权串（allowed=true 时与能力一一对应） */
  matched: string[];
}

const VALID_KINDS: ReadonlySet<string> = new Set(['fs.read', 'fs.write', 'cmd', 'net', 'subagent']);

const CMD_FORBIDDEN = /[\\/:;\s]/;
const NET_HOST = /^[a-z0-9.-]+$/;

/** FS 能力类别（共享根目录集合的两种） */
type FsKind = 'fs.read' | 'fs.write';

function isFsKind(kind: string): kind is FsKind {
  return kind === 'fs.read' || kind === 'fs.write';
}

// ----------------------------------------------------------------------------
// grant 语法解析（入口拒绝：非法 grant 指名 ConfigurationError）
// ----------------------------------------------------------------------------

interface ParsedGrant {
  kind: CapabilityKind;
  /** fs 的根目录 / cmd 的程序名 / net 的域名后缀；subagent 为 null */
  value: string | null;
}

function parseGrant(grant: string): ParsedGrant {
  const fail = (requirement: string): never => {
    throw new ConfigurationError(`Invalid capability grant '${grant}': ${requirement}`);
  };
  if (grant === 'subagent') return { kind: 'subagent', value: null };
  const colonAt = grant.indexOf(':');
  if (colonAt < 0) {
    fail(
      "expected '<kind>:<value>' or the bare grant 'subagent' " +
        `(kinds: ${[...VALID_KINDS].join(', ')})`,
    );
  }
  const kind = grant.slice(0, colonAt);
  const value = grant.slice(colonAt + 1);
  if (!VALID_KINDS.has(kind)) fail(`unknown kind '${kind}'`);
  if (value.length === 0) fail(`kind '${kind}' requires a non-empty value`);
  if (isFsKind(kind)) {
    if (!isAbsolute(value)) fail(`kind '${kind}' requires an absolute directory path`);
    return { kind, value: resolve(value) };
  }
  if (kind === 'cmd') {
    if (CMD_FORBIDDEN.test(value)) {
      fail("cmd value must be a bare program name (no path separators, ';' or whitespace)");
    }
    return { kind, value: value.toLowerCase() };
  }
  // net：小写域名后缀，无 scheme/路径
  if (!NET_HOST.test(value.toLowerCase())) {
    fail('net value must be a plain lowercase domain suffix (letters, digits, dots, hyphens)');
  }
  return { kind: 'net', value: value.toLowerCase() };
}

// ----------------------------------------------------------------------------
// 匹配语义
// ----------------------------------------------------------------------------

/**
 * 词法包含判定：requested 是否落在 root 目录树下（或恰为 root 本身）。
 * 词法（不触盘）：resolve 规范化后做前缀比对，win32 大小写不敏感——
 * 与 fs-tools/system-tools 的既有前缀比对口径一致。等值根合法。
 */
function isPathWithin(requested: string, root: string): boolean {
  const absolute = resolve(requested);
  if (absolute === root) return true;
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return process.platform === 'win32'
    ? absolute.toLowerCase().startsWith(rootWithSep.toLowerCase())
    : absolute.startsWith(rootWithSep);
}

/**
 * 域名后缀匹配（点锚）：host 匹配 suffix 当且仅当 host === suffix 或
 * host 以 '.'+suffix 结尾——'evil-api.example.com' 不得匹配 'api.example.com'。
 */
function hostMatchesSuffix(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith('.' + suffix);
}

// ----------------------------------------------------------------------------
// ToolCapabilityPolicy
// ----------------------------------------------------------------------------

export class ToolCapabilityPolicy {
  private readonly fsRoots = new Map<FsKind, string[]>();
  private readonly cmdPrograms = new Set<string>();
  private readonly netSuffixes: string[] = [];
  private subagentGranted = false;
  private readonly declarations = new Map<string, ToolCapabilityDeclaration>();

  /** 构造即解析并校验全部授权（非法 grant 指名拒绝，零静默丢弃） */
  constructor(grants: readonly string[]) {
    if (!Array.isArray(grants)) {
      throw new ConfigurationError(
        `ToolCapabilityPolicy grants must be an array of strings, got ${typeof grants}`,
      );
    }
    for (const grant of grants) {
      if (typeof grant !== 'string' || grant.length === 0) {
        throw new ConfigurationError(
          `ToolCapabilityPolicy grant must be a non-empty string, got ${String(grant)}`,
        );
      }
      const parsed = parseGrant(grant);
      if (isFsKind(parsed.kind)) {
        const roots = this.fsRoots.get(parsed.kind) ?? [];
        roots.push(parsed.value!);
        this.fsRoots.set(parsed.kind, roots);
      } else if (parsed.kind === 'cmd') {
        this.cmdPrograms.add(parsed.value!);
      } else if (parsed.kind === 'net') {
        this.netSuffixes.push(parsed.value!);
      } else {
        this.subagentGranted = true;
      }
    }
  }

  /**
   * 注册工具能力声明。重复 toolName 指名拒绝（与 DSHIntegration.registerTool
   * 同口径：替换须先 unregisterTool）。声明至少含一条能力（无能力工具
   * 不需要本策略）。
   */
  registerTool(declaration: ToolCapabilityDeclaration): void {
    if (typeof declaration.toolName !== 'string' || declaration.toolName.length === 0) {
      throw new ConfigurationError('ToolCapabilityDeclaration.toolName must be a non-empty string');
    }
    if (this.declarations.has(declaration.toolName)) {
      throw new ToolError(
        `Tool '${declaration.toolName}' is already registered (unregister it first to replace)`,
      );
    }
    if (!Array.isArray(declaration.capabilities) || declaration.capabilities.length === 0) {
      throw new ConfigurationError(
        `Tool '${declaration.toolName}' must declare at least one capability`,
      );
    }
    // 逐能力校验并归一化入库（校验过的深拷贝——与规则所有权契约同口径，
    // 调用方事后改写声明对象不影响已注册裁决）
    const normalized: ToolCapability[] = [];
    for (const cap of declaration.capabilities) {
      // 以 unknown 视图校验：类型标注对 JS 调用方不构成约束
      const raw = cap as { kind?: unknown; param?: unknown } | null;
      if (raw === null || typeof raw.kind !== 'string' || !VALID_KINDS.has(raw.kind)) {
        throw new ConfigurationError(
          `Tool '${declaration.toolName}' capability has unknown kind ${String(raw?.kind)}`,
        );
      }
      const kind = raw.kind as CapabilityKind;
      if (kind === 'subagent') {
        if (raw.param !== undefined) {
          throw new ConfigurationError(
            `Tool '${declaration.toolName}': capability 'subagent' takes no param`,
          );
        }
        normalized.push({ kind });
        continue;
      }
      if (typeof raw.param !== 'string' || raw.param.length === 0) {
        throw new ConfigurationError(
          `Tool '${declaration.toolName}': capability '${kind}' requires a non-empty param name`,
        );
      }
      normalized.push({ kind, param: raw.param });
    }
    this.declarations.set(declaration.toolName, {
      toolName: declaration.toolName,
      capabilities: normalized,
    });
  }

  /** 注销声明（返回是否存在） */
  unregisterTool(toolName: string): boolean {
    return this.declarations.delete(toolName);
  }

  /** 已声明的工具名（注册序） */
  declaredTools(): string[] {
    return [...this.declarations.keys()];
  }

  /**
   * 裁决一次工具调用：按声明逐能力检查调用点参数值。
   * 未声明的工具拒绝（default-deny）；缺参数是调用方编程错误（ToolError
   * 指名参数）；能力不足返回 allowed=false 且 reason 指名全部缺失 grant。
   */
  checkCall(
    toolName: string,
    params: Record<string, unknown> | null | undefined,
  ): CapabilityDecision {
    const declaration = this.declarations.get(toolName);
    if (!declaration) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' has no capability declaration (default-deny)`,
        matched: [],
      };
    }
    if (params === null || typeof params !== 'object') {
      throw new ToolError(`checkCall() params must be an object for tool '${toolName}'`);
    }

    const missing: string[] = [];
    const matched: string[] = [];
    for (const cap of declaration.capabilities) {
      if (cap.kind === 'subagent') {
        if (this.subagentGranted) matched.push('subagent');
        else missing.push('subagent');
        continue;
      }
      const value = params[cap.param!];
      if (typeof value !== 'string' || value.length === 0) {
        throw new ToolError(
          `Tool '${toolName}' capability '${cap.kind}' requires a non-empty string ` +
            `parameter '${cap.param!}'`,
        );
      }
      if (isFsKind(cap.kind)) {
        const roots = this.fsRoots.get(cap.kind) ?? [];
        const hit = roots.find((root) => isPathWithin(value, root));
        if (hit !== undefined) matched.push(`${cap.kind}:${hit}`);
        else missing.push(`${cap.kind}:${value}`);
      } else if (cap.kind === 'cmd') {
        const program = value.toLowerCase();
        if (this.cmdPrograms.has(program)) matched.push(`cmd:${program}`);
        else missing.push(`cmd:${value}`);
      } else {
        const host = value.toLowerCase();
        const suffix = this.netSuffixes.find((s) => hostMatchesSuffix(host, s));
        if (suffix !== undefined) matched.push(`net:${suffix}`);
        else missing.push(`net:${host}`);
      }
    }
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Missing capability grants: ${missing.join(', ')}`,
        matched,
      };
    }
    return { allowed: true, matched };
  }
}

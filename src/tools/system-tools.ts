import { logWarn } from '../utils/logger';
import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import { resolve } from 'path';
import { ToolError } from '../utils/errors';

/**
 * 命令执行策略：execute_command 的输入来自不可信任的调用方（DSH 工具面
 * 暴露在 WebSocket 控制台协议之后），原始实现把任意字符串直接交给 shell，
 * 构造上就是命令注入。这里在进入 shell 前加三道闸门：
 *
 * 1. 程序白名单——首 token（程序名）必须命中 allowlist（默认覆盖平台文档
 *    内置工作流用到的 npm/node/npx/tsc/git 等；可用 configureCommandPolicy
 *    调整），程序名本身禁止路径分隔符与扩展名伪装。
 * 2. 元字符拒绝——引号外的 shell 控制运算符（; & | < > ` $ 换行）一律拒绝，
 *    杜绝串联、管道、重定向、命令替换与子 shell 逃逸。
 * 3. token 级字符黑名单——任何参数 token 的值不得包含引号与 %（含反引号）。
 *    这使得执行侧无需依赖 shell 的引号语义：POSIX 直接以 argv 数组 exec
 *    （完全不经过 shell）；Windows 因 npm/npx 是 .cmd 脚本必须借道 cmd.exe，
 *    但重建的命令行里每个含空白/特殊字符的参数都被双引号包裹，而双引号内
 *    已经不存在任何 cmd 活跃元字符（" 与 % 被第 3 条规则禁止）。
 *    这修复了旧实现「按 POSIX 单引号语义解析、却把原文交回 cmd.exe」的
 *    跨平台引号错配（cmd 不认单引号，引号内的 & 仍会逃逸）。
 */

export interface CommandPolicy {
  /** 允许执行的程序名（basename 精确匹配，大小写不敏感） */
  allowedPrograms: readonly string[];
  /** workdir 必须位于其下的根目录；null 表示不限制（仍须存在） */
  workdirRoot: string | null;
  /** 单命令执行超时（毫秒） */
  timeoutMs: number;
}

const DEFAULT_POLICY: CommandPolicy = {
  allowedPrograms: ['npm', 'node', 'npx', 'tsc', 'tsx', 'git', 'ls', 'echo'],
  workdirRoot: process.cwd(),
  timeoutMs: 120_000,
};

let policy: CommandPolicy = DEFAULT_POLICY;

/** 调整命令执行策略（传入部分字段，未传字段保持现状） */
export function configureCommandPolicy(overrides: Partial<CommandPolicy>): void {
  policy = { ...policy, ...overrides };
}

// 引号外必须整体拒绝的 shell 控制字符/运算符
const SHELL_METACHARS = /[;&|<>`\n]|\$\(|\|\|/;

// token 值内禁止出现的字符：引号会破坏重建命令行时的包裹，
// % 在 cmd.exe 的双引号内仍会发生变量展开，反引号在 POSIX shell 内是命令替换。
const FORBIDDEN_TOKEN_CHARS = /["'`%]/;
// Windows 重建命令行时需要双引号包裹的字符（空白与 cmd 元字符）
const CMD_SPECIALS = /[\s&|<>(){},^!;]/;

/** shell 风格分词：支持单/双引号，遇引号外元字符即抛错 */
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let hasToken = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else current += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      else if (ch === '\\' && i + 1 < command.length && command[i + 1] === '"') {
        current += '"';
        i++;
      } else current += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      hasToken = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      hasToken = true;
      continue;
    }
    if (SHELL_METACHARS.test(ch) || (ch === '$' && command[i + 1] === '(')) {
      throw new ToolError(`Shell metacharacter '${ch}' is not allowed in commands`);
    }
    if (/\s/.test(ch)) {
      if (hasToken || current.length > 0) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
      continue;
    }
    current += ch;
    hasToken = true;
  }
  if (inSingle || inDouble) throw new ToolError('Unbalanced quotes in command');
  if (hasToken || current.length > 0) tokens.push(current);
  return tokens;
}

function validateProgram(program: string): void {
  if (/[\\/:]/.test(program)) {
    throw new ToolError('Command program must be a bare name, not a path');
  }
  const allowed = policy.allowedPrograms.some((p) => p.toLowerCase() === program.toLowerCase());
  if (!allowed) {
    throw new ToolError(
      `Command program '${program}' is not in the allowed list ` +
        `(${policy.allowedPrograms.join(', ')}). Use configureCommandPolicy() to extend it.`,
    );
  }
}

/** token 值级校验：引号与 % 会破坏受控重建的命令行，一律拒绝 */
function validateTokenValues(tokens: string[]): void {
  for (const token of tokens) {
    if (FORBIDDEN_TOKEN_CHARS.test(token)) {
      throw new ToolError(
        `Command argument '${token}' contains a forbidden character ` +
          `("' \` %) that cannot be passed through the hardened execution path`,
      );
    }
  }
}

async function validateWorkdir(workdir?: string): Promise<Record<string, never> | { cwd: string }> {
  if (!workdir) return {};
  const absolute = resolve(workdir);
  if (policy.workdirRoot) {
    const root = resolve(policy.workdirRoot);
    const rootWithSep = root.endsWith('/') || root.endsWith('\\') ? root : root + '/';
    const inside =
      process.platform === 'win32'
        ? absolute.toLowerCase().startsWith(rootWithSep.toLowerCase())
        : absolute.startsWith(rootWithSep);
    if (!inside) {
      throw new ToolError(`workdir '${workdir}' is outside the allowed root ${root}`);
    }
  }
  const info = await stat(absolute).catch(() => null);
  if (!info?.isDirectory()) {
    throw new ToolError(`workdir '${workdir}' is not an existing directory`);
  }
  return { cwd: absolute };
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

interface ProcessResult {
  stdout: string;
  stderr: string;
}

/**
 * 无 shell 执行：
 * - POSIX：直接以 argv 数组 exec，参数不经任何 shell 解析；
 * - Windows：npm/npx 等是 .cmd 脚本，须借道 cmd.exe（/d 禁 autorun），
 *   命令行由已验证 token 重建，含特殊字符的参数以双引号包裹。
 */
function runProcess(program: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolvePromise, rejectPromise) => {
    const spawnArgs: string[] = args;
    let command = program;
    if (process.platform === 'win32') {
      const comspec = process.env.ComSpec ?? 'cmd.exe';
      const quoted = [program, ...args].map((a) => (CMD_SPECIALS.test(a) ? `"${a}"` : a));
      spawnArgs.unshift('/d', '/s', '/c', quoted.join(' '));
      command = comspec;
    }

    const child = spawn(command, spawnArgs, {
      cwd,
      shell: false,
      windowsHide: true,
    });

    let settled = false;
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > MAX_OUTPUT_BYTES) {
        child.kill();
        if (!settled) {
          settled = true;
          rejectPromise(new Error(`Command output exceeded ${MAX_OUTPUT_BYTES} bytes`));
        }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      errChunks.push(chunk);
      if (Buffer.concat(errChunks).length > MAX_OUTPUT_BYTES) {
        child.kill();
        if (!settled) {
          settled = true;
          rejectPromise(new Error(`Command stderr exceeded ${MAX_OUTPUT_BYTES} bytes`));
        }
      }
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (process.platform === 'win32' && child.pid) {
        // cmd.exe 的子进程不受 kill() 波及，需整树终止
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      } else {
        child.kill('SIGKILL');
      }
      rejectPromise(new Error(`Command timed out after ${policy.timeoutMs}ms`));
    }, policy.timeoutMs);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      const stdout = Buffer.concat(chunks).toString('utf8');
      const stderr = Buffer.concat(errChunks).toString('utf8');
      if (code !== 0) {
        rejectPromise(
          new Error(
            `Command exited with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`,
          ),
        );
      } else {
        resolvePromise({ stdout, stderr });
      }
    });
  });
}

export async function execute_command(command: string, workdir?: string): Promise<string> {
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new ToolError('Command must be a non-empty string');
  }

  const tokens = tokenizeCommand(command.trim());
  if (tokens.length === 0) throw new ToolError('Command must contain a program name');
  validateProgram(tokens[0]!);
  validateTokenValues(tokens);

  try {
    const { cwd } = await validateWorkdir(workdir);
    const { stdout, stderr } = await runProcess(tokens[0]!, tokens.slice(1), cwd);

    if (stderr) {
      logWarn('SystemTools', `Command stderr: ${stderr}`);
    }

    return stdout;
  } catch (error) {
    throw new ToolError(
      `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** 仅供测试/工具链复位默认策略 */
export function resetCommandPolicy(): void {
  policy = DEFAULT_POLICY;
}

/** 测试与文档用：当前策略（只读视图） */
export function getCommandPolicy(): Readonly<CommandPolicy> {
  return policy;
}

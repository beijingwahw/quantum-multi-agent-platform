import { logWarn } from '../utils/logger.js';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { stat } from 'fs/promises';
import { resolve } from 'path';
import { ToolError } from '../utils/errors.js';

/**
 * 命令执行策略：execute_command 的输入来自不可信任的调用方（DSH 工具面
 * 暴露在 WebSocket 控制台协议之后），原始实现把任意字符串直接交给 shell，
 * 构造上就是命令注入。这里在进入 shell 前加四道闸门：
 *
 * 1. 程序白名单——首 token（程序名）必须命中 allowlist。默认只含只读/
 *    构建类工具（tsc/git/ls/echo）：解释器（node/npx/tsx…）与包管理器
 *    （npm install 会执行依赖生命周期脚本）等价于任意代码执行，
 *    `-e`/`String.fromCharCode` 等单 token 载荷可绕过一切词法闸门，
 *    必须由宿主经 configureCommandPolicy 显式 opted-in。程序名本身
 *    禁止路径分隔符与扩展名伪装。
 * 2. 元字符拒绝——引号外的 shell 控制运算符（; & | < > ` $ 换行）一律拒绝，
 *    杜绝串联、管道、重定向、命令替换与子 shell 逃逸。
 * 3. token 级字符黑名单——任何参数 token 的值不得包含引号与 %（含反引号）。
 *    这使得执行侧无需依赖 shell 的引号语义：POSIX 直接以 argv 数组 exec
 *    （完全不经过 shell）；Windows 因 npm/npx 是 .cmd 脚本必须借道 cmd.exe，
 *    但重建的命令行里每个含空白/特殊字符的参数都被双引号包裹，而双引号内
 *    已经不存在任何 cmd 活跃元字符（" 与 % 被第 3 条规则禁止）。
 *    这修复了旧实现「按 POSIX 单引号语义解析、却把原文交回 cmd.exe」的
 *    跨平台引号错配（cmd 不认单引号，引号内的 & 仍会逃逸）。
 * 4. 内联代码/配置注入旗标拒绝——即便宿主把解释器加入白名单，`-e/--eval`
 *    类内联代码旗标仍然被无条件拒绝（见 INLINE_EXEC_FLAGS）：白名单宿主
 *    预期的是 `node script.js`，而非 `node -e <任意代码>`；git 的 `-c`
 *    同理（alias.`!<命令>` 等价于任意执行）。
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
  // 安全默认：仅只读/构建工具。node/npx/tsx/npm 等价于任意代码执行，
  // 需要时由宿主显式 configureCommandPolicy({ allowedPrograms: [...] })。
  allowedPrograms: ['tsc', 'git', 'ls', 'echo'],
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

/**
 * 能把「受控参数」升级成「任意代码执行」的旗标：即使宿主显式把程序加入
 * 白名单，这些旗标仍被无条件拒绝。
 * - 解释器的 -e/--eval/-c：直接运行任意字符串，词法闸门无法审计；
 * - git 的 -c/--config：config 可定义 `alias.x = "!<shell 命令>"`、
 *   core.pager/core.editor 等，等价于任意执行——argv 直 exec 绕不过它。
 * `--eval=<code>` 的等号形式与裸旗标语义相同，一并拒绝。
 */
const INLINE_EXEC_FLAGS: Record<string, readonly string[]> = {
  node: ['-e', '--eval', '-p', '--print', '-pe', '--experimental-repl'],
  deno: ['-e', '--eval'],
  bun: ['-e', '--eval'],
  tsx: ['-e', '--eval'],
  npx: ['-e', '--eval'],
  python: ['-c', '--command'],
  python3: ['-c', '--command'],
  perl: ['-e'],
  ruby: ['-e'],
  git: ['-c', '--config'],
};

function validateEvalFlags(program: string, args: readonly string[]): void {
  const banned = INLINE_EXEC_FLAGS[program.toLowerCase()];
  if (!banned) return;
  for (const arg of args) {
    if (banned.some((flag) => arg === flag || arg.startsWith(flag + '='))) {
      throw new ToolError(
        `Inline-code flag '${arg}' is not allowed for program '${program}' ` +
          `(it bypasses all command-line auditing). Put the code in a script file instead.`,
      );
    }
  }
}

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
function quoteForCmd(arg: string): string {
  if (!CMD_SPECIALS.test(arg)) return arg;
  // 结尾反斜杠会把收尾双引号转义出 cmd 解析，成对补齐
  const safe = arg.replace(/\\+$/, (m) => m + m);
  return `"${safe}"`;
}

/** Windows 下整树终止（cmd.exe 的孙进程不受 kill() 波及）；失败仅记录 */
function killProcessTree(pid: number): void {
  const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
  // 无 error 监听的 spawn 失败会以 uncaughtException 击穿整个进程
  killer.on('error', (err) => {
    logWarn('SystemTools', `taskkill failed for pid ${pid}:`, err);
  });
}

function runProcess(
  program: string,
  args: string[],
  cwd?: string,
  abortSignal?: AbortSignal,
): Promise<ProcessResult> {
  return new Promise<ProcessResult>((resolvePromise, rejectPromise) => {
    let command = program;
    let spawnArgs: string[] = [...args];
    if (process.platform === 'win32') {
      const comspec = process.env.ComSpec ?? 'cmd.exe';
      const quoted = [program, ...args].map(quoteForCmd);
      // /s + 外层引号是 cmd 的正规引用协议：cmd 剥掉首尾引号、原样保留
      // 内部引号；配合 windowsVerbatimArguments（禁止 Node 再包一层），
      // 含空白的参数边界由 quoteForCmd 完全掌控。
      // 注意 /c 载荷必须独占——unshift 到 args 前面会把参数重复传递
      // （旧实现的 Windows 命令行实际是 `... /c "payload" arg1 arg2`）。
      spawnArgs = ['/d', '/s', '/c', `"${quoted.join(' ')}"`];
      command = comspec;
    }

    const child = spawn(command, spawnArgs, {
      cwd,
      shell: false,
      windowsHide: true,
      // 引号语义由我们完全掌控：Node 默认会对含空格的 /c 载荷再包一层引号，
      // 破坏经审计重建的命令行（含空白参数被 cmd 二次拆分）。
      // verbatim 模式下命令行原样直达 cmd.exe，引号只来自 quoteForCmd。
      windowsVerbatimArguments: process.platform === 'win32',
    });

    // 工具调用语义下无人写 stdin：显式关闭，防止读取 stdin 的程序
    // 一直挂到超时（默认 stdio 三管道，stdin 管道保持打开）
    child.stdin.on('error', () => {
      /* EPIPE 等写入侧错误由 close 事件统一收尾 */
    });
    child.stdin.end();

    let settled = false;
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    // 运行字节计数：每个 data 事件只加长度，避免 Buffer.concat 的 O(n²) 拷贝
    let totalBytes = 0;
    let totalErrBytes = 0;

    child.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      totalBytes += chunk.length;
      if (totalBytes > MAX_OUTPUT_BYTES) {
        killProcessTreeOrSignal(child);
        if (!settled) {
          settled = true;
          rejectPromise(new Error(`Command output exceeded ${MAX_OUTPUT_BYTES} bytes`));
        }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      errChunks.push(chunk);
      totalErrBytes += chunk.length;
      if (totalErrBytes > MAX_OUTPUT_BYTES) {
        killProcessTreeOrSignal(child);
        if (!settled) {
          settled = true;
          rejectPromise(new Error(`Command stderr exceeded ${MAX_OUTPUT_BYTES} bytes`));
        }
      }
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killProcessTreeOrSignal(child);
      rejectPromise(new Error(`Command timed out after ${policy.timeoutMs}ms`));
    }, policy.timeoutMs);

    // 外部取消（02#18）：调用方（executor 的动作超时）经 AbortSignal
    // 请求中止——整树击杀与内部超时同一终止路径，race 返回后子进程
    // 不再滞留在飞。信号已触发时立即中止（监听器注册前的窗口）。
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killProcessTreeOrSignal(child);
      rejectPromise(
        abortSignal?.reason instanceof Error
          ? abortSignal.reason
          : new Error('Command aborted by caller'),
      );
    };
    if (abortSignal) {
      if (abortSignal.aborted) onAbort();
      else abortSignal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectPromise(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      // 正常收尾时摘除中止监听：abortSignal 常由调用方长期持有（executor
      // 逐动作创建例外，但契约上不承诺），挂着的监听器会拉长 child 生存期
      abortSignal?.removeEventListener('abort', onAbort);
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

/** 溢出/超时共用终止路径：Windows 整树杀，POSIX 直接 SIGKILL */
function killProcessTreeOrSignal(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    killProcessTree(child.pid);
  } else {
    child.kill('SIGKILL');
  }
}

/**
 * argv 形式的加固执行入口：参数边界由调用方保证（不经 shell 分词），
 * 适用于结构化携带参数数组的调用方（如 executor 的 command 动作）——
 * 字符串拼接回 shell 语法会破坏含空白/特殊字符的参数。
 */
export async function execute_command_argv(
  program: string,
  args: readonly string[],
  workdir?: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  if (typeof program !== 'string' || program.length === 0) {
    throw new ToolError('Command program must be a non-empty string');
  }
  const argList = args.map((a) => {
    if (typeof a !== 'string') {
      throw new ToolError('Command arguments must be strings');
    }
    return a;
  });

  validateProgram(program);
  validateTokenValues([program, ...argList]);
  validateEvalFlags(program, argList);

  try {
    const { cwd } = await validateWorkdir(workdir);
    const { stdout, stderr } = await runProcess(program, argList, cwd, abortSignal);

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

export async function execute_command(
  command: string,
  workdir?: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new ToolError('Command must be a non-empty string');
  }

  const tokens = tokenizeCommand(command.trim());
  if (tokens.length === 0) throw new ToolError('Command must contain a program name');

  return execute_command_argv(tokens[0]!, tokens.slice(1), workdir, abortSignal);
}

/** 仅供测试/工具链复位默认策略 */
export function resetCommandPolicy(): void {
  policy = DEFAULT_POLICY;
}

/** 测试与文档用：当前策略（只读视图） */
export function getCommandPolicy(): Readonly<CommandPolicy> {
  return policy;
}

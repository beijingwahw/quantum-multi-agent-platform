import { readFile, writeFile, stat, realpath, readlink } from 'fs/promises';
import { resolve, sep, dirname, basename, join } from 'path';
import { ToolError } from '../utils/errors.js';

/**
 * 文件系统沙箱：所有 read_file/write_file 路径都强制解析到该根目录内，
 * 阻止绝对路径与 `../` 逃逸导致的任意文件读写（DSH 工具面暴露在
 * WebSocket 控制台协议之后，不可信任调用方输入）。
 */
let sandboxRoot: string = process.cwd();

/** 收紧/调整沙箱根目录（仅接受已存在的目录路径） */
export async function setFsSandboxRoot(root: string): Promise<void> {
  const absolute = resolve(root);
  const info = await stat(absolute).catch(() => null);
  if (!info?.isDirectory()) {
    throw new ToolError(`Sandbox root '${root}' must be an existing directory`);
  }
  sandboxRoot = await realpath(absolute);
}

const MAX_LINK_DEPTH = 40;

/**
 * 解析真实路径：解引用路径上所有符号链接（含悬空链接——readlink 仍能
 * 得知其指向），realpath 失败时逐段回退。仅做词法前缀比对会被沙箱内
 * 指向沙箱外的符号链接绕过，因此校验必须在真实路径上进行。
 */
async function resolveReal(pathStr: string): Promise<string> {
  let current = pathStr;
  for (let depth = 0; depth < MAX_LINK_DEPTH; depth++) {
    const real = await realpath(current).catch(() => null);
    if (real !== null) return real;
    const parent = dirname(current);
    if (parent === current) return current;
    const candidate = join(await resolveReal(parent), basename(current));
    const link = await readlink(candidate).catch(() => null);
    if (link === null) return candidate;
    current = resolve(dirname(candidate), link);
  }
  return current;
}

/**
 * 解析路径并校验未逃出沙箱；返回真实绝对路径。
 * 返回 real（而非调用方拼写）至关重要：校验与实际读写之间若路径组件
 * 被换成指向沙箱外的符号链接（TOCTOU），使用原拼写即从窗户逃逸；
 * 使用已解析的 real 路径读写，操作系统不再跟随任何链接。
 */
async function resolveWithinSandbox(path: string): Promise<string> {
  const absolute = resolve(sandboxRoot, path);
  const real = await resolveReal(absolute);
  const rootWithSep = sandboxRoot.endsWith(sep) ? sandboxRoot : sandboxRoot + sep;
  const isInside =
    process.platform === 'win32'
      ? real.toLowerCase().startsWith(rootWithSep.toLowerCase())
      : real.startsWith(rootWithSep);
  if (!isInside && real !== sandboxRoot) {
    throw new ToolError(`Path '${path}' escapes the filesystem sandbox (root: ${sandboxRoot})`);
  }
  return real;
}

export async function read_file(path: string): Promise<string> {
  const safePath = await resolveWithinSandbox(path);
  try {
    return await readFile(safePath, 'utf-8');
  } catch (error) {
    throw new ToolError(
      `Failed to read file ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function write_file(path: string, content: string): Promise<boolean> {
  const safePath = await resolveWithinSandbox(path);
  try {
    await writeFile(safePath, content, 'utf-8');
    return true;
  } catch (error) {
    throw new ToolError(
      `Failed to write file ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

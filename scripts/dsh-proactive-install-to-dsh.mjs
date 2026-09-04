#!/usr/bin/env node
/**
 * install-to-dsh.mjs — dsh-proactive 自动化安装到 DeepSeek Harness 官方插件目录
 *
 * 【落地位置】把本文件复制到：<dsh-proactive 仓库>/scripts/install-to-dsh.mjs
 * （同目录请保留 uninstall-from-dsh.mjs / 已有 scripts/ 内容）
 *
 * 触发方式（任一即可）：
 *   1. 独立 CLI：node scripts/install-to-dsh.mjs               # 安装
 *                   node scripts/install-to-dsh.mjs uninstall # 卸载
 *                   node scripts/install-to-dsh.mjs list       # 查状态
 *                   --dry-run                                  # 只打印不真改
 *                   --dsh-home <path>                          # 覆盖 DSH_HOME
 *                   --profiles web,headless                    # 限定 profile
 *   2. postinstall：npm/pnpm 在 install 时自动调用（已在 package.json 配）
 *
 * 工作流程：
 *   识别 DSH_HOME → 扫描 profiles/* → 备份 manifest →
 *   把 dsh-proactive 写入 dsh.profile.bundles + dependencies →
 *   在 profile 目录跑 pnpm install → 打印结果。
 *
 * 边界：
 *   - 仅修改 $DSH_HOME/profiles/<profile>/ 下的文件（DSH 自己管理的区域）
 *   - 不修改 dsh-proactive 包本身
 *   - postinstall 在 CI/无 DSH 环境下静默跳过
 *   - 同 profile 已安装则幂等跳过
 */

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve, dirname, delimiter as PATH_DELIM } from 'node:path';
import { homedir, platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = resolve(__dirname, '..');
const PLUGIN_NAME = 'dsh-proactive';
const PLUGIN_VERSION = readJSON(join(PLUGIN_ROOT, 'package.json'))?.version ?? '0.0.0';

// ─── 常量 ────────────────────────────────────────────────────────────────
const DEFAULT_PROFILES = ['web', 'headless'];
const IS_WIN = platform === 'win32';

// 子进程必须保留的环境变量白名单
const SAFE_ENV_KEYS = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'TMP',
  'TEMP',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'NODE_ENV',
  'NODE_PATH',
  'npm_config_*',
  'npm_lifecycle_event',
  'npm_lifecycle_script',
  'PNPM_HOME',
  'pnpm_config_*',
  'DSH_HOME',
  'SHELL',
];

// ─── 颜色 ────────────────────────────────────────────────────────────────
// isTTY===true 才启用 ANSI：管道/重定向（undefined）下两平台都不应输出转义序列
const useColor = process.stdout.isTTY === true;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const ok = (s) => c('32', s);
const warn = (s) => c('33', s);
const err = (s) => c('31', s);
const info = (s) => c('36', s);
const dim = (s) => c('2', s);

// ─── 工具 ────────────────────────────────────────────────────────────────
function readJSON(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = { cmd: 'install', dryRun: false, dshHome: null, profiles: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'install' || a === 'uninstall' || a === 'list') out.cmd = a;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--dsh-home') {
      const v = argv[++i];
      if (!v) throw new Error('--dsh-home requires a value');
      out.dshHome = v;
    } else if (a.startsWith('--dsh-home=')) out.dshHome = a.slice('--dsh-home='.length);
    else if (a === '--profiles') {
      const v = argv[++i];
      if (!v) throw new Error('--profiles requires a comma-separated value');
      out.profiles = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('--profiles=')) {
      out.profiles = a
        .slice('--profiles='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a === '--postinstall') out.isPostinstall = true;
    else if (a === '--help' || a === '-h') out.cmd = 'help';
  }
  return out;
}

function printHelp() {
  console.log(`Usage: dsh-proactive-install [install|uninstall|list] [options]

Options:
  --dsh-home <path>   Override DSH_HOME (default: auto-detect)
  --profiles a,b      Limit to specific profiles (default: ${DEFAULT_PROFILES.join(', ')})
  --dry-run           Show what would change without writing
  --postinstall       Internal flag, set by package.json scripts.postinstall

Auto-detect order for DSH_HOME:
  1. --dsh-home <path>
  2. $DSH_HOME env var
  3. Read from dsh.cmd on PATH (Windows)
  4. ~/Library/Application Support/dsh (macOS), ~/.config/dsh or ~/.dsh (Linux),
     %APPDATA%/dsh or %LOCALAPPDATA%/dsh (Windows)
  5. Scan: C:\\, D:\\, E:\\ for DeepSeekHarness\\data\\profiles
`);
}

// ─── DSH_HOME 识别 ───────────────────────────────────────────────────────
async function detectDshHome() {
  // 1. 环境变量
  if (process.env.DSH_HOME && existsSync(join(process.env.DSH_HOME, 'profiles'))) {
    return { path: process.env.DSH_HOME, source: '$DSH_HOME' };
  }

  // 2. Windows: 从 PATH 中找 dsh.cmd 并解析 DSH_HOME
  if (IS_WIN) {
    const fromCmd = await readDshHomeFromCmd();
    if (fromCmd) return { path: fromCmd, source: 'dsh.cmd' };
  }

  // 3. 平台默认配置目录
  const candidates = platformHomeCandidates();
  for (const dir of candidates) {
    if (existsSync(join(dir, 'profiles'))) {
      return { path: dir, source: `platform default (${dir})` };
    }
  }

  // 4. 扫描常见安装位置
  const roots = IS_WIN
    ? ['C:\\', 'D:\\', 'E:\\', 'F:\\', join(homedir(), 'AppData', 'Local')]
    : ['/opt', '/usr/local', join(homedir(), 'Applications')];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const guesses = IS_WIN
      ? [join(root, 'DeepSeekHarness'), join(root, 'dsh')]
      : [join(root, 'deepseek-harness'), join(root, 'dsh')];
    for (const guess of guesses) {
      if (existsSync(join(guess, 'data', 'profiles'))) {
        return { path: join(guess, 'data'), source: 'scan' };
      }
      if (existsSync(join(guess, 'profiles'))) {
        return { path: guess, source: 'scan' };
      }
    }
  }

  return null;
}

async function readDshHomeFromCmd() {
  const pathEnv = process.env.PATH || process.env.Path || '';
  const exts = (process.env.PATHEXT || '.CMD;.EXE;.BAT;.COM').split(';');
  for (const dir of pathEnv.split(PATH_DELIM)) {
    if (!dir) continue;
    for (const ext of exts) {
      const cmdPath = join(dir, `dsh${ext.toLowerCase()}`);
      if (!existsSync(cmdPath)) continue;
      try {
        const content = await readFile(cmdPath, 'utf8');
        const m = content.match(/set\s+["']?DSH_HOME=["']?([^\s"']+)/i);
        if (m) {
          const candidate = m[1];
          if (existsSync(join(candidate, 'profiles'))) return candidate;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function platformHomeCandidates() {
  if (IS_WIN) {
    const out = [];
    if (process.env.APPDATA) out.push(join(process.env.APPDATA, 'dsh'));
    if (process.env.LOCALAPPDATA) out.push(join(process.env.LOCALAPPDATA, 'dsh'));
    out.push(join(homedir(), '.dsh'));
    out.push(join(homedir(), 'AppData', 'Roaming', 'dsh'));
    return out;
  }
  if (platform === 'darwin') {
    return [join(homedir(), 'Library', 'Application Support', 'dsh'), join(homedir(), '.dsh')];
  }
  return [join(homedir(), '.config', 'dsh'), join(homedir(), '.dsh')];
}

// ─── Profile 处理 ────────────────────────────────────────────────────────
async function discoverProfiles(dshHome) {
  const profilesDir = join(dshHome, 'profiles');
  if (!existsSync(profilesDir)) return [];
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(profilesDir, { withFileTypes: true });
  const profiles = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(profilesDir, entry.name);
    if (entry.name === 'node_modules') continue;
    const manifestPath = join(dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    profiles.push({ name: entry.name, dir, manifestPath });
  }
  return profiles;
}

function isInstalledInManifest(manifest) {
  const deps = manifest.dependencies || {};
  if (deps[PLUGIN_NAME]) return true;
  const bundles = manifest.dsh?.profile?.bundles || [];
  return bundles.includes(PLUGIN_NAME);
}

function recordVersion(manifest, version) {
  manifest.dsh = manifest.dsh || {};
  manifest.dsh.plugin = manifest.dsh.plugin || {};
  manifest.dsh.plugin[PLUGIN_NAME] = {
    installed: true,
    version,
    installedAt: new Date().toISOString(),
    method: 'install-to-dsh.mjs',
  };
}

function clearVersion(manifest) {
  if (manifest.dsh?.plugin?.[PLUGIN_NAME]) {
    delete manifest.dsh.plugin[PLUGIN_NAME];
    if (Object.keys(manifest.dsh.plugin).length === 0) delete manifest.dsh.plugin;
    if (Object.keys(manifest.dsh).length === 0) delete manifest.dsh;
  }
}

function buildPnpmDepSpec(pluginRoot) {
  let abs = resolve(pluginRoot);
  if (IS_WIN) abs = abs.replace(/\\/g, '/');
  // 仅 POSIX 需要前导 '/'；Windows 盘符路径（D:/...）再补 '/' 会产生
  // file:/D:/... ——任何按 Node path 语义解析的消费方都会指向不存在的目录
  if (!IS_WIN && !abs.startsWith('/')) abs = '/' + abs;
  return `file:${abs}`;
}

function applyInstallEdits(manifest, pluginRoot) {
  manifest.dependencies = manifest.dependencies || {};
  manifest.dependencies[PLUGIN_NAME] = buildPnpmDepSpec(pluginRoot);

  manifest.dsh = manifest.dsh || {};
  manifest.dsh.profile = manifest.dsh.profile || {};
  manifest.dsh.profile.bundles = manifest.dsh.profile.bundles || [];
  if (!manifest.dsh.profile.bundles.includes(PLUGIN_NAME)) {
    manifest.dsh.profile.bundles.push(PLUGIN_NAME);
  }

  recordVersion(manifest, PLUGIN_VERSION);
}

function applyUninstallEdits(manifest) {
  if (manifest.dependencies && PLUGIN_NAME in manifest.dependencies) {
    delete manifest.dependencies[PLUGIN_NAME];
    if (Object.keys(manifest.dependencies).length === 0) delete manifest.dependencies;
  }
  if (manifest.dsh?.profile?.bundles) {
    const idx = manifest.dsh.profile.bundles.indexOf(PLUGIN_NAME);
    if (idx >= 0) manifest.dsh.profile.bundles.splice(idx, 1);
    if (manifest.dsh.profile.bundles.length === 0) delete manifest.dsh.profile.bundles;
    if (Object.keys(manifest.dsh.profile).length === 0) delete manifest.dsh.profile;
    if (Object.keys(manifest.dsh).length === 0) delete manifest.dsh;
  }
  clearVersion(manifest);
}

async function backupIfFirst(manifestPath) {
  const bak = manifestPath + '.bak';
  if (existsSync(bak)) return false;
  await copyFile(manifestPath, bak);
  return true;
}

// ─── 子进程 (pnpm) ───────────────────────────────────────────────────────
function pickSafeEnv() {
  const env = {};
  for (const key of Object.keys(process.env)) {
    if (
      SAFE_ENV_KEYS.some((pattern) => {
        if (pattern.endsWith('*')) return key.startsWith(pattern.slice(0, -1));
        return key === pattern;
      })
    )
      env[key] = process.env[key];
  }
  return env;
}

function findPnpmBin() {
  if (process.env.PNPM_HOME && existsSync(process.env.PNPM_HOME)) {
    const candidate = join(process.env.PNPM_HOME, IS_WIN ? 'pnpm.cmd' : 'pnpm');
    if (existsSync(candidate)) return candidate;
  }
  return IS_WIN ? 'pnpm.cmd' : 'pnpm';
}

async function runPnpm(cwd, args) {
  const bin = findPnpmBin();
  return new Promise((resolveP, rejectP) => {
    // Windows 上 pnpm 是 .cmd 脚本：Node >= 18.20 对 shell:false 的 .cmd
    // spawn 直接抛 EINVAL（CVE-2024-27980 缓解）。借道 cmd.exe（/d 禁
    // autorun、/s+外层引号的正规引用协议、verbatim 禁止 Node 二次包裹），
    // 含空格/特殊字符的参数逐个加引号
    let command = bin;
    let spawnArgs = [...args];
    if (IS_WIN) {
      const specials = /[\s&|<>(){},^!;]/;
      const quoted = [bin, ...args].map((a) =>
        specials.test(a) ? '"' + a.replace(/\\+$/, (m) => m + m) + '"' : a,
      );
      command = process.env.ComSpec ?? 'cmd.exe';
      spawnArgs = ['/d', '/s', '/c', '"' + quoted.join(' ') + '"'];
    }
    const child = spawn(command, spawnArgs, {
      cwd,
      env: pickSafeEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...(IS_WIN ? { windowsVerbatimArguments: true } : {}),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', rejectP);
    child.on('close', (code) => resolveP({ code, stdout, stderr }));
  });
}

// ─── 主流程 ─────────────────────────────────────────────────────────────
async function installToDsh(options = {}) {
  const opts = {
    cmd: 'install',
    dryRun: false,
    dshHome: null,
    profiles: null,
    isPostinstall: false,
    ...options,
  };

  const home = opts.dshHome ? { path: opts.dshHome, source: '--dsh-home' } : await detectDshHome();

  if (!home) {
    if (opts.isPostinstall || process.env.CI) {
      console.warn(dim(`[dsh-proactive] no DSH install detected, skipping auto-install`));
      console.warn(
        dim(`[dsh-proactive] run \`dsh-proactive-install\` manually after configuring DSH_HOME`),
      );
      return { skipped: true };
    }
    throw new Error(
      'DSH install not found. Set DSH_HOME environment variable, or pass --dsh-home <path>.',
    );
  }
  console.log(info(`[dsh-proactive] DSH_HOME = ${home.path} (source: ${home.source})`));

  const allProfiles = await discoverProfiles(home.path);
  if (allProfiles.length === 0) {
    throw new Error(`No profiles found under ${home.path}/profiles`);
  }
  const targets = opts.profiles
    ? allProfiles.filter((p) => opts.profiles.includes(p.name))
    : allProfiles.filter((p) => DEFAULT_PROFILES.includes(p.name));

  if (targets.length === 0) {
    console.warn(
      warn(
        `[dsh-proactive] No target profiles matched. Available: ${allProfiles.map((p) => p.name).join(', ')}`,
      ),
    );
    return { skipped: true, reason: 'no matching profiles' };
  }
  console.log(info(`[dsh-proactive] target profiles: ${targets.map((p) => p.name).join(', ')}`));

  const results = [];
  for (const profile of targets) {
    results.push(await processProfile(profile, opts));
  }
  return { home, results };
}

async function processProfile(profile, opts) {
  const manifest = readJSON(profile.manifestPath);
  if (!manifest) {
    console.warn(warn(`[${profile.name}] manifest unreadable, skipping`));
    return { profile: profile.name, skipped: true };
  }

  const wasInstalled = isInstalledInManifest(manifest);
  if (opts.cmd === 'install' && wasInstalled) {
    console.log(dim(`[${profile.name}] already installed, skipping (idempotent)`));
    return { profile: profile.name, skipped: true, reason: 'already installed' };
  }
  if (opts.cmd === 'uninstall' && !wasInstalled) {
    console.log(dim(`[${profile.name}] not installed, skipping`));
    return { profile: profile.name, skipped: true, reason: 'not installed' };
  }

  if (!opts.dryRun) await backupIfFirst(profile.manifestPath);

  const before = JSON.stringify(manifest, null, 2) + '\n';
  const draft = JSON.parse(before);
  if (opts.cmd === 'install') applyInstallEdits(draft, PLUGIN_ROOT);
  else applyUninstallEdits(draft);
  const after = JSON.stringify(draft, null, 2) + '\n';

  if (before === after) {
    console.log(dim(`[${profile.name}] no manifest change needed`));
    return { profile: profile.name, skipped: true, reason: 'no change' };
  }

  if (opts.dryRun) {
    console.log(info(`[${profile.name}] (dry-run) manifest diff:`));
    console.log(dim('--- before ---'));
    console.log(dim(before));
    console.log(dim('--- after ---'));
    console.log(dim(after));
    return { profile: profile.name, dryRun: true };
  }

  // 顺序按方向区分：
  // - install：先写 manifest（加入 file: 依赖与 bundle 声明），pnpm install 落地依赖；
  // - uninstall：先 pnpm remove（它自己会同步改写 manifest 的 dependencies），
  //   成功后再套用我们的补充清理（plugin 块/bundle/版本标记）。若先删依赖再
  //   remove，pnpm 会以 ERR_PNPM_CANNOT_REMOVE_MISSING_PACKAGE 失败，
  //   留下半应用的卸载（manifest 已改、包还在）。
  if (opts.cmd === 'install') {
    await writeFile(profile.manifestPath, after, 'utf8');
    console.log(ok(`[${profile.name}] manifest updated`));

    const args = ['install', '--prefer-offline'];
    console.log(info(`[${profile.name}] running pnpm ${args.join(' ')} ...`));
    const { code, stdout, stderr } = await runPnpm(profile.dir, args);
    if (code !== 0) {
      console.error(err(`[${profile.name}] pnpm ${opts.cmd} failed (exit ${code})`));
      if (stderr) console.error(dim(stderr));
      if (stdout) console.error(dim(stdout));
      return { profile: profile.name, failed: true, code };
    }
    console.log(ok(`[${profile.name}] pnpm ${opts.cmd} succeeded`));
    return { profile: profile.name, ok: true };
  }

  // uninstall 路径
  const removeArgs = ['remove', PLUGIN_NAME];
  console.log(info(`[${profile.name}] running pnpm ${removeArgs.join(' ')} ...`));
  const rm = await runPnpm(profile.dir, removeArgs);
  if (rm.code !== 0) {
    console.error(err(`[${profile.name}] pnpm ${opts.cmd} failed (exit ${rm.code})`));
    if (rm.stderr) console.error(dim(rm.stderr));
    if (rm.stdout) console.error(dim(rm.stdout));
    return { profile: profile.name, failed: true, code: rm.code };
  }
  // pnpm 已自行改写 manifest：在磁盘最新内容上做补充清理（避免覆盖
  // pnpm 的并发改动），版本标记与 bundle 声明按 after 的清理意图重放
  const fresh = readJSON(profile.manifestPath) ?? draft;
  applyUninstallEdits(fresh);
  await writeFile(profile.manifestPath, JSON.stringify(fresh, null, 2) + '\n', 'utf8');
  console.log(ok(`[${profile.name}] manifest cleaned`));
  return { profile: profile.name, ok: true };
}

async function listStatus(options = {}) {
  const opts = { dryRun: false, dshHome: null, ...options };
  const home = opts.dshHome ? { path: opts.dshHome, source: '--dsh-home' } : await detectDshHome();
  if (!home) {
    console.warn(warn('DSH install not found.'));
    return;
  }
  console.log(info(`DSH_HOME = ${home.path} (${home.source})`));
  const profiles = await discoverProfiles(home.path);
  if (profiles.length === 0) {
    console.log(dim('No profiles discovered.'));
    return;
  }
  for (const profile of profiles) {
    const manifest = readJSON(profile.manifestPath);
    const installed = manifest && isInstalledInManifest(manifest);
    const version = manifest?.dsh?.plugin?.[PLUGIN_NAME]?.version ?? '(unknown)';
    const marker = installed ? ok('✓ installed') : dim('  not installed');
    console.log(`  ${profile.name.padEnd(12)} ${marker}  ${dim(installed ? `v${version}` : '')}`);
  }
}

// ─── CLI 入口 ────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.cmd === 'help') {
    printHelp();
    return;
  }

  try {
    if (opts.cmd === 'list') {
      await listStatus(opts);
      return;
    }
    const result = await installToDsh(opts);
    if (result?.results?.some((r) => r.failed)) {
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(err(`[dsh-proactive] ${e.message}`));
    if (!opts.isPostinstall) process.exit(1);
  }
}

// ─── 导出 ────────────────────────────────────────────────────────────────
export {
  applyInstallEdits,
  applyUninstallEdits,
  backupIfFirst,
  buildPnpmDepSpec,
  detectDshHome,
  discoverProfiles,
  installToDsh,
  isInstalledInManifest,
  listStatus,
  PLUGIN_NAME,
  PLUGIN_ROOT,
  PLUGIN_VERSION,
};

// ─── 直接执行入口 ────────────────────────────────────────────────────────
// 入口判定用 URL 规范比较（06#19）：endsWith 匹配文件名，改名即静默失效
const isEntry =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
// postinstall 触发同样要求本文件是入口：仅被 import（如测试）时即使处于
// 任意 npm 生命周期也不得对用户的 DSH profiles 做真实写入
const invokedDirectly = isEntry && process.env.npm_lifecycle_event !== undefined;
if (invokedDirectly) {
  if (process.env.npm_lifecycle_event === 'postinstall') {
    const opts = parseArgs(process.argv.slice(2));
    opts.isPostinstall = true;
    await installToDsh(opts).catch(() => {
      /* swallow in postinstall */
    });
  } else {
    await main();
  }
}

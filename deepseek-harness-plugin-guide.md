# DeepSeek Harness 插件开发指南与最佳安装方式分析

## 📚 开发指南核心要点

### 1. 插件架构基础

DeepSeek Harness 基于 **Cordis 框架**，采用"一切皆插件"的设计理念：

```
DeepSeek Harness (dsh)
├── Core Framework (@deepseek-ai/cordis)
├── Plugin System (Cordis ≥ 4.0)
└── Profile System (web/headless/custom)
```

#### 关键概念

- **Bundle（包）**: 插件的基本单位，一个插件可能包含多个子插件
- **Profile（配置档案）**: 独立的运行环境（web/headless），每个 profile 有自己的 package.json 和依赖
- **Cordis Fiber**: 插件实例的生命周期单元
- **Service（服务）**: 依赖注入系统的基本单元

### 2. 插件结构规范

#### 标准 package.json 结构

```json
{
  "name": "your-plugin-name",
  "version": "1.0.0",
  "type": "module",
  "main": "lib/index.js",           // 或 "dist/index.mjs"
  "types": "lib/index.d.ts",       // 类型声明文件
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.js"
    }
  },
  "files": [
    "lib/**/*.js",
    "lib/**/*.d.ts",
    "cordis.patch.yml",            // bundle 配置文件
    "README.md"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

#### Cordis Patch 配置文件

```yaml
# cordis.patch.yml
services:
  # 服务声明
  yourService:
    plugin: your-plugin-name

config:
  # 配置选项
  yourPlugin:
    enabled: true
    someOption: "default value"
```

### 3. 插件入口函数

```typescript
// index.ts
import { Context } from '@deepseek-ai/cordis';

export interface Config {
  enabled: boolean;
  someOption: string;
}

export interface Provider {
  yourService: YourService;
}

export const name = 'your-plugin-name';

export function apply(ctx: Context, config: Config): Provider {
  // 服务实现
  const yourService = new YourService(config);

  // 依赖注入
  ctx.provide('yourService', yourService);

  // 生命周期管理
  ctx.effect(() => {
    // 初始化
    return () => {
      // 清理
    };
  });

  return {
    yourService
  };
}
```

### 4. Type 增强

```typescript
// 在插件的类型声明文件中
declare module '@deepseek-ai/cordis' {
  interface Context {
    yourService: YourService;
  }
}
```

## 🔧 插件安装方式对比分析

### 方式一：GitHub 直接安装

```bash
dsh plugin add github:username/plugin-name --profile web
```

#### 优点
- ✅ 开发友好，无需发布到 npm
- ✅ 用户可获取最新代码
- ✅ 便于开源协作和反馈

#### 缺点
- ❌ **构建脚本的坎**: pnpm ≥ 10 默认不运行 git 依赖的 prepare 脚本
- ❌ 需要用户手动授权构建权限（安全风险）
- ❌ 拉取的是源码，不是构建产物
- ❌ 安装失败率较高（依赖构建环境）

#### 技术细节

**为什么需要构建权限？**

```yaml
# 用户需要在 profile 的 pnpm-workspace.yaml 中添加：
allowBuilds:
  your-plugin-name: true  # 允许该包在安装时执行构建脚本
```

**安全风险**:
- 允许该包的代码在用户机器上执行任意脚本
- 不在 agent 运行的沙箱保护内
- 需要锁定 commit SHA 确保代码不可变

### 方式二：NPM 发布安装

```bash
dsh plugin add plugin-name --profile web
```

#### 优点
- ✅ **生产环境最佳实践**: 无需构建权限
- ✅ 安装简单，用户体验好
- ✅ 依赖关系清晰
- ✅ 版本管理规范（semver）
- ✅ 自动处理传递依赖

#### 缺点
- ❌ 需要发布到公共 npm 注册表（或私有注册表）
- ❌ 发布流程增加开发负担
- ❌ 无法实时获取最新修复（需要发布新版本）

#### 实施要求

```json
// package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepublishOnly": "pnpm run build"  // 发布前自动构建
  },
  "files": [
    "lib/**/*.js",
    "lib/**/*.d.ts",
    "cordis.patch.yml",
    "README.md"
  ]
}
```

### 方式三：本地 Tarball 安装

```bash
# 开发者打包
pnpm pack  # 生成 plugin-name-1.0.0.tgz

# 用户安装
dsh plugin add ./plugin-name-1.0.0.tgz --profile web
```

#### 优点
- ✅ **构建产物分发**: 无需用户构建
- ✅ 版本控制精确（包含 commit SHA）
- ✅ 适合私有分发和企业场景
- ✅ 无需构建权限

#### 缺点
- ❌ 手动分发，不够自动化
- ❌ 用户需要先下载 tarball
- ❌ 更新不够便捷

#### 最佳实践

```bash
# 创建发布脚本
#!/bin/bash
# scripts/publish.sh

pnpm install
pnpm run build
pnpm pack

# 重命名包含版本和 commit SHA
COMMIT_SHA=$(git rev-parse --short HEAD)
VERSION=$(node -p "require('./package.json').version")
mv *.tgz "dist/${NAME}-${VERSION}-${COMMIT_SHA}.tgz"

echo "发布包: dist/${NAME}-${VERSION}-${COMMIT_SHA}.tgz"
```

### 方式四：自动化安装脚本（进阶）

参考 `dsh-proactive` 的 `install-to-dsh.mjs` 方案：

```javascript
// scripts/install-to-dsh.mjs
#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

async function detectDshHome() {
  // 自动检测 DSH_HOME
  // 1. 环境变量 $DSH_HOME
  // 2. Windows: 从 PATH 中的 dsh.cmd 解析
  // 3. 平台默认配置目录
  // 4. 扫描常见安装位置
}

async function discoverProfiles(dshHome) {
  // 扫描所有可用的 profiles
  // web, headless, custom...
}

async function installToProfile(profilePath) {
  // 1. 读取 profile 的 package.json
  // 2. 添加插件到 dependencies 和 bundles
  // 3. 运行 pnpm install
  // 4. 验证安装结果
}

async function main() {
  const dshHome = await detectDshHome();
  const profiles = await discoverProfiles(dshHome);

  for (const profile of profiles) {
    await installToProfile(profile);
  }
}

main().catch(console.error);
```

在 `package.json` 中配置：

```json
{
  "scripts": {
    "postinstall": "node scripts/install-to-dsh.mjs"
  }
}
```

## 🏆 最佳安装方式推荐

### 根据场景选择

#### 1. **开源插件（推荐用户安装）**

**首选方式**: NPM 发布 + tarball 备选

```bash
# 方式A: NPM 安装（推荐）
dsh plugin add plugin-name --profile web

# 方式B: GitHub 安装（需用户授权构建）
dsh plugin add github:username/plugin-name --profile web
# 用户需要手动在 pnpm-workspace.yaml 中添加 allowBuilds
```

**理由**:
- NPM 安装零摩擦，无需用户理解构建权限概念
- 如果 npm 包不可用，回退到 GitHub 方式但提供清晰文档
- tarball 方式作为企业私有分发的备选

#### 2. **企业内部插件**

**推荐方式**: 私有 npm 注册表 + 本地 tarball

```bash
# 内部 npm
dsh plugin add @your-company/plugin-name --profile web

# 或私有 tarball
dsh plugin add ./plugin-name-1.0.0-company.tgz --profile web
```

**理由**:
- 私有 npm 注册表提供类似公共 npm 的体验
- tarball 方式适合严格的内网环境

#### 3. **开发调试**

**推荐方式**: 本地路径 + HMR

```bash
# 本地路径安装（开发中）
dsh plugin add /path/to/plugin --profile web

# 使用 HMR 热更新（需要 Node ≥ 24.11）
npm run dev
```

**理由**:
- 本地路径指向当前工作目录，修改立即生效
- HMR 提供快速迭代体验

### 🎯 终极最佳实践：混合策略

**开发者侧**:
1. 发布构建产物到 npm
2. 同时提供 GitHub 源码作为备选
3. 提供 tarball 下载链接（Release 附带）

**用户侧**:
1. 优先尝试 `dsh plugin add plugin-name`（npm）
2. 失败时尝试 `dsh plugin add github:user/repo#<sha>`（GitHub，指定 commit）
3. 手动下载 tarball 作为最后选择

**安装脚本自动化**:
```javascript
// scripts/detect-and-install.mjs
async function smartInstall() {
  try {
    // 1. 尝试 npm
    await exec('dsh plugin add plugin-name --profile web');
  } catch {
    try {
      // 2. 尝试 GitHub（固定 commit）
      await exec(`dsh plugin add github:user/repo#${FIXED_COMMIT} --profile web`);
    } catch {
      // 3. 提示用户手动安装 tarball
      console.log('请手动下载并安装: https://releases/...');
    }
  }
}
```

## 📋 开发者检查清单

### 发布前检查

- [ ] `package.json` 包含正确的 `main`, `types`, `exports`
- [ ] `files` 字段包含所有必要文件（构建产物、配置文件）
- [ ] `dsh.bundle.patch` 指向正确的配置文件
- [ ] `prepublishOnly` 脚本确保发布前构建
- [ ] README 包含清晰的安装说明
- [ ] 所有依赖版本锁定或指定范围
- [ ] 提供最小可用示例

### 构建产物验证

```bash
# 构建测试
pnpm run build

# 验证输出
ls -la lib/  # 或 dist/

# 测试本地安装
dsh plugin add . --profile test
dsh --profile test web  # 验证加载
```

### 跨环境兼容性

- [ ] Node.js 版本兼容性（建议支持 Node 22+）
- [ ] TypeScript 版本兼容性
- [ ] Cordis 版本兼容性
- [ ] 操作系统兼容性（Windows/Linux/macOS）

## 🔐 安全最佳实践

### GitHub 安装的安全建议

1. **始终锁定 commit SHA**:
   ```bash
   dsh plugin add github:user/repo#abc123def456 --profile web
   ```

2. **提供构建权限说明**:
   ```markdown
   如果使用 GitHub 安装，需要在 `~/.dsh/profiles/web/pnpm-workspace.yaml` 中添加：
   ```yaml
   allowBuilds:
     your-plugin-name: true
   ```
   ```

3. **签名验证**（可选）:
   ```javascript
   // 在安装脚本中验证签名
   const signature = await verifySignature(packageJson, gpgSignature);
   ```

### NPM 包的安全建议

1. **启用双因素认证**
2. **使用 npm provenance**（npm 包来源证明）
3. **定期审计依赖**:
   ```bash
   npm audit
   pnpm audit
   ```

## 🚀 未来趋势

### 1. 构建产物分发标准化

类似 Python wheels，Node.js 生态也在推动预构建产物的标准化分发，这将解决"构建脚本的坎"问题。

### 2. 安全沙箱执行

pnpm 的 `allowBuilds` 机制是第一步，未来可能提供更细粒度的权限控制和沙箱隔离。

### 3. 插件市场

DSH 可能发展出自己的插件市场，提供更好的发现、安装和更新体验。

---

## 总结

**最佳安装方式**的排序：

1. **生产环境**: NPM 发布安装 > 本地 tarball > GitHub（锁定 commit）
2. **开发环境**: 本地路径 + HMR > NPM 安装
3. **企业环境**: 私有 npm 注册表 > 内部 tarball 分发

**关键原则**:
- 优先减少用户操作复杂度
- 提供多种安装方式作为备选
- 始终关注安全和可追溯性
- 自动化检测和回退机制

记住：**用户体验 > 开发便利性**。多一种安装方式意味着多一份选择，但也意味着多一份维护成本。根据目标用户群体选择最合适的策略。
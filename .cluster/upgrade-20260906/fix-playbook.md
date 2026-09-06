# 严格模式修复纪律手册（2026-09-06 前沿升级）

本手册是所有修复代理的唯一纪律源。目标：在 `noUncheckedIndexedAccess`、
`verbatimModuleSyntax`、`noUncheckedSideEffectImports` 三开关下实现
**零类型错误、全部测试绿、零行为回归、零热路径性能回退**。

## 硬门禁（缺一不可）

1. `npx tsc --noEmit -p tsconfig.typecheck.json` → **0 errors**
2. `npm test` → **全部通过**（不得修改测试的期望值来让测试通过）
3. 不改 tsconfig 编译选项（三开关必须保持开启）
4. 禁止：`as any`、`@ts-ignore`、`@ts-expect-error`、`eslint-disable`、
   删除/绕过测试、放宽类型（把 `T` 改成 `T | undefined` 来消音）

## 修复模式优先级阶梯

按错误类别选模式，禁止一刀切：

### 模式 A：TS1484 类型导入（verbatimModuleSyntax）
`import type { X }` 或 `import { type X, y }`。纯类型层操作，零运行时影响。
先全部清掉这类（最便宜）。

### 模式 B：真 undefined 风险 → 显式守卫
适用：Map/对象按键取值、稀疏数组、按外部输入索引、`.find()`/`.match()` 结果。
做法（按优先序）：
- 早返回 / 抛领域错误（`throw new Error('<域>: ...')`，英文消息）
- 有明确文档语义时给回退值，并加一行注释说明回退语义
**这类修复是本次升级的核心价值**——发现 undefined 真的可达时，单独记录到报告里。

### 模式 C：可证明在界的访问 → 带理由的窄断言
适用：循环条件就是 `i < arr.length`、紧邻的 `has()/includes()/length` 检查、
构造时同步填充的并行数组。
做法：`arr[i]!`（断言）或局部 `const v = arr[i]!`（重复读时）。
要求：**界检查必须在断言的文本紧邻处可见**（for 条件、上一行的 if）。
不满足「紧邻可见」就用模式 B。

### 模式 D：数值热内循环 → 优先 `!`，禁止加运行时分支
量子/数值内核（TypedArray 矩阵运算、态矢量循环）的内层循环：索引由循环
边界证明在界。此时用 `!`；**不得**在内层循环体里加 `if (v === undefined)`
守卫——那是每迭代的性能税，违背本次「性能提升」目标。守卫只加在函数边界。

### 模式 E：下游连锁（TS2322/2345/2538）
undefined 从源头流到下游。**在源头修**（产生 undefined 的那一行），不在下游
塞断言或拓宽类型。TS2538（undefined 当索引用）几乎总是模式 B 的真风险。

## 工作顺序

1. Read 本手册 + 目标项目 tsconfig
2. 建 `tsconfig.typecheck.json`（见下方模板）+ 更新 package.json 的 typecheck 脚本
3. `npx tsc --noEmit -p tsconfig.typecheck.json` 拿全量错误清单
4. 先清模式 A（TS1484），再按文件逐个清 B/C/D/E（同文件的错误一次修完）
5. 修复途中每 2-3 个文件跑一次 tsc 确认收敛
6. 最终门禁：tsc 0 errors + `npm test` 全绿

## tsconfig.typecheck.json 模板

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "declaration": false,
    "rootDir": "."
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "out"]
}
```

package.json 的 `"typecheck"` 脚本改为：
`"typecheck": "tsc --noEmit -p tsconfig.typecheck.json"`

## 报告格式（最终回复必须包含）

- 修复错误数（按模式 A/B/C/D/E 分类计数）
- 模式 B 中发现的**真实缺陷**清单（undefined 实际可达的场景，file:line + 一句话）
- 是否有无法安全修复而保留的错误（应为 0；若有，逐条说明原因）
- `npm test` 结果（通过/失败数）
- 是否发现测试本身的类型问题及处理方式

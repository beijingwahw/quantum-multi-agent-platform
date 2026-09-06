import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', 'eslint.strict-trial.mjs'],
  },

  // ---- 通用(所有文件):基础规则 + 环境全局 ----
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ---- 类型感知规则(仅 TS):recommendedTypeChecked 基座
  // 含 no-floating-promises / no-misused-promises / no-unsafe-* / 三斜线守卫等。
  // 有意不开 no-non-null-assertion:本仓在 noUncheckedIndexedAccess 下以 `!`
  // 标注"索引必然存在"是热内核的既定约定(逐位确定性路径不引入分支)，
  // 全量改写成守卫式访问会增大数值回归面而无实际收益。
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      // 显式指向全仓 tsconfig(src+tests+examples+experiments);
      // projectService 只认"最近的 tsconfig",而根 tsconfig 排除了测试文件
      parserOptions: {
        project: ['./tsconfig.typecheck.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // 死逻辑类:恒真/恒假条件、无效断言、无意义比较
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',

      // 值语义类:|| 吞掉合法的 0/''/false、可选链化、void 陷阱
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',

      // 字符串化陷阱:模板串里拼出 "[object Object]"
      '@typescript-eslint/no-base-to-string': 'error',

      // 异步纪律:无 await 的 async、Promise 丢弃(基座已含 floating/misused)
      '@typescript-eslint/require-await': 'error',

      // 安全:catch 回调与 reduce 的类型收窄
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/prefer-for-of': 'error',

      // 风格(自动修复):数组类型写法、泛型构造、可推断标注
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/consistent-generic-constructors': ['error', 'constructor'],
      '@typescript-eslint/no-inferrable-types': 'error',
    },
  },

  // ---- 测试/示例/实验:允许显式 any(模拟数据与探索性代码),保留其余全部纪律 ----
  {
    files: ['tests/**/*.ts', 'examples/**/*.ts', 'experiments/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // node:test 的 describe/it/test 本身返回由运行器管理的 Promise——
      // "floating" 恰是测试注册的正规形态,逐个 void/await 无意义
      '@typescript-eslint/no-floating-promises': 'off',
      // 断言的职责就是验证"类型上不可能"的不变量;统一 async 测试风格是惯例
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // 测试中常解构模块方法/对象方法做引用与桩替换,this 语义由测试自身保证
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      // 演示/实验输出直接模板插值数组与对象,收窄无意义
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-entry': 'off',
    },
  },

  // ---- 纯 JS(脚本):类型感知规则不适用 ----
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);

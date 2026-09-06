import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // dist/ is this repo's compiled build output (tsconfig outDir) — build
    // artifacts are never linted, same as the template's out/
    ignores: ['out/', 'dist/', 'node_modules/'],
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

  // ---- 类型感知规则(仅 TS):recommendedTypeChecked 基座 ----
  // 有意不开 no-non-null-assertion:本仓在 noUncheckedIndexedAccess 下以 `!`
  // 标注"索引必然存在"是数值内核的既定约定(不引入分支、保持逐位确定性),
  // 全量改写成守卫式访问会增大数值回归面而无实际收益。
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
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

  // ---- 测试:允许断言"类型上不可能"的不变量,保留其余纪律 ----
  {
    files: ['test/**/*.ts'],
    rules: {
      // node:test 的 test/it 返回由运行器管理的 Promise——"floating"
      // 恰是测试注册的正规形态
      '@typescript-eslint/no-floating-promises': 'off',
      // 断言的职责就是验证"类型上不可能"的不变量
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // 测试常解构模块方法做引用与桩替换,this 语义由测试自身保证
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
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

// 分级日志：热路径（任务提交/分配/完成）在高吞吐场景下产生海量日志，
// Windows管道下单行输出可达数十微秒，是调度吞吐的主要瓶颈之一。
// 默认info级别只保留生命周期日志；基准测试与生产建议warn。
//
// 结构化输出（Q7/Wave4.5）：
// - 每行前缀 [ISO-8601 UTC 毫秒] [level] [tag]，人类可读、grep 友好，
//   级别词汇与 JSON 模式一致（小写）；
// - QUANTUM_LOG_JSON=1（或 setLogJsonMode(true)）切换单行 JSON：
//   { ts, level, tag, msg, ...fields }（pino 式），供日志采集器消费；
// - 热路径纪律：emit 仅由级别放行分支调用——JSON 序列化只发生在
//   放行之后，被压制级别零序列化开销；默认（人类可读）模式每行仅
//   一次 toISOString + 模板拼接，不做任何对象序列化。

export type LogLevel = 'silent' | 'warn' | 'info' | 'debug';

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function resolveInitialLevel(): number {
  const fromEnv = process.env.QUANTUM_LOG_LEVEL as LogLevel | undefined;
  if (fromEnv && fromEnv in LEVEL_ORDER) return LEVEL_ORDER[fromEnv];
  return LEVEL_ORDER.info;
}

let currentLevel: number = resolveInitialLevel();

export function setLogLevel(level: LogLevel): void {
  currentLevel = LEVEL_ORDER[level];
}

export function getLogLevel(): LogLevel {
  return (
    (Object.keys(LEVEL_ORDER) as LogLevel[]).find((key) => LEVEL_ORDER[key] === currentLevel) ??
    'info'
  );
}

/** 单行 JSON 输出模式：QUANTUM_LOG_JSON=1 于模块加载时读取 */
let jsonMode = process.env.QUANTUM_LOG_JSON === '1';

/** 运行时切换 JSON 模式（与 QUANTUM_LOG_JSON=1 等效，供测试与热配置） */
export function setLogJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isLogJsonMode(): boolean {
  return jsonMode;
}

/** 末位纯对象识别：logInfo(tag, 'msg', { fields }) 的末参作为结构化字段 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * 输出整形（Q7）：默认人类可读 `[ts] [level] [tag] + 余参透传`；
 * JSON 模式单行 `{ ts, level, tag, msg, ...fields }`。保留字段
 * （ts/level/tag/msg）不参与字段合并——调用方不得借字段对象伪造元数据。
 * JSON.stringify 失败（循环引用/BigInt）时退回人类可读行，日志器不抛错。
 */
function emit(
  stream: (line: string, ...rest: unknown[]) => void,
  level: string,
  tag: string,
  args: unknown[],
): void {
  const ts = new Date().toISOString();
  if (jsonMode) {
    let fields: Record<string, unknown> = {};
    let msgArgs = args;
    const last = args[args.length - 1];
    if (args.length > 1 && isPlainObject(last)) {
      fields = last;
      msgArgs = args.slice(0, -1);
    }
    const record: Record<string, unknown> = {
      ts,
      level,
      tag,
      msg: msgArgs.length === 1 ? msgArgs[0] : msgArgs,
    };
    // 字段对象只追加非保留键——ts/level/tag/msg 恒为日志器自己的口径
    for (const [k, v] of Object.entries(fields)) {
      if (!(k in record)) record[k] = v;
    }
    try {
      stream(JSON.stringify(record));
    } catch {
      // 不可序列化负载（循环引用/BigInt）：退回人类可读行，不吞日志
      stream(`[${ts}] [${level}] [${tag}]`, ...args);
    }
    return;
  }
  stream(`[${ts}] [${level}] [${tag}]`, ...args);
}

// 输出流适配器（模块常量，R13）：此前每条放行的日志行都在调用点新建
// 一个闭包适配 console.*——日志是文档化的吞吐瓶颈（文件头注释），
// 热路径上纯属分配搅动。console.* 在调用时解析：测试对 console 的
// monkey-patch 语义与逐调用新建闭包完全一致。
const writeOut = (line: string, ...rest: unknown[]): void => {
  console.log(line, ...rest);
};
const writeWarn = (line: string, ...rest: unknown[]): void => {
  console.warn(line, ...rest);
};
const writeErr = (line: string, ...rest: unknown[]): void => {
  console.error(line, ...rest);
};

export function logDebug(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.debug) {
    emit(writeOut, 'debug', tag, args);
  }
}

export function logInfo(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.info) {
    emit(writeOut, 'info', tag, args);
  }
}

export function logWarn(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.warn) {
    emit(writeWarn, 'warn', tag, args);
  }
}

export function logError(tag: string, ...args: unknown[]): void {
  // 错误永远输出：silent 只应压制噪音，不应吞掉故障信号
  emit(writeErr, 'error', tag, args);
}

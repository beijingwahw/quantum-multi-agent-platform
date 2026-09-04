// 分级日志：热路径（任务提交/分配/完成）在高吞吐场景下产生海量日志，
// Windows管道下单行输出可达数十微秒，是调度吞吐的主要瓶颈之一。
// 默认info级别只保留生命周期日志；基准测试与生产建议warn。

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

/**
 * 行前缀（Q7）：ISO 时间戳 + 级别 + 标签——生产可观测性的最小结构。
 * QUANTUM_LOG_JSON=1 时输出单行 JSON（pino 式），供日志采集器解析；
 * 默认保持人类可读格式（热路径开销考量：前缀拼接 <10ns 量级）。
 */
function emit(
  stream: (line: string, ...rest: unknown[]) => void,
  level: string,
  tag: string,
  args: unknown[],
): void {
  if (jsonMode) {
    const record: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      tag,
      msg: args.length === 1 ? args[0] : args,
    };
    stream(JSON.stringify(record));
    return;
  }
  stream(`[${new Date().toISOString()}] [${level.toUpperCase()}] [${tag}]`, ...args);
}

const jsonMode = process.env.QUANTUM_LOG_JSON === '1';

export function logDebug(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.debug) {
    emit(
      (line) => {
        console.log(line);
      },
      'debug',
      tag,
      args,
    );
  }
}

export function logInfo(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.info) {
    emit(
      (line) => {
        console.log(line);
      },
      'info',
      tag,
      args,
    );
  }
}

export function logWarn(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.warn) {
    emit(
      (line) => {
        console.warn(line);
      },
      'warn',
      tag,
      args,
    );
  }
}

export function logError(tag: string, ...args: unknown[]): void {
  // 错误永远输出：silent 只应压制噪音，不应吞掉故障信号
  emit(
    (line) => {
      console.error(line);
    },
    'error',
    tag,
    args,
  );
}

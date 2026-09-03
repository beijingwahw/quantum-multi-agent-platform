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
  currentLevel = LEVEL_ORDER[level] ?? LEVEL_ORDER.info;
}

export function getLogLevel(): LogLevel {
  return (
    (Object.keys(LEVEL_ORDER) as LogLevel[]).find((key) => LEVEL_ORDER[key] === currentLevel) ||
    'info'
  );
}

export function logDebug(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.debug) {
    console.log(`[${tag}]`, ...args);
  }
}

export function logInfo(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.info) {
    console.log(`[${tag}]`, ...args);
  }
}

export function logWarn(tag: string, ...args: unknown[]): void {
  if (currentLevel >= LEVEL_ORDER.warn) {
    console.warn(`[${tag}]`, ...args);
  }
}

export function logError(tag: string, ...args: unknown[]): void {
  // 错误永远输出：silent 只应压制噪音，不应吞掉故障信号
  console.error(`[${tag}]`, ...args);
}

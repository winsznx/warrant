type Level = "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, ...rest: unknown[]): void {
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}] [${scope}] ${message}`;
  if (level === "error") console.error(line, ...rest);
  else if (level === "warn") console.warn(line, ...rest);
  else console.log(line, ...rest);
}

export interface Logger {
  info: (message: string, ...rest: unknown[]) => void;
  warn: (message: string, ...rest: unknown[]) => void;
  error: (message: string, ...rest: unknown[]) => void;
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, ...rest) => emit("info", scope, message, ...rest),
    warn: (message, ...rest) => emit("warn", scope, message, ...rest),
    error: (message, ...rest) => emit("error", scope, message, ...rest),
  };
}

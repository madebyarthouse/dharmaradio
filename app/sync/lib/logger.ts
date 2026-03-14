type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL;
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return "info";
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ) {
    if (levelOrder[level] < levelOrder[getLogLevel()]) {
      return;
    }
    const timestamp = new Date().toISOString();
    console[level](
      JSON.stringify({
        timestamp,
        level,
        context: this.context,
        message,
        ...meta,
      })
    );
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  }

  error(message: string, error: Error, meta?: Record<string, unknown>) {
    this.log("error", message, {
      error: {
        message: error.message,
        stack: error.stack,
      },
      ...meta,
    });
  }
}

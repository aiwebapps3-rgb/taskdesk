/**
 * Logger that only ever writes to stderr.
 * In stdio mode stdout carries JSON-RPC messages, so a single stray print there
 * breaks the connection with the MCP client.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: Level = "info";

export function setLogLevel(level: Level): void {
  minLevel = level;
}

function write(level: Level, message: string, extra?: unknown): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  const line = `[taskdesk] ${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  if (extra === undefined) {
    console.error(line);
  } else {
    console.error(line, extra);
  }
}

export const logger = {
  debug: (m: string, e?: unknown) => write("debug", m, e),
  info: (m: string, e?: unknown) => write("info", m, e),
  warn: (m: string, e?: unknown) => write("warn", m, e),
  error: (m: string, e?: unknown) => write("error", m, e),
};

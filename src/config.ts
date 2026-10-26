import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

/**
 * Project root, worked out from this file's location (src/ or dist/ are one level down).
 * Relative paths in config are resolved against it, so the server works no matter
 * which folder the MCP client starts it from.
 */
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.join(PROJECT_ROOT, ".env");
if (existsSync(envFile)) {
  // quiet: keep dotenv from printing anything. stdout belongs to the MCP protocol.
  dotenv.config({ path: envFile, quiet: true });
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const EnvSchema = z
  .object({
    TASKDESK_DB_PATH: z.string().min(1).default("./data/taskdesk.db"),
    TASKDESK_AUDIT_PATH: z.string().min(1).default("./logs/audit.jsonl"),
    TASKDESK_TIMEZONE: z
      .string()
      .default("Asia/Karachi")
      .refine(isValidTimeZone, { message: "must be an IANA time zone such as Asia/Karachi" }),
    TASKDESK_TRANSPORT: z.enum(["stdio", "http"]).default("stdio"),
    TASKDESK_HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    TASKDESK_HTTP_TOKEN: z.string().optional(),
    TASKDESK_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.TASKDESK_TRANSPORT === "http" && (!env.TASKDESK_HTTP_TOKEN || env.TASKDESK_HTTP_TOKEN.length < 24)) {
      ctx.addIssue({
        code: "custom",
        path: ["TASKDESK_HTTP_TOKEN"],
        message: "is required in http mode and must be at least 24 characters",
      });
    }
  });

export interface Config {
  dbPath: string;
  auditPath: string;
  timezone: string;
  transport: "stdio" | "http";
  httpPort: number;
  httpToken: string | undefined;
  logLevel: "debug" | "info" | "warn" | "error";
}

function resolvePath(p: string): string {
  if (p === ":memory:") return p;
  return path.isAbsolute(p) ? p : path.resolve(PROJECT_ROOT, p);
}

/** Reads and validates config once at startup. Fails fast with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): Config {
  const merged = { ...env };
  if (argv.includes("--http")) merged.TASKDESK_TRANSPORT = "http";

  const parsed = EnvSchema.safeParse(merged);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")} ${i.message}`).join("\n");
    throw new Error(`Invalid TaskDesk configuration:\n${problems}`);
  }
  const e = parsed.data;
  return {
    dbPath: resolvePath(e.TASKDESK_DB_PATH),
    auditPath: resolvePath(e.TASKDESK_AUDIT_PATH),
    timezone: e.TASKDESK_TIMEZONE,
    transport: e.TASKDESK_TRANSPORT,
    httpPort: e.TASKDESK_HTTP_PORT,
    httpToken: e.TASKDESK_HTTP_TOKEN,
    logLevel: e.TASKDESK_LOG_LEVEL,
  };
}

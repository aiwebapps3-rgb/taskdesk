import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DomainError } from "./errors.js";
import { logger } from "./logger.js";
import { redact } from "./redact.js";

export type Outcome = "ok" | "preview" | "error" | "bug";

export interface AuditEntry {
  ts: string;
  tool: string;
  args: unknown;
  outcome: Outcome;
  message?: string;
  errorRef?: string;
  durationMs: number;
}

export interface AuditSink {
  write(entry: AuditEntry): void;
}

/** Appends one JSON object per line. Creates the folder if needed. */
export class JsonlAuditSink implements AuditSink {
  constructor(private readonly filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }
  write(entry: AuditEntry): void {
    try {
      appendFileSync(this.filePath, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      // Never let logging break a tool call.
      logger.error("Could not write audit log", err);
    }
  }
}

/** Keeps entries in memory. Used by tests. */
export class MemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];
  write(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}

/** What a tool handler returns before it is turned into an MCP result. */
export interface ToolOutput {
  text: string;
  outcome?: "ok" | "preview";
}

/**
 * Decorator applied to every tool in server.ts.
 * - times the call
 * - writes a redacted audit entry
 * - turns expected errors into a readable isError result the agent can recover from
 * - hides unexpected errors behind a reference id (details go to stderr only)
 */
export function withAudit<A>(
  toolName: string,
  sink: AuditSink,
  handler: (args: A) => Promise<ToolOutput>,
): (args: A) => Promise<CallToolResult> {
  return async (args: A) => {
    const started = Date.now();
    const base = { ts: new Date(started).toISOString(), tool: toolName, args: redact(args) };
    try {
      const out = await handler(args);
      const outcome = out.outcome ?? "ok";
      sink.write({ ...base, outcome, durationMs: Date.now() - started });
      return { content: [{ type: "text", text: out.text }] };
    } catch (err) {
      const durationMs = Date.now() - started;
      if (err instanceof DomainError) {
        sink.write({ ...base, outcome: "error", message: err.message, durationMs });
        return { isError: true, content: [{ type: "text", text: err.message }] };
      }
      const errorRef = randomUUID().slice(0, 8);
      logger.error(`Unexpected error in ${toolName} (ref ${errorRef})`, err);
      sink.write({ ...base, outcome: "bug", errorRef, durationMs });
      return {
        isError: true,
        content: [{ type: "text", text: `Something went wrong inside TaskDesk (ref ${errorRef}). Please tell the user; details are in the server log.` }],
      };
    }
  };
}

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ToolOutput } from "../lib/audit.js";
import type { TaskService } from "../services/taskService.js";

export interface ToolContext {
  service: TaskService;
}

/** One entry in the tool registry. server.ts registers every entry the same way. */
export interface ToolDefinition<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  annotations: ToolAnnotations;
  handler: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<ToolOutput>;
}

/** Keeps each tool's handler typed from its own schema. */
export function defineTool<S extends z.ZodRawShape>(def: ToolDefinition<S>): ToolDefinition<S> {
  return def;
}

/** Text for the agent: a one-line summary, then the data as JSON. */
export function respond(message: string, data?: unknown, outcome: "ok" | "preview" = "ok"): ToolOutput {
  const text = data === undefined ? message : `${message}\n\n${JSON.stringify(data, null, 2)}`;
  return { text, outcome };
}

/** Annotation presets. Hints only: the real safety checks are in the service. */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const DESTRUCTIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

// Shared field schemas so every tool describes them the same way.
export const fields = {
  taskId: z.number().int().positive().describe("Task id, a whole number such as 7. Use list_tasks or search_tasks to find it."),
  status: z
    .enum(["todo", "in_progress", "blocked", "done"])
    .describe("Task status: todo, in_progress, blocked or done."),
  priority: z.enum(["low", "medium", "high"]).describe("Priority: low, medium or high."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD, for example 2026-10-30.")
    .describe("Date in YYYY-MM-DD format, for example 2026-10-30. Convert words like 'next Friday' to a real date first."),
  dryRun: z
    .boolean()
    .default(false)
    .describe("If true, show what would change without saving anything. Use this when the user asks to preview or not save."),
};

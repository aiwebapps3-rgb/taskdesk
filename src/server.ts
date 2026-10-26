import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withAudit, type AuditSink } from "./lib/audit.js";
import { registerDailyStandupPrompt } from "./prompts/dailyStandup.js";
import { registerTaskResource } from "./resources/taskResource.js";
import type { TaskService } from "./services/taskService.js";
import { TOOLS } from "./tools/index.js";

export const SERVER_NAME = "taskdesk";
export const SERVER_VERSION = "0.1.0";

export interface ServerDeps {
  service: TaskService;
  audit: AuditSink;
}

/**
 * Builds the MCP server. Dependencies are passed in, so tests can use an
 * in-memory store and audit sink without touching real files.
 */
export function createServer({ service, audit }: ServerDeps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "TaskDesk manages the team's task list. Read tools are safe to call any time. " +
        "Write tools accept dry_run for previews. delete_task needs a preview first and confirm: true only after the user agrees. " +
        "Change one task per call and check with the user before changing many tasks. Dates are YYYY-MM-DD.",
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      withAudit(tool.name, audit, (args) => tool.handler(args, { service })),
    );
  }

  registerTaskResource(server, service);
  registerDailyStandupPrompt(server);
  return server;
}

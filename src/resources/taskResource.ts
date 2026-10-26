import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DomainError } from "../lib/errors.js";
import type { TaskService } from "../services/taskService.js";

/** taskdesk://tasks/{id}: a task and its notes as JSON, readable without calling a tool. */
export function registerTaskResource(server: McpServer, service: TaskService): void {
  server.registerResource(
    "task",
    new ResourceTemplate("taskdesk://tasks/{id}", {
      list: async () => ({
        resources: service.listTasks({ limit: 100 }).tasks.map((t) => ({
          uri: `taskdesk://tasks/${t.id}`,
          name: `Task ${t.id}: ${t.title}`,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "Task",
      description: "One task with its notes, as JSON.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const raw = Array.isArray(variables.id) ? variables.id[0] : variables.id;
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Invalid task id in ${uri.href}`);
      }
      try {
        const task = service.getTask(id);
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(task, null, 2) }] };
      } catch (err) {
        // Resources report errors as protocol errors; keep the message short and safe.
        if (err instanceof DomainError) throw new Error(err.message, { cause: err });
        throw new Error("Could not read task.", { cause: err });
      }
    },
  );
}
